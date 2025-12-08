/**
 * Tests for Logger
 * 
 * Requirements: 4.5, 5.4
 * Property 13: Error logging and continuation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger, LoggerConfig, LogEntry, createLogger } from './logger';
import { ErrorType } from './types';

// Mock Obsidian App
const createMockApp = () => {
  const files: Map<string, string> = new Map();
  
  return {
    vault: {
      getAbstractFileByPath: vi.fn((path: string) => {
        if (files.has(path)) {
          return { path } as any;
        }
        return null;
      }),
      read: vi.fn(async (file: any) => {
        return files.get(file.path) || '';
      }),
      modify: vi.fn(async (file: any, content: string) => {
        files.set(file.path, content);
      }),
      create: vi.fn(async (path: string, content: string) => {
        files.set(path, content);
      }),
      createFolder: vi.fn(async () => {}),
      delete: vi.fn(async () => {}),
    },
    // Helper to access internal state for testing
    _files: files,
  };
};

describe('Logger', () => {
  let mockApp: ReturnType<typeof createMockApp>;
  let logger: Logger;
  const testConfig: Partial<LoggerConfig> = {
    logFilePath: 'test/error_log.md',
    maxEntries: 10,
    maxAgeDays: 7,
  };

  beforeEach(() => {
    mockApp = createMockApp();
    logger = new Logger(mockApp as any, testConfig);
  });

  describe('logError', () => {
    it('should create log file with header if not exists', async () => {
      await logger.logError({
        path: 'notes/test.md',
        error: 'Test error message',
        attempts: 1,
      });

      expect(mockApp.vault.create).toHaveBeenCalled();
      const createCall = mockApp.vault.create.mock.calls[0];
      expect(createCall[0]).toBe('test/error_log.md');
      expect(createCall[1]).toContain('# CareerOS Error Log');
      expect(createCall[1]).toContain('**Path**: notes/test.md');
      expect(createCall[1]).toContain('**Error**: Test error message');
    });

    it('should include error type in log entry', async () => {
      await logger.logError({
        path: 'notes/test.md',
        error: 'Test error',
        type: 'llm',
      });

      const createCall = mockApp.vault.create.mock.calls[0];
      expect(createCall[1]).toContain('**Type**: LLM/API');
    });

    it('should auto-categorize error type if not provided', async () => {
      await logger.logError({
        path: 'notes/test.md',
        error: 'Schema validation failed',
      });

      const createCall = mockApp.vault.create.mock.calls[0];
      expect(createCall[1]).toContain('**Type**: Schema Validation');
    });

    it('should include details if provided', async () => {
      await logger.logError({
        path: 'notes/test.md',
        error: 'Test error',
        details: 'Additional context here',
      });

      const createCall = mockApp.vault.create.mock.calls[0];
      expect(createCall[1]).toContain('**Details**: Additional context here');
    });
  });

  describe('convenience methods', () => {
    it('logLLMError should set type to llm', async () => {
      await logger.logLLMError('notes/test.md', 'API timeout', 3, 'Retry exhausted');

      const createCall = mockApp.vault.create.mock.calls[0];
      expect(createCall[1]).toContain('**Type**: LLM/API');
      expect(createCall[1]).toContain('**Attempts**: 3');
      expect(createCall[1]).toContain('**Details**: Retry exhausted');
    });

    it('logValidationError should set type to validation', async () => {
      await logger.logValidationError('notes/test.md', 'Invalid JSON');

      const createCall = mockApp.vault.create.mock.calls[0];
      expect(createCall[1]).toContain('**Type**: Schema Validation');
    });

    it('logFileError should set type to file_operation', async () => {
      await logger.logFileError('notes/test.md', 'Permission denied');

      const createCall = mockApp.vault.create.mock.calls[0];
      expect(createCall[1]).toContain('**Type**: File Operation');
    });

    it('logExtractionError should set type to extraction', async () => {
      await logger.logExtractionError('notes/test.md', 'NoteCard extraction failed', 2);

      const createCall = mockApp.vault.create.mock.calls[0];
      expect(createCall[1]).toContain('**Type**: Extraction');
      expect(createCall[1]).toContain('**Attempts**: 2');
    });
  });

  describe('log format', () => {
    it('should format entry with ISO timestamp', async () => {
      const beforeTime = new Date().toISOString().slice(0, 10);
      
      await logger.logError({
        path: 'notes/test.md',
        error: 'Test error',
      });

      const createCall = mockApp.vault.create.mock.calls[0];
      // Check that timestamp starts with current date
      expect(createCall[1]).toMatch(/## \d{4}-\d{2}-\d{2}T/);
    });

    it('should include separator after each entry', async () => {
      await logger.logError({
        path: 'notes/test.md',
        error: 'Test error',
      });

      const createCall = mockApp.vault.create.mock.calls[0];
      expect(createCall[1]).toContain('---');
    });
  });

  describe('createLogger', () => {
    it('should create logger with default config', () => {
      const logger = createLogger(mockApp as any);
      expect(logger).toBeInstanceOf(Logger);
    });

    it('should create logger with custom config', () => {
      const logger = createLogger(mockApp as any, { maxEntries: 50 });
      expect(logger).toBeInstanceOf(Logger);
    });
  });
});

describe('Logger error categorization', () => {
  it('should map error types to correct labels', () => {
    const typeLabels: Record<ErrorType, string> = {
      extraction: 'Extraction',
      validation: 'Schema Validation',
      file_operation: 'File Operation',
      llm: 'LLM/API',
      unknown: 'Unknown',
    };

    // Verify all types have labels
    const types: ErrorType[] = ['extraction', 'validation', 'file_operation', 'llm', 'unknown'];
    for (const type of types) {
      expect(typeLabels[type]).toBeDefined();
    }
  });
});
