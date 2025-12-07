/**
 * DashboardContext - State management for CareerOS Dashboard
 * 
 * Provides centralized state management using React Context + hooks pattern.
 * Manages:
 * - SelfProfile data
 * - Loading states
 * - Error states
 * - Refresh triggers
 * 
 * Requirements: 11.4
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { SelfProfile, MarketProfile, QueueStatus, SkillProfile, ProjectSummary } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface WorkflowStatus {
  selfProfileComplete: boolean;
  marketProfileComplete: boolean;
  actionPlanComplete: boolean;
}

export interface DashboardError {
  message: string;
  timestamp: string;
  type: 'load' | 'refresh' | 'action';
}

export interface DashboardState {
  // Data
  selfProfile: SelfProfile | null;
  marketProfiles: MarketProfile[];
  errorCount: number;
  
  // Loading states
  isLoading: boolean;
  isRefreshing: boolean;
  
  // Workflow status
  workflowStatus: WorkflowStatus;
  
  // Queue status (for indexing progress)
  queueStatus: QueueStatus | null;
  
  // Errors
  error: DashboardError | null;
  
  // Detail view states
  selectedSkill: SkillProfile | null;
  selectedProject: ProjectSummary | null;
}

export interface DashboardActions {
  // Data loading
  loadDashboardData: () => Promise<void>;
  
  // Refresh actions
  refreshSelfProfile: () => Promise<void>;
  
  // State setters
  setSelfProfile: (profile: SelfProfile | null) => void;
  setMarketProfiles: (profiles: MarketProfile[]) => void;
  setErrorCount: (count: number) => void;
  setQueueStatus: (status: QueueStatus | null) => void;
  setError: (error: DashboardError | null) => void;
  setWorkflowStatus: (status: Partial<WorkflowStatus>) => void;
  
  // Clear error
  clearError: () => void;
  
  // Detail view actions
  selectSkill: (skill: SkillProfile | null) => void;
  selectProject: (project: ProjectSummary | null) => void;
}

export interface DashboardContextValue extends DashboardState, DashboardActions {}

// ============================================================================
// Context
// ============================================================================

const DashboardContext = createContext<DashboardContextValue | null>(null);

// ============================================================================
// Provider Props
// ============================================================================

export interface DashboardProviderProps {
  children: ReactNode;
  
  // Callbacks to interact with plugin services
  onLoadSelfProfile: () => Promise<SelfProfile | null>;
  onLoadMarketProfiles: () => Promise<MarketProfile[]>;
  onLoadErrorCount: () => Promise<number>;
  onRefreshSelfProfile: () => Promise<SelfProfile>;
}

// ============================================================================
// Provider Component
// ============================================================================

export function DashboardProvider({
  children,
  onLoadSelfProfile,
  onLoadMarketProfiles,
  onLoadErrorCount,
  onRefreshSelfProfile,
}: DashboardProviderProps): JSX.Element {
  // State
  const [selfProfile, setSelfProfile] = useState<SelfProfile | null>(null);
  const [marketProfiles, setMarketProfiles] = useState<MarketProfile[]>([]);
  const [errorCount, setErrorCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [error, setError] = useState<DashboardError | null>(null);
  const [workflowStatus, setWorkflowStatusState] = useState<WorkflowStatus>({
    selfProfileComplete: false,
    marketProfileComplete: false,
    actionPlanComplete: false,
  });
  
  // Detail view states
  const [selectedSkill, setSelectedSkill] = useState<SkillProfile | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectSummary | null>(null);

  // Load all dashboard data
  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Load data in parallel
      const [profile, profiles, errors] = await Promise.all([
        onLoadSelfProfile(),
        onLoadMarketProfiles(),
        onLoadErrorCount(),
      ]);
      
      setSelfProfile(profile);
      setMarketProfiles(profiles);
      setErrorCount(errors);
      
      // Update workflow status based on loaded data
      setWorkflowStatusState({
        selfProfileComplete: profile !== null,
        marketProfileComplete: profiles.length > 0,
        actionPlanComplete: false, // TODO: Check for action plans
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError({
        message: `Failed to load dashboard data: ${errorMessage}`,
        timestamp: new Date().toISOString(),
        type: 'load',
      });
    } finally {
      setIsLoading(false);
    }
  }, [onLoadSelfProfile, onLoadMarketProfiles, onLoadErrorCount]);

  // Refresh self profile (rebuild from NoteCards)
  const refreshSelfProfile = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    
    try {
      const profile = await onRefreshSelfProfile();
      setSelfProfile(profile);
      
      // Update workflow status
      setWorkflowStatusState(prev => ({
        ...prev,
        selfProfileComplete: true,
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError({
        message: `Failed to refresh self profile: ${errorMessage}`,
        timestamp: new Date().toISOString(),
        type: 'refresh',
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefreshSelfProfile]);

  // Update workflow status partially
  const setWorkflowStatus = useCallback((status: Partial<WorkflowStatus>) => {
    setWorkflowStatusState(prev => ({ ...prev, ...status }));
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  // Detail view actions
  const selectSkill = useCallback((skill: SkillProfile | null) => {
    setSelectedSkill(skill);
  }, []);
  
  const selectProject = useCallback((project: ProjectSummary | null) => {
    setSelectedProject(project);
  }, []);

  // Context value
  const value: DashboardContextValue = {
    // State
    selfProfile,
    marketProfiles,
    errorCount,
    isLoading,
    isRefreshing,
    workflowStatus,
    queueStatus,
    error,
    selectedSkill,
    selectedProject,
    
    // Actions
    loadDashboardData,
    refreshSelfProfile,
    setSelfProfile,
    setMarketProfiles,
    setErrorCount,
    setQueueStatus,
    setError,
    setWorkflowStatus,
    clearError,
    selectSkill,
    selectProject,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access dashboard context
 * Must be used within DashboardProvider
 */
export function useDashboard(): DashboardContextValue {
  const context = useContext(DashboardContext);
  
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  
  return context;
}

// ============================================================================
// Selector Hooks (for performance optimization)
// ============================================================================

/**
 * Hook to get only the self profile
 */
export function useSelfProfile(): SelfProfile | null {
  const { selfProfile } = useDashboard();
  return selfProfile;
}

/**
 * Hook to get loading state
 */
export function useIsLoading(): boolean {
  const { isLoading, isRefreshing } = useDashboard();
  return isLoading || isRefreshing;
}

/**
 * Hook to get workflow status
 */
export function useWorkflowStatus(): WorkflowStatus {
  const { workflowStatus } = useDashboard();
  return workflowStatus;
}
