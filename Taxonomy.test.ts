/**
 * Unit tests for Taxonomy
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Taxonomy, createDefaultTaxonomy } from './Taxonomy';
import { SkillMapping } from './types';

describe('Taxonomy', () => {
  let taxonomy: Taxonomy;
  
  beforeEach(() => {
    const mappings: SkillMapping[] = [
      {
        standardName: 'JavaScript',
        aliases: ['js', 'javascript', 'JS'],
        category: 'language'
      },
      {
        standardName: 'React',
        aliases: ['react', 'reactjs', 'React.js'],
        category: 'framework'
      },
      {
        standardName: 'TypeScript',
        aliases: ['ts', 'typescript'],
        category: 'language'
      }
    ];
    taxonomy = new Taxonomy(mappings);
  });
  
  describe('normalize', () => {
    it('should normalize skill aliases to standard names', () => {
      expect(taxonomy.normalize('js')).toBe('JavaScript');
      expect(taxonomy.normalize('javascript')).toBe('JavaScript');
      expect(taxonomy.normalize('JS')).toBe('JavaScript');
    });
    
    it('should normalize standard names to themselves', () => {
      expect(taxonomy.normalize('JavaScript')).toBe('JavaScript');
      expect(taxonomy.normalize('React')).toBe('React');
    });
    
    it('should be case-insensitive', () => {
      expect(taxonomy.normalize('JAVASCRIPT')).toBe('JavaScript');
      expect(taxonomy.normalize('Javascript')).toBe('JavaScript');
      expect(taxonomy.normalize('react')).toBe('React');
    });
    
    it('should trim whitespace', () => {
      expect(taxonomy.normalize('  js  ')).toBe('JavaScript');
      expect(taxonomy.normalize(' React ')).toBe('React');
    });
    
    it('should return original name for unmapped skills', () => {
      expect(taxonomy.normalize('Python')).toBe('Python');
      expect(taxonomy.normalize('Vue')).toBe('Vue');
    });
    
    it('should track unmapped skills', () => {
      taxonomy.normalize('Python');
      taxonomy.normalize('Vue');
      
      const unmapped = taxonomy.getUnmappedSkills();
      expect(unmapped).toContain('Python');
      expect(unmapped).toContain('Vue');
    });
  });
  
  describe('normalizeMany', () => {
    it('should normalize multiple skill names', () => {
      const skills = ['js', 'react', 'Python', 'typescript'];
      const normalized = taxonomy.normalizeMany(skills);
      
      expect(normalized).toEqual(['JavaScript', 'React', 'Python', 'TypeScript']);
    });
  });
  
  describe('addAlias', () => {
    it('should add new alias to existing mapping', async () => {
      await taxonomy.addAlias('javascript-lang', 'JavaScript');
      
      expect(taxonomy.normalize('javascript-lang')).toBe('JavaScript');
    });
    
    it('should create new mapping if standard name does not exist', async () => {
      await taxonomy.addAlias('python', 'Python');
      
      expect(taxonomy.normalize('python')).toBe('Python');
      expect(taxonomy.hasMapping('Python')).toBe(true);
    });
    
    it('should remove skill from unmapped list when alias is added', async () => {
      taxonomy.normalize('Python');
      expect(taxonomy.getUnmappedSkills()).toContain('Python');
      
      await taxonomy.addAlias('python', 'Python');
      expect(taxonomy.getUnmappedSkills()).not.toContain('python');
    });
  });
  
  describe('getUnmappedSkills', () => {
    it('should return list of unmapped skills', () => {
      taxonomy.normalize('Python');
      taxonomy.normalize('Vue');
      taxonomy.normalize('Django');
      
      const unmapped = taxonomy.getUnmappedSkills();
      expect(unmapped).toHaveLength(3);
      expect(unmapped).toContain('Python');
      expect(unmapped).toContain('Vue');
      expect(unmapped).toContain('Django');
    });
    
    it('should not include mapped skills', () => {
      taxonomy.normalize('JavaScript');
      taxonomy.normalize('Python');
      
      const unmapped = taxonomy.getUnmappedSkills();
      expect(unmapped).not.toContain('JavaScript');
      expect(unmapped).toContain('Python');
    });
  });
  
  describe('clearUnmappedSkills', () => {
    it('should clear unmapped skills tracking', () => {
      taxonomy.normalize('Python');
      taxonomy.normalize('Vue');
      
      expect(taxonomy.getUnmappedSkills()).toHaveLength(2);
      
      taxonomy.clearUnmappedSkills();
      expect(taxonomy.getUnmappedSkills()).toHaveLength(0);
    });
  });
  
  describe('getMapping', () => {
    it('should return mapping for standard name', () => {
      const mapping = taxonomy.getMapping('JavaScript');
      
      expect(mapping).toBeDefined();
      expect(mapping?.standardName).toBe('JavaScript');
      expect(mapping?.aliases).toContain('js');
      expect(mapping?.category).toBe('language');
    });
    
    it('should return undefined for non-existent mapping', () => {
      const mapping = taxonomy.getMapping('Python');
      expect(mapping).toBeUndefined();
    });
  });
  
  describe('getAllMappings', () => {
    it('should return all skill mappings', () => {
      const mappings = taxonomy.getAllMappings();
      
      expect(mappings).toHaveLength(3);
      expect(mappings.map(m => m.standardName)).toContain('JavaScript');
      expect(mappings.map(m => m.standardName)).toContain('React');
      expect(mappings.map(m => m.standardName)).toContain('TypeScript');
    });
  });
  
  describe('hasMapping', () => {
    it('should return true for mapped skills', () => {
      expect(taxonomy.hasMapping('JavaScript')).toBe(true);
      expect(taxonomy.hasMapping('js')).toBe(true);
      expect(taxonomy.hasMapping('react')).toBe(true);
    });
    
    it('should return false for unmapped skills', () => {
      expect(taxonomy.hasMapping('Python')).toBe(false);
      expect(taxonomy.hasMapping('Vue')).toBe(false);
    });
  });
  
  describe('getCategory', () => {
    it('should return category for mapped skills', () => {
      expect(taxonomy.getCategory('JavaScript')).toBe('language');
      expect(taxonomy.getCategory('js')).toBe('language');
      expect(taxonomy.getCategory('React')).toBe('framework');
    });
    
    it('should return undefined for unmapped skills', () => {
      expect(taxonomy.getCategory('Python')).toBeUndefined();
    });
  });
  
  describe('updateCategory', () => {
    it('should update category for existing mapping', () => {
      taxonomy.updateCategory('JavaScript', 'tool');
      
      expect(taxonomy.getCategory('JavaScript')).toBe('tool');
    });
  });
  
  describe('removeMapping', () => {
    it('should remove skill mapping', () => {
      taxonomy.removeMapping('JavaScript');
      
      expect(taxonomy.hasMapping('JavaScript')).toBe(false);
      expect(taxonomy.hasMapping('js')).toBe(false);
      expect(taxonomy.normalize('js')).toBe('js');
    });
  });
  
  describe('exportMappings', () => {
    it('should export all mappings', () => {
      const exported = taxonomy.exportMappings();
      
      expect(exported).toHaveLength(3);
      expect(exported[0]).toHaveProperty('standardName');
      expect(exported[0]).toHaveProperty('aliases');
    });
  });
  
  describe('load and save', () => {
    it('should load new mappings', async () => {
      const newMappings: SkillMapping[] = [
        {
          standardName: 'Python',
          aliases: ['python', 'py'],
          category: 'language'
        }
      ];
      
      await taxonomy.load(newMappings);
      
      expect(taxonomy.normalize('python')).toBe('Python');
      expect(taxonomy.hasMapping('JavaScript')).toBe(false);
    });
    
    it('should save current mappings', async () => {
      const saved = await taxonomy.save();
      
      expect(saved).toHaveLength(3);
      expect(saved.map(m => m.standardName)).toContain('JavaScript');
    });
  });
  
  describe('getStats', () => {
    it('should return taxonomy statistics', () => {
      taxonomy.normalize('Python');
      taxonomy.normalize('Vue');
      
      const stats = taxonomy.getStats();
      
      expect(stats.totalMappings).toBe(3);
      expect(stats.totalAliases).toBeGreaterThan(0);
      expect(stats.unmappedCount).toBe(2);
    });
  });
});

describe('createDefaultTaxonomy', () => {
  it('should create taxonomy with default mappings', () => {
    const taxonomy = createDefaultTaxonomy();
    
    expect(taxonomy.normalize('js')).toBe('JavaScript');
    expect(taxonomy.normalize('python')).toBe('Python');
    expect(taxonomy.normalize('react')).toBe('React');
    expect(taxonomy.normalize('docker')).toBe('Docker');
  });
  
  it('should have mappings for common languages', () => {
    const taxonomy = createDefaultTaxonomy();
    
    expect(taxonomy.hasMapping('JavaScript')).toBe(true);
    expect(taxonomy.hasMapping('Python')).toBe(true);
    expect(taxonomy.hasMapping('Java')).toBe(true);
    expect(taxonomy.hasMapping('Go')).toBe(true);
  });
  
  it('should have mappings for common frameworks', () => {
    const taxonomy = createDefaultTaxonomy();
    
    expect(taxonomy.hasMapping('React')).toBe(true);
    expect(taxonomy.hasMapping('Vue')).toBe(true);
    expect(taxonomy.hasMapping('Django')).toBe(true);
  });
  
  it('should have mappings for databases', () => {
    const taxonomy = createDefaultTaxonomy();
    
    expect(taxonomy.hasMapping('MySQL')).toBe(true);
    expect(taxonomy.hasMapping('PostgreSQL')).toBe(true);
    expect(taxonomy.hasMapping('MongoDB')).toBe(true);
  });
});
