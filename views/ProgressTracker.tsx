/**
 * ProgressTracker - Progress tracking component for long-running operations
 * 
 * Provides:
 * - Progress bar with percentage
 * - Real-time progress updates (completed/total tasks)
 * - Pause/resume/cancel buttons
 * - Estimated time remaining
 * - Success/failure notifications
 * 
 * Requirements: 4.3, 4.4
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { QueueStatus } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface ProgressTrackerProps {
  /** Current queue status */
  status: QueueStatus | null;
  /** Operation label (e.g., "Indexing Notes", "Extracting JDs") */
  operationLabel: string;
  /** Whether the operation is active */
  isActive: boolean;
  /** Callback when pause is clicked */
  onPause?: () => void;
  /** Callback when resume is clicked */
  onResume?: () => void;
  /** Callback when cancel is clicked */
  onCancel?: () => void;
  /** Whether pause/resume is supported */
  supportsPauseResume?: boolean;
  /** Whether cancel is supported */
  supportsCancel?: boolean;
  /** Start time of the operation (for ETA calculation) */
  startTime?: number;
  /** Show compact version */
  compact?: boolean;
}

export interface ProgressState {
  /** Percentage complete (0-100) */
  percentage: number;
  /** Completed tasks count */
  completed: number;
  /** Total tasks count */
  total: number;
  /** Failed tasks count */
  failed: number;
  /** Pending tasks count */
  pending: number;
  /** Whether operation is running */
  isRunning: boolean;
  /** Estimated time remaining in seconds */
  estimatedTimeRemaining: number | null;
  /** Average time per task in ms */
  avgTimePerTask: number | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format seconds to human-readable time string
 */
function formatTimeRemaining(seconds: number): string {
  if (seconds < 0 || !isFinite(seconds)) return '--';
  
  if (seconds < 60) {
    return `${Math.ceil(seconds)}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.ceil(seconds % 60);
  
  if (minutes < 60) {
    return remainingSeconds > 0 
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}m`
    : `${hours}h`;
}

/**
 * Calculate progress state from queue status
 */
function calculateProgressState(
  status: QueueStatus | null,
  startTime?: number
): ProgressState {
  if (!status) {
    return {
      percentage: 0,
      completed: 0,
      total: 0,
      failed: 0,
      pending: 0,
      isRunning: false,
      estimatedTimeRemaining: null,
      avgTimePerTask: null,
    };
  }
  
  const { total, completed, failed, pending, isRunning } = status;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  // Calculate ETA based on elapsed time and progress
  let estimatedTimeRemaining: number | null = null;
  let avgTimePerTask: number | null = null;
  
  if (startTime && completed > 0 && pending > 0) {
    const elapsedMs = Date.now() - startTime;
    avgTimePerTask = elapsedMs / completed;
    const remainingTasks = pending;
    estimatedTimeRemaining = (avgTimePerTask * remainingTasks) / 1000; // Convert to seconds
  }
  
  return {
    percentage,
    completed,
    total,
    failed,
    pending,
    isRunning,
    estimatedTimeRemaining,
    avgTimePerTask,
  };
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Progress bar visual component
 */
function ProgressBar({ percentage, failed, total }: { 
  percentage: number; 
  failed: number;
  total: number;
}): JSX.Element {
  const failedPercentage = total > 0 ? Math.round((failed / total) * 100) : 0;
  
  return (
    <div className="career-os-progress-bar-container">
      <div className="career-os-progress-bar-track">
        <div 
          className="career-os-progress-bar-fill"
          style={{ width: `${percentage}%` }}
        />
        {failedPercentage > 0 && (
          <div 
            className="career-os-progress-bar-failed"
            style={{ 
              width: `${failedPercentage}%`,
              left: `${percentage}%`
            }}
          />
        )}
      </div>
      <span className="career-os-progress-percentage">{percentage}%</span>
    </div>
  );
}

/**
 * Progress stats display
 */
function ProgressStats({ state }: { state: ProgressState }): JSX.Element {
  return (
    <div className="career-os-progress-stats">
      <div className="career-os-progress-stat">
        <span className="career-os-progress-stat-value">{state.completed}</span>
        <span className="career-os-progress-stat-label">完成</span>
      </div>
      <div className="career-os-progress-stat-divider">/</div>
      <div className="career-os-progress-stat">
        <span className="career-os-progress-stat-value">{state.total}</span>
        <span className="career-os-progress-stat-label">总计</span>
      </div>
      {state.failed > 0 && (
        <>
          <div className="career-os-progress-stat-divider">·</div>
          <div className="career-os-progress-stat career-os-progress-stat-failed">
            <span className="career-os-progress-stat-value">{state.failed}</span>
            <span className="career-os-progress-stat-label">失败</span>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Estimated time remaining display
 */
function TimeRemaining({ seconds }: { seconds: number | null }): JSX.Element | null {
  if (seconds === null) return null;
  
  return (
    <div className="career-os-progress-eta">
      <span className="career-os-progress-eta-icon">⏱️</span>
      <span className="career-os-progress-eta-text">
        预计剩余: {formatTimeRemaining(seconds)}
      </span>
    </div>
  );
}

/**
 * Control buttons (pause/resume/cancel)
 */
function ProgressControls({
  isRunning,
  isPaused,
  onPause,
  onResume,
  onCancel,
  supportsPauseResume,
  supportsCancel,
}: {
  isRunning: boolean;
  isPaused: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  supportsPauseResume?: boolean;
  supportsCancel?: boolean;
}): JSX.Element | null {
  if (!supportsPauseResume && !supportsCancel) return null;
  
  return (
    <div className="career-os-progress-controls">
      {supportsPauseResume && (
        <>
          {isRunning && !isPaused && onPause && (
            <button
              className="career-os-progress-btn career-os-progress-btn-pause"
              onClick={onPause}
              title="暂停"
            >
              ⏸️ 暂停
            </button>
          )}
          {isPaused && onResume && (
            <button
              className="career-os-progress-btn career-os-progress-btn-resume"
              onClick={onResume}
              title="继续"
            >
              ▶️ 继续
            </button>
          )}
        </>
      )}
      {supportsCancel && onCancel && (isRunning || isPaused) && (
        <button
          className="career-os-progress-btn career-os-progress-btn-cancel"
          onClick={onCancel}
          title="取消"
        >
          ✕ 取消
        </button>
      )}
    </div>
  );
}

/**
 * Status indicator (running/paused/completed)
 */
function StatusIndicator({ 
  isRunning, 
  isPaused,
  isComplete,
  hasFailed,
}: { 
  isRunning: boolean;
  isPaused: boolean;
  isComplete: boolean;
  hasFailed: boolean;
}): JSX.Element {
  if (isComplete && !hasFailed) {
    return (
      <div className="career-os-progress-status career-os-progress-status-complete">
        <span className="career-os-progress-status-icon">✓</span>
        <span className="career-os-progress-status-text">完成</span>
      </div>
    );
  }
  
  if (isComplete && hasFailed) {
    return (
      <div className="career-os-progress-status career-os-progress-status-partial">
        <span className="career-os-progress-status-icon">⚠️</span>
        <span className="career-os-progress-status-text">部分完成</span>
      </div>
    );
  }
  
  if (isPaused) {
    return (
      <div className="career-os-progress-status career-os-progress-status-paused">
        <span className="career-os-progress-status-icon">⏸️</span>
        <span className="career-os-progress-status-text">已暂停</span>
      </div>
    );
  }
  
  if (isRunning) {
    return (
      <div className="career-os-progress-status career-os-progress-status-running">
        <span className="career-os-progress-status-spinner"></span>
        <span className="career-os-progress-status-text">处理中...</span>
      </div>
    );
  }
  
  return (
    <div className="career-os-progress-status career-os-progress-status-idle">
      <span className="career-os-progress-status-icon">○</span>
      <span className="career-os-progress-status-text">等待中</span>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * ProgressTracker component
 * 
 * Displays progress for long-running operations with:
 * - Visual progress bar
 * - Task counts (completed/total/failed)
 * - Estimated time remaining
 * - Pause/resume/cancel controls
 */
export function ProgressTracker({
  status,
  operationLabel,
  isActive,
  onPause,
  onResume,
  onCancel,
  supportsPauseResume = true,
  supportsCancel = true,
  startTime,
  compact = false,
}: ProgressTrackerProps): JSX.Element | null {
  // Track paused state locally (since QueueStatus doesn't expose it directly)
  const [isPaused, setIsPaused] = useState(false);
  
  // Calculate progress state
  const progressState = useMemo(
    () => calculateProgressState(status, startTime),
    [status, startTime]
  );
  
  // Determine completion state
  const isComplete = progressState.total > 0 && 
    progressState.pending === 0 && 
    !progressState.isRunning;
  
  // Handle pause
  const handlePause = useCallback(() => {
    setIsPaused(true);
    onPause?.();
  }, [onPause]);
  
  // Handle resume
  const handleResume = useCallback(() => {
    setIsPaused(false);
    onResume?.();
  }, [onResume]);
  
  // Handle cancel
  const handleCancel = useCallback(() => {
    setIsPaused(false);
    onCancel?.();
  }, [onCancel]);
  
  // Reset paused state when operation completes or becomes inactive
  useEffect(() => {
    if (!isActive || isComplete) {
      setIsPaused(false);
    }
  }, [isActive, isComplete]);
  
  // Don't render if not active and no progress to show
  if (!isActive && progressState.total === 0) {
    return null;
  }
  
  // Compact version for inline display
  if (compact) {
    return (
      <div className="career-os-progress-tracker career-os-progress-tracker-compact">
        <div className="career-os-progress-compact-header">
          <StatusIndicator 
            isRunning={progressState.isRunning}
            isPaused={isPaused}
            isComplete={isComplete}
            hasFailed={progressState.failed > 0}
          />
          <span className="career-os-progress-compact-label">{operationLabel}</span>
          <span className="career-os-progress-compact-count">
            {progressState.completed}/{progressState.total}
          </span>
        </div>
        <ProgressBar 
          percentage={progressState.percentage}
          failed={progressState.failed}
          total={progressState.total}
        />
      </div>
    );
  }
  
  // Full version
  return (
    <div className={`career-os-progress-tracker ${isComplete ? 'complete' : ''} ${isPaused ? 'paused' : ''}`}>
      <div className="career-os-progress-header">
        <div className="career-os-progress-title">
          <StatusIndicator 
            isRunning={progressState.isRunning}
            isPaused={isPaused}
            isComplete={isComplete}
            hasFailed={progressState.failed > 0}
          />
          <span className="career-os-progress-label">{operationLabel}</span>
        </div>
        <ProgressControls
          isRunning={progressState.isRunning}
          isPaused={isPaused}
          onPause={handlePause}
          onResume={handleResume}
          onCancel={handleCancel}
          supportsPauseResume={supportsPauseResume}
          supportsCancel={supportsCancel}
        />
      </div>
      
      <ProgressBar 
        percentage={progressState.percentage}
        failed={progressState.failed}
        total={progressState.total}
      />
      
      <div className="career-os-progress-footer">
        <ProgressStats state={progressState} />
        <TimeRemaining seconds={progressState.estimatedTimeRemaining} />
      </div>
    </div>
  );
}

// ============================================================================
// Notification Components
// ============================================================================

export interface ProgressNotificationProps {
  /** Notification type */
  type: 'success' | 'error' | 'warning' | 'info';
  /** Notification message */
  message: string;
  /** Optional details */
  details?: string;
  /** Callback when dismissed */
  onDismiss?: () => void;
  /** Auto-dismiss after ms (0 = no auto-dismiss) */
  autoDismissMs?: number;
}

/**
 * Progress notification component for success/failure messages
 */
export function ProgressNotification({
  type,
  message,
  details,
  onDismiss,
  autoDismissMs = 5000,
}: ProgressNotificationProps): JSX.Element {
  // Auto-dismiss effect
  useEffect(() => {
    if (autoDismissMs > 0 && onDismiss) {
      const timer = setTimeout(onDismiss, autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [autoDismissMs, onDismiss]);
  
  const icons: Record<string, string> = {
    success: '✓',
    error: '✕',
    warning: '⚠️',
    info: 'ℹ️',
  };
  
  return (
    <div className={`career-os-progress-notification career-os-progress-notification-${type}`}>
      <span className="career-os-progress-notification-icon">{icons[type]}</span>
      <div className="career-os-progress-notification-content">
        <span className="career-os-progress-notification-message">{message}</span>
        {details && (
          <span className="career-os-progress-notification-details">{details}</span>
        )}
      </div>
      {onDismiss && (
        <button 
          className="career-os-progress-notification-dismiss"
          onClick={onDismiss}
          title="关闭"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Hook for Progress Tracking
// ============================================================================

export interface UseProgressTrackerOptions {
  /** Initial start time */
  startTime?: number;
}

export interface UseProgressTrackerResult {
  /** Current progress state */
  progressState: ProgressState;
  /** Start time of operation */
  startTime: number | undefined;
  /** Start tracking */
  startTracking: () => void;
  /** Stop tracking */
  stopTracking: () => void;
  /** Update status */
  updateStatus: (status: QueueStatus) => void;
  /** Is tracking active */
  isTracking: boolean;
}

/**
 * Hook for managing progress tracking state
 */
export function useProgressTracker(
  options: UseProgressTrackerOptions = {}
): UseProgressTrackerResult {
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [startTime, setStartTime] = useState<number | undefined>(options.startTime);
  const [isTracking, setIsTracking] = useState(false);
  
  const progressState = useMemo(
    () => calculateProgressState(status, startTime),
    [status, startTime]
  );
  
  const startTracking = useCallback(() => {
    setStartTime(Date.now());
    setIsTracking(true);
  }, []);
  
  const stopTracking = useCallback(() => {
    setIsTracking(false);
  }, []);
  
  const updateStatus = useCallback((newStatus: QueueStatus) => {
    setStatus(newStatus);
  }, []);
  
  return {
    progressState,
    startTime,
    startTracking,
    stopTracking,
    updateStatus,
    isTracking,
  };
}

export default ProgressTracker;
