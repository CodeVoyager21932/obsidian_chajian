/**
 * Tests for Error Log Parser
 * 
 * Requirements: 11.3
 */

import { describe, it, expect } from 'vitest';
import { 
  parseErrorLog, 
  categorizeError, 
  generateErrorSummary,
  getErrorTypeLabel,
  getErrorTypeIcon,
  parseTypeLabel
} from './errorLogParser';

describe('parseErrorLog', () => {
  it('should return empty array for empty content', () => {
    expect(parseErrorLog('')).toEqual([]);
    expect(parseErrorLog('   ')).toEqual([]);
  });

  it('should parse single error entry', () => {
    const content = `# CareerOS Error Log

## 2024-12-07T10:30:00.000Z

- **Path**: notes/project.md
- **Attempts**: 3
- **Error**: LLM timeout error

---
`;
    const entries = parseErrorLog(content);
    
    expect(entries).toHaveLength(1);
    expect(entries[0].timestamp).toBe('2024-12-07T10:30:00.000Z');
    expect(entries[0].path).toBe('notes/project.md');
    expect(entries[0].attempts).toBe(3);
    expect(entries[0].error).toBe('LLM timeout error');
    expect(entries[0].type).toBe('llm');
  });

  it('should parse multiple error entries', () => {
    const content = `# CareerOS Error Log

## 2024-12-07T10:30:00.000Z

- **Path**: notes/project1.md
- **Attempts**: 3
- **Error**: Schema validation failed

---

## 2024-12-07T11:00:00.000Z

- **Path**: notes/project2.md
- **Attempts**: 2
- **Error**: File read permission denied

---
`;
    const entries = parseErrorLog(content);
    
    expect(entries).toHaveLength(2);
    expect(entries[0].path).toBe('notes/project1.md');
    expect(entries[0].type).toBe('validation');
    expect(entries[1].path).toBe('notes/project2.md');
    expect(entries[1].type).toBe('file_operation');
  });

  it('should handle entries without separator', () => {
    const content = `# CareerOS Error Log

## 2024-12-07T10:30:00.000Z

- **Path**: notes/test.md
- **Attempts**: 1
- **Error**: Test error

## 2024-12-07T11:00:00.000Z

- **Path**: notes/test2.md
- **Attempts**: 2
- **Error**: Another error
`;
    const entries = parseErrorLog(content);
    
    expect(entries).toHaveLength(2);
  });
});

describe('categorizeError', () => {
  it('should categorize LLM errors', () => {
    expect(categorizeError('LLM timeout error')).toBe('llm');
    expect(categorizeError('API rate limit exceeded')).toBe('llm');
    expect(categorizeError('Network connection failed')).toBe('llm');
    expect(categorizeError('Connection timeout')).toBe('llm');
  });

  it('should categorize validation errors', () => {
    expect(categorizeError('Schema validation failed')).toBe('validation');
    expect(categorizeError('Invalid JSON format')).toBe('validation');
    expect(categorizeError('Failed to parse response')).toBe('validation');
  });

  it('should categorize file operation errors', () => {
    expect(categorizeError('File read error')).toBe('file_operation');
    expect(categorizeError('Write permission denied')).toBe('file_operation');
    expect(categorizeError('ENOENT: no such file')).toBe('file_operation');
    expect(categorizeError('Directory not found')).toBe('file_operation');
  });

  it('should categorize extraction errors', () => {
    expect(categorizeError('NoteCard extraction failed')).toBe('extraction');
    expect(categorizeError('JDCard extract error')).toBe('extraction');
  });

  it('should return unknown for unrecognized errors', () => {
    expect(categorizeError('Something went wrong')).toBe('unknown');
    expect(categorizeError('Unexpected error occurred')).toBe('unknown');
  });
});

describe('generateErrorSummary', () => {
  it('should generate summary with zero counts for empty entries', () => {
    const summary = generateErrorSummary([]);
    
    expect(summary.totalErrors).toBe(0);
    expect(summary.byType.extraction).toBe(0);
    expect(summary.byType.validation).toBe(0);
    expect(summary.byType.file_operation).toBe(0);
    expect(summary.byType.llm).toBe(0);
    expect(summary.byType.unknown).toBe(0);
    expect(summary.entries).toEqual([]);
  });

  it('should count errors by type correctly', () => {
    const entries = [
      { timestamp: '2024-12-07T10:00:00Z', path: 'a.md', attempts: 1, error: 'LLM error', type: 'llm' as const },
      { timestamp: '2024-12-07T10:01:00Z', path: 'b.md', attempts: 1, error: 'Schema error', type: 'validation' as const },
      { timestamp: '2024-12-07T10:02:00Z', path: 'c.md', attempts: 1, error: 'API error', type: 'llm' as const },
      { timestamp: '2024-12-07T10:03:00Z', path: 'd.md', attempts: 1, error: 'File error', type: 'file_operation' as const },
    ];
    
    const summary = generateErrorSummary(entries);
    
    expect(summary.totalErrors).toBe(4);
    expect(summary.byType.llm).toBe(2);
    expect(summary.byType.validation).toBe(1);
    expect(summary.byType.file_operation).toBe(1);
    expect(summary.byType.extraction).toBe(0);
    expect(summary.byType.unknown).toBe(0);
  });
});

describe('getErrorTypeLabel', () => {
  it('should return correct labels', () => {
    expect(getErrorTypeLabel('extraction')).toBe('Extraction');
    expect(getErrorTypeLabel('validation')).toBe('Validation');
    expect(getErrorTypeLabel('file_operation')).toBe('File Operation');
    expect(getErrorTypeLabel('llm')).toBe('LLM/API');
    expect(getErrorTypeLabel('unknown')).toBe('Other');
  });
});

describe('getErrorTypeIcon', () => {
  it('should return correct icons', () => {
    expect(getErrorTypeIcon('extraction')).toBe('📝');
    expect(getErrorTypeIcon('validation')).toBe('⚠️');
    expect(getErrorTypeIcon('file_operation')).toBe('📁');
    expect(getErrorTypeIcon('llm')).toBe('🤖');
    expect(getErrorTypeIcon('unknown')).toBe('❓');
  });
});

describe('parseTypeLabel', () => {
  it('should parse type labels correctly', () => {
    expect(parseTypeLabel('Extraction')).toBe('extraction');
    expect(parseTypeLabel('Schema Validation')).toBe('validation');
    expect(parseTypeLabel('Validation')).toBe('validation');
    expect(parseTypeLabel('File Operation')).toBe('file_operation');
    expect(parseTypeLabel('LLM/API')).toBe('llm');
    expect(parseTypeLabel('LLM')).toBe('llm');
    expect(parseTypeLabel('API')).toBe('llm');
    expect(parseTypeLabel('Unknown')).toBe('unknown');
    expect(parseTypeLabel('Other')).toBe('unknown');
  });

  it('should return unknown for unrecognized labels', () => {
    expect(parseTypeLabel('Something Else')).toBe('unknown');
    expect(parseTypeLabel('')).toBe('unknown');
  });
});

describe('parseErrorLog with new format', () => {
  it('should parse entries with explicit Type field', () => {
    const content = `# CareerOS Error Log

## 2024-12-07T10:30:00.000Z

- **Type**: LLM/API
- **Path**: notes/project.md
- **Attempts**: 3
- **Error**: Connection timeout

---
`;
    const entries = parseErrorLog(content);
    
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('llm');
    expect(entries[0].path).toBe('notes/project.md');
    expect(entries[0].attempts).toBe(3);
    expect(entries[0].error).toBe('Connection timeout');
  });

  it('should parse entries with Details field', () => {
    const content = `# CareerOS Error Log

## 2024-12-07T10:30:00.000Z

- **Type**: Schema Validation
- **Path**: notes/test.md
- **Attempts**: 1
- **Error**: Invalid JSON structure
- **Details**: Missing required field 'summary'

---
`;
    const entries = parseErrorLog(content);
    
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('validation');
    expect(entries[0].error).toBe('Invalid JSON structure');
  });

  it('should fallback to auto-categorization for legacy format', () => {
    const content = `# CareerOS Error Log

## 2024-12-07T10:30:00.000Z

- **Path**: notes/project.md
- **Attempts**: 3
- **Error**: LLM timeout error

---
`;
    const entries = parseErrorLog(content);
    
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('llm');
  });
});
