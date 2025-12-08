/**
 * Error Log Parser - Parses error_log.md and extracts structured error entries
 * 
 * Requirements: 11.3
 * - Read error_log.md and parse error entries
 * - Categorize errors by type (extraction, validation, file operation)
 */

import { ErrorLogEntry, ErrorLogSummary, ErrorType } from '../types';

/**
 * Parse error_log.md content into structured entries
 * 
 * Expected format (new format with Type field):
 * ## 2024-12-07T10:30:00.000Z
 * - **Type**: LLM/API
 * - **Path**: path/to/note.md
 * - **Attempts**: 3
 * - **Error**: Error message here
 * - **Details**: Optional details
 * ---
 * 
 * Also supports legacy format without Type field (auto-categorizes from error message)
 */
export function parseErrorLog(content: string): ErrorLogEntry[] {
  if (!content || content.trim() === '') {
    return [];
  }
  
  const entries: ErrorLogEntry[] = [];
  
  // Split by error entry separator (## timestamp)
  const entryPattern = /## (\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\s*\n([\s\S]*?)(?=\n---|\n## |$)/g;
  
  let match;
  while ((match = entryPattern.exec(content)) !== null) {
    const timestamp = match[1];
    const body = match[2];
    
    // Extract fields from body
    const typeMatch = body.match(/\*\*Type\*\*:\s*(.+)/);
    const pathMatch = body.match(/\*\*Path\*\*:\s*(.+)/);
    const attemptsMatch = body.match(/\*\*Attempts\*\*:\s*(\d+)/);
    const errorMatch = body.match(/\*\*Error\*\*:\s*([\s\S]*?)(?=\n-|\n$|$)/);
    
    if (timestamp) {
      const errorMessage = errorMatch ? errorMatch[1].trim() : 'Unknown error';
      
      // Use explicit type if provided, otherwise categorize from error message
      let errorType: ErrorType;
      if (typeMatch) {
        errorType = parseTypeLabel(typeMatch[1].trim());
      } else {
        errorType = categorizeError(errorMessage);
      }
      
      entries.push({
        timestamp,
        path: pathMatch ? pathMatch[1].trim() : 'Unknown path',
        attempts: attemptsMatch ? parseInt(attemptsMatch[1], 10) : 0,
        error: errorMessage,
        type: errorType,
      });
    }
  }
  
  return entries;
}

/**
 * Parse type label back to ErrorType
 */
export function parseTypeLabel(label: string): ErrorType {
  const labelMap: Record<string, ErrorType> = {
    'extraction': 'extraction',
    'schema validation': 'validation',
    'validation': 'validation',
    'file operation': 'file_operation',
    'llm/api': 'llm',
    'llm': 'llm',
    'api': 'llm',
    'unknown': 'unknown',
    'other': 'unknown',
  };
  
  const normalized = label.toLowerCase();
  return labelMap[normalized] || 'unknown';
}

/**
 * Categorize error based on error message content
 */
export function categorizeError(errorMessage: string): ErrorType {
  const lowerMessage = errorMessage.toLowerCase();
  
  // LLM related errors
  if (
    lowerMessage.includes('llm') ||
    lowerMessage.includes('api') ||
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('rate limit') ||
    lowerMessage.includes('network') ||
    lowerMessage.includes('connection')
  ) {
    return 'llm';
  }
  
  // Validation/Schema errors
  if (
    lowerMessage.includes('schema') ||
    lowerMessage.includes('validation') ||
    lowerMessage.includes('invalid') ||
    lowerMessage.includes('parse') ||
    lowerMessage.includes('json')
  ) {
    return 'validation';
  }
  
  // File operation errors
  if (
    lowerMessage.includes('file') ||
    lowerMessage.includes('read') ||
    lowerMessage.includes('write') ||
    lowerMessage.includes('permission') ||
    lowerMessage.includes('enoent') ||
    lowerMessage.includes('directory')
  ) {
    return 'file_operation';
  }
  
  // Extraction errors
  if (
    lowerMessage.includes('extract') ||
    lowerMessage.includes('notecard') ||
    lowerMessage.includes('jdcard')
  ) {
    return 'extraction';
  }
  
  return 'unknown';
}

/**
 * Generate error summary from entries
 */
export function generateErrorSummary(entries: ErrorLogEntry[]): ErrorLogSummary {
  const byType: Record<ErrorType, number> = {
    extraction: 0,
    validation: 0,
    file_operation: 0,
    llm: 0,
    unknown: 0,
  };
  
  for (const entry of entries) {
    byType[entry.type]++;
  }
  
  return {
    totalErrors: entries.length,
    byType,
    entries,
  };
}

/**
 * Get human-readable label for error type
 */
export function getErrorTypeLabel(type: ErrorType): string {
  const labels: Record<ErrorType, string> = {
    extraction: 'Extraction',
    validation: 'Validation',
    file_operation: 'File Operation',
    llm: 'LLM/API',
    unknown: 'Other',
  };
  return labels[type];
}

/**
 * Get icon for error type
 */
export function getErrorTypeIcon(type: ErrorType): string {
  const icons: Record<ErrorType, string> = {
    extraction: '📝',
    validation: '⚠️',
    file_operation: '📁',
    llm: '🤖',
    unknown: '❓',
  };
  return icons[type];
}
