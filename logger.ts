/**
 * Logger - Error logging system for CareerOS
 * 
 * Requirements: 4.5, 5.4
 * - Log errors to error_log.md with structured format
 * - Include timestamp, error type, file path, and error details
 * - Implement log rotation (keep last N entries or last M days)
 * - Add error categorization (LLM, file system, schema, user input)
 * 
 * Property 13: Error logging and continuation
 * - For any LLM extraction that fails after exhausting all retry attempts,
 *   the system should log the error with note path and details to the error log file,
 *   and continue processing remaining tasks without halting the entire operation.
 */

import { App, TFile, normalizePath } from 'obsidian';
import { ErrorType, ErrorLogEntry } from './types';
import { parseErrorLog, categorizeError } from './utils/errorLogParser';

// Error log configuration
export interface LoggerConfig {
  maxEntries: number;      // Maximum number of entries to keep (default: 100)
  maxAgeDays: number;      // Maximum age of entries in days (default: 30)
  logFilePath: string;     // Path to error log file
}

const DEFAULT_CONFIG: LoggerConfig = {
  maxEntries: 100,
  maxAgeDays: 30,
  logFilePath: 'CareerOS/error_log.md',
};

/**
 * Error entry to be logged
 */
export interface LogEntry {
  path: string;            // File path related to the error
  error: string;           // Error message
  attempts?: number;       // Number of retry attempts (for LLM errors)
  type?: ErrorType;        // Error type (auto-detected if not provided)
  details?: string;        // Additional error details
}

/**
 * Logger class for CareerOS error logging
 */
export class Logger {
  private config: LoggerConfig;
  private app: App;

  constructor(app: App, config: Partial<LoggerConfig> = {}) {
    this.app = app;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Log an error entry to error_log.md
   */
  async logError(entry: LogEntry): Promise<void> {
    const timestamp = new Date().toISOString();
    const errorType = entry.type || categorizeError(entry.error);
    
    const formattedEntry = this.formatEntry({
      timestamp,
      path: entry.path,
      attempts: entry.attempts || 1,
      error: entry.error,
      type: errorType,
    }, entry.details);

    await this.appendToLog(formattedEntry);
    await this.rotateLog();
  }

  /**
   * Log an LLM error (convenience method)
   */
  async logLLMError(path: string, error: string, attempts: number, details?: string): Promise<void> {
    await this.logError({
      path,
      error,
      attempts,
      type: 'llm',
      details,
    });
  }

  /**
   * Log a schema validation error (convenience method)
   */
  async logValidationError(path: string, error: string, details?: string): Promise<void> {
    await this.logError({
      path,
      error,
      type: 'validation',
      details,
    });
  }

  /**
   * Log a file operation error (convenience method)
   */
  async logFileError(path: string, error: string, details?: string): Promise<void> {
    await this.logError({
      path,
      error,
      type: 'file_operation',
      details,
    });
  }

  /**
   * Log an extraction error (convenience method)
   */
  async logExtractionError(path: string, error: string, attempts: number, details?: string): Promise<void> {
    await this.logError({
      path,
      error,
      attempts,
      type: 'extraction',
      details,
    });
  }

  /**
   * Format an error entry for the log file
   */
  private formatEntry(entry: ErrorLogEntry, details?: string): string {
    let formatted = `## ${entry.timestamp}\n\n`;
    formatted += `- **Type**: ${this.getTypeLabel(entry.type)}\n`;
    formatted += `- **Path**: ${entry.path}\n`;
    formatted += `- **Attempts**: ${entry.attempts}\n`;
    formatted += `- **Error**: ${entry.error}\n`;
    
    if (details) {
      formatted += `- **Details**: ${details}\n`;
    }
    
    formatted += '\n---\n\n';
    return formatted;
  }

  /**
   * Get human-readable label for error type
   */
  private getTypeLabel(type: ErrorType): string {
    const labels: Record<ErrorType, string> = {
      extraction: 'Extraction',
      validation: 'Schema Validation',
      file_operation: 'File Operation',
      llm: 'LLM/API',
      unknown: 'Unknown',
    };
    return labels[type];
  }

  /**
   * Append entry to log file
   */
  private async appendToLog(entry: string): Promise<void> {
    const logPath = normalizePath(this.config.logFilePath);
    
    // Ensure parent directory exists
    await this.ensureLogDirectory();
    
    const file = this.app.vault.getAbstractFileByPath(logPath);
    
    if (file && file instanceof TFile) {
      // Append to existing file
      const content = await this.app.vault.read(file);
      const newContent = this.insertEntryAfterHeader(content, entry);
      await this.app.vault.modify(file, newContent);
    } else {
      // Create new file with header
      const header = this.getLogHeader();
      await this.app.vault.create(logPath, header + entry);
    }
  }

  /**
   * Insert entry after the header (newest entries first)
   */
  private insertEntryAfterHeader(content: string, entry: string): string {
    const headerEndIndex = content.indexOf('\n\n');
    if (headerEndIndex === -1) {
      return content + '\n\n' + entry;
    }
    
    const header = content.substring(0, headerEndIndex + 2);
    const body = content.substring(headerEndIndex + 2);
    
    return header + entry + body;
  }

  /**
   * Get log file header
   */
  private getLogHeader(): string {
    return `# CareerOS Error Log\n\n`;
  }

  /**
   * Ensure log directory exists
   */
  private async ensureLogDirectory(): Promise<void> {
    const logPath = normalizePath(this.config.logFilePath);
    const parts = logPath.split('/');
    
    if (parts.length <= 1) {
      return;
    }
    
    parts.pop(); // Remove filename
    const dirPath = parts.join('/');
    
    if (!dirPath) {
      return;
    }
    
    const dir = this.app.vault.getAbstractFileByPath(dirPath);
    if (!dir) {
      await this.app.vault.createFolder(dirPath);
    }
  }

  /**
   * Rotate log to keep within limits
   */
  private async rotateLog(): Promise<void> {
    const logPath = normalizePath(this.config.logFilePath);
    const file = this.app.vault.getAbstractFileByPath(logPath);
    
    if (!file || !(file instanceof TFile)) {
      return;
    }
    
    const content = await this.app.vault.read(file);
    const entries = parseErrorLog(content);
    
    if (entries.length === 0) {
      return;
    }
    
    // Filter by age
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.maxAgeDays);
    const cutoffTimestamp = cutoffDate.toISOString();
    
    let filteredEntries = entries.filter(entry => {
      return entry.timestamp >= cutoffTimestamp;
    });
    
    // Limit by count (keep newest)
    if (filteredEntries.length > this.config.maxEntries) {
      filteredEntries = filteredEntries.slice(0, this.config.maxEntries);
    }
    
    // Only rewrite if entries were removed
    if (filteredEntries.length < entries.length) {
      const newContent = this.rebuildLogContent(filteredEntries);
      await this.app.vault.modify(file, newContent);
    }
  }

  /**
   * Rebuild log content from entries
   */
  private rebuildLogContent(entries: ErrorLogEntry[]): string {
    let content = this.getLogHeader();
    
    for (const entry of entries) {
      content += this.formatEntry(entry);
    }
    
    return content;
  }

  /**
   * Clear all log entries
   */
  async clearLog(): Promise<void> {
    const logPath = normalizePath(this.config.logFilePath);
    const file = this.app.vault.getAbstractFileByPath(logPath);
    
    if (file && file instanceof TFile) {
      await this.app.vault.modify(file, this.getLogHeader());
    }
  }

  /**
   * Get current log entries
   */
  async getEntries(): Promise<ErrorLogEntry[]> {
    const logPath = normalizePath(this.config.logFilePath);
    const file = this.app.vault.getAbstractFileByPath(logPath);
    
    if (!file || !(file instanceof TFile)) {
      return [];
    }
    
    const content = await this.app.vault.read(file);
    return parseErrorLog(content);
  }

  /**
   * Get error count by type
   */
  async getErrorCounts(): Promise<Record<ErrorType, number>> {
    const entries = await this.getEntries();
    
    const counts: Record<ErrorType, number> = {
      extraction: 0,
      validation: 0,
      file_operation: 0,
      llm: 0,
      unknown: 0,
    };
    
    for (const entry of entries) {
      counts[entry.type]++;
    }
    
    return counts;
  }
}

/**
 * Create a logger instance with default configuration
 */
export function createLogger(app: App, config?: Partial<LoggerConfig>): Logger {
  return new Logger(app, config);
}
