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
import { SelfProfile, MarketProfile, QueueStatus, SkillProfile, ProjectSummary, ErrorLogSummary, MarketProfileSummary, GapAnalysisSummary, ActionPlanSummary } from '../types';

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
  marketProfileSummaries: MarketProfileSummary[];
  gapAnalyses: GapAnalysisSummary[];
  actionPlans: ActionPlanSummary[];
  activePlanPath: string | null;
  errorCount: number;
  
  // Error log data
  errorLogSummary: ErrorLogSummary | null;
  isErrorLogModalOpen: boolean;
  
  // Loading states
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingErrorLog: boolean;
  isBuildingMarketProfile: boolean;
  
  // Workflow status
  workflowStatus: WorkflowStatus;
  
  // Queue status (for indexing progress)
  queueStatus: QueueStatus | null;
  
  // Errors
  error: DashboardError | null;
  
  // Detail view states
  selectedSkill: SkillProfile | null;
  selectedProject: ProjectSummary | null;
  selectedMarketProfile: MarketProfileSummary | null;
}

export interface DashboardActions {
  // Data loading
  loadDashboardData: () => Promise<void>;
  
  // Refresh actions
  refreshSelfProfile: () => Promise<void>;
  
  // Error log actions
  loadErrorLog: () => Promise<void>;
  openErrorLogModal: () => void;
  closeErrorLogModal: () => void;
  
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
  selectMarketProfile: (profile: MarketProfileSummary | null) => void;
  
  // Workflow actions
  indexNotes: () => Promise<void>;
  extractJDs: () => Promise<void>;
  generatePlan: () => Promise<void>;
  
  // Market profile actions
  buildMarketProfile: (role: string, location: string) => Promise<void>;
  
  // Action plan actions
  setActivePlan: (planPath: string) => Promise<void>;
  
  // Workflow action loading states
  isIndexingNotes: boolean;
  isExtractingJDs: boolean;
  isGeneratingPlan: boolean;
}

export interface WorkflowActionStates {
  isIndexingNotes: boolean;
  isExtractingJDs: boolean;
  isGeneratingPlan: boolean;
}

export interface DashboardContextValue extends DashboardState, Omit<DashboardActions, 'isIndexingNotes' | 'isExtractingJDs' | 'isGeneratingPlan'>, WorkflowActionStates {
  isBuildingMarketProfile: boolean;
}

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
  onLoadMarketProfileSummaries: () => Promise<MarketProfileSummary[]>;
  onLoadGapAnalyses: () => Promise<GapAnalysisSummary[]>;
  onLoadActionPlans: () => Promise<ActionPlanSummary[]>;
  onLoadErrorCount: () => Promise<number>;
  onLoadErrorLog: () => Promise<ErrorLogSummary | null>;
  onRefreshSelfProfile: () => Promise<SelfProfile>;
  
  // Workflow action callbacks
  onIndexNotes?: () => Promise<void>;
  onExtractJDs?: () => Promise<void>;
  onGeneratePlan?: () => Promise<void>;
  onCheckActionPlans?: () => Promise<boolean>;
  
  // Market profile callbacks
  onBuildMarketProfile?: (role: string, location: string) => Promise<void>;
  
  // Action plan callbacks
  onSetActivePlan?: (planPath: string) => Promise<void>;
  onLoadActivePlan?: () => Promise<string | null>;
}

// ============================================================================
// Provider Component
// ============================================================================

export function DashboardProvider({
  children,
  onLoadSelfProfile,
  onLoadMarketProfiles,
  onLoadMarketProfileSummaries,
  onLoadGapAnalyses,
  onLoadActionPlans,
  onLoadErrorCount,
  onLoadErrorLog,
  onRefreshSelfProfile,
  onIndexNotes,
  onExtractJDs,
  onGeneratePlan,
  onCheckActionPlans,
  onBuildMarketProfile,
  onSetActivePlan,
  onLoadActivePlan,
}: DashboardProviderProps): JSX.Element {
  // State
  const [selfProfile, setSelfProfile] = useState<SelfProfile | null>(null);
  const [marketProfiles, setMarketProfiles] = useState<MarketProfile[]>([]);
  const [marketProfileSummaries, setMarketProfileSummaries] = useState<MarketProfileSummary[]>([]);
  const [gapAnalyses, setGapAnalyses] = useState<GapAnalysisSummary[]>([]);
  const [actionPlans, setActionPlans] = useState<ActionPlanSummary[]>([]);
  const [activePlanPath, setActivePlanPath] = useState<string | null>(null);
  const [errorCount, setErrorCount] = useState<number>(0);
  const [errorLogSummary, setErrorLogSummary] = useState<ErrorLogSummary | null>(null);
  const [isErrorLogModalOpen, setIsErrorLogModalOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isLoadingErrorLog, setIsLoadingErrorLog] = useState<boolean>(false);
  const [isBuildingMarketProfile, setIsBuildingMarketProfile] = useState<boolean>(false);
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
  const [selectedMarketProfile, setSelectedMarketProfile] = useState<MarketProfileSummary | null>(null);
  
  // Workflow action loading states
  const [isIndexingNotes, setIsIndexingNotes] = useState<boolean>(false);
  const [isExtractingJDs, setIsExtractingJDs] = useState<boolean>(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState<boolean>(false);

  // Load all dashboard data
  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Load data in parallel
      const [profile, profiles, profileSummaries, gapAnalysisData, actionPlanData, errors] = await Promise.all([
        onLoadSelfProfile(),
        onLoadMarketProfiles(),
        onLoadMarketProfileSummaries(),
        onLoadGapAnalyses(),
        onLoadActionPlans(),
        onLoadErrorCount(),
      ]);
      
      // Check for action plans if callback provided
      let hasActionPlans = false;
      if (onCheckActionPlans) {
        try {
          hasActionPlans = await onCheckActionPlans();
        } catch {
          // Ignore errors checking action plans
        }
      }
      
      // Load active plan path
      let activePlan: string | null = null;
      if (onLoadActivePlan) {
        try {
          activePlan = await onLoadActivePlan();
        } catch {
          // Ignore errors loading active plan
        }
      }
      
      setSelfProfile(profile);
      setMarketProfiles(profiles);
      setMarketProfileSummaries(profileSummaries);
      setGapAnalyses(gapAnalysisData);
      setActionPlans(actionPlanData);
      setActivePlanPath(activePlan);
      setErrorCount(errors);
      
      // Update workflow status based on loaded data
      setWorkflowStatusState({
        selfProfileComplete: profile !== null,
        marketProfileComplete: profiles.length > 0 || profileSummaries.length > 0,
        actionPlanComplete: hasActionPlans || actionPlanData.length > 0,
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
  }, [onLoadSelfProfile, onLoadMarketProfiles, onLoadMarketProfileSummaries, onLoadGapAnalyses, onLoadActionPlans, onLoadErrorCount, onCheckActionPlans, onLoadActivePlan]);

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

  // Load error log details
  const loadErrorLog = useCallback(async () => {
    setIsLoadingErrorLog(true);
    
    try {
      const summary = await onLoadErrorLog();
      setErrorLogSummary(summary);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError({
        message: `Failed to load error log: ${errorMessage}`,
        timestamp: new Date().toISOString(),
        type: 'load',
      });
    } finally {
      setIsLoadingErrorLog(false);
    }
  }, [onLoadErrorLog]);

  // Open error log modal
  const openErrorLogModal = useCallback(() => {
    setIsErrorLogModalOpen(true);
    // Load error log when modal opens
    loadErrorLog();
  }, [loadErrorLog]);

  // Close error log modal
  const closeErrorLogModal = useCallback(() => {
    setIsErrorLogModalOpen(false);
  }, []);

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
  
  const selectMarketProfile = useCallback((profile: MarketProfileSummary | null) => {
    setSelectedMarketProfile(profile);
  }, []);
  
  // Workflow action: Index Notes
  const indexNotes = useCallback(async () => {
    if (!onIndexNotes) {
      setError({
        message: 'Index Notes action not available',
        timestamp: new Date().toISOString(),
        type: 'action',
      });
      return;
    }
    
    setIsIndexingNotes(true);
    setError(null);
    
    try {
      await onIndexNotes();
      // Reload data after indexing
      await loadDashboardData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError({
        message: `Failed to index notes: ${errorMessage}`,
        timestamp: new Date().toISOString(),
        type: 'action',
      });
    } finally {
      setIsIndexingNotes(false);
    }
  }, [onIndexNotes, loadDashboardData]);
  
  // Workflow action: Extract JDs
  const extractJDs = useCallback(async () => {
    if (!onExtractJDs) {
      setError({
        message: 'Extract JDs action not available',
        timestamp: new Date().toISOString(),
        type: 'action',
      });
      return;
    }
    
    setIsExtractingJDs(true);
    setError(null);
    
    try {
      await onExtractJDs();
      // Reload data after extraction
      await loadDashboardData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError({
        message: `Failed to extract JDs: ${errorMessage}`,
        timestamp: new Date().toISOString(),
        type: 'action',
      });
    } finally {
      setIsExtractingJDs(false);
    }
  }, [onExtractJDs, loadDashboardData]);
  
  // Workflow action: Generate Plan
  const generatePlan = useCallback(async () => {
    if (!onGeneratePlan) {
      setError({
        message: 'Generate Plan action not available',
        timestamp: new Date().toISOString(),
        type: 'action',
      });
      return;
    }
    
    setIsGeneratingPlan(true);
    setError(null);
    
    try {
      await onGeneratePlan();
      // Reload data after plan generation
      await loadDashboardData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError({
        message: `Failed to generate plan: ${errorMessage}`,
        timestamp: new Date().toISOString(),
        type: 'action',
      });
    } finally {
      setIsGeneratingPlan(false);
    }
  }, [onGeneratePlan, loadDashboardData]);
  
  // Market profile action: Build Market Profile
  const buildMarketProfile = useCallback(async (role: string, location: string) => {
    if (!onBuildMarketProfile) {
      setError({
        message: 'Build Market Profile action not available',
        timestamp: new Date().toISOString(),
        type: 'action',
      });
      return;
    }
    
    setIsBuildingMarketProfile(true);
    setError(null);
    
    try {
      await onBuildMarketProfile(role, location);
      // Reload data after building market profile
      await loadDashboardData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError({
        message: `Failed to build market profile: ${errorMessage}`,
        timestamp: new Date().toISOString(),
        type: 'action',
      });
    } finally {
      setIsBuildingMarketProfile(false);
    }
  }, [onBuildMarketProfile, loadDashboardData]);
  
  // Action plan action: Set Active Plan
  const setActivePlan = useCallback(async (planPath: string) => {
    if (!onSetActivePlan) {
      setError({
        message: 'Set Active Plan action not available',
        timestamp: new Date().toISOString(),
        type: 'action',
      });
      return;
    }
    
    try {
      await onSetActivePlan(planPath);
      setActivePlanPath(planPath);
      // Update action plans to reflect active status
      setActionPlans(prev => prev.map(plan => ({
        ...plan,
        isActive: plan.planPath === planPath,
      })));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError({
        message: `Failed to set active plan: ${errorMessage}`,
        timestamp: new Date().toISOString(),
        type: 'action',
      });
    }
  }, [onSetActivePlan]);

  // Context value
  const value: DashboardContextValue = {
    // State
    selfProfile,
    marketProfiles,
    marketProfileSummaries,
    gapAnalyses,
    actionPlans,
    activePlanPath,
    errorCount,
    errorLogSummary,
    isErrorLogModalOpen,
    isLoading,
    isRefreshing,
    isLoadingErrorLog,
    isBuildingMarketProfile,
    workflowStatus,
    queueStatus,
    error,
    selectedSkill,
    selectedProject,
    selectedMarketProfile,
    
    // Workflow action loading states
    isIndexingNotes,
    isExtractingJDs,
    isGeneratingPlan,
    
    // Actions
    loadDashboardData,
    refreshSelfProfile,
    loadErrorLog,
    openErrorLogModal,
    closeErrorLogModal,
    setSelfProfile,
    setMarketProfiles,
    setErrorCount,
    setQueueStatus,
    setError,
    setWorkflowStatus,
    clearError,
    selectSkill,
    selectProject,
    selectMarketProfile,
    
    // Workflow actions
    indexNotes,
    extractJDs,
    generatePlan,
    
    // Market profile actions
    buildMarketProfile,
    
    // Action plan actions
    setActivePlan,
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
