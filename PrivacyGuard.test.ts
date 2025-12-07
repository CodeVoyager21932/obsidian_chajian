/**
 * Unit tests for PrivacyGuard
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PrivacyGuard } from './PrivacyGuard';
import { ExclusionRules, LLMProvider } from './types';

describe('PrivacyGuard', () => {
  let privacyGuard: PrivacyGuard;
  let exclusionRules: ExclusionRules;
  
  beforeEach(() => {
    exclusionRules = {
      directories: ['private/', 'personal/'],
      tags: ['#private', '#confidential']
    };
    privacyGuard = new PrivacyGuard(exclusionRules);
  });
  
  describe('filterPII', () => {
    it('should filter email addresses for external LLMs', () => {
      const content = 'Contact me at john.doe@example.com for details.';
      const filtered = privacyGuard.filterPII(content, 'openai');
      
      expect(filtered).not.toContain('john.doe@example.com');
      expect(filtered).toContain('[EMAIL_REDACTED]');
    });
    
    it('should filter Chinese mobile phone numbers', () => {
      const content = '我的电话是 13812345678，请联系我。';
      const filtered = privacyGuard.filterPII(content, 'anthropic');
      
      expect(filtered).not.toContain('13812345678');
      expect(filtered).toContain('[PHONE_REDACTED]');
    });
    
    it('should filter multiple PII instances', () => {
      const content = 'Email: test@example.com, Phone: 13900001111';
      const filtered = privacyGuard.filterPII(content, 'google');
      
      expect(filtered).not.toContain('test@example.com');
      expect(filtered).not.toContain('13900001111');
      expect(filtered).toContain('[EMAIL_REDACTED]');
      expect(filtered).toContain('[PHONE_REDACTED]');
    });
    
    it('should not filter content for local LLM', () => {
      const content = 'Contact me at john.doe@example.com or 13812345678.';
      const filtered = privacyGuard.filterPII(content, 'local');
      
      expect(filtered).toBe(content);
      expect(filtered).toContain('john.doe@example.com');
      expect(filtered).toContain('13812345678');
    });
    
    it('should preserve non-PII content', () => {
      const content = 'This is a project about React and TypeScript.';
      const filtered = privacyGuard.filterPII(content, 'openai');
      
      expect(filtered).toBe(content);
    });
  });
  
  describe('shouldExclude', () => {
    it('should exclude notes in excluded directories', () => {
      expect(privacyGuard.shouldExclude('private/diary.md', [])).toBe(true);
      expect(privacyGuard.shouldExclude('personal/notes.md', [])).toBe(true);
    });
    
    it('should exclude notes with excluded tags', () => {
      expect(privacyGuard.shouldExclude('notes/work.md', ['#private'])).toBe(true);
      expect(privacyGuard.shouldExclude('notes/project.md', ['#confidential'])).toBe(true);
    });
    
    it('should not exclude notes without exclusion criteria', () => {
      expect(privacyGuard.shouldExclude('notes/project.md', ['#work'])).toBe(false);
      expect(privacyGuard.shouldExclude('work/task.md', [])).toBe(false);
    });
    
    it('should handle Windows-style paths', () => {
      expect(privacyGuard.shouldExclude('private\\diary.md', [])).toBe(true);
    });
    
    it('should exclude notes in subdirectories of excluded directories', () => {
      expect(privacyGuard.shouldExclude('private/2024/diary.md', [])).toBe(true);
    });
  });
  
  describe('getExclusionRules', () => {
    it('should return current exclusion rules', () => {
      const rules = privacyGuard.getExclusionRules();
      
      expect(rules.directories).toEqual(['private/', 'personal/']);
      expect(rules.tags).toEqual(['#private', '#confidential']);
    });
    
    it('should return a copy of rules', () => {
      const rules = privacyGuard.getExclusionRules();
      rules.directories.push('test/');
      
      const rules2 = privacyGuard.getExclusionRules();
      expect(rules2.directories).not.toContain('test/');
    });
  });
  
  describe('updateExclusionRules', () => {
    it('should update exclusion rules', () => {
      const newRules: ExclusionRules = {
        directories: ['secret/'],
        tags: ['#secret']
      };
      
      privacyGuard.updateExclusionRules(newRules);
      
      expect(privacyGuard.shouldExclude('secret/file.md', [])).toBe(true);
      expect(privacyGuard.shouldExclude('private/file.md', [])).toBe(false);
    });
  });
  
  describe('custom PII patterns', () => {
    it('should allow adding custom PII patterns', () => {
      privacyGuard.addCustomPattern({
        type: 'custom',
        pattern: /\bPASSWORD:\s*\S+/g,
        replacement: '[PASSWORD_REDACTED]'
      });
      
      const content = 'My credentials: PASSWORD: secret123';
      const filtered = privacyGuard.filterPII(content, 'openai');
      
      expect(filtered).not.toContain('PASSWORD: secret123');
      expect(filtered).toContain('[PASSWORD_REDACTED]');
    });
  });
});
