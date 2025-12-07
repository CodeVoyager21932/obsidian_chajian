/**
 * Queue Manager Module
 * 
 * Manages asynchronous task processing with concurrency control,
 * pause/resume functionality, and progress tracking.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import { Task, QueueStatus, TaskType } from './types';

/**
 * Task execution result
 */
export interface TaskResult {
  taskId: string;
  success: boolean;
  result?: any;
  error?: Error;
}

/**
 * Task executor function type
 */
export type TaskExecutor = (task: Task) => Promise<any>;

/**
 * Progress callback type
 */
export type ProgressCallback = (status: QueueStatus) => void;

/**
 * Task completion callback type
 */
export type TaskCompletionCallback = (result: TaskResult) => void;

/**
 * Queue state enum
 */
enum QueueState {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  CANCELLED = 'cancelled',
}

/**
 * Internal task wrapper with metadata
 */
interface QueuedTask {
  task: Task;
  addedAt: number;
  startedAt?: number;
  completedAt?: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

/**
 * Queue Manager class
 * 
 * Provides task queue management with:
 * - Configurable concurrency
 * - Pause/resume functionality
 * - Progress tracking
 * - Error handling
 */
export class QueueManager {
  private queue: QueuedTask[] = [];
  private activeCount: number = 0;
  private state: QueueState = QueueState.IDLE;
  private concurrency: number;
  private executor: TaskExecutor;
  
  // Callbacks
  private onProgress?: ProgressCallback;
  private onTaskComplete?: TaskCompletionCallback;
  
  // Statistics
  private completedCount: number = 0;
  private failedCount: number = 0;

  constructor(
    executor: TaskExecutor,
    options: {
      concurrency?: number;
      onProgress?: ProgressCallback;
      onTaskComplete?: TaskCompletionCallback;
    } = {}
  ) {
    this.executor = executor;
    this.concurrency = options.concurrency || 3;
    this.onProgress = options.onProgress;
    this.onTaskComplete = options.onTaskComplete;
  }

  /**
   * Add a task to the queue
   */
  async enqueue(task: Task): Promise<void> {
    const queuedTask: QueuedTask = {
      task,
      addedAt: Date.now(),
      status: 'pending',
    };
    
    // Insert based on priority (higher priority first)
    const priority = task.priority ?? 0;
    let insertIndex = this.queue.length;
    
    for (let i = 0; i < this.queue.length; i++) {
      const existingPriority = this.queue[i].task.priority ?? 0;
      if (priority > existingPriority && this.queue[i].status === 'pending') {
        insertIndex = i;
        break;
      }
    }
    
    this.queue.splice(insertIndex, 0, queuedTask);
    this.notifyProgress();
    
    // Auto-start if running
    if (this.state === QueueState.RUNNING) {
      this.processNext();
    }
  }

  /**
   * Add multiple tasks to the queue
   */
  async enqueueBatch(tasks: Task[]): Promise<void> {
    for (const task of tasks) {
      await this.enqueue(task);
    }
  }


  /**
   * Start processing the queue
   */
  start(): void {
    if (this.state === QueueState.RUNNING) {
      return; // Already running
    }
    
    this.state = QueueState.RUNNING;
    this.notifyProgress();
    
    // Start processing up to concurrency limit
    for (let i = 0; i < this.concurrency; i++) {
      this.processNext();
    }
  }

  /**
   * Pause processing (allows current tasks to complete)
   */
  pause(): void {
    if (this.state !== QueueState.RUNNING) {
      return;
    }
    
    this.state = QueueState.PAUSED;
    this.notifyProgress();
  }

  /**
   * Resume processing from paused state
   */
  resume(): void {
    if (this.state !== QueueState.PAUSED) {
      return;
    }
    
    this.state = QueueState.RUNNING;
    this.notifyProgress();
    
    // Resume processing
    for (let i = this.activeCount; i < this.concurrency; i++) {
      this.processNext();
    }
  }

  /**
   * Cancel all pending tasks
   */
  cancel(): void {
    this.state = QueueState.CANCELLED;
    
    // Mark all pending tasks as cancelled (remove them)
    this.queue = this.queue.filter(qt => qt.status !== 'pending');
    
    this.notifyProgress();
  }

  /**
   * Clear the queue and reset state
   */
  clear(): void {
    this.queue = [];
    this.activeCount = 0;
    this.completedCount = 0;
    this.failedCount = 0;
    this.state = QueueState.IDLE;
    this.notifyProgress();
  }

  /**
   * Get current queue status
   */
  getStatus(): QueueStatus {
    const pending = this.queue.filter(qt => qt.status === 'pending').length;
    const running = this.queue.filter(qt => qt.status === 'running').length;
    
    return {
      total: this.completedCount + this.failedCount + pending + running,
      completed: this.completedCount,
      failed: this.failedCount,
      pending: pending + running,
      isRunning: this.state === QueueState.RUNNING,
    };
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.filter(qt => qt.status === 'pending').length === 0 && 
           this.activeCount === 0;
  }

  /**
   * Check if queue is running
   */
  isRunning(): boolean {
    return this.state === QueueState.RUNNING;
  }

  /**
   * Check if queue is paused
   */
  isPaused(): boolean {
    return this.state === QueueState.PAUSED;
  }

  /**
   * Update concurrency limit
   */
  setConcurrency(concurrency: number): void {
    this.concurrency = Math.max(1, concurrency);
    
    // If running and new concurrency is higher, start more workers
    if (this.state === QueueState.RUNNING) {
      for (let i = this.activeCount; i < this.concurrency; i++) {
        this.processNext();
      }
    }
  }

  /**
   * Get the number of pending tasks
   */
  getPendingCount(): number {
    return this.queue.filter(qt => qt.status === 'pending').length;
  }

  /**
   * Wait for all tasks to complete
   */
  async waitForCompletion(): Promise<void> {
    return new Promise((resolve) => {
      const checkComplete = () => {
        if (this.isEmpty() || this.state === QueueState.CANCELLED) {
          resolve();
        } else {
          setTimeout(checkComplete, 100);
        }
      };
      checkComplete();
    });
  }

  /**
   * Process the next pending task
   */
  private async processNext(): Promise<void> {
    // Check if we should process
    if (this.state !== QueueState.RUNNING) {
      return;
    }
    
    if (this.activeCount >= this.concurrency) {
      return;
    }
    
    // Find next pending task
    const queuedTask = this.queue.find(qt => qt.status === 'pending');
    if (!queuedTask) {
      // No more tasks, check if we're done
      if (this.activeCount === 0) {
        this.state = QueueState.IDLE;
        this.notifyProgress();
      }
      return;
    }
    
    // Mark as running
    queuedTask.status = 'running';
    queuedTask.startedAt = Date.now();
    this.activeCount++;
    this.notifyProgress();
    
    // Execute task
    let result: TaskResult;
    try {
      const taskResult = await this.executor(queuedTask.task);
      queuedTask.status = 'completed';
      queuedTask.completedAt = Date.now();
      this.completedCount++;
      
      result = {
        taskId: queuedTask.task.id,
        success: true,
        result: taskResult,
      };
    } catch (error) {
      queuedTask.status = 'failed';
      queuedTask.completedAt = Date.now();
      this.failedCount++;
      
      result = {
        taskId: queuedTask.task.id,
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
    
    this.activeCount--;
    
    // Notify completion
    if (this.onTaskComplete) {
      this.onTaskComplete(result);
    }
    
    this.notifyProgress();
    
    // Process next task
    this.processNext();
  }

  /**
   * Notify progress callback
   */
  private notifyProgress(): void {
    if (this.onProgress) {
      this.onProgress(this.getStatus());
    }
  }
}


/**
 * Create a new queue manager instance
 */
export function createQueueManager(
  executor: TaskExecutor,
  options?: {
    concurrency?: number;
    onProgress?: ProgressCallback;
    onTaskComplete?: TaskCompletionCallback;
  }
): QueueManager {
  return new QueueManager(executor, options);
}

/**
 * Generate a unique task ID
 */
export function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a task object
 */
export function createTask(
  type: TaskType,
  data: any,
  priority?: number
): Task {
  return {
    id: generateTaskId(),
    type,
    data,
    priority,
  };
}
