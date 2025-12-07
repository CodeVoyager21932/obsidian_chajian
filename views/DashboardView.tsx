/**
 * DashboardView - Main React component for CareerOS Dashboard
 * 
 * Provides a visual overview of:
 * - Skills with proficiency levels
 * - Recent projects
 * - Workflow status (self-profile, market-profile, action plan)
 * - Error summary
 * 
 * Requirements: 11.4
 */

import React, { useEffect } from 'react';
import { ItemView, WorkspaceLeaf } from 'obsidian';
import { createRoot, Root } from 'react-dom/client';
import { SelfProfile, MarketProfile, SkillProfile, ProjectSummary } from '../types';
import { DashboardProvider, useDashboard, WorkflowStatus } from './DashboardContext';

// ============================================================================
// Constants
// ============================================================================

export const DASHBOARD_VIEW_TYPE = 'career-os-dashboard';

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Header section with title and refresh button
 */
function DashboardHeader(): JSX.Element {
  const { isRefreshing, refreshSelfProfile } = useDashboard();
  
  return (
    <div className="career-os-header">
      <h2>CareerOS Dashboard</h2>
      <button
        className="career-os-refresh-btn"
        onClick={refreshSelfProfile}
        disabled={isRefreshing}
        title="Rebuild Self Profile"
      >
        {isRefreshing ? '⟳ Refreshing...' : '⟳ Refresh'}
      </button>
    </div>
  );
}

/**
 * Error banner component
 */
function ErrorBanner(): JSX.Element | null {
  const { error, clearError } = useDashboard();
  
  if (!error) return null;
  
  return (
    <div className="career-os-error-banner">
      <span className="career-os-error-icon">⚠️</span>
      <span className="career-os-error-message">{error.message}</span>
      <button className="career-os-error-dismiss" onClick={clearError}>×</button>
    </div>
  );
}

/**
 * Loading indicator
 */
function LoadingIndicator(): JSX.Element {
  return (
    <div className="career-os-loading">
      <div className="career-os-spinner"></div>
      <span>Loading dashboard data...</span>
    </div>
  );
}

/**
 * Skills section - displays top skills with proficiency levels
 */
function SkillsSection(): JSX.Element {
  const { selfProfile } = useDashboard();
  
  const skills = selfProfile?.analysis_view?.top_skills || selfProfile?.skills.slice(0, 15) || [];
  
  if (skills.length === 0) {
    return (
      <div className="career-os-section career-os-skills-section">
        <h3>🎯 Skills</h3>
        <div className="career-os-empty-state">
          <p>No skills indexed yet.</p>
          <p className="career-os-hint">Run "Cold Start Indexing" to extract skills from your notes.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="career-os-section career-os-skills-section">
      <h3>🎯 Top Skills</h3>
      <div className="career-os-skills-list">
        {skills.map((skill, index) => (
          <SkillItem key={skill.name} skill={skill} rank={index + 1} />
        ))}
      </div>
    </div>
  );
}

/**
 * Single skill item with level bar
 */
function SkillItem({ skill, rank }: { skill: SkillProfile; rank: number }): JSX.Element {
  const levelPercent = (skill.level / 5) * 100;
  const levelLabel = getLevelLabel(skill.level);
  
  return (
    <div className="career-os-skill-item">
      <div className="career-os-skill-header">
        <span className="career-os-skill-rank">#{rank}</span>
        <span className="career-os-skill-name">{skill.name}</span>
        {skill.category && (
          <span className="career-os-skill-category">{skill.category}</span>
        )}
      </div>
      <div className="career-os-skill-bar-container">
        <div 
          className="career-os-skill-bar" 
          style={{ width: `${levelPercent}%` }}
        />
      </div>
      <div className="career-os-skill-meta">
        <span className="career-os-skill-level">{levelLabel} ({skill.level.toFixed(1)})</span>
        <span className="career-os-skill-evidence">{skill.evidence_notes.length} notes</span>
      </div>
    </div>
  );
}

/**
 * Convert numeric level to label
 */
function getLevelLabel(level: number): string {
  if (level >= 4) return '精通';
  if (level >= 3) return '熟练';
  if (level >= 2) return '熟悉';
  return '入门';
}

/**
 * Projects section - displays recent projects
 */
function ProjectsSection(): JSX.Element {
  const { selfProfile } = useDashboard();
  
  const projects = selfProfile?.analysis_view?.recent_projects || selfProfile?.projects.slice(0, 5) || [];
  
  if (projects.length === 0) {
    return (
      <div className="career-os-section career-os-projects-section">
        <h3>📁 Recent Projects</h3>
        <div className="career-os-empty-state">
          <p>No projects indexed yet.</p>
          <p className="career-os-hint">Index your project notes to see them here.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="career-os-section career-os-projects-section">
      <h3>📁 Recent Projects</h3>
      <div className="career-os-projects-list">
        {projects.map((project) => (
          <ProjectItem key={project.note_path} project={project} />
        ))}
      </div>
    </div>
  );
}

/**
 * Single project item
 */
function ProjectItem({ project }: { project: ProjectSummary }): JSX.Element {
  const projectName = project.note_path.split('/').pop()?.replace('.md', '') || 'Project';
  const techList = project.tech_stack.map(t => t.name).slice(0, 5);
  
  return (
    <div className="career-os-project-item">
      <div className="career-os-project-header">
        <span className="career-os-project-name">{projectName}</span>
        {project.time_span && (
          <span className="career-os-project-time">{project.time_span}</span>
        )}
      </div>
      <p className="career-os-project-summary">
        {project.summary.length > 150 
          ? project.summary.substring(0, 150) + '...' 
          : project.summary}
      </p>
      {techList.length > 0 && (
        <div className="career-os-project-tech">
          {techList.map(tech => (
            <span key={tech} className="career-os-tech-tag">{tech}</span>
          ))}
          {project.tech_stack.length > 5 && (
            <span className="career-os-tech-more">+{project.tech_stack.length - 5}</span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Workflow section - shows completion status for each step
 */
function WorkflowSection(): JSX.Element {
  const { workflowStatus } = useDashboard();
  
  const steps = [
    {
      id: 'self-profile',
      label: 'Self Profile',
      description: 'Index your notes and build capability profile',
      complete: workflowStatus.selfProfileComplete,
      icon: '👤',
    },
    {
      id: 'market-profile',
      label: 'Market Profile',
      description: 'Extract JDs and build market demand profile',
      complete: workflowStatus.marketProfileComplete,
      icon: '📊',
    },
    {
      id: 'action-plan',
      label: 'Action Plan',
      description: 'Generate gap analysis and action plan',
      complete: workflowStatus.actionPlanComplete,
      icon: '📋',
    },
  ];
  
  return (
    <div className="career-os-section career-os-workflow-section">
      <h3>🚀 Workflow</h3>
      <div className="career-os-workflow-steps">
        {steps.map((step, index) => (
          <div 
            key={step.id} 
            className={`career-os-workflow-step ${step.complete ? 'complete' : ''}`}
          >
            <div className="career-os-step-indicator">
              {step.complete ? '✓' : index + 1}
            </div>
            <div className="career-os-step-content">
              <div className="career-os-step-header">
                <span className="career-os-step-icon">{step.icon}</span>
                <span className="career-os-step-label">{step.label}</span>
              </div>
              <p className="career-os-step-description">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Error summary section
 */
function ErrorSummarySection(): JSX.Element {
  const { errorCount } = useDashboard();
  
  if (errorCount === 0) {
    return (
      <div className="career-os-section career-os-errors-section career-os-no-errors">
        <h3>✅ Status</h3>
        <p>No errors in recent operations.</p>
      </div>
    );
  }
  
  return (
    <div className="career-os-section career-os-errors-section career-os-has-errors">
      <h3>⚠️ Errors</h3>
      <div className="career-os-error-summary">
        <span className="career-os-error-count">{errorCount}</span>
        <span className="career-os-error-label">errors in error log</span>
      </div>
      <button className="career-os-view-errors-btn">
        View Error Log
      </button>
    </div>
  );
}

// ============================================================================
// Main Dashboard Component
// ============================================================================

/**
 * Main dashboard content component
 */
function DashboardContent(): JSX.Element {
  const { isLoading, loadDashboardData } = useDashboard();
  
  // Load data on mount
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);
  
  if (isLoading) {
    return <LoadingIndicator />;
  }
  
  return (
    <div className="career-os-dashboard">
      <DashboardHeader />
      <ErrorBanner />
      
      <div className="career-os-dashboard-grid">
        <div className="career-os-main-column">
          <SkillsSection />
          <ProjectsSection />
        </div>
        
        <div className="career-os-side-column">
          <WorkflowSection />
          <ErrorSummarySection />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Dashboard App (with Provider)
// ============================================================================

export interface DashboardAppProps {
  onLoadSelfProfile: () => Promise<SelfProfile | null>;
  onLoadMarketProfiles: () => Promise<MarketProfile[]>;
  onLoadErrorCount: () => Promise<number>;
  onRefreshSelfProfile: () => Promise<SelfProfile>;
}

/**
 * Dashboard App component with context provider
 */
export function DashboardApp(props: DashboardAppProps): JSX.Element {
  return (
    <DashboardProvider {...props}>
      <DashboardContent />
    </DashboardProvider>
  );
}

// ============================================================================
// Obsidian ItemView Integration
// ============================================================================

/**
 * Obsidian ItemView for the Dashboard
 */
export class DashboardItemView extends ItemView {
  private root: Root | null = null;
  private callbacks: DashboardAppProps;
  
  constructor(leaf: WorkspaceLeaf, callbacks: DashboardAppProps) {
    super(leaf);
    this.callbacks = callbacks;
  }
  
  getViewType(): string {
    return DASHBOARD_VIEW_TYPE;
  }
  
  getDisplayText(): string {
    return 'CareerOS Dashboard';
  }
  
  getIcon(): string {
    return 'briefcase';
  }
  
  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('career-os-dashboard-container');
    
    // Create React root and render
    this.root = createRoot(container);
    this.root.render(<DashboardApp {...this.callbacks} />);
  }
  
  async onClose(): Promise<void> {
    // Cleanup React root
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}
