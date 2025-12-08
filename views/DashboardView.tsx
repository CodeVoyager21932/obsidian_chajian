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
import { SelfProfile, MarketProfile, SkillProfile, ProjectSummary, TechItem, ErrorLogSummary, ErrorLogEntry, ErrorType, MarketProfileSummary, GapAnalysisSummary, ActionPlanSummary } from '../types';
import { DashboardProvider, useDashboard } from './DashboardContext';
import { getErrorTypeLabel, getErrorTypeIcon } from '../utils/errorLogParser';
import { ProgressTracker, ProgressNotification } from './ProgressTracker';

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
 * Requirements: 11.1
 */
function SkillsSection(): JSX.Element {
  const { selfProfile, selectedSkill, selectSkill } = useDashboard();
  
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
          <SkillItem 
            key={skill.name} 
            skill={skill} 
            rank={index + 1}
            isSelected={selectedSkill?.name === skill.name}
            onSelect={() => selectSkill(selectedSkill?.name === skill.name ? null : skill)}
          />
        ))}
      </div>
      
      {/* Skill Detail Panel */}
      {selectedSkill && (
        <SkillDetailPanel skill={selectedSkill} onClose={() => selectSkill(null)} />
      )}
    </div>
  );
}

/**
 * Single skill item with level bar (clickable for detail view)
 * Requirements: 11.1
 */
interface SkillItemProps {
  skill: SkillProfile;
  rank: number;
  isSelected: boolean;
  onSelect: () => void;
}

function SkillItem({ skill, rank, isSelected, onSelect }: SkillItemProps): JSX.Element {
  const levelPercent = (skill.level / 5) * 100;
  const levelLabel = getLevelLabel(skill.level);
  
  return (
    <div 
      className={`career-os-skill-item ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      title="Click to view evidence notes"
    >
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
 * Skill detail panel - shows evidence notes for selected skill
 * Requirements: 11.1
 */
function SkillDetailPanel({ skill, onClose }: { skill: SkillProfile; onClose: () => void }): JSX.Element {
  const levelLabel = getLevelLabel(skill.level);
  
  return (
    <div className="career-os-detail-panel career-os-skill-detail">
      <div className="career-os-detail-header">
        <h4>{skill.name}</h4>
        <button className="career-os-detail-close" onClick={onClose} title="Close">×</button>
      </div>
      
      <div className="career-os-detail-content">
        <div className="career-os-detail-meta">
          <div className="career-os-detail-meta-item">
            <span className="career-os-detail-label">Level:</span>
            <span className="career-os-detail-value">{levelLabel} ({skill.level.toFixed(2)})</span>
          </div>
          {skill.category && (
            <div className="career-os-detail-meta-item">
              <span className="career-os-detail-label">Category:</span>
              <span className="career-os-detail-value">{skill.category}</span>
            </div>
          )}
          <div className="career-os-detail-meta-item">
            <span className="career-os-detail-label">Last Active:</span>
            <span className="career-os-detail-value">{skill.last_active || 'N/A'}</span>
          </div>
        </div>
        
        <div className="career-os-evidence-section">
          <h5>📝 Evidence Notes ({skill.evidence_notes.length})</h5>
          {skill.evidence_notes.length === 0 ? (
            <p className="career-os-no-evidence">No evidence notes found.</p>
          ) : (
            <ul className="career-os-evidence-list">
              {skill.evidence_notes.map((notePath, index) => {
                const noteName = notePath.split('/').pop()?.replace('.md', '') || notePath;
                return (
                  <li key={index} className="career-os-evidence-item">
                    <span className="career-os-evidence-icon">📄</span>
                    <span className="career-os-evidence-path" title={notePath}>{noteName}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
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
 * Requirements: 11.2
 */
function ProjectsSection(): JSX.Element {
  const { selfProfile, selectedProject, selectProject } = useDashboard();
  
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
          <ProjectItem 
            key={project.note_path} 
            project={project}
            isSelected={selectedProject?.note_path === project.note_path}
            onSelect={() => selectProject(selectedProject?.note_path === project.note_path ? null : project)}
          />
        ))}
      </div>
      
      {/* Project Detail Panel */}
      {selectedProject && (
        <ProjectDetailPanel project={selectedProject} onClose={() => selectProject(null)} />
      )}
    </div>
  );
}

/**
 * Single project item (clickable for detail view)
 * Requirements: 11.2
 */
interface ProjectItemProps {
  project: ProjectSummary;
  isSelected: boolean;
  onSelect: () => void;
}

function ProjectItem({ project, isSelected, onSelect }: ProjectItemProps): JSX.Element {
  const projectName = project.note_path.split('/').pop()?.replace('.md', '') || 'Project';
  const techList = project.tech_stack.map(t => t.name).slice(0, 5);
  
  return (
    <div 
      className={`career-os-project-item ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      title="Click to view full project details"
    >
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
 * Project detail panel - shows full project summary and tech stack
 * Requirements: 11.2
 */
function ProjectDetailPanel({ project, onClose }: { project: ProjectSummary; onClose: () => void }): JSX.Element {
  const projectName = project.note_path.split('/').pop()?.replace('.md', '') || 'Project';
  
  return (
    <div className="career-os-detail-panel career-os-project-detail">
      <div className="career-os-detail-header">
        <h4>{projectName}</h4>
        <button className="career-os-detail-close" onClick={onClose} title="Close">×</button>
      </div>
      
      <div className="career-os-detail-content">
        <div className="career-os-detail-meta">
          <div className="career-os-detail-meta-item">
            <span className="career-os-detail-label">Path:</span>
            <span className="career-os-detail-value career-os-path-value" title={project.note_path}>
              {project.note_path}
            </span>
          </div>
          {project.time_span && (
            <div className="career-os-detail-meta-item">
              <span className="career-os-detail-label">Time Span:</span>
              <span className="career-os-detail-value">{project.time_span}</span>
            </div>
          )}
        </div>
        
        <div className="career-os-summary-section">
          <h5>📋 Summary</h5>
          <p className="career-os-full-summary">{project.summary}</p>
        </div>
        
        {project.tech_stack.length > 0 && (
          <div className="career-os-tech-section">
            <h5>🛠️ Tech Stack ({project.tech_stack.length})</h5>
            <div className="career-os-tech-detail-list">
              {project.tech_stack.map((tech, index) => (
                <TechStackItem key={index} tech={tech} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Tech stack item with level and context
 */
function TechStackItem({ tech }: { tech: TechItem }): JSX.Element {
  return (
    <div className="career-os-tech-detail-item">
      <div className="career-os-tech-detail-header">
        <span className="career-os-tech-detail-name">{tech.name}</span>
        <span className="career-os-tech-detail-level">{tech.level}</span>
      </div>
      {tech.context && (
        <p className="career-os-tech-detail-context">{tech.context}</p>
      )}
    </div>
  );
}

/**
 * Workflow step configuration
 */
interface WorkflowStep {
  id: 'self-profile' | 'market-profile' | 'action-plan';
  label: string;
  description: string;
  complete: boolean;
  icon: string;
  actionLabel: string;
  guidanceText: string;
  isLoading: boolean;
  onAction: () => void;
  isDisabled: boolean;
}

/**
 * Workflow section - shows completion status for each step with action buttons
 * Requirements: 11.5
 */
function WorkflowSection(): JSX.Element {
  const { 
    workflowStatus, 
    indexNotes, 
    extractJDs, 
    generatePlan,
    isIndexingNotes,
    isExtractingJDs,
    isGeneratingPlan,
  } = useDashboard();
  
  // Determine current step (first incomplete step)
  const getCurrentStep = (): 'self-profile' | 'market-profile' | 'action-plan' | 'complete' => {
    if (!workflowStatus.selfProfileComplete) return 'self-profile';
    if (!workflowStatus.marketProfileComplete) return 'market-profile';
    if (!workflowStatus.actionPlanComplete) return 'action-plan';
    return 'complete';
  };
  
  const currentStep = getCurrentStep();
  
  const steps: WorkflowStep[] = [
    {
      id: 'self-profile',
      label: 'Self Profile',
      description: 'Index your notes and build capability profile',
      complete: workflowStatus.selfProfileComplete,
      icon: '👤',
      actionLabel: 'Index Notes',
      guidanceText: 'Start by indexing your notes to extract skills and experiences. This will build your capability profile.',
      isLoading: isIndexingNotes,
      onAction: indexNotes,
      isDisabled: isIndexingNotes || isExtractingJDs || isGeneratingPlan,
    },
    {
      id: 'market-profile',
      label: 'Market Profile',
      description: 'Extract JDs and build market demand profile',
      complete: workflowStatus.marketProfileComplete,
      icon: '📊',
      actionLabel: 'Extract JDs',
      guidanceText: 'Add job descriptions to a note and extract them to understand market demands for your target role.',
      isLoading: isExtractingJDs,
      onAction: extractJDs,
      isDisabled: isIndexingNotes || isExtractingJDs || isGeneratingPlan,
    },
    {
      id: 'action-plan',
      label: 'Action Plan',
      description: 'Generate gap analysis and action plan',
      complete: workflowStatus.actionPlanComplete,
      icon: '📋',
      actionLabel: 'Generate Plan',
      guidanceText: 'Generate a personalized action plan based on the gap between your skills and market demands.',
      isLoading: isGeneratingPlan,
      onAction: generatePlan,
      isDisabled: isIndexingNotes || isExtractingJDs || isGeneratingPlan || !workflowStatus.selfProfileComplete || !workflowStatus.marketProfileComplete,
    },
  ];
  
  return (
    <div className="career-os-section career-os-workflow-section">
      <h3>🚀 Guided Workflow</h3>
      
      {/* Current step guidance */}
      {currentStep !== 'complete' && (
        <CurrentStepGuidance 
          step={steps.find(s => s.id === currentStep)!} 
        />
      )}
      
      {/* Completion message */}
      {currentStep === 'complete' && (
        <div className="career-os-workflow-complete">
          <span className="career-os-complete-icon">🎉</span>
          <p>All steps completed! You can regenerate any step by clicking its action button.</p>
        </div>
      )}
      
      {/* Workflow steps */}
      <div className="career-os-workflow-steps">
        {steps.map((step, index) => (
          <WorkflowStepItem 
            key={step.id} 
            step={step} 
            stepNumber={index + 1}
            isCurrent={currentStep === step.id}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Current step guidance component
 * Requirements: 11.5 - Display current step with helpful guidance text
 */
function CurrentStepGuidance({ step }: { step: WorkflowStep }): JSX.Element {
  return (
    <div className="career-os-current-step-guidance">
      <div className="career-os-guidance-header">
        <span className="career-os-guidance-icon">💡</span>
        <span className="career-os-guidance-title">Next Step: {step.label}</span>
      </div>
      <p className="career-os-guidance-text">{step.guidanceText}</p>
    </div>
  );
}

/**
 * Single workflow step item with action button
 * Requirements: 11.5
 */
interface WorkflowStepItemProps {
  step: WorkflowStep;
  stepNumber: number;
  isCurrent: boolean;
}

function WorkflowStepItem({ step, stepNumber, isCurrent }: WorkflowStepItemProps): JSX.Element {
  const stepClasses = [
    'career-os-workflow-step',
    step.complete ? 'complete' : '',
    isCurrent ? 'current' : '',
  ].filter(Boolean).join(' ');
  
  return (
    <div className={stepClasses}>
      <div className="career-os-step-indicator">
        {step.complete ? '✓' : stepNumber}
      </div>
      <div className="career-os-step-content">
        <div className="career-os-step-header">
          <span className="career-os-step-icon">{step.icon}</span>
          <span className="career-os-step-label">{step.label}</span>
          {step.complete && (
            <span className="career-os-step-status-badge complete">Complete</span>
          )}
          {isCurrent && !step.complete && (
            <span className="career-os-step-status-badge current">Current</span>
          )}
        </div>
        <p className="career-os-step-description">{step.description}</p>
        
        {/* Action button */}
        <button
          className={`career-os-step-action-btn ${step.isLoading ? 'loading' : ''}`}
          onClick={step.onAction}
          disabled={step.isDisabled}
          title={step.isDisabled && !step.isLoading ? 'Complete previous steps first' : step.actionLabel}
        >
          {step.isLoading ? (
            <>
              <span className="career-os-btn-spinner"></span>
              Processing...
            </>
          ) : (
            <>
              {step.complete ? '↻ ' : '▶ '}
              {step.actionLabel}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * Error summary section
 * Requirements: 11.3
 */
function ErrorSummarySection(): JSX.Element {
  const { errorCount, openErrorLogModal, isErrorLogModalOpen, closeErrorLogModal, errorLogSummary, isLoadingErrorLog } = useDashboard();
  
  if (errorCount === 0) {
    return (
      <div className="career-os-section career-os-errors-section career-os-no-errors">
        <h3>✅ Status</h3>
        <p>No errors in recent operations.</p>
      </div>
    );
  }
  
  return (
    <>
      <div className="career-os-section career-os-errors-section career-os-has-errors">
        <h3>⚠️ Errors</h3>
        <div className="career-os-error-summary">
          <span className="career-os-error-count">{errorCount}</span>
          <span className="career-os-error-label">errors in error log</span>
        </div>
        <button 
          className="career-os-view-errors-btn"
          onClick={openErrorLogModal}
        >
          View Error Log
        </button>
      </div>
      
      {/* Error Log Modal */}
      {isErrorLogModalOpen && (
        <ErrorLogModal 
          summary={errorLogSummary}
          isLoading={isLoadingErrorLog}
          onClose={closeErrorLogModal}
        />
      )}
    </>
  );
}

/**
 * Error Log Modal - displays detailed error information
 * Requirements: 11.3
 */
interface ErrorLogModalProps {
  summary: ErrorLogSummary | null;
  isLoading: boolean;
  onClose: () => void;
}

function ErrorLogModal({ summary, isLoading, onClose }: ErrorLogModalProps): JSX.Element {
  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  
  return (
    <div className="career-os-modal-overlay" onClick={onClose}>
      <div className="career-os-modal" onClick={(e) => e.stopPropagation()}>
        <div className="career-os-modal-header">
          <h3>📋 Error Log</h3>
          <button className="career-os-modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="career-os-modal-content">
          {isLoading ? (
            <div className="career-os-modal-loading">
              <div className="career-os-spinner"></div>
              <span>Loading error log...</span>
            </div>
          ) : summary ? (
            <>
              {/* Error Type Summary */}
              <ErrorTypeSummary summary={summary} />
              
              {/* Error List */}
              <ErrorList entries={summary.entries} />
            </>
          ) : (
            <div className="career-os-modal-empty">
              <p>No error log data available.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Error type summary - shows breakdown by error type
 * Requirements: 11.3
 */
function ErrorTypeSummary({ summary }: { summary: ErrorLogSummary }): JSX.Element {
  const errorTypes: ErrorType[] = ['extraction', 'validation', 'file_operation', 'llm', 'unknown'];
  const activeTypes = errorTypes.filter(type => summary.byType[type] > 0);
  
  if (activeTypes.length === 0) {
    return <></>;
  }
  
  return (
    <div className="career-os-error-type-summary">
      <h4>Error Breakdown</h4>
      <div className="career-os-error-type-grid">
        {activeTypes.map(type => (
          <div key={type} className={`career-os-error-type-item career-os-error-type-${type}`}>
            <span className="career-os-error-type-icon">{getErrorTypeIcon(type)}</span>
            <span className="career-os-error-type-count">{summary.byType[type]}</span>
            <span className="career-os-error-type-label">{getErrorTypeLabel(type)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Error list - displays individual error entries
 * Requirements: 11.3
 */
function ErrorList({ entries }: { entries: ErrorLogEntry[] }): JSX.Element {
  if (entries.length === 0) {
    return (
      <div className="career-os-error-list-empty">
        <p>No errors recorded.</p>
      </div>
    );
  }
  
  // Sort by timestamp descending (most recent first)
  const sortedEntries = [...entries].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  
  return (
    <div className="career-os-error-list">
      <h4>Recent Errors ({entries.length})</h4>
      <div className="career-os-error-entries">
        {sortedEntries.map((entry, index) => (
          <ErrorEntryItem key={`${entry.timestamp}-${index}`} entry={entry} />
        ))}
      </div>
    </div>
  );
}

/**
 * Single error entry item
 * Requirements: 11.3
 */
function ErrorEntryItem({ entry }: { entry: ErrorLogEntry }): JSX.Element {
  const formattedTime = formatTimestamp(entry.timestamp);
  const fileName = entry.path.split('/').pop() || entry.path;
  
  return (
    <div className={`career-os-error-entry career-os-error-entry-${entry.type}`}>
      <div className="career-os-error-entry-header">
        <span className="career-os-error-entry-icon">{getErrorTypeIcon(entry.type)}</span>
        <span className="career-os-error-entry-type">{getErrorTypeLabel(entry.type)}</span>
        <span className="career-os-error-entry-time">{formattedTime}</span>
      </div>
      <div className="career-os-error-entry-path" title={entry.path}>
        📄 {fileName}
      </div>
      <div className="career-os-error-entry-message">
        {entry.error}
      </div>
      {entry.attempts > 0 && (
        <div className="career-os-error-entry-attempts">
          Attempts: {entry.attempts}
        </div>
      )}
    </div>
  );
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString();
  } catch {
    return timestamp;
  }
}

// ============================================================================
// Market Profiles Section
// Requirements: 9.5, 20
// ============================================================================

/**
 * Market profiles section - displays available market profiles
 * Requirements: 9.5 - Display list of recent analyses in dashboard
 */
function MarketProfilesSection(): JSX.Element {
  const { 
    marketProfileSummaries, 
    selectedMarketProfile, 
    selectMarketProfile,
    buildMarketProfile,
    isBuildingMarketProfile,
  } = useDashboard();
  
  const [showBuildModal, setShowBuildModal] = React.useState(false);
  
  return (
    <div className="career-os-section career-os-market-section">
      <div className="career-os-section-header">
        <h3>📊 Market Profiles</h3>
        <button
          className="career-os-add-btn"
          onClick={() => setShowBuildModal(true)}
          disabled={isBuildingMarketProfile}
          title="Build new market profile"
        >
          {isBuildingMarketProfile ? '⟳' : '+'} New
        </button>
      </div>
      
      {marketProfileSummaries.length === 0 ? (
        <div className="career-os-empty-state">
          <p>No market profiles yet.</p>
          <p className="career-os-hint">Extract JDs and build a market profile to see market demands.</p>
        </div>
      ) : (
        <div className="career-os-market-list">
          {marketProfileSummaries.map((profile) => (
            <MarketProfileItem
              key={`${profile.role}-${profile.location}`}
              profile={profile}
              isSelected={selectedMarketProfile?.role === profile.role && selectedMarketProfile?.location === profile.location}
              onSelect={() => selectMarketProfile(
                selectedMarketProfile?.role === profile.role && selectedMarketProfile?.location === profile.location 
                  ? null 
                  : profile
              )}
            />
          ))}
        </div>
      )}
      
      {/* Build Market Profile Modal */}
      {showBuildModal && (
        <BuildMarketProfileModal
          onClose={() => setShowBuildModal(false)}
          onBuild={buildMarketProfile}
          isBuilding={isBuildingMarketProfile}
        />
      )}
    </div>
  );
}

/**
 * Single market profile item
 */
interface MarketProfileItemProps {
  profile: MarketProfileSummary;
  isSelected: boolean;
  onSelect: () => void;
}

function MarketProfileItem({ profile, isSelected, onSelect }: MarketProfileItemProps): JSX.Element {
  const formattedDate = formatDate(profile.lastBuilt);
  
  return (
    <div 
      className={`career-os-market-item ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
    >
      <div className="career-os-market-item-header">
        <span className="career-os-market-role">{profile.role}</span>
        <span className="career-os-market-location">📍 {profile.location}</span>
      </div>
      <div className="career-os-market-item-meta">
        <span className="career-os-market-jd-count">{profile.jdCount} JDs</span>
        <span className="career-os-market-date">{formattedDate}</span>
      </div>
    </div>
  );
}

/**
 * Build Market Profile Modal
 */
interface BuildMarketProfileModalProps {
  onClose: () => void;
  onBuild: (role: string, location: string) => Promise<void>;
  isBuilding: boolean;
}

function BuildMarketProfileModal({ onClose, onBuild, isBuilding }: BuildMarketProfileModalProps): JSX.Element {
  const [role, setRole] = React.useState('');
  const [location, setLocation] = React.useState('');
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role.trim() && location.trim()) {
      await onBuild(role.trim(), location.trim());
      onClose();
    }
  };
  
  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  
  return (
    <div className="career-os-modal-overlay" onClick={onClose}>
      <div className="career-os-modal career-os-build-modal" onClick={(e) => e.stopPropagation()}>
        <div className="career-os-modal-header">
          <h3>📊 Build Market Profile</h3>
          <button className="career-os-modal-close" onClick={onClose}>×</button>
        </div>
        
        <form className="career-os-modal-content" onSubmit={handleSubmit}>
          <div className="career-os-form-group">
            <label htmlFor="market-role">Target Role</label>
            <input
              id="market-role"
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g., Python 后端"
              disabled={isBuilding}
              autoFocus
            />
          </div>
          
          <div className="career-os-form-group">
            <label htmlFor="market-location">Location</label>
            <input
              id="market-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., 杭州"
              disabled={isBuilding}
            />
          </div>
          
          <div className="career-os-form-actions">
            <button
              type="button"
              className="career-os-btn-secondary"
              onClick={onClose}
              disabled={isBuilding}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="career-os-btn-primary"
              disabled={isBuilding || !role.trim() || !location.trim()}
            >
              {isBuilding ? (
                <>
                  <span className="career-os-btn-spinner"></span>
                  Building...
                </>
              ) : (
                'Build Profile'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// Gap Analyses and Action Plans Section
// Requirements: 9.5, 10.5, 20
// ============================================================================

/**
 * Plans section - displays gap analyses and action plans
 * Requirements: 9.5, 10.5
 */
function PlansSection(): JSX.Element {
  const { 
    gapAnalyses, 
    actionPlans, 
    activePlanPath,
    setActivePlan,
  } = useDashboard();
  
  const hasContent = gapAnalyses.length > 0 || actionPlans.length > 0;
  
  return (
    <div className="career-os-section career-os-plans-section">
      <h3>📋 Gap Analyses & Plans</h3>
      
      {!hasContent ? (
        <div className="career-os-empty-state">
          <p>No analyses or plans yet.</p>
          <p className="career-os-hint">Complete the workflow to generate gap analysis and action plans.</p>
        </div>
      ) : (
        <div className="career-os-plans-content">
          {/* Gap Analyses */}
          {gapAnalyses.length > 0 && (
            <div className="career-os-gap-analyses">
              <h4>🔍 Gap Analyses</h4>
              <div className="career-os-gap-list">
                {gapAnalyses.slice(0, 5).map((analysis) => (
                  <GapAnalysisItem key={analysis.reportPath} analysis={analysis} />
                ))}
              </div>
            </div>
          )}
          
          {/* Action Plans */}
          {actionPlans.length > 0 && (
            <div className="career-os-action-plans">
              <h4>📝 Action Plans</h4>
              <div className="career-os-plan-list">
                {actionPlans.slice(0, 5).map((plan) => (
                  <ActionPlanItem 
                    key={plan.planPath} 
                    plan={plan}
                    isActive={plan.planPath === activePlanPath || plan.isActive === true}
                    onSetActive={() => setActivePlan(plan.planPath)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Gap analysis item
 */
function GapAnalysisItem({ analysis }: { analysis: GapAnalysisSummary }): JSX.Element {
  const formattedDate = formatDate(analysis.generatedAt);
  const matchColor = getMatchColor(analysis.matchPercentage);
  
  return (
    <div className="career-os-gap-item">
      <div className="career-os-gap-item-header">
        <span className="career-os-gap-role">{analysis.targetRole}</span>
        <span className="career-os-gap-location">📍 {analysis.targetLocation}</span>
      </div>
      <div className="career-os-gap-item-stats">
        <span 
          className="career-os-gap-match" 
          style={{ color: matchColor }}
          title="Match percentage"
        >
          {analysis.matchPercentage}% match
        </span>
        <span className="career-os-gap-strengths" title="Strengths identified">
          ✓ {analysis.strengthsCount}
        </span>
        <span className="career-os-gap-gaps" title="Gaps identified">
          ⚠ {analysis.gapsCount}
        </span>
      </div>
      <div className="career-os-gap-item-date">{formattedDate}</div>
    </div>
  );
}

/**
 * Action plan item with "Set as Active" button
 * Requirements: 10.5
 */
interface ActionPlanItemProps {
  plan: ActionPlanSummary;
  isActive: boolean;
  onSetActive: () => void;
}

function ActionPlanItem({ plan, isActive, onSetActive }: ActionPlanItemProps): JSX.Element {
  const formattedDate = formatDate(plan.generatedAt);
  
  return (
    <div className={`career-os-plan-item ${isActive ? 'active' : ''}`}>
      <div className="career-os-plan-item-header">
        <span className="career-os-plan-role">{plan.role}</span>
        {isActive && <span className="career-os-plan-active-badge">Active</span>}
      </div>
      <div className="career-os-plan-item-meta">
        <span className="career-os-plan-location">📍 {plan.location}</span>
        <span className="career-os-plan-period">📅 {plan.period}</span>
        <span className="career-os-plan-hours">⏱️ {plan.weeklyHours}h/week</span>
      </div>
      <div className="career-os-plan-item-footer">
        <span className="career-os-plan-date">{formattedDate}</span>
        {!isActive && (
          <button
            className="career-os-set-active-btn"
            onClick={(e) => {
              e.stopPropagation();
              onSetActive();
            }}
            title="Set as active plan"
          >
            Set Active
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Get color based on match percentage
 */
function getMatchColor(percentage: number): string {
  if (percentage >= 80) return 'var(--text-success)';
  if (percentage >= 60) return 'var(--text-accent)';
  if (percentage >= 40) return 'var(--text-warning, #f59e0b)';
  return 'var(--text-error)';
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

// ============================================================================
// Main Dashboard Component
// ============================================================================

/**
 * Progress section - displays active progress tracking
 * Requirements: 4.3, 4.4
 */
function ProgressSection(): JSX.Element | null {
  const { 
    progressTracking, 
    queueStatus, 
    pauseProgress, 
    resumeProgress, 
    cancelProgress,
    isIndexingNotes,
    isExtractingJDs,
    isGeneratingPlan,
  } = useDashboard();
  
  // Determine if any operation is active
  const isAnyOperationActive = isIndexingNotes || isExtractingJDs || isGeneratingPlan || progressTracking.isActive;
  
  // Determine operation label
  let operationLabel = progressTracking.operationLabel;
  if (!operationLabel) {
    if (isIndexingNotes) operationLabel = '索引笔记中...';
    else if (isExtractingJDs) operationLabel = '提取 JD 中...';
    else if (isGeneratingPlan) operationLabel = '生成计划中...';
  }
  
  if (!isAnyOperationActive || !queueStatus) {
    return null;
  }
  
  return (
    <div className="career-os-progress-section">
      <ProgressTracker
        status={queueStatus}
        operationLabel={operationLabel}
        isActive={isAnyOperationActive}
        onPause={pauseProgress}
        onResume={resumeProgress}
        onCancel={cancelProgress}
        supportsPauseResume={true}
        supportsCancel={true}
        startTime={progressTracking.startTime ?? undefined}
      />
    </div>
  );
}

/**
 * Notifications section - displays success/failure notifications
 * Requirements: 4.3, 4.4
 */
function NotificationsSection(): JSX.Element | null {
  const { notifications, dismissNotification } = useDashboard();
  
  if (notifications.length === 0) {
    return null;
  }
  
  return (
    <div className="career-os-notifications-section">
      {notifications.map((notification) => (
        <ProgressNotification
          key={notification.id}
          type={notification.type}
          message={notification.message}
          details={notification.details}
          onDismiss={() => dismissNotification(notification.id)}
          autoDismissMs={notification.type === 'success' ? 5000 : 0}
        />
      ))}
    </div>
  );
}

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
      <NotificationsSection />
      <ProgressSection />
      
      <div className="career-os-dashboard-grid">
        <div className="career-os-main-column">
          <SkillsSection />
          <ProjectsSection />
          <MarketProfilesSection />
          <PlansSection />
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
  
  // Progress tracking callbacks (Requirements: 4.3, 4.4)
  onPauseQueue?: () => void;
  onResumeQueue?: () => void;
  onCancelQueue?: () => void;
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
