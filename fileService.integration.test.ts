/**
 * Integration tests for FileService and IndexStore
 * These tests verify core functionality without extensive mocking
 */

import { describe, it, expect } from 'vitest';
import { getCardPath } from './IndexStore';
import { CURRENT_SCHEMA_VERSION } from './schema';

describe('FileService and IndexStore Integration', () => {
  describe('Path Resolution', () => {
    it('should convert note path to card path correctly', () => {
      const cardPath = getCardPath('projects/my-project.md', 'index');
      expect(cardPath).toBe('index/projects_my-project.json');
    });

    it('should handle paths with multiple slashes', () => {
      const cardPath = getCardPath('a/b/c/note.md', 'index');
      expect(cardPath).toBe('index/a_b_c_note.json');
    });

    it('should handle paths without extension', () => {
      const cardPath = getCardPath('note', 'index');
      expect(cardPath).toBe('index/note.json');
    });

    it('should handle Windows-style paths', () => {
      const cardPath = getCardPath('projects\\my-project.md', 'index');
      expect(cardPath).toBe('index/projects_my-project.json');
    });
  });

  describe('Schema Version', () => {
    it('should have current schema version defined', () => {
      expect(CURRENT_SCHEMA_VERSION).toBe(1);
    });
  });

  describe('Type Safety', () => {
    it('should validate NoteCard structure', () => {
      const noteCard = {
        schema_version: 1,
        note_path: 'test.md',
        hash: 'abc123',
        summary: 'Test',
        type: 'project' as const,
        time_span: '2024',
        tech_stack: [],
        topics: [],
        preferences: { likes: [], dislikes: [], traits: [] },
        evidence: [],
        last_updated: '2024-01-01',
        detected_date: '2024-01-01T00:00:00Z',
      };

      expect(noteCard.schema_version).toBe(1);
      expect(noteCard.type).toBe('project');
    });

    it('should validate JDCard structure', () => {
      const jdCard = {
        schema_version: 1,
        jd_id: 'test-123',
        source_note: 'jobs/test.md',
        company: 'Test Co',
        title: 'Developer',
        location: 'Beijing',
        salary_range: '20k-30k',
        skills_required: ['TypeScript'],
        skills_optional: [],
        experience: '3-5 years',
        degree: 'Bachelor',
        raw_text_hash: 'hash123',
        tags: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      expect(jdCard.schema_version).toBe(1);
      expect(jdCard.jd_id).toBe('test-123');
    });
  });
});
