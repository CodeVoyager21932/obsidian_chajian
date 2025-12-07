/**
 * ProfileEngine - Core extraction and profile building engine
 * 
 * Responsible for:
 * - Processing notes and extracting NoteCards using LLM
 * - Content hash calculation for change detection
 * - Time parsing from content, filename, and file metadata
 * - Schema validation with retry logic
 * - Error handling and logging
 * - Cold start indexing with concurrent processing
 * - Incremental update handling (file save, rename, delete)
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 4.1, 4.2, 4.3, 5.2, 5.3, 5.4, 15.1, 15.2, 15.3
 */

import { App, TFile, TFolder, normalizePath } from 'obsidian';
import { z } from 'zod';
import { NoteCard, CareerOSSettings, IndexOptions, IndexResult, Task, QueueStatus, SelfProfile, SkillProfile, ProjectSummary, Preferences, TechItem, SkillCategory } from './types';
import { NoteCardSchema, SelfProfileSchema, CURRENT_SCHEMA_VERSION } from './schema';
import { LLMClient } from './llmClient';
import { IndexStore } from './IndexStore';
import { PromptStore, getNoteCardPrompt } from './PromptStore';
import { PrivacyGuard } from './PrivacyGuard';
import { FileService } from './fs';
import { QueueManager, createQueueManager, createTask, TaskResult } from './queue';
import { Taxonomy } from './Taxonomy';

// ============================================================================
// Types
// ============================================================================

export interface ProcessNoteResult {
  success: boolean;
  noteCard?: NoteCard;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

export interface ExtractionError {
  path: string;
  error: string;
  timestamp: string;
  attempts: number;
}

/**
 * Progress callback for cold start indexing
 */
export type IndexProgressCallback = (status: QueueStatus) => void;

/**
 * Dry-run result for a single note
 */
export interface DryRunNoteResult {
  path: string;
  success: boolean;
  noteCard?: NoteCard;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

/**
 * Dry-run summary result
 */
export interface DryRunResult {
  totalNotes: number;
  processedNotes: number;
  skippedNotes: number;
  failedNotes: number;
  results: DryRunNoteResult[];
}

/**
 * Incremental update result
 */
export interface IncrementalUpdateResult {
  action: 'queued' | 'skipped' | 'error';
  reason?: string;
  notePath: string;
}

/**
 * File rename result
 */
export interface FileRenameResult {
  success: boolean;
  oldPath: string;
  newPath: string;
  error?: string;
}

/**
 * File delete result
 */
export interface FileDeleteResult {
  success: boolean;
  notePath: string;
  error?: string;
}

// Schema for LLM extraction output (without hash and detected_date which we set)
const LLMNoteCardOutputSchema = z.object({
  schema_version: z.number(),
  note_path: z.string(),
  hash: z.string(),
  summary: z.string(),
  type: z.enum(['project', 'course', 'reflection', 'other']),
  time_span: z.string(),
  tech_stack: z.array(z.object({
    name: z.string(),
    context: z.string(),
    level: z.enum(['入门', '熟悉', '熟练', '精通']),
  })),
  topics: z.array(z.string()),
  preferences: z.object({
    likes: z.array(z.string()),
    dislikes: z.array(z.string()),
    traits: z.array(z.string()),
  }),
  evidence: z.array(z.string()),
  last_updated: z.string(),
  detected_date: z.string(),
  status: z.enum(['draft', 'confirmed']).optional(),
});

// ============================================================================
// Content Hash Calculation
// ============================================================================

/**
 * Calculate content hash for change detection
 * Property 3: Content hash consistency
 * 
 * Uses a simple but effective hash algorithm that:
 * - Produces identical hashes for identical content
 * - Produces different hashes for different content
 */
export function calculateContentHash(content: string): string {
  // Simple hash implementation using djb2 algorithm
  // This is deterministic and fast for our use case
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) + hash) + char; // hash * 33 + char
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to hex string and ensure positive
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// ============================================================================
// Time Parsing
// ============================================================================

/**
 * Parse time information from various sources
 * Priority: content > filename > file metadata
 */
export function parseTimeFromContent(content: string): string | null {
  // Common date patterns in content
  const patterns = [
    // ISO format: 2023-01-15
    /\b(\d{4}-\d{2}-\d{2})\b/,
    // Chinese format: 2023年1月15日
    /\b(\d{4})年(\d{1,2})月(\d{1,2})日/,
    // Slash format: 2023/01/15
    /\b(\d{4})\/(\d{1,2})\/(\d{1,2})\b/,
    // Time span: 2023-01 到 2023-06
    /\b(\d{4}-\d{2})\s*(?:到|至|-)\s*(\d{4}-\d{2})\b/,
    // Single month: 2023-01
    /\b(\d{4}-\d{2})\b/,
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      // Return the full match for time span, or construct ISO date
      if (pattern.source.includes('到|至|-')) {
        return `${match[1]} 到 ${match[2]}`;
      }
      if (pattern.source.includes('年')) {
        const year = match[1];
        const month = match[2].padStart(2, '0');
        const day = match[3].padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      if (pattern.source.includes('\\/')) {
        const year = match[1];
        const month = match[2].padStart(2, '0');
        const day = match[3].padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      return match[0];
    }
  }
  
  return null;
}

/**
 * Parse time from filename
 * Common patterns: 2023-01-15-note.md, note-2023-01.md, 20230115.md
 */
export function parseTimeFromFilename(filename: string): string | null {
  const patterns = [
    // ISO date in filename: 2023-01-15
    /(\d{4}-\d{2}-\d{2})/,
    // Compact date: 20230115
    /(\d{4})(\d{2})(\d{2})/,
    // Year-month: 2023-01
    /(\d{4}-\d{2})/,
  ];
  
  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) {
      if (match.length === 4) {
        // Compact date format
        return `${match[1]}-${match[2]}-${match[3]}`;
      }
      return match[1];
    }
  }
  
  return null;
}

/**
 * Get time from file metadata (modification time)
 */
export function getTimeFromFileMetadata(file: TFile): string {
  return new Date(file.stat.mtime).toISOString().split('T')[0];
}

/**
 * Infer last_updated time with priority: content > filename > metadata
 */
export function inferLastUpdated(content: string, filename: string, file: TFile): string {
  // Try content first
  const contentTime = parseTimeFromContent(content);
  if (contentTime) {
    return contentTime;
  }
  
  // Try filename
  const filenameTime = parseTimeFromFilename(filename);
  if (filenameTime) {
    return filenameTime;
  }
  
  // Fall back to file metadata
  return getTimeFromFileMetadata(file);
}

// ============================================================================
// Error Logging
// ============================================================================

/**
 * Append error to error log file
 */
async function logExtractionError(
  fileService: FileService,
  pluginDataDir: string,
  error: ExtractionError
): Promise<void> {
  const errorLogPath = `${pluginDataDir}/error_log.md`;
  
  const errorEntry = `
## ${error.timestamp}

- **Path**: ${error.path}
- **Attempts**: ${error.attempts}
- **Error**: ${error.error}

---
`;
  
  try {
    // Try to read existing log
    let existingContent = '';
    try {
      existingContent = await fileService.read(errorLogPath);
    } catch {
      // File doesn't exist, start fresh
      existingContent = '# CareerOS Error Log\n\n';
    }
    
    // Append new error
    await fileService.write(errorLogPath, existingContent + errorEntry);
  } catch (logError) {
    console.error('Failed to write to error log:', logError);
  }
}

// ============================================================================
// ProfileEngine Class
// ============================================================================

// ============================================================================
// SelfProfile Building Configuration
// ============================================================================

/**
 * Configuration for SelfProfile building
 */
export interface SelfProfileConfig {
  topSkillsCount: number;      // Number of top skills for analysis_view (default: 15)
  recentProjectsCount: number; // Number of recent projects for analysis_view (default: 5)
}

export const DEFAULT_SELF_PROFILE_CONFIG: SelfProfileConfig = {
  topSkillsCount: 15,
  recentProjectsCount: 5,
};

/**
 * Skill level to numeric score mapping
 * Used for calculating weighted skill scores
 */
const SKILL_LEVEL_SCORES: Record<string, number> = {
  '入门': 1,
  '熟悉': 2,
  '熟练': 3,
  '精通': 4,
};

/**
 * Note type weights for skill scoring
 * Project notes have higher weight than course notes
 */
const NOTE_TYPE_WEIGHTS: Record<string, number> = {
  'project': 1.5,
  'course': 1.0,
  'reflection': 0.8,
  'other': 0.5,
};

/**
 * Time decay calculation
 * Property 19: Skill scoring with time decay
 * 
 * Uses a stepped decay function:
 * - Within 6 months: 1.0 (no decay)
 * - 6-12 months: 0.8
 * - 12-24 months: 0.6
 * - 24-36 months: 0.4
 * - Over 36 months: 0.2
 */
export function calculateTimeDecay(lastActiveDate: string): number {
  const now = new Date();
  const lastActive = new Date(lastActiveDate);
  
  // Handle invalid dates
  if (isNaN(lastActive.getTime())) {
    return 0.5; // Default decay for invalid dates
  }
  
  const monthsDiff = (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24 * 30);
  
  if (monthsDiff <= 6) return 1.0;
  if (monthsDiff <= 12) return 0.8;
  if (monthsDiff <= 24) return 0.6;
  if (monthsDiff <= 36) return 0.4;
  return 0.2;
}

/**
 * Parse date from various formats
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  // Try ISO format first
  let date = new Date(dateStr);
  if (!isNaN(date.getTime())) return date;
  
  // Try extracting year-month-day from time span like "2023-01 到 2023-06"
  const spanMatch = dateStr.match(/(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (spanMatch) {
    const year = parseInt(spanMatch[1]);
    const month = parseInt(spanMatch[2]) - 1;
    const day = spanMatch[3] ? parseInt(spanMatch[3]) : 1;
    return new Date(year, month, day);
  }
  
  return null;
}

/**
 * Get the most recent date from a time span string
 */
function getMostRecentDate(timeSpan: string): Date | null {
  if (!timeSpan) return null;
  
  // Handle time span format "2023-01 到 2023-06"
  const spanMatch = timeSpan.match(/(\d{4}-\d{2}(?:-\d{2})?)\s*(?:到|至|-)\s*(\d{4}-\d{2}(?:-\d{2})?)/);
  if (spanMatch) {
    // Return the end date
    return parseDate(spanMatch[2]);
  }
  
  // Single date
  return parseDate(timeSpan);
}

export class ProfileEngine {
  private app: App;
  private settings: CareerOSSettings;
  private llmClient: LLMClient;
  private indexStore: IndexStore;
  private promptStore: PromptStore;
  private privacyGuard: PrivacyGuard;
  private fileService: FileService;
  private pluginDataDir: string;
  private taxonomy: Taxonomy;
  
  constructor(
    app: App,
    settings: CareerOSSettings,
    llmClient: LLMClient,
    indexStore: IndexStore,
    promptStore: PromptStore,
    privacyGuard: PrivacyGuard,
    pluginDataDir: string
  ) {
    this.app = app;
    this.settings = settings;
    this.llmClient = llmClient;
    this.indexStore = indexStore;
    this.promptStore = promptStore;
    this.privacyGuard = privacyGuard;
    this.pluginDataDir = pluginDataDir;
    this.fileService = new FileService(app, pluginDataDir);
    this.taxonomy = new Taxonomy(settings.taxonomy);
  }
  
  /**
   * Update settings (e.g., when user changes configuration)
   */
  updateSettings(settings: CareerOSSettings): void {
    this.settings = settings;
    this.llmClient.updateSettings(settings);
    this.privacyGuard.updateExclusionRules(settings.exclusionRules);
    this.taxonomy = new Taxonomy(settings.taxonomy);
  }

  // ============================================================================
  // SelfProfile Building
  // Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
  // ============================================================================

  /**
   * Build aggregated self profile from all note cards
   * 
   * Requirements:
   * - 7.1: Aggregate all non-deleted NoteCards and normalize skill names using Taxonomy
   * - 7.2: Apply weights based on note type, skill level, and time decay
   * - 7.3: Prioritize reflection-type NoteCards for preferences, rank by frequency
   * - 7.4: Create detailed view and compressed analysis_view with top N skills and recent M projects
   * - 7.5: Save as both JSON and Markdown formats
   * 
   * Property 18: Skill normalization consistency
   * Property 19: Skill scoring with time decay
   * Property 20: Profile serialization round-trip
   * Property 21: Analysis view compression
   * 
   * @param config - Optional configuration for profile building
   * @returns Built SelfProfile
   */
  async buildSelfProfile(config: Partial<SelfProfileConfig> = {}): Promise<SelfProfile> {
    const finalConfig = { ...DEFAULT_SELF_PROFILE_CONFIG, ...config };
    
    // Step 1: Read all non-deleted NoteCards from IndexStore
    const allCards = await this.indexStore.listNoteCards();
    const activeCards = allCards.filter(card => !card.deleted);
    
    console.log(`Building SelfProfile from ${activeCards.length} active NoteCards`);
    
    // Step 2: Aggregate skills with normalization and scoring
    const skills = this.aggregateSkills(activeCards);
    
    // Step 3: Aggregate preferences from reflection-type notes
    const preferences = this.aggregatePreferences(activeCards);
    
    // Step 4: Extract project summaries from project-type notes
    const projects = this.extractProjectSummaries(activeCards);
    
    // Step 5: Generate analysis_view with top N skills and recent M projects
    const analysisView = this.generateAnalysisView(skills, projects, finalConfig);
    
    // Step 6: Build the SelfProfile object
    const selfProfile: SelfProfile = {
      schema_version: CURRENT_SCHEMA_VERSION,
      skills,
      preferences,
      projects,
      analysis_view: analysisView,
      last_built: new Date().toISOString(),
    };
    
    // Step 7: Save as JSON
    await this.indexStore.writeSelfProfile(selfProfile);
    
    // Step 8: Save as Markdown
    await this.saveSelfProfileAsMarkdown(selfProfile);
    
    console.log(`SelfProfile built successfully: ${skills.length} skills, ${projects.length} projects`);
    
    return selfProfile;
  }

  /**
   * Aggregate skills from all NoteCards with normalization and scoring
   * 
   * Property 18: Skill normalization consistency
   * Property 19: Skill scoring with time decay
   * 
   * @param cards - Array of NoteCards to aggregate
   * @returns Array of SkillProfile sorted by level (descending)
   */
  private aggregateSkills(cards: NoteCard[]): SkillProfile[] {
    // Map to accumulate skill data: normalized name -> aggregated data
    const skillMap = new Map<string, {
      name: string;
      category?: SkillCategory;
      totalScore: number;
      evidenceNotes: Set<string>;
      lastActive: Date;
    }>();
    
    for (const card of cards) {
      // Get time decay factor based on card's last_updated
      const timeDecay = calculateTimeDecay(card.last_updated);
      
      // Get note type weight
      const noteTypeWeight = NOTE_TYPE_WEIGHTS[card.type] || 0.5;
      
      for (const tech of card.tech_stack) {
        // Normalize skill name using Taxonomy (Property 18)
        const normalizedName = this.taxonomy.normalize(tech.name);
        
        // Get skill level score
        const levelScore = SKILL_LEVEL_SCORES[tech.level] || 1;
        
        // Calculate weighted score (Property 19)
        const weightedScore = levelScore * noteTypeWeight * timeDecay;
        
        // Get or create skill entry
        let skillEntry = skillMap.get(normalizedName);
        if (!skillEntry) {
          skillEntry = {
            name: normalizedName,
            category: this.taxonomy.getCategory(normalizedName),
            totalScore: 0,
            evidenceNotes: new Set(),
            lastActive: new Date(0),
          };
          skillMap.set(normalizedName, skillEntry);
        }
        
        // Accumulate score
        skillEntry.totalScore += weightedScore;
        
        // Add evidence note
        skillEntry.evidenceNotes.add(card.note_path);
        
        // Update last active date
        const cardDate = parseDate(card.last_updated);
        if (cardDate && cardDate > skillEntry.lastActive) {
          skillEntry.lastActive = cardDate;
        }
      }
    }
    
    // Convert to SkillProfile array and normalize scores to 0-5 range
    const skills: SkillProfile[] = [];
    
    // Find max score for normalization
    let maxScore = 0;
    for (const entry of skillMap.values()) {
      if (entry.totalScore > maxScore) {
        maxScore = entry.totalScore;
      }
    }
    
    // Normalize and create SkillProfile objects
    for (const entry of skillMap.values()) {
      // Normalize score to 0-5 range
      const normalizedLevel = maxScore > 0 
        ? Math.min(5, (entry.totalScore / maxScore) * 5)
        : 0;
      
      skills.push({
        name: entry.name,
        category: entry.category,
        level: Math.round(normalizedLevel * 100) / 100, // Round to 2 decimal places
        evidence_notes: Array.from(entry.evidenceNotes),
        last_active: entry.lastActive.toISOString().split('T')[0],
      });
    }
    
    // Sort by level (descending)
    skills.sort((a, b) => b.level - a.level);
    
    return skills;
  }

  /**
   * Aggregate preferences from NoteCards
   * 
   * Requirement 7.3: Prioritize reflection-type NoteCards and rank by frequency
   * 
   * @param cards - Array of NoteCards to aggregate
   * @returns Aggregated Preferences
   */
  private aggregatePreferences(cards: NoteCard[]): Preferences {
    // Count frequency of each preference item
    const likesCount = new Map<string, number>();
    const dislikesCount = new Map<string, number>();
    const traitsCount = new Map<string, number>();
    
    // Process cards, giving higher weight to reflection-type notes
    for (const card of cards) {
      const weight = card.type === 'reflection' ? 2 : 1;
      
      for (const like of card.preferences.likes) {
        const normalized = like.trim();
        if (normalized) {
          likesCount.set(normalized, (likesCount.get(normalized) || 0) + weight);
        }
      }
      
      for (const dislike of card.preferences.dislikes) {
        const normalized = dislike.trim();
        if (normalized) {
          dislikesCount.set(normalized, (dislikesCount.get(normalized) || 0) + weight);
        }
      }
      
      for (const trait of card.preferences.traits) {
        const normalized = trait.trim();
        if (normalized) {
          traitsCount.set(normalized, (traitsCount.get(normalized) || 0) + weight);
        }
      }
    }
    
    // Sort by frequency and extract items
    const sortByFrequency = (map: Map<string, number>): string[] => {
      return Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([item]) => item);
    };
    
    return {
      likes: sortByFrequency(likesCount),
      dislikes: sortByFrequency(dislikesCount),
      traits: sortByFrequency(traitsCount),
    };
  }

  /**
   * Extract project summaries from project-type NoteCards
   * 
   * @param cards - Array of NoteCards to process
   * @returns Array of ProjectSummary sorted by date (most recent first)
   */
  private extractProjectSummaries(cards: NoteCard[]): ProjectSummary[] {
    const projects: ProjectSummary[] = [];
    
    for (const card of cards) {
      if (card.type === 'project') {
        projects.push({
          note_path: card.note_path,
          summary: card.summary,
          tech_stack: card.tech_stack,
          time_span: card.time_span,
        });
      }
    }
    
    // Sort by time_span (most recent first)
    projects.sort((a, b) => {
      const dateA = getMostRecentDate(a.time_span);
      const dateB = getMostRecentDate(b.time_span);
      
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      
      return dateB.getTime() - dateA.getTime();
    });
    
    return projects;
  }

  /**
   * Generate analysis_view with top N skills and recent M projects
   * 
   * Property 21: Analysis view compression
   * 
   * @param skills - All aggregated skills
   * @param projects - All project summaries
   * @param config - Configuration with topSkillsCount and recentProjectsCount
   * @returns Compressed analysis view
   */
  private generateAnalysisView(
    skills: SkillProfile[],
    projects: ProjectSummary[],
    config: SelfProfileConfig
  ): { top_skills: SkillProfile[]; recent_projects: ProjectSummary[] } {
    return {
      top_skills: skills.slice(0, config.topSkillsCount),
      recent_projects: projects.slice(0, config.recentProjectsCount),
    };
  }

  /**
   * Save SelfProfile as Markdown format
   * 
   * Requirement 7.5: Save as both JSON and Markdown formats
   * 
   * @param profile - SelfProfile to save
   */
  private async saveSelfProfileAsMarkdown(profile: SelfProfile): Promise<void> {
    const timestamp = new Date().toISOString().split('T')[0];
    const mdPath = `${this.settings.mappingDirectory}/self_profile_${timestamp}.md`;
    
    // Build Markdown content
    let content = `---
schema_version: ${profile.schema_version}
last_built: ${profile.last_built}
total_skills: ${profile.skills.length}
total_projects: ${profile.projects.length}
---

# Self Profile

Generated: ${profile.last_built}

## Skills Overview

| Skill | Level | Category | Evidence Count |
|-------|-------|----------|----------------|
`;
    
    // Add top skills to table
    for (const skill of profile.skills.slice(0, 20)) {
      const levelBar = '█'.repeat(Math.round(skill.level)) + '░'.repeat(5 - Math.round(skill.level));
      content += `| ${skill.name} | ${levelBar} ${skill.level.toFixed(1)} | ${skill.category || '-'} | ${skill.evidence_notes.length} |\n`;
    }
    
    if (profile.skills.length > 20) {
      content += `\n*... and ${profile.skills.length - 20} more skills*\n`;
    }
    
    // Add preferences section
    content += `
## Preferences

### Likes
${profile.preferences.likes.length > 0 ? profile.preferences.likes.map(l => `- ${l}`).join('\n') : '*No preferences recorded*'}

### Dislikes
${profile.preferences.dislikes.length > 0 ? profile.preferences.dislikes.map(d => `- ${d}`).join('\n') : '*No dislikes recorded*'}

### Traits
${profile.preferences.traits.length > 0 ? profile.preferences.traits.map(t => `- ${t}`).join('\n') : '*No traits recorded*'}

## Recent Projects

`;
    
    // Add project summaries
    for (const project of profile.projects.slice(0, 10)) {
      const techList = project.tech_stack.map(t => t.name).join(', ');
      content += `### ${project.note_path.split('/').pop()?.replace('.md', '') || 'Project'}

- **Time**: ${project.time_span || 'Unknown'}
- **Tech Stack**: ${techList || 'None'}
- **Summary**: ${project.summary}

`;
    }
    
    if (profile.projects.length > 10) {
      content += `*... and ${profile.projects.length - 10} more projects*\n`;
    }
    
    // Add analysis view section
    if (profile.analysis_view) {
      content += `
## Analysis View (Compressed)

### Top ${profile.analysis_view.top_skills.length} Skills

`;
      for (let i = 0; i < profile.analysis_view.top_skills.length; i++) {
        const skill = profile.analysis_view.top_skills[i];
        content += `${i + 1}. **${skill.name}** (Level: ${skill.level.toFixed(1)})\n`;
      }
      
      content += `
### Recent ${profile.analysis_view.recent_projects.length} Projects

`;
      for (const project of profile.analysis_view.recent_projects) {
        content += `- **${project.note_path.split('/').pop()?.replace('.md', '')}**: ${project.summary.substring(0, 100)}${project.summary.length > 100 ? '...' : ''}\n`;
      }
    }
    
    // Write Markdown file
    await this.fileService.write(mdPath, content);
    
    console.log(`SelfProfile Markdown saved to: ${mdPath}`);
  }

  /**
   * Get the current Taxonomy instance
   */
  getTaxonomy(): Taxonomy {
    return this.taxonomy;
  }
  
  /**
   * Process a single note and extract NoteCard
   * 
   * Requirements:
   * - 1.1: Extract technical skills with proficiency levels
   * - 1.2: Preserve original skill names (Property 1)
   * - 1.3: Extract preferences conservatively (Property 2)
   * - 1.4: Include content hash (Property 3)
   * - 1.5: Use empty values for unknown fields (Property 4)
   * - 5.2: Validate against Zod schema (Property 14)
   * - 5.3: Retry on validation failure (Property 15)
   * - 5.4: Log errors after retry exhaustion (Property 13)
   */
  async processNote(notePath: string): Promise<ProcessNoteResult> {
    const normalizedPath = normalizePath(notePath);
    
    try {
      // Get the file
      const file = this.app.vault.getAbstractFileByPath(normalizedPath);
      if (!file || !(file instanceof TFile)) {
        return {
          success: false,
          error: `File not found: ${notePath}`,
        };
      }
      
      // Read note content
      const content = await this.app.vault.read(file);
      
      // Extract tags from frontmatter or content
      const tags = this.extractTags(content);
      
      // Check exclusion rules (Property 9)
      if (this.privacyGuard.shouldExclude(normalizedPath, tags)) {
        return {
          success: true,
          skipped: true,
          skipReason: 'Note excluded by privacy rules',
        };
      }
      
      // Calculate content hash (Property 3)
      const contentHash = calculateContentHash(content);
      
      // Check if we already have a card with the same hash
      const existingCard = await this.indexStore.readNoteCard(normalizedPath);
      if (existingCard && existingCard.hash === contentHash) {
        return {
          success: true,
          skipped: true,
          skipReason: 'Content unchanged (hash match)',
          noteCard: existingCard,
        };
      }
      
      // Get LLM provider for extract role
      const llmConfig = this.settings.llmConfigs.extract;
      
      // Apply PII filtering for external LLMs (Property 8)
      const filteredContent = this.privacyGuard.filterPII(content, llmConfig.provider);
      
      // Get current date for detected_date
      const currentDate = new Date().toISOString();
      
      // Build prompt
      const prompt = await getNoteCardPrompt(
        this.promptStore,
        normalizedPath,
        filteredContent,
        contentHash,
        currentDate
      );
      
      // Call LLM with retry logic (Property 15)
      let noteCard: NoteCard;
      let attempts = 0;
      const maxRetries = this.settings.maxRetries;
      
      while (attempts <= maxRetries) {
        attempts++;
        
        try {
          // Call LLM expecting JSON output
          const llmOutput = await this.llmClient.callJSON(
            'extract',
            prompt,
            LLMNoteCardOutputSchema,
            { maxRetries: 0 } // We handle retries ourselves
          );
          
          // Ensure required fields are set correctly
          noteCard = {
            ...llmOutput,
            schema_version: CURRENT_SCHEMA_VERSION,
            note_path: normalizedPath,
            hash: contentHash,
            detected_date: currentDate,
            // Infer last_updated if LLM didn't provide a good value
            last_updated: llmOutput.last_updated || inferLastUpdated(content, file.name, file),
          };
          
          // Validate final NoteCard against schema
          NoteCardSchema.parse(noteCard);
          
          // Success! Save the card
          await this.indexStore.writeNoteCard(noteCard);
          
          return {
            success: true,
            noteCard,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          // Check if we should retry
          if (attempts <= maxRetries) {
            console.log(`NoteCard extraction failed (attempt ${attempts}/${maxRetries + 1}): ${errorMessage}`);
            continue;
          }
          
          // Max retries exhausted, log error (Property 13)
          const extractionError: ExtractionError = {
            path: normalizedPath,
            error: errorMessage,
            timestamp: new Date().toISOString(),
            attempts,
          };
          
          await logExtractionError(this.fileService, this.pluginDataDir, extractionError);
          
          return {
            success: false,
            error: `Extraction failed after ${attempts} attempts: ${errorMessage}`,
          };
        }
      }
      
      // Should not reach here, but TypeScript needs this
      return {
        success: false,
        error: 'Unexpected error in extraction loop',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
  
  /**
   * Extract tags from note content (frontmatter and inline)
   */
  private extractTags(content: string): string[] {
    const tags: string[] = [];
    
    // Extract from frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      
      // Look for tags: [tag1, tag2] or tags: tag1
      const tagsMatch = frontmatter.match(/tags:\s*\[(.*?)\]/);
      if (tagsMatch) {
        const tagList = tagsMatch[1].split(',').map(t => t.trim().replace(/['"]/g, ''));
        tags.push(...tagList);
      } else {
        const singleTagMatch = frontmatter.match(/tags:\s*(\S+)/);
        if (singleTagMatch) {
          tags.push(singleTagMatch[1]);
        }
      }
    }
    
    // Extract inline tags (#tag)
    const inlineTags = content.match(/#[\w\u4e00-\u9fa5]+/g);
    if (inlineTags) {
      tags.push(...inlineTags.map(t => t.substring(1)));
    }
    
    return [...new Set(tags)]; // Remove duplicates
  }
  
  /**
   * Check if a note needs re-extraction based on content hash
   * Property 5: Incremental update correctness
   */
  async needsReExtraction(notePath: string): Promise<boolean> {
    const normalizedPath = normalizePath(notePath);
    
    try {
      // Get the file
      const file = this.app.vault.getAbstractFileByPath(normalizedPath);
      if (!file || !(file instanceof TFile)) {
        return false;
      }
      
      // Read content and calculate hash
      const content = await this.app.vault.read(file);
      const currentHash = calculateContentHash(content);
      
      // Get existing card
      const existingCard = await this.indexStore.readNoteCard(normalizedPath);
      
      // If no existing card, needs extraction
      if (!existingCard) {
        return true;
      }
      
      // Compare hashes
      return existingCard.hash !== currentHash;
    } catch {
      return true; // On error, assume re-extraction needed
    }
  }
  
  /**
   * Get extraction statistics
   */
  async getExtractionStats(): Promise<{
    totalCards: number;
    draftCards: number;
    confirmedCards: number;
    deletedCards: number;
  }> {
    const cards = await this.indexStore.listNoteCards();
    
    return {
      totalCards: cards.length,
      draftCards: cards.filter(c => c.status === 'draft' && !c.deleted).length,
      confirmedCards: cards.filter(c => c.status === 'confirmed' && !c.deleted).length,
      deletedCards: cards.filter(c => c.deleted).length,
    };
  }

  // ============================================================================
  // Cold Start Indexing
  // Requirements: 4.1, 4.2, 4.3, 15.1, 15.2, 15.3
  // ============================================================================

  /**
   * Scan directories to find all markdown files
   * 
   * @param directories - Array of directory paths to scan (empty = scan entire vault)
   * @returns Array of markdown file paths
   */
  async scanDirectories(directories: string[]): Promise<string[]> {
    const markdownFiles: string[] = [];
    
    // If no directories specified, scan entire vault
    if (directories.length === 0) {
      const allFiles = this.app.vault.getMarkdownFiles();
      for (const file of allFiles) {
        markdownFiles.push(file.path);
      }
    } else {
      // Scan specified directories
      for (const dirPath of directories) {
        const normalizedDir = normalizePath(dirPath);
        const folder = this.app.vault.getAbstractFileByPath(normalizedDir);
        
        if (folder && folder instanceof TFolder) {
          this.collectMarkdownFiles(folder, markdownFiles);
        }
      }
    }
    
    return markdownFiles;
  }

  /**
   * Recursively collect markdown files from a folder
   */
  private collectMarkdownFiles(folder: TFolder, files: string[]): void {
    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === 'md') {
        files.push(child.path);
      } else if (child instanceof TFolder) {
        this.collectMarkdownFiles(child, files);
      }
    }
  }

  /**
   * Filter notes that need indexing (unindexed or hash changed)
   * 
   * @param notePaths - Array of note paths to check
   * @returns Array of note paths that need indexing
   */
  async filterUnindexedNotes(notePaths: string[]): Promise<string[]> {
    const unindexedNotes: string[] = [];
    
    for (const notePath of notePaths) {
      const normalizedPath = normalizePath(notePath);
      
      // Get the file
      const file = this.app.vault.getAbstractFileByPath(normalizedPath);
      if (!file || !(file instanceof TFile)) {
        continue;
      }
      
      // Read content and calculate hash
      const content = await this.app.vault.read(file);
      
      // Extract tags for exclusion check
      const tags = this.extractTags(content);
      
      // Check exclusion rules (Property 9)
      if (this.privacyGuard.shouldExclude(normalizedPath, tags)) {
        continue;
      }
      
      const currentHash = calculateContentHash(content);
      
      // Get existing card
      const existingCard = await this.indexStore.readNoteCard(normalizedPath);
      
      // If no existing card or hash differs, needs indexing
      if (!existingCard || existingCard.hash !== currentHash) {
        unindexedNotes.push(normalizedPath);
      }
    }
    
    return unindexedNotes;
  }

  /**
   * Cold start indexing - scan directories and build task queue for all unindexed notes
   * 
   * Requirements:
   * - 4.1: Scan selected directories and build task queue
   * - 4.2: Limit concurrent requests (via QueueManager)
   * - 4.3: Display progress indicator (via callback)
   * - 15.1: Dry-run mode processes only first N notes
   * - 15.2: Dry-run displays results without writing files
   * - 15.3: Dry-run does not write card files
   * 
   * @param directories - Array of directory paths to scan (empty = scan entire vault)
   * @param options - Index options (dryRun, maxNotes, concurrency)
   * @param onProgress - Progress callback for UI updates
   * @returns IndexResult with statistics
   */
  async coldStartIndex(
    directories: string[],
    options: IndexOptions = {},
    onProgress?: IndexProgressCallback
  ): Promise<IndexResult> {
    const {
      dryRun = this.settings.dryRunEnabled,
      maxNotes = dryRun ? this.settings.dryRunMaxNotes : undefined,
      concurrency = this.settings.concurrency,
    } = options;

    // Step 1: Scan directories to find all markdown files
    const allNotes = await this.scanDirectories(directories);
    
    // Step 2: Filter to only unindexed notes (check hash against existing cards)
    let notesToProcess = await this.filterUnindexedNotes(allNotes);
    
    // Step 3: Apply maxNotes limit for dry-run mode
    if (maxNotes !== undefined && maxNotes > 0) {
      notesToProcess = notesToProcess.slice(0, maxNotes);
    }
    
    // Initialize result tracking
    const result: IndexResult = {
      totalNotes: notesToProcess.length,
      processedNotes: 0,
      failedNotes: 0,
      errors: [],
    };
    
    // If no notes to process, return early
    if (notesToProcess.length === 0) {
      return result;
    }
    
    // For dry-run mode, process without writing files
    if (dryRun) {
      return await this.dryRunIndex(notesToProcess, onProgress);
    }
    
    // Step 4: Create task queue with QueueManager
    this.currentQueueManager = createQueueManager(
      async (task: Task) => {
        const notePath = task.data.notePath as string;
        return await this.processNote(notePath);
      },
      {
        concurrency,
        onProgress: (status) => {
          if (onProgress) {
            onProgress(status);
          }
        },
        onTaskComplete: (taskResult: TaskResult) => {
          if (taskResult.success) {
            const processResult = taskResult.result as ProcessNoteResult;
            if (processResult.success && !processResult.skipped) {
              result.processedNotes++;
            } else if (!processResult.success) {
              result.failedNotes++;
              result.errors.push({
                path: taskResult.taskId,
                error: processResult.error || 'Unknown error',
              });
            }
          } else {
            result.failedNotes++;
            result.errors.push({
              path: taskResult.taskId,
              error: taskResult.error?.message || 'Unknown error',
            });
          }
        },
      }
    );
    
    // Step 5: Enqueue all notes as tasks
    for (const notePath of notesToProcess) {
      const task = createTask('extract_note', { notePath });
      await this.currentQueueManager.enqueue(task);
    }
    
    // Step 6: Start processing
    this.currentQueueManager.start();
    
    // Step 7: Wait for completion
    await this.currentQueueManager.waitForCompletion();
    
    // Clear queue manager reference
    this.currentQueueManager = undefined;
    
    return result;
  }

  /**
   * Dry-run indexing - process notes without writing files
   * 
   * Property 24: Dry-run isolation
   * - Process specified number of notes
   * - Display results
   * - Do NOT write any card files to disk
   * 
   * @param notePaths - Array of note paths to process
   * @param onProgress - Progress callback
   * @returns IndexResult with dry-run results
   */
  private async dryRunIndex(
    notePaths: string[],
    onProgress?: IndexProgressCallback
  ): Promise<IndexResult> {
    const result: IndexResult = {
      totalNotes: notePaths.length,
      processedNotes: 0,
      failedNotes: 0,
      errors: [],
    };
    
    const dryRunResults: DryRunNoteResult[] = [];
    
    // Process notes sequentially in dry-run mode for clearer output
    for (let i = 0; i < notePaths.length; i++) {
      const notePath = notePaths[i];
      
      // Update progress
      if (onProgress) {
        onProgress({
          total: notePaths.length,
          completed: i,
          failed: result.failedNotes,
          pending: notePaths.length - i,
          isRunning: true,
        });
      }
      
      try {
        // Process note but don't write to disk
        const processResult = await this.processNoteDryRun(notePath);
        
        dryRunResults.push({
          path: notePath,
          success: processResult.success,
          noteCard: processResult.noteCard,
          error: processResult.error,
          skipped: processResult.skipped,
          skipReason: processResult.skipReason,
        });
        
        if (processResult.success && !processResult.skipped) {
          result.processedNotes++;
        } else if (!processResult.success) {
          result.failedNotes++;
          result.errors.push({
            path: notePath,
            error: processResult.error || 'Unknown error',
          });
        }
      } catch (error) {
        result.failedNotes++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push({
          path: notePath,
          error: errorMessage,
        });
        
        dryRunResults.push({
          path: notePath,
          success: false,
          error: errorMessage,
        });
      }
    }
    
    // Final progress update
    if (onProgress) {
      onProgress({
        total: notePaths.length,
        completed: result.processedNotes + result.failedNotes,
        failed: result.failedNotes,
        pending: 0,
        isRunning: false,
      });
    }
    
    // Log dry-run results to console for developer review (Requirement 15.2)
    console.log('=== CareerOS Dry-Run Results ===');
    console.log(`Total notes: ${result.totalNotes}`);
    console.log(`Processed: ${result.processedNotes}`);
    console.log(`Failed: ${result.failedNotes}`);
    console.log('');
    
    for (const dryResult of dryRunResults) {
      if (dryResult.success && dryResult.noteCard) {
        console.log(`✓ ${dryResult.path}`);
        console.log(`  Type: ${dryResult.noteCard.type}`);
        console.log(`  Summary: ${dryResult.noteCard.summary.substring(0, 100)}...`);
        console.log(`  Skills: ${dryResult.noteCard.tech_stack.map(t => t.name).join(', ')}`);
      } else if (dryResult.skipped) {
        console.log(`⊘ ${dryResult.path} (skipped: ${dryResult.skipReason})`);
      } else {
        console.log(`✗ ${dryResult.path}`);
        console.log(`  Error: ${dryResult.error}`);
      }
      console.log('');
    }
    
    console.log('=== End Dry-Run Results ===');
    
    return result;
  }

  /**
   * Process a note in dry-run mode (no file writes)
   * 
   * Similar to processNote() but does NOT write to IndexStore
   */
  private async processNoteDryRun(notePath: string): Promise<ProcessNoteResult> {
    const normalizedPath = normalizePath(notePath);
    
    try {
      // Get the file
      const file = this.app.vault.getAbstractFileByPath(normalizedPath);
      if (!file || !(file instanceof TFile)) {
        return {
          success: false,
          error: `File not found: ${notePath}`,
        };
      }
      
      // Read note content
      const content = await this.app.vault.read(file);
      
      // Extract tags from frontmatter or content
      const tags = this.extractTags(content);
      
      // Check exclusion rules (Property 9)
      if (this.privacyGuard.shouldExclude(normalizedPath, tags)) {
        return {
          success: true,
          skipped: true,
          skipReason: 'Note excluded by privacy rules',
        };
      }
      
      // Calculate content hash (Property 3)
      const contentHash = calculateContentHash(content);
      
      // Check if we already have a card with the same hash
      const existingCard = await this.indexStore.readNoteCard(normalizedPath);
      if (existingCard && existingCard.hash === contentHash) {
        return {
          success: true,
          skipped: true,
          skipReason: 'Content unchanged (hash match)',
          noteCard: existingCard,
        };
      }
      
      // Get LLM provider for extract role
      const llmConfig = this.settings.llmConfigs.extract;
      
      // Apply PII filtering for external LLMs (Property 8)
      const filteredContent = this.privacyGuard.filterPII(content, llmConfig.provider);
      
      // Get current date for detected_date
      const currentDate = new Date().toISOString();
      
      // Build prompt
      const prompt = await getNoteCardPrompt(
        this.promptStore,
        normalizedPath,
        filteredContent,
        contentHash,
        currentDate
      );
      
      // Call LLM with retry logic (Property 15)
      let noteCard: NoteCard;
      let attempts = 0;
      const maxRetries = this.settings.maxRetries;
      
      while (attempts <= maxRetries) {
        attempts++;
        
        try {
          // Call LLM expecting JSON output
          const llmOutput = await this.llmClient.callJSON(
            'extract',
            prompt,
            LLMNoteCardOutputSchema,
            { maxRetries: 0 } // We handle retries ourselves
          );
          
          // Ensure required fields are set correctly
          noteCard = {
            ...llmOutput,
            schema_version: CURRENT_SCHEMA_VERSION,
            note_path: normalizedPath,
            hash: contentHash,
            detected_date: currentDate,
            // Infer last_updated if LLM didn't provide a good value
            last_updated: llmOutput.last_updated || inferLastUpdated(content, file.name, file),
          };
          
          // Validate final NoteCard against schema
          NoteCardSchema.parse(noteCard);
          
          // DRY-RUN: Do NOT write to IndexStore (Property 24)
          // Just return the result for display
          
          return {
            success: true,
            noteCard,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          // Check if we should retry
          if (attempts <= maxRetries) {
            console.log(`[Dry-Run] NoteCard extraction failed (attempt ${attempts}/${maxRetries + 1}): ${errorMessage}`);
            continue;
          }
          
          // Max retries exhausted
          return {
            success: false,
            error: `Extraction failed after ${attempts} attempts: ${errorMessage}`,
          };
        }
      }
      
      // Should not reach here
      return {
        success: false,
        error: 'Unexpected error in extraction loop',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get the current queue manager for external control (pause/resume/cancel)
   * This is set during coldStartIndex execution
   */
  private currentQueueManager?: QueueManager;

  /**
   * Pause the current indexing operation
   */
  pauseIndexing(): void {
    if (this.currentQueueManager) {
      this.currentQueueManager.pause();
    }
  }

  /**
   * Resume the current indexing operation
   */
  resumeIndexing(): void {
    if (this.currentQueueManager) {
      this.currentQueueManager.resume();
    }
  }

  /**
   * Cancel the current indexing operation
   */
  cancelIndexing(): void {
    if (this.currentQueueManager) {
      this.currentQueueManager.cancel();
    }
  }

  /**
   * Check if indexing is currently running
   */
  isIndexingRunning(): boolean {
    return this.currentQueueManager?.isRunning() ?? false;
  }

  /**
   * Check if indexing is currently paused
   */
  isIndexingPaused(): boolean {
    return this.currentQueueManager?.isPaused() ?? false;
  }

  // ============================================================================
  // Incremental Update Handling
  // Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
  // ============================================================================

  /**
   * Debounce map to prevent rapid re-indexing
   * Key: note path, Value: timeout ID
   */
  private debounceMap: Map<string, ReturnType<typeof setTimeout>> = new Map();
  
  /**
   * Debounce delay in milliseconds
   */
  private readonly DEBOUNCE_DELAY = 2000;

  /**
   * Incremental update queue manager (separate from cold start)
   */
  private incrementalQueueManager?: QueueManager;

  /**
   * Handle note saved event
   * 
   * Requirements:
   * - 2.1: Calculate content hash and compare with existing NoteCard
   * - 2.2: Add note to queue when hash differs
   * 
   * Property 5: Incremental update correctness
   * 
   * @param notePath - Path to the saved note
   * @returns IncrementalUpdateResult
   */
  async handleNoteSaved(notePath: string): Promise<IncrementalUpdateResult> {
    const normalizedPath = normalizePath(notePath);
    
    // Apply debouncing to prevent rapid re-indexing
    const existingTimeout = this.debounceMap.get(normalizedPath);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    return new Promise((resolve) => {
      const timeoutId = setTimeout(async () => {
        this.debounceMap.delete(normalizedPath);
        const result = await this.processNoteSavedDebounced(normalizedPath);
        resolve(result);
      }, this.DEBOUNCE_DELAY);
      
      this.debounceMap.set(normalizedPath, timeoutId);
    });
  }

  /**
   * Process note saved after debounce delay
   */
  private async processNoteSavedDebounced(notePath: string): Promise<IncrementalUpdateResult> {
    try {
      // Get the file
      const file = this.app.vault.getAbstractFileByPath(notePath);
      if (!file || !(file instanceof TFile)) {
        return {
          action: 'error',
          reason: `File not found: ${notePath}`,
          notePath,
        };
      }
      
      // Read content and calculate hash
      const content = await this.app.vault.read(file);
      
      // Extract tags for exclusion check
      const tags = this.extractTags(content);
      
      // Check exclusion rules (Property 9)
      if (this.privacyGuard.shouldExclude(notePath, tags)) {
        return {
          action: 'skipped',
          reason: 'Note excluded by privacy rules',
          notePath,
        };
      }
      
      const currentHash = calculateContentHash(content);
      
      // Get existing card (Requirement 2.1)
      const existingCard = await this.indexStore.readNoteCard(notePath);
      
      // Compare hashes (Requirement 2.1)
      if (existingCard && existingCard.hash === currentHash) {
        return {
          action: 'skipped',
          reason: 'Content unchanged (hash match)',
          notePath,
        };
      }
      
      // Hash differs or no existing card - add to queue (Requirement 2.2)
      await this.addToIncrementalQueue(notePath);
      
      return {
        action: 'queued',
        reason: existingCard ? 'Content changed (hash mismatch)' : 'New note',
        notePath,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        action: 'error',
        reason: errorMessage,
        notePath,
      };
    }
  }

  /**
   * Handle note renamed/moved event
   * 
   * Requirements:
   * - 2.3: Update NoteCard path and relocate card file
   * 
   * Property 6: File operation state consistency
   * 
   * @param oldPath - Original path of the note
   * @param newPath - New path of the note
   * @returns FileRenameResult
   */
  async handleNoteRenamed(oldPath: string, newPath: string): Promise<FileRenameResult> {
    const normalizedOldPath = normalizePath(oldPath);
    const normalizedNewPath = normalizePath(newPath);
    
    try {
      // Read existing card
      const existingCard = await this.indexStore.readNoteCard(normalizedOldPath);
      
      if (!existingCard) {
        // No existing card, nothing to update
        // But we should queue the new path for extraction
        await this.addToIncrementalQueue(normalizedNewPath);
        
        return {
          success: true,
          oldPath: normalizedOldPath,
          newPath: normalizedNewPath,
        };
      }
      
      // Update card with new path
      const updatedCard: NoteCard = {
        ...existingCard,
        note_path: normalizedNewPath,
        detected_date: new Date().toISOString(),
      };
      
      // Write card to new location
      await this.indexStore.writeNoteCard(updatedCard);
      
      // Delete old card file
      await this.indexStore.deleteNoteCard(normalizedOldPath);
      
      console.log(`NoteCard relocated: ${normalizedOldPath} -> ${normalizedNewPath}`);
      
      return {
        success: true,
        oldPath: normalizedOldPath,
        newPath: normalizedNewPath,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to handle note rename: ${errorMessage}`);
      
      return {
        success: false,
        oldPath: normalizedOldPath,
        newPath: normalizedNewPath,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle note deleted event
   * 
   * Requirements:
   * - 2.4: Mark NoteCard as deleted without physically removing the card file
   * 
   * Property 6: File operation state consistency
   * 
   * @param notePath - Path of the deleted note
   * @returns FileDeleteResult
   */
  async handleNoteDeleted(notePath: string): Promise<FileDeleteResult> {
    const normalizedPath = normalizePath(notePath);
    
    try {
      // Read existing card
      const existingCard = await this.indexStore.readNoteCard(normalizedPath);
      
      if (!existingCard) {
        // No existing card, nothing to mark as deleted
        return {
          success: true,
          notePath: normalizedPath,
        };
      }
      
      // Mark card as deleted (logical deletion)
      const updatedCard: NoteCard = {
        ...existingCard,
        deleted: true,
        detected_date: new Date().toISOString(),
      };
      
      // Write updated card (don't physically remove)
      await this.indexStore.writeNoteCard(updatedCard);
      
      console.log(`NoteCard marked as deleted: ${normalizedPath}`);
      
      return {
        success: true,
        notePath: normalizedPath,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to handle note deletion: ${errorMessage}`);
      
      return {
        success: false,
        notePath: normalizedPath,
        error: errorMessage,
      };
    }
  }

  /**
   * Add note to incremental processing queue
   * 
   * Uses a separate queue from cold start to allow concurrent operations
   */
  private async addToIncrementalQueue(notePath: string): Promise<void> {
    // Initialize incremental queue if not exists
    if (!this.incrementalQueueManager) {
      this.incrementalQueueManager = createQueueManager(
        async (task: Task) => {
          const taskNotePath = task.data.notePath as string;
          return await this.processNote(taskNotePath);
        },
        {
          concurrency: 1, // Process one at a time for incremental updates
          onTaskComplete: (result: TaskResult) => {
            if (result.success) {
              console.log(`Incremental update completed: ${result.taskId}`);
            } else {
              console.error(`Incremental update failed: ${result.taskId}`, result.error);
            }
          },
        }
      );
      
      // Start the queue
      this.incrementalQueueManager.start();
    }
    
    // Create and enqueue task
    const task = createTask('extract_note', { notePath }, 0);
    await this.incrementalQueueManager.enqueue(task);
    
    console.log(`Note queued for incremental update: ${notePath}`);
  }

  /**
   * Get incremental queue status
   */
  getIncrementalQueueStatus(): QueueStatus | null {
    return this.incrementalQueueManager?.getStatus() ?? null;
  }

  /**
   * Clear all debounce timers (cleanup)
   */
  clearDebounceTimers(): void {
    for (const timeout of this.debounceMap.values()) {
      clearTimeout(timeout);
    }
    this.debounceMap.clear();
  }

  /**
   * Handle corrupted card file
   * 
   * Requirement 2.5: Attempt to regenerate from source note and log error
   * 
   * @param notePath - Path to the source note
   * @returns ProcessNoteResult
   */
  async handleCorruptedCard(notePath: string): Promise<ProcessNoteResult> {
    const normalizedPath = normalizePath(notePath);
    
    console.log(`Attempting to regenerate corrupted card: ${normalizedPath}`);
    
    // Log the corruption error
    const extractionError: ExtractionError = {
      path: normalizedPath,
      error: 'Card file corrupted, attempting regeneration',
      timestamp: new Date().toISOString(),
      attempts: 0,
    };
    
    await logExtractionError(this.fileService, this.pluginDataDir, extractionError);
    
    // Try to regenerate by processing the note
    return await this.processNote(normalizedPath);
  }
}

/**
 * Create a ProfileEngine instance
 */
export function createProfileEngine(
  app: App,
  settings: CareerOSSettings,
  llmClient: LLMClient,
  indexStore: IndexStore,
  promptStore: PromptStore,
  privacyGuard: PrivacyGuard,
  pluginDataDir: string
): ProfileEngine {
  return new ProfileEngine(
    app,
    settings,
    llmClient,
    indexStore,
    promptStore,
    privacyGuard,
    pluginDataDir
  );
}
