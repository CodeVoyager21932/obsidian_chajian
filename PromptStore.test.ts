/**
 * Tests for PromptStore
 * 
 * **Feature: career-os, Property 14: JSON cleaning and validation**
 * **Validates: Requirements 5.1, 5.2**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EmbeddedPromptStore } from './PromptStore';

describe('EmbeddedPromptStore', () => {
  let store: EmbeddedPromptStore;

  beforeEach(() => {
    store = new EmbeddedPromptStore();
  });

  describe('getPrompt', () => {
    it('should return noteCard prompt template', () => {
      const prompt = store.getPrompt('noteCard', {});
      expect(prompt).toContain('职业规划助手');
      expect(prompt).toContain('NoteCard');
      expect(prompt).toContain('{{note_path}}');
    });

    it('should return jdCard prompt template', () => {
      const prompt = store.getPrompt('jdCard', {});
      expect(prompt).toContain('招聘信息分析');
      expect(prompt).toContain('JDCard');
      expect(prompt).toContain('{{source_note}}');
    });

    it('should return plan prompt template', () => {
      const prompt = store.getPrompt('plan', {});
      expect(prompt).toContain('职业规划顾问');
      expect(prompt).toContain('差距分析');
      expect(prompt).toContain('{{target_role}}');
    });

    it('should throw error for unknown prompt', () => {
      expect(() => store.getPrompt('unknown' as any, {})).toThrow('Unknown prompt');
    });
  });

  describe('interpolate', () => {
    it('should interpolate single variable', () => {
      const template = 'Hello {{name}}!';
      const result = store.interpolate(template, { name: 'World' });
      expect(result).toBe('Hello World!');
    });

    it('should interpolate multiple variables', () => {
      const template = '{{greeting}} {{name}}, welcome to {{place}}!';
      const result = store.interpolate(template, {
        greeting: 'Hello',
        name: 'Alice',
        place: 'CareerOS',
      });
      expect(result).toBe('Hello Alice, welcome to CareerOS!');
    });

    it('should keep unmatched placeholders', () => {
      const template = 'Hello {{name}}, your id is {{id}}';
      const result = store.interpolate(template, { name: 'Bob' });
      expect(result).toBe('Hello Bob, your id is {{id}}');
    });

    it('should handle empty variables object', () => {
      const template = 'Hello {{name}}!';
      const result = store.interpolate(template, {});
      expect(result).toBe('Hello {{name}}!');
    });

    it('should handle template without placeholders', () => {
      const template = 'Hello World!';
      const result = store.interpolate(template, { name: 'Test' });
      expect(result).toBe('Hello World!');
    });

    it('should handle empty string values', () => {
      const template = 'Value: {{value}}';
      const result = store.interpolate(template, { value: '' });
      expect(result).toBe('Value: ');
    });

    it('should handle special characters in values', () => {
      const template = 'Content: {{content}}';
      const result = store.interpolate(template, { 
        content: 'Line1\nLine2\t"quoted"' 
      });
      expect(result).toBe('Content: Line1\nLine2\t"quoted"');
    });

    it('should handle multiple occurrences of same variable', () => {
      const template = '{{name}} said: "Hello, {{name}}!"';
      const result = store.interpolate(template, { name: 'Alice' });
      expect(result).toBe('Alice said: "Hello, Alice!"');
    });
  });

  describe('getPrompt with interpolation', () => {
    it('should interpolate noteCard prompt variables', () => {
      const prompt = store.getPrompt('noteCard', {
        note_path: 'projects/my-project.md',
        note_content: 'This is my project content',
        content_hash: 'abc123',
        current_date: '2024-12-07',
      });

      expect(prompt).toContain('projects/my-project.md');
      expect(prompt).toContain('This is my project content');
      expect(prompt).toContain('abc123');
      expect(prompt).toContain('2024-12-07');
    });

    it('should interpolate jdCard prompt variables', () => {
      const prompt = store.getPrompt('jdCard', {
        source_note: 'market/jd-list.md',
        note_content: 'Job description content',
        current_date: '2024-12-07',
      });

      expect(prompt).toContain('market/jd-list.md');
      expect(prompt).toContain('Job description content');
      expect(prompt).toContain('2024-12-07');
    });

    it('should interpolate plan prompt variables', () => {
      const prompt = store.getPrompt('plan', {
        self_profile_analysis_view: '{"skills": []}',
        market_profile: '{"role": "Backend"}',
        target_role: 'Python 后端',
        target_location: '杭州',
        period_months: '3',
        weekly_hours: '10',
      });

      expect(prompt).toContain('{"skills": []}');
      expect(prompt).toContain('{"role": "Backend"}');
      expect(prompt).toContain('Python 后端');
      expect(prompt).toContain('杭州');
      expect(prompt).toContain('3 个月');
      expect(prompt).toContain('10 小时');
    });
  });
});
