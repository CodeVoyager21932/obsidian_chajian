/**
 * IndexStore - Manages reading, writing, and versioning of all index files
 * 
 * Provides:
 * - Read/write NoteCard, JDCard, SelfProfile, MarketProfile
 * - Schema validation and migration
 * - Consistent card file path resolution
 * - Error handling and recovery
 */

import { App } from 'obsidian';
import { z } from 'zod';
import { FileService } from './fs';
import {
  NoteCard,
  JDCard,
  SelfProfile,
  MarketProfile,
} from './types';
import {
  NoteCardSchema,
  JDCardSchema,
  SelfProfileSchema,
  MarketProfileSchema,
  CURRENT_SCHEMA_VERSION,
  migrateSchema,
  validateSchemaVersion,
} from './schema';

export class IndexStore {
  private fileService: FileService;
  
  constructor(
    private app: App,
    private pluginDataDir: string,
    private indexDirectory: string,
    private mappingDirectory: string,
    private marketCardsDirectory: string
  ) {
    this.fileService = new FileService(app, pluginDataDir);
  }

  // ============================================================================
  // NoteCard Operations
  // ============================================================================

  /**
   * Read a note card with schema validation and migration
   * Property 16: Schema version migration
   */
  async readNoteCard(notePath: string): Promise<NoteCard | null> {
    const cardPath = this.getNoteCardPath(notePath);
    
    try {
      const content = await this.fileService.read(cardPath);
      const parsed = JSON.parse(content);
      
      // Check schema version and migrate if needed
      if (!validateSchemaVersion(parsed, CURRENT_SCHEMA_VERSION)) {
        const migrated = migrateSchema(
          parsed,
          NoteCardSchema,
          parsed.schema_version || 1,
          CURRENT_SCHEMA_VERSION
        );
        
        // Write back migrated version
        await this.writeNoteCard(migrated);
        return migrated;
      }
      
      // Validate against current schema
      return NoteCardSchema.parse(parsed);
    } catch (error) {
      if (error instanceof Error && error.message.includes('File not found')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Write a note card with backup
   */
  async writeNoteCard(card: NoteCard): Promise<void> {
    const cardPath = this.getNoteCardPath(card.note_path);
    await this.fileService.writeJSON(cardPath, card, NoteCardSchema);
  }

  /**
   * List all note cards
   */
  async listNoteCards(): Promise<NoteCard[]> {
    const cardFiles = await this.fileService.listFiles(this.indexDirectory, 'json');
    const cards: NoteCard[] = [];
    
    for (const cardPath of cardFiles) {
      try {
        const content = await this.fileService.read(cardPath);
        const parsed = JSON.parse(content);
        
        // Migrate if needed
        if (!validateSchemaVersion(parsed, CURRENT_SCHEMA_VERSION)) {
          const migrated = migrateSchema(
            parsed,
            NoteCardSchema,
            parsed.schema_version || 1,
            CURRENT_SCHEMA_VERSION
          );
          cards.push(migrated);
        } else {
          cards.push(NoteCardSchema.parse(parsed));
        }
      } catch (error) {
        console.error(`Failed to read note card: ${cardPath}`, error);
      }
    }
    
    return cards;
  }

  /**
   * Delete a note card
   */
  async deleteNoteCard(notePath: string): Promise<void> {
    const cardPath = this.getNoteCardPath(notePath);
    await this.fileService.delete(cardPath);
  }

  // ============================================================================
  // JDCard Operations
  // ============================================================================

  /**
   * Read a JD card with schema validation and migration
   */
  async readJDCard(jdId: string): Promise<JDCard | null> {
    const cardPath = this.getJDCardPath(jdId);
    
    try {
      const content = await this.fileService.read(cardPath);
      const parsed = JSON.parse(content);
      
      // Check schema version and migrate if needed
      if (!validateSchemaVersion(parsed, CURRENT_SCHEMA_VERSION)) {
        const migrated = migrateSchema(
          parsed,
          JDCardSchema,
          parsed.schema_version || 1,
          CURRENT_SCHEMA_VERSION
        );
        
        // Write back migrated version
        await this.writeJDCard(migrated);
        return migrated;
      }
      
      return JDCardSchema.parse(parsed);
    } catch (error) {
      if (error instanceof Error && error.message.includes('File not found')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Write a JD card with backup
   */
  async writeJDCard(card: JDCard): Promise<void> {
    const cardPath = this.getJDCardPath(card.jd_id);
    await this.fileService.writeJSON(cardPath, card, JDCardSchema);
  }

  /**
   * List all JD cards
   */
  async listJDCards(): Promise<JDCard[]> {
    const cardFiles = await this.fileService.listFiles(this.marketCardsDirectory, 'json');
    const cards: JDCard[] = [];
    
    for (const cardPath of cardFiles) {
      try {
        const content = await this.fileService.read(cardPath);
        const parsed = JSON.parse(content);
        
        // Migrate if needed
        if (!validateSchemaVersion(parsed, CURRENT_SCHEMA_VERSION)) {
          const migrated = migrateSchema(
            parsed,
            JDCardSchema,
            parsed.schema_version || 1,
            CURRENT_SCHEMA_VERSION
          );
          cards.push(migrated);
        } else {
          cards.push(JDCardSchema.parse(parsed));
        }
      } catch (error) {
        console.error(`Failed to read JD card: ${cardPath}`, error);
      }
    }
    
    return cards;
  }

  /**
   * Find JD card by raw text hash
   */
  async findJDCardByHash(hash: string): Promise<JDCard | null> {
    const cards = await this.listJDCards();
    return cards.find(card => card.raw_text_hash === hash) || null;
  }

  /**
   * Delete a JD card
   */
  async deleteJDCard(jdId: string): Promise<void> {
    const cardPath = this.getJDCardPath(jdId);
    await this.fileService.delete(cardPath);
  }

  // ============================================================================
  // SelfProfile Operations
  // ============================================================================

  /**
   * Read self profile with schema validation and migration
   */
  async readSelfProfile(): Promise<SelfProfile | null> {
    const profilePath = this.getSelfProfilePath();
    
    try {
      const content = await this.fileService.read(profilePath);
      const parsed = JSON.parse(content);
      
      // Check schema version and migrate if needed
      if (!validateSchemaVersion(parsed, CURRENT_SCHEMA_VERSION)) {
        const migrated = migrateSchema(
          parsed,
          SelfProfileSchema,
          parsed.schema_version || 1,
          CURRENT_SCHEMA_VERSION
        );
        
        // Write back migrated version
        await this.writeSelfProfile(migrated);
        return migrated;
      }
      
      return SelfProfileSchema.parse(parsed);
    } catch (error) {
      if (error instanceof Error && error.message.includes('File not found')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Write self profile with backup
   */
  async writeSelfProfile(profile: SelfProfile): Promise<void> {
    const profilePath = this.getSelfProfilePath();
    await this.fileService.writeJSON(profilePath, profile, SelfProfileSchema);
  }

  // ============================================================================
  // MarketProfile Operations
  // ============================================================================

  /**
   * Read market profile with schema validation and migration
   */
  async readMarketProfile(role: string, location: string): Promise<MarketProfile | null> {
    const profilePath = this.getMarketProfilePath(role, location);
    
    try {
      const content = await this.fileService.read(profilePath);
      const parsed = JSON.parse(content);
      
      // Check schema version and migrate if needed
      if (!validateSchemaVersion(parsed, CURRENT_SCHEMA_VERSION)) {
        const migrated = migrateSchema(
          parsed,
          MarketProfileSchema,
          parsed.schema_version || 1,
          CURRENT_SCHEMA_VERSION
        );
        
        // Write back migrated version
        await this.writeMarketProfile(migrated);
        return migrated;
      }
      
      return MarketProfileSchema.parse(parsed);
    } catch (error) {
      if (error instanceof Error && error.message.includes('File not found')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Write market profile with backup
   */
  async writeMarketProfile(profile: MarketProfile): Promise<void> {
    const profilePath = this.getMarketProfilePath(profile.role, profile.location);
    await this.fileService.writeJSON(profilePath, profile, MarketProfileSchema);
  }

  /**
   * List all market profiles
   */
  async listMarketProfiles(): Promise<MarketProfile[]> {
    const profileFiles = await this.fileService.listFiles(this.mappingDirectory, 'json');
    const profiles: MarketProfile[] = [];
    
    for (const profilePath of profileFiles) {
      // Skip self profile
      if (profilePath.includes('self_profile')) {
        continue;
      }
      
      try {
        const content = await this.fileService.read(profilePath);
        const parsed = JSON.parse(content);
        
        // Migrate if needed
        if (!validateSchemaVersion(parsed, CURRENT_SCHEMA_VERSION)) {
          const migrated = migrateSchema(
            parsed,
            MarketProfileSchema,
            parsed.schema_version || 1,
            CURRENT_SCHEMA_VERSION
          );
          profiles.push(migrated);
        } else {
          profiles.push(MarketProfileSchema.parse(parsed));
        }
      } catch (error) {
        console.error(`Failed to read market profile: ${profilePath}`, error);
      }
    }
    
    return profiles;
  }

  // ============================================================================
  // Path Resolution Utilities
  // ============================================================================

  /**
   * Get card path for a note
   * Consistent card file path resolution
   */
  getNoteCardPath(notePath: string): string {
    // Convert note path to card filename
    // Example: "projects/my-project.md" -> "projects_my-project.json"
    const sanitized = notePath
      .replace(/\.md$/, '')
      .replace(/\//g, '_')
      .replace(/\\/g, '_');
    
    return `${this.indexDirectory}/${sanitized}.json`;
  }

  /**
   * Get card path for a JD
   */
  getJDCardPath(jdId: string): string {
    return `${this.marketCardsDirectory}/${jdId}.json`;
  }

  /**
   * Get path for self profile
   */
  getSelfProfilePath(): string {
    const timestamp = new Date().toISOString().split('T')[0];
    return `${this.mappingDirectory}/self_profile_${timestamp}.json`;
  }

  /**
   * Get path for market profile
   */
  getMarketProfilePath(role: string, location: string): string {
    const sanitizedRole = role.toLowerCase().replace(/\s+/g, '_');
    const sanitizedLocation = location.toLowerCase().replace(/\s+/g, '_');
    const timestamp = new Date().toISOString().split('T')[0];
    
    return `${this.mappingDirectory}/market_${sanitizedRole}_${sanitizedLocation}_${timestamp}.json`;
  }

  // ============================================================================
  // Migration Utilities
  // ============================================================================

  /**
   * Migrate all cards to current schema version
   */
  async migrateAll(): Promise<{ migrated: number; failed: number }> {
    let migrated = 0;
    let failed = 0;
    
    // Migrate note cards
    const noteCards = await this.listNoteCards();
    for (const card of noteCards) {
      try {
        if (card.schema_version !== CURRENT_SCHEMA_VERSION) {
          await this.writeNoteCard(card);
          migrated++;
        }
      } catch (error) {
        console.error(`Failed to migrate note card: ${card.note_path}`, error);
        failed++;
      }
    }
    
    // Migrate JD cards
    const jdCards = await this.listJDCards();
    for (const card of jdCards) {
      try {
        if (card.schema_version !== CURRENT_SCHEMA_VERSION) {
          await this.writeJDCard(card);
          migrated++;
        }
      } catch (error) {
        console.error(`Failed to migrate JD card: ${card.jd_id}`, error);
        failed++;
      }
    }
    
    return { migrated, failed };
  }
}

/**
 * Standalone utility function for getting card path
 * Can be used outside of IndexStore context
 */
export function getCardPath(notePath: string, indexDirectory: string): string {
  const sanitized = notePath
    .replace(/\.md$/, '')
    .replace(/\//g, '_')
    .replace(/\\/g, '_');
  
  return `${indexDirectory}/${sanitized}.json`;
}
