/**
 * ProfileEngine - Core extraction and profile building engine
 * 
 * Responsible for:
 * - Processing notes and extracting NoteCards using LLM
 * - Content hash calculation for change detection
 * - Time parsing from content, filename, and file metadata
 * - Schema validation with retry logic
 * - Error handling and logging
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.2, 5.3, 5.4
 */

import { App, TFile, normalizePath } from 'obsidian';
import { z } from 'zod';
import { NoteCard, CareerOSSettings, NoteType } from './types';
import { NoteCardSchema, CURRENT_SCHEMA_VERSION } from './schema';
import { LLMClient, LLMError } from './llmClient';
import { IndexStore } from './IndexStore';
import { PromptStore, getNoteCardPrompt } from './PromptStore';
import { PrivacyGuard } from './PrivacyGuard';
import { FileService } from './fs';

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

export class ProfileEngine {
  private app: App;
  private settings: CareerOSSettings;
  private llmClient: LLMClient;
  private indexStore: IndexStore;
  private promptStore: PromptStore;
  private privacyGuard: PrivacyGuard;
  private fileService: FileService;
  private pluginDataDir: string;
  
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
  }
  
  /**
   * Update settings (e.g., when user changes configuration)
   */
  updateSettings(settings: CareerOSSettings): void {
    this.settings = settings;
    this.llmClient.updateSettings(settings);
    this.privacyGuard.updateExclusionRules(settings.exclusionRules);
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
