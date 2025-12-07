/**
 * MarketScanner - JD extraction and market profile building
 * 
 * Responsible for:
 * - Extracting JDCard objects from market notes using LLM
 * - Calculating raw_text_hash for deduplication
 * - Checking for existing JDCards with same hash
 * - Updating existing cards (preserve jd_id) or creating new cards (generate UUID)
 * - Saving JDCards to market_cards/ directory
 * - Building MarketProfile from aggregated JDCards
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { App, TFile, normalizePath } from 'obsidian';
import { z } from 'zod';
import { 
  JDCard, 
  CareerOSSettings, 
  MarketProfile, 
  MarketProfileSummary,
  SkillDemand 
} from './types';
import { 
  JDCardSchema, 
  MarketProfileSchema, 
  CURRENT_SCHEMA_VERSION 
} from './schema';
import { LLMClient } from './llmClient';
import { IndexStore } from './IndexStore';
import { PromptStore, getJDCardPrompt } from './PromptStore';
import { PrivacyGuard } from './PrivacyGuard';
import { Taxonomy } from './Taxonomy';
import { createHash } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface ExtractJDCardsResult {
  success: boolean;
  cards: JDCard[];
  newCards: number;
  updatedCards: number;
  error?: string;
}

export interface BuildMarketProfileResult {
  success: boolean;
  profile?: MarketProfile;
  error?: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate UUID v4
 */
function generateUUID(): string {
  // Use crypto.randomUUID if available (Node.js 14.17+, modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Calculate hash for raw text (for deduplication)
 * Property 17: JD deduplication by hash
 */
function calculateRawTextHash(text: string): string {
  // Normalize text: trim, lowercase, remove extra whitespace
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  
  // Calculate SHA-256 hash
  const hash = createHash('sha256');
  hash.update(normalized);
  return hash.digest('hex');
}

/**
 * Extract raw JD text from a JD object for hashing
 * Combines key fields that define the unique identity of a JD
 */
function extractRawJDText(jd: Partial<JDCard>): string {
  const parts = [
    jd.company || '',
    jd.title || '',
    jd.location || '',
    jd.experience || '',
    jd.degree || '',
    ...(jd.skills_required || []),
    ...(jd.skills_optional || []),
  ];
  
  return parts.join(' | ');
}

// ============================================================================
// MarketScanner Class
// ============================================================================

export class MarketScanner {
  private llmClient: LLMClient;
  private indexStore: IndexStore;
  private promptStore: PromptStore;
  private privacyGuard: PrivacyGuard;
  private taxonomy: Taxonomy;
  private settings: CareerOSSettings;

  constructor(
    private app: App,
    settings: CareerOSSettings,
    llmClient: LLMClient,
    indexStore: IndexStore,
    promptStore: PromptStore,
    privacyGuard: PrivacyGuard,
    taxonomy: Taxonomy
  ) {
    this.settings = settings;
    this.llmClient = llmClient;
    this.indexStore = indexStore;
    this.promptStore = promptStore;
    this.privacyGuard = privacyGuard;
    this.taxonomy = taxonomy;
  }

  /**
   * Update settings (e.g., when user changes configuration)
   */
  updateSettings(settings: CareerOSSettings): void {
    this.settings = settings;
    this.llmClient.updateSettings(settings);
  }

  // ============================================================================
  // JD Extraction
  // ============================================================================

  /**
   * Extract JD cards from a market note
   * 
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
   * 
   * @param notePath - Path to the market note
   * @returns Extraction result with created/updated cards
   */
  async extractJDCards(notePath: string): Promise<ExtractJDCardsResult> {
    try {
      // Read note content
      const normalizedPath = normalizePath(notePath);
      const file = this.app.vault.getAbstractFileByPath(normalizedPath);
      
      if (!file || !(file instanceof TFile)) {
        return {
          success: false,
          cards: [],
          newCards: 0,
          updatedCards: 0,
          error: `File not found: ${notePath}`,
        };
      }
      
      const noteContent = await this.app.vault.read(file);
      
      // Check if note should be excluded
      const tags = this.extractTags(noteContent);
      if (this.privacyGuard.shouldExclude(notePath, tags)) {
        return {
          success: false,
          cards: [],
          newCards: 0,
          updatedCards: 0,
          error: 'Note excluded by privacy rules',
        };
      }
      
      // Apply PII filtering if using external LLM
      const extractConfig = this.settings.llmConfigs.extract;
      const filteredContent = extractConfig.provider !== 'local'
        ? this.privacyGuard.filterPII(noteContent, extractConfig.provider)
        : noteContent;
      
      // Generate prompt
      const currentDate = new Date().toISOString();
      const prompt = await getJDCardPrompt(
        this.promptStore,
        notePath,
        filteredContent,
        currentDate
      );
      
      // Call LLM to extract JD cards
      // Requirement 6.2: Parse LLM output as array of JDCard objects
      const jdCardsArray = await this.llmClient.callJSON(
        'extract',
        prompt,
        z.array(JDCardSchema)
      );
      
      // Process each JD card
      const processedCards: JDCard[] = [];
      let newCards = 0;
      let updatedCards = 0;
      
      for (const jdData of jdCardsArray) {
        // Requirement 6.3: Calculate raw text hash
        const rawText = extractRawJDText(jdData);
        const rawTextHash = calculateRawTextHash(rawText);
        
        // Requirement 6.3, 6.4: Check for existing JDCard with same hash
        const existingCard = await this.indexStore.findJDCardByHash(rawTextHash);
        
        let finalCard: JDCard;
        
        if (existingCard) {
          // Requirement 6.4: Update existing card, preserve jd_id
          finalCard = {
            ...jdData,
            schema_version: CURRENT_SCHEMA_VERSION,
            jd_id: existingCard.jd_id, // Preserve original ID
            source_note: notePath,
            raw_text_hash: rawTextHash,
            created_at: existingCard.created_at, // Preserve creation time
            updated_at: currentDate,
          };
          updatedCards++;
        } else {
          // Requirement 6.5: Create new card with generated UUID
          finalCard = {
            ...jdData,
            schema_version: CURRENT_SCHEMA_VERSION,
            jd_id: generateUUID(),
            source_note: notePath,
            raw_text_hash: rawTextHash,
            created_at: currentDate,
            updated_at: currentDate,
          };
          newCards++;
        }
        
        // Save JDCard to market_cards/ directory
        await this.indexStore.writeJDCard(finalCard);
        processedCards.push(finalCard);
      }
      
      return {
        success: true,
        cards: processedCards,
        newCards,
        updatedCards,
      };
    } catch (error) {
      console.error(`Failed to extract JD cards from ${notePath}:`, error);
      return {
        success: false,
        cards: [],
        newCards: 0,
        updatedCards: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ============================================================================
  // Market Profile Building
  // ============================================================================

  /**
   * Build market profile for a specific role and location
   * 
   * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
   * Property 18: Skill normalization consistency
   * 
   * @param role - Target role (e.g., "Python 后端")
   * @param location - Target location (e.g., "杭州")
   * @returns Build result with market profile
   */
  async buildMarketProfile(
    role: string,
    location: string
  ): Promise<BuildMarketProfileResult> {
    try {
      // Requirement 8.1: Filter JDCards by specified role and location
      const allJDCards = await this.indexStore.listJDCards();
      
      const filteredCards = allJDCards.filter(card => {
        if (card.deleted) return false;
        
        // Fuzzy match on role (case-insensitive, partial match)
        const roleMatch = card.title.toLowerCase().includes(role.toLowerCase());
        
        // Fuzzy match on location (case-insensitive, partial match)
        const locationMatch = card.location.toLowerCase().includes(location.toLowerCase());
        
        return roleMatch && locationMatch;
      });
      
      if (filteredCards.length === 0) {
        return {
          success: false,
          error: `No JD cards found for role "${role}" in location "${location}"`,
        };
      }
      
      // Requirement 8.2: Calculate skill demand with Taxonomy normalization
      // Property 18: Apply same normalization rules as SelfProfile
      const skillFrequency = new Map<string, { count: number; hints: Set<string> }>();
      
      for (const card of filteredCards) {
        // Process required skills (weighted higher)
        for (const skill of card.skills_required) {
          const normalizedSkill = this.taxonomy.normalize(skill);
          const entry = skillFrequency.get(normalizedSkill) || { count: 0, hints: new Set() };
          entry.count += 2; // Weight required skills higher
          if (card.experience) {
            entry.hints.add(card.experience);
          }
          skillFrequency.set(normalizedSkill, entry);
        }
        
        // Process optional skills (weighted lower)
        for (const skill of card.skills_optional) {
          const normalizedSkill = this.taxonomy.normalize(skill);
          const entry = skillFrequency.get(normalizedSkill) || { count: 0, hints: new Set() };
          entry.count += 1; // Weight optional skills lower
          if (card.experience) {
            entry.hints.add(card.experience);
          }
          skillFrequency.set(normalizedSkill, entry);
        }
      }
      
      // Convert to SkillDemand array and sort by frequency
      const skillsDemand: SkillDemand[] = Array.from(skillFrequency.entries())
        .map(([name, data]) => ({
          name,
          frequency: data.count,
          experience_hint: Array.from(data.hints),
        }))
        .sort((a, b) => b.frequency - a.frequency);
      
      // Requirement 8.3: Aggregate experience requirements distribution
      const experienceDistribution: Record<string, number> = {};
      for (const card of filteredCards) {
        const exp = card.experience || '不限';
        experienceDistribution[exp] = (experienceDistribution[exp] || 0) + 1;
      }
      
      // Requirement 8.3: Aggregate degree requirements distribution
      const degreeDistribution: Record<string, number> = {};
      for (const card of filteredCards) {
        const degree = card.degree || '不限';
        degreeDistribution[degree] = (degreeDistribution[degree] || 0) + 1;
      }
      
      // Build soft requirements from degree distribution and other indicators
      const softRequirements: string[] = [];
      
      // Add degree requirements summary
      const sortedDegrees = Object.entries(degreeDistribution)
        .sort((a, b) => b[1] - a[1]);
      
      for (const [degree, count] of sortedDegrees) {
        if (degree !== '不限') {
          const percentage = Math.round((count / filteredCards.length) * 100);
          softRequirements.push(`学历要求 ${degree}: ${count}个岗位 (${percentage}%)`);
        }
      }
      
      // Requirement 8.4: Select sample JD IDs for reference
      const sampleJDIds = filteredCards
        .slice(0, Math.min(10, filteredCards.length))
        .map(card => card.jd_id);
      
      // Build market profile
      const profile: MarketProfile = {
        schema_version: CURRENT_SCHEMA_VERSION,
        role,
        location,
        skills_demand: skillsDemand,
        soft_requirements: softRequirements,
        experience_distribution: experienceDistribution,
        sample_jd_ids: sampleJDIds,
        last_built: new Date().toISOString(),
      };
      
      // Requirement 8.5: Save as both JSON and Markdown with schema version
      await this.indexStore.writeMarketProfile(profile);
      await this.writeMarketProfileMarkdown(profile, degreeDistribution);
      
      return {
        success: true,
        profile,
      };
    } catch (error) {
      console.error(`Failed to build market profile for ${role} in ${location}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * List all available market profiles
   * 
   * @returns Array of market profile summaries
   */
  async listMarketProfiles(): Promise<MarketProfileSummary[]> {
    try {
      const profiles = await this.indexStore.listMarketProfiles();
      
      return profiles.map(profile => ({
        role: profile.role,
        location: profile.location,
        jdCount: profile.sample_jd_ids.length,
        lastBuilt: profile.last_built,
      }));
    } catch (error) {
      console.error('Failed to list market profiles:', error);
      return [];
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Extract tags from note content (from frontmatter or inline tags)
   */
  private extractTags(content: string): string[] {
    const tags: string[] = [];
    
    // Extract from frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      const tagsMatch = frontmatter.match(/tags:\s*\[(.*?)\]/);
      if (tagsMatch) {
        const tagsList = tagsMatch[1].split(',').map(t => t.trim().replace(/['"]/g, ''));
        tags.push(...tagsList);
      }
    }
    
    // Extract inline tags (#tag)
    const inlineTagMatches = content.matchAll(/#([\w-]+)/g);
    for (const match of inlineTagMatches) {
      tags.push(match[1]);
    }
    
    return tags;
  }

  /**
   * Write market profile as Markdown file
   * Requirement 8.5: Save MarketProfile as Markdown format with schema version
   */
  private async writeMarketProfileMarkdown(
    profile: MarketProfile,
    degreeDistribution?: Record<string, number>
  ): Promise<void> {
    const lines: string[] = [];
    
    // Frontmatter with schema version
    lines.push('---');
    lines.push(`role: "${profile.role}"`);
    lines.push(`location: "${profile.location}"`);
    lines.push(`last_built: "${profile.last_built}"`);
    lines.push(`schema_version: ${profile.schema_version}`);
    lines.push(`jd_count: ${profile.sample_jd_ids.length}`);
    lines.push('---');
    lines.push('');
    
    // Title
    lines.push(`# Market Profile: ${profile.role} (${profile.location})`);
    lines.push('');
    lines.push(`> 基于 ${profile.sample_jd_ids.length} 个岗位数据生成`);
    lines.push('');
    
    // Skills Demand (Requirement 8.2)
    lines.push('## 技能需求 (Skills Demand)');
    lines.push('');
    lines.push('| 技能 | 频率 | 经验提示 |');
    lines.push('|------|------|----------|');
    for (const skill of profile.skills_demand.slice(0, 20)) {
      const hints = skill.experience_hint?.join(', ') || '-';
      lines.push(`| ${skill.name} | ${skill.frequency} | ${hints} |`);
    }
    lines.push('');
    
    // Experience Distribution (Requirement 8.3)
    lines.push('## 经验要求分布 (Experience Distribution)');
    lines.push('');
    const sortedExp = Object.entries(profile.experience_distribution)
      .sort((a, b) => b[1] - a[1]);
    for (const [exp, count] of sortedExp) {
      lines.push(`- **${exp}**: ${count} 个岗位`);
    }
    lines.push('');
    
    // Degree Distribution (Requirement 8.3)
    if (degreeDistribution && Object.keys(degreeDistribution).length > 0) {
      lines.push('## 学历要求分布 (Degree Distribution)');
      lines.push('');
      const sortedDegree = Object.entries(degreeDistribution)
        .sort((a, b) => b[1] - a[1]);
      for (const [degree, count] of sortedDegree) {
        lines.push(`- **${degree}**: ${count} 个岗位`);
      }
      lines.push('');
    }
    
    // Soft Requirements
    if (profile.soft_requirements.length > 0) {
      lines.push('## 软性要求 (Soft Requirements)');
      lines.push('');
      for (const req of profile.soft_requirements) {
        lines.push(`- ${req}`);
      }
      lines.push('');
    }
    
    // Sample JDs (Requirement 8.4)
    lines.push('## 样本 JD IDs (Sample JD IDs)');
    lines.push('');
    for (const jdId of profile.sample_jd_ids) {
      lines.push(`- \`${jdId}\``);
    }
    lines.push('');
    
    // Write to file
    const markdownPath = this.indexStore.getMarketProfilePath(profile.role, profile.location)
      .replace('.json', '.md');
    
    const content = lines.join('\n');
    const normalizedPath = normalizePath(markdownPath);
    const file = this.app.vault.getAbstractFileByPath(normalizedPath);
    
    if (file && file instanceof TFile) {
      await this.app.vault.modify(file, content);
    } else {
      // Ensure parent directory exists
      const parentPath = normalizedPath.split('/').slice(0, -1).join('/');
      if (parentPath) {
        const parentDir = this.app.vault.getAbstractFileByPath(parentPath);
        if (!parentDir) {
          await this.app.vault.createFolder(parentPath);
        }
      }
      await this.app.vault.create(normalizedPath, content);
    }
  }
}

/**
 * Factory function to create a MarketScanner instance
 */
export function createMarketScanner(
  app: App,
  settings: CareerOSSettings,
  llmClient: LLMClient,
  indexStore: IndexStore,
  promptStore: PromptStore,
  privacyGuard: PrivacyGuard,
  taxonomy: Taxonomy
): MarketScanner {
  return new MarketScanner(
    app,
    settings,
    llmClient,
    indexStore,
    promptStore,
    privacyGuard,
    taxonomy
  );
}
