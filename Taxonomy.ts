/**
 * Taxonomy - Skill name normalization and standardization
 * 
 * Validates: Requirements 7.1, 13.1, 13.2, 13.3
 * - Property 18: Skill normalization consistency
 */

import { SkillMapping, SkillCategory } from './types';

export class Taxonomy {
  private mappings: Map<string, SkillMapping>;
  private aliasToStandard: Map<string, string>;
  private unmappedSkills: Set<string>;
  
  constructor(initialMappings: SkillMapping[] = []) {
    this.mappings = new Map();
    this.aliasToStandard = new Map();
    this.unmappedSkills = new Set();
    
    // Load initial mappings
    this.loadMappings(initialMappings);
  }
  
  /**
   * Load skill mappings from configuration
   */
  private loadMappings(mappings: SkillMapping[]): void {
    for (const mapping of mappings) {
      this.addMapping(mapping);
    }
  }
  
  /**
   * Add a skill mapping
   */
  private addMapping(mapping: SkillMapping): void {
    const standardLower = mapping.standardName.toLowerCase();
    
    // Store the mapping
    this.mappings.set(standardLower, mapping);
    
    // Map standard name to itself
    this.aliasToStandard.set(standardLower, mapping.standardName);
    
    // Map all aliases to standard name
    for (const alias of mapping.aliases) {
      const aliasLower = alias.toLowerCase();
      this.aliasToStandard.set(aliasLower, mapping.standardName);
    }
  }
  
  /**
   * Normalize a skill name to its standard form
   * 
   * Property 18: For any skill name appearing in NoteCards or JDCards,
   * when building SelfProfile or MarketProfile, the system should apply
   * the same Taxonomy normalization rules, mapping aliases to standard
   * names consistently across both profiles.
   * 
   * @param skillName - Original skill name
   * @returns Normalized standard skill name
   */
  normalize(skillName: string): string {
    const skillLower = skillName.trim().toLowerCase();
    
    // Check if we have a mapping for this skill
    const standardName = this.aliasToStandard.get(skillLower);
    
    if (standardName) {
      return standardName;
    }
    
    // No mapping found - track as unmapped and return original
    this.unmappedSkills.add(skillName.trim());
    return skillName.trim();
  }
  
  /**
   * Normalize multiple skill names
   */
  normalizeMany(skillNames: string[]): string[] {
    return skillNames.map(name => this.normalize(name));
  }
  
  /**
   * Add a new skill alias mapping
   * 
   * Validates: Requirements 13.3
   * 
   * @param alias - Alias to add
   * @param standardName - Standard name to map to
   */
  async addAlias(alias: string, standardName: string): Promise<void> {
    const aliasLower = alias.toLowerCase();
    const standardLower = standardName.toLowerCase();
    
    // Get or create mapping for standard name
    let mapping = this.mappings.get(standardLower);
    
    if (!mapping) {
      // Create new mapping
      mapping = {
        standardName: standardName,
        aliases: []
      };
      this.mappings.set(standardLower, mapping);
      this.aliasToStandard.set(standardLower, standardName);
    }
    
    // Add alias if not already present
    if (!mapping.aliases.includes(alias)) {
      mapping.aliases.push(alias);
    }
    
    // Update alias mapping
    this.aliasToStandard.set(aliasLower, mapping.standardName);
    
    // Remove from unmapped if it was there
    this.unmappedSkills.delete(alias);
  }
  
  /**
   * Get all unmapped skills from recent processing
   * 
   * Validates: Requirements 13.2
   * 
   * @returns Array of skill names that couldn't be mapped
   */
  getUnmappedSkills(): string[] {
    return Array.from(this.unmappedSkills);
  }
  
  /**
   * Clear unmapped skills tracking
   */
  clearUnmappedSkills(): void {
    this.unmappedSkills.clear();
  }
  
  /**
   * Get a skill mapping by standard name
   */
  getMapping(standardName: string): SkillMapping | undefined {
    return this.mappings.get(standardName.toLowerCase());
  }
  
  /**
   * Get all skill mappings
   */
  getAllMappings(): SkillMapping[] {
    return Array.from(this.mappings.values());
  }
  
  /**
   * Check if a skill name has a mapping
   */
  hasMapping(skillName: string): boolean {
    return this.aliasToStandard.has(skillName.toLowerCase());
  }
  
  /**
   * Get the category for a skill
   */
  getCategory(skillName: string): SkillCategory | undefined {
    const standardName = this.normalize(skillName);
    const mapping = this.mappings.get(standardName.toLowerCase());
    return mapping?.category;
  }
  
  /**
   * Update a skill mapping's category
   */
  updateCategory(standardName: string, category: SkillCategory): void {
    const mapping = this.mappings.get(standardName.toLowerCase());
    if (mapping) {
      mapping.category = category;
    }
  }
  
  /**
   * Remove a skill mapping
   */
  removeMapping(standardName: string): void {
    const standardLower = standardName.toLowerCase();
    const mapping = this.mappings.get(standardLower);
    
    if (mapping) {
      // Remove all alias mappings
      this.aliasToStandard.delete(standardLower);
      for (const alias of mapping.aliases) {
        this.aliasToStandard.delete(alias.toLowerCase());
      }
      
      // Remove the mapping itself
      this.mappings.delete(standardLower);
    }
  }
  
  /**
   * Export mappings for persistence
   */
  exportMappings(): SkillMapping[] {
    return this.getAllMappings();
  }
  
  /**
   * Load mappings from external source
   */
  async load(mappings: SkillMapping[]): Promise<void> {
    // Clear existing mappings
    this.mappings.clear();
    this.aliasToStandard.clear();
    
    // Load new mappings
    this.loadMappings(mappings);
  }
  
  /**
   * Save current mappings (returns data for persistence)
   */
  async save(): Promise<SkillMapping[]> {
    return this.exportMappings();
  }
  
  /**
   * Get statistics about the taxonomy
   */
  getStats(): {
    totalMappings: number;
    totalAliases: number;
    unmappedCount: number;
  } {
    let totalAliases = 0;
    for (const mapping of this.mappings.values()) {
      totalAliases += mapping.aliases.length;
    }
    
    return {
      totalMappings: this.mappings.size,
      totalAliases,
      unmappedCount: this.unmappedSkills.size
    };
  }
}

/**
 * Create a default taxonomy with common skill mappings
 */
export function createDefaultTaxonomy(): Taxonomy {
  const defaultMappings: SkillMapping[] = [
    // Programming Languages
    {
      standardName: 'JavaScript',
      aliases: ['js', 'javascript', 'JS', 'Javascript'],
      category: 'language'
    },
    {
      standardName: 'TypeScript',
      aliases: ['ts', 'typescript', 'TS', 'Typescript'],
      category: 'language'
    },
    {
      standardName: 'Python',
      aliases: ['python', 'py', 'Python3', 'python3'],
      category: 'language'
    },
    {
      standardName: 'Java',
      aliases: ['java', 'JAVA'],
      category: 'language'
    },
    {
      standardName: 'C++',
      aliases: ['cpp', 'c++', 'CPP', 'C++'],
      category: 'language'
    },
    {
      standardName: 'Go',
      aliases: ['go', 'golang', 'Golang', 'GO'],
      category: 'language'
    },
    {
      standardName: 'Rust',
      aliases: ['rust', 'RUST'],
      category: 'language'
    },
    
    // Frameworks
    {
      standardName: 'React',
      aliases: ['react', 'reactjs', 'React.js', 'ReactJS'],
      category: 'framework'
    },
    {
      standardName: 'Vue',
      aliases: ['vue', 'vuejs', 'Vue.js', 'VueJS'],
      category: 'framework'
    },
    {
      standardName: 'Angular',
      aliases: ['angular', 'angularjs', 'Angular.js'],
      category: 'framework'
    },
    {
      standardName: 'Node.js',
      aliases: ['node', 'nodejs', 'node.js', 'Node', 'NodeJS'],
      category: 'framework'
    },
    {
      standardName: 'Express',
      aliases: ['express', 'expressjs', 'Express.js'],
      category: 'framework'
    },
    {
      standardName: 'Django',
      aliases: ['django', 'Django'],
      category: 'framework'
    },
    {
      standardName: 'Flask',
      aliases: ['flask', 'Flask'],
      category: 'framework'
    },
    {
      standardName: 'Spring Boot',
      aliases: ['spring boot', 'springboot', 'Spring', 'spring'],
      category: 'framework'
    },
    
    // Databases
    {
      standardName: 'MySQL',
      aliases: ['mysql', 'MySQL', 'MYSQL'],
      category: 'database'
    },
    {
      standardName: 'PostgreSQL',
      aliases: ['postgresql', 'postgres', 'PostgreSQL', 'Postgres'],
      category: 'database'
    },
    {
      standardName: 'MongoDB',
      aliases: ['mongodb', 'mongo', 'MongoDB', 'Mongo'],
      category: 'database'
    },
    {
      standardName: 'Redis',
      aliases: ['redis', 'Redis', 'REDIS'],
      category: 'database'
    },
    {
      standardName: 'SQLite',
      aliases: ['sqlite', 'SQLite', 'sqlite3'],
      category: 'database'
    },
    
    // Tools
    {
      standardName: 'Git',
      aliases: ['git', 'Git', 'GIT'],
      category: 'tool'
    },
    {
      standardName: 'Docker',
      aliases: ['docker', 'Docker', 'DOCKER'],
      category: 'tool'
    },
    {
      standardName: 'Kubernetes',
      aliases: ['kubernetes', 'k8s', 'K8s', 'Kubernetes'],
      category: 'tool'
    },
    {
      standardName: 'Webpack',
      aliases: ['webpack', 'Webpack'],
      category: 'tool'
    },
    {
      standardName: 'Vite',
      aliases: ['vite', 'Vite'],
      category: 'tool'
    },
    
    // Platforms
    {
      standardName: 'AWS',
      aliases: ['aws', 'AWS', 'Amazon Web Services'],
      category: 'platform'
    },
    {
      standardName: 'Azure',
      aliases: ['azure', 'Azure', 'Microsoft Azure'],
      category: 'platform'
    },
    {
      standardName: 'GCP',
      aliases: ['gcp', 'GCP', 'Google Cloud', 'google cloud'],
      category: 'platform'
    },
    
    // Soft Skills
    {
      standardName: 'Communication',
      aliases: ['communication', '沟通', '沟通能力'],
      category: 'soft'
    },
    {
      standardName: 'Leadership',
      aliases: ['leadership', '领导力', '领导能力'],
      category: 'soft'
    },
    {
      standardName: 'Problem Solving',
      aliases: ['problem solving', '问题解决', '解决问题'],
      category: 'soft'
    },
    {
      standardName: 'Teamwork',
      aliases: ['teamwork', '团队协作', '团队合作'],
      category: 'soft'
    }
  ];
  
  return new Taxonomy(defaultMappings);
}
