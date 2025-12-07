/**
 * MarketScanner Tests
 * 
 * Basic unit tests for MarketScanner functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MarketScanner } from './MarketScanner';
import { App } from 'obsidian';
import { CareerOSSettings, LLMConfig } from './types';
import { LLMClient } from './llmClient';
import { IndexStore } from './IndexStore';
import { PromptStore } from './PromptStore';
import { PrivacyGuard } from './PrivacyGuard';
import { Taxonomy } from './Taxonomy';

// Mock Obsidian App
const createMockApp = (): App => {
  return {
    vault: {
      getAbstractFileByPath: vi.fn(),
      read: vi.fn(),
      create: vi.fn(),
      modify: vi.fn(),
      createFolder: vi.fn(),
      adapter: {
        exists: vi.fn(),
        read: vi.fn(),
      },
    },
  } as any;
};

// Mock settings
const createMockSettings = (): CareerOSSettings => {
  const llmConfig: LLMConfig = {
    provider: 'local',
    model: 'test-model',
    baseUrl: 'http://localhost:11434',
  };

  return {
    llmConfigs: {
      extract: llmConfig,
      analyze: llmConfig,
      embedding: llmConfig,
    },
    openaiApiKey: '',
    anthropicApiKey: '',
    googleApiKey: '',
    maxRetries: 3,
    timeout: 30000,
    concurrency: 2,
    exclusionRules: {
      directories: [],
      tags: [],
    },
    taxonomy: [],
    dryRunEnabled: false,
    dryRunMaxNotes: 10,
    indexDirectory: 'test-index',
    mappingDirectory: 'test-mapping',
    marketCardsDirectory: 'test-market-cards',
  };
};

describe('MarketScanner', () => {
  let app: App;
  let settings: CareerOSSettings;
  let llmClient: LLMClient;
  let indexStore: IndexStore;
  let promptStore: PromptStore;
  let privacyGuard: PrivacyGuard;
  let taxonomy: Taxonomy;
  let scanner: MarketScanner;

  beforeEach(() => {
    app = createMockApp();
    settings = createMockSettings();
    llmClient = new LLMClient(settings);
    indexStore = new IndexStore(
      app,
      'test-plugin-dir',
      settings.indexDirectory,
      settings.mappingDirectory,
      settings.marketCardsDirectory
    );
    promptStore = new PromptStore(app, 'test-plugin-dir');
    privacyGuard = new PrivacyGuard(settings.exclusionRules);
    taxonomy = new Taxonomy(settings.taxonomy); // Pass taxonomy array
    
    scanner = new MarketScanner(
      app,
      settings,
      llmClient,
      indexStore,
      promptStore,
      privacyGuard,
      taxonomy
    );
  });

  describe('extractJDCards', () => {
    it('should return error when file not found', async () => {
      vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(null);

      const result = await scanner.extractJDCards('non-existent.md');

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
      expect(result.cards).toHaveLength(0);
    });

    it('should return error when note is excluded', async () => {
      // Import TFile from test mocks
      const { TFile } = await import('./test-mocks/obsidian');
      
      // Create a proper TFile instance
      const mockFile = new TFile('test.md', 'md');
      
      // Mock the file system calls
      vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(mockFile as any);
      vi.mocked(app.vault.read).mockResolvedValue('---\ntags: [private]\n---\nContent');
      
      // Mock privacy guard to exclude this note
      vi.spyOn(privacyGuard, 'shouldExclude').mockReturnValue(true);

      const result = await scanner.extractJDCards('test.md');

      expect(result.success).toBe(false);
      expect(result.error).toContain('excluded');
    });
  });

  describe('buildMarketProfile', () => {
    it('should return error when no matching JD cards found', async () => {
      vi.spyOn(indexStore, 'listJDCards').mockResolvedValue([]);

      const result = await scanner.buildMarketProfile('Python Developer', 'Beijing');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No JD cards found');
    });

    it('should filter JDCards by role and location (Requirement 8.1)', async () => {
      const mockJDCards = [
        {
          schema_version: 1,
          jd_id: 'jd-1',
          source_note: 'jd.md',
          company: 'Company A',
          title: 'Python Backend Developer',
          location: 'Beijing',
          salary_range: '20k-30k',
          skills_required: ['Python', 'Django'],
          skills_optional: ['Redis'],
          experience: '3-5年',
          degree: '本科',
          raw_text_hash: 'hash1',
          tags: [],
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          schema_version: 1,
          jd_id: 'jd-2',
          source_note: 'jd.md',
          company: 'Company B',
          title: 'Frontend Developer',
          location: 'Beijing',
          salary_range: '15k-25k',
          skills_required: ['React', 'TypeScript'],
          skills_optional: ['Vue'],
          experience: '2-3年',
          degree: '本科',
          raw_text_hash: 'hash2',
          tags: [],
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          schema_version: 1,
          jd_id: 'jd-3',
          source_note: 'jd.md',
          company: 'Company C',
          title: 'Python Backend Developer',
          location: 'Shanghai',
          salary_range: '25k-35k',
          skills_required: ['Python', 'Flask'],
          skills_optional: ['MongoDB'],
          experience: '5年以上',
          degree: '硕士',
          raw_text_hash: 'hash3',
          tags: [],
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];

      vi.spyOn(indexStore, 'listJDCards').mockResolvedValue(mockJDCards);
      vi.spyOn(indexStore, 'writeMarketProfile').mockResolvedValue();
      vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(null);
      vi.mocked(app.vault.createFolder).mockResolvedValue(undefined as any);
      vi.mocked(app.vault.create).mockResolvedValue({} as any);

      const result = await scanner.buildMarketProfile('Python', 'Beijing');

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();
      // Only jd-1 matches both Python and Beijing
      expect(result.profile!.sample_jd_ids).toContain('jd-1');
      expect(result.profile!.sample_jd_ids).not.toContain('jd-2'); // Frontend, not Python
      expect(result.profile!.sample_jd_ids).not.toContain('jd-3'); // Shanghai, not Beijing
    });

    it('should normalize skills using Taxonomy (Requirement 8.2)', async () => {
      const mockJDCards = [
        {
          schema_version: 1,
          jd_id: 'jd-1',
          source_note: 'jd.md',
          company: 'Company A',
          title: 'Backend Developer',
          location: 'Beijing',
          salary_range: '20k-30k',
          skills_required: ['python', 'js', 'typescript'], // lowercase aliases
          skills_optional: ['react'],
          experience: '3-5年',
          degree: '本科',
          raw_text_hash: 'hash1',
          tags: [],
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];

      vi.spyOn(indexStore, 'listJDCards').mockResolvedValue(mockJDCards);
      vi.spyOn(indexStore, 'writeMarketProfile').mockResolvedValue();
      vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(null);
      vi.mocked(app.vault.createFolder).mockResolvedValue(undefined as any);
      vi.mocked(app.vault.create).mockResolvedValue({} as any);

      // Use taxonomy with mappings
      const taxonomyWithMappings = new Taxonomy([
        { standardName: 'Python', aliases: ['python', 'py'] },
        { standardName: 'JavaScript', aliases: ['js', 'javascript'] },
        { standardName: 'TypeScript', aliases: ['ts', 'typescript'] },
        { standardName: 'React', aliases: ['react', 'reactjs'] },
      ]);

      const scannerWithTaxonomy = new MarketScanner(
        app,
        settings,
        llmClient,
        indexStore,
        promptStore,
        privacyGuard,
        taxonomyWithMappings
      );

      const result = await scannerWithTaxonomy.buildMarketProfile('Backend', 'Beijing');

      expect(result.success).toBe(true);
      const skillNames = result.profile!.skills_demand.map(s => s.name);
      // Skills should be normalized to standard names
      expect(skillNames).toContain('Python');
      expect(skillNames).toContain('JavaScript');
      expect(skillNames).toContain('TypeScript');
      expect(skillNames).toContain('React');
      // Should not contain lowercase aliases
      expect(skillNames).not.toContain('python');
      expect(skillNames).not.toContain('js');
    });

    it('should aggregate experience distribution (Requirement 8.3)', async () => {
      const mockJDCards = [
        {
          schema_version: 1,
          jd_id: 'jd-1',
          source_note: 'jd.md',
          company: 'Company A',
          title: 'Developer',
          location: 'Beijing',
          salary_range: '20k-30k',
          skills_required: ['Python'],
          skills_optional: [],
          experience: '3-5年',
          degree: '本科',
          raw_text_hash: 'hash1',
          tags: [],
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          schema_version: 1,
          jd_id: 'jd-2',
          source_note: 'jd.md',
          company: 'Company B',
          title: 'Developer',
          location: 'Beijing',
          salary_range: '25k-35k',
          skills_required: ['Python'],
          skills_optional: [],
          experience: '3-5年',
          degree: '硕士',
          raw_text_hash: 'hash2',
          tags: [],
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          schema_version: 1,
          jd_id: 'jd-3',
          source_note: 'jd.md',
          company: 'Company C',
          title: 'Developer',
          location: 'Beijing',
          salary_range: '30k-40k',
          skills_required: ['Python'],
          skills_optional: [],
          experience: '5年以上',
          degree: '本科',
          raw_text_hash: 'hash3',
          tags: [],
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];

      vi.spyOn(indexStore, 'listJDCards').mockResolvedValue(mockJDCards);
      vi.spyOn(indexStore, 'writeMarketProfile').mockResolvedValue();
      vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(null);
      vi.mocked(app.vault.createFolder).mockResolvedValue(undefined as any);
      vi.mocked(app.vault.create).mockResolvedValue({} as any);

      const result = await scanner.buildMarketProfile('Developer', 'Beijing');

      expect(result.success).toBe(true);
      // Check experience distribution
      expect(result.profile!.experience_distribution['3-5年']).toBe(2);
      expect(result.profile!.experience_distribution['5年以上']).toBe(1);
    });

    it('should include sample JD IDs (Requirement 8.4)', async () => {
      const mockJDCards = Array.from({ length: 15 }, (_, i) => ({
        schema_version: 1,
        jd_id: `jd-${i + 1}`,
        source_note: 'jd.md',
        company: `Company ${i + 1}`,
        title: 'Developer',
        location: 'Beijing',
        salary_range: '20k-30k',
        skills_required: ['Python'],
        skills_optional: [],
        experience: '3-5年',
        degree: '本科',
        raw_text_hash: `hash${i + 1}`,
        tags: [],
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      }));

      vi.spyOn(indexStore, 'listJDCards').mockResolvedValue(mockJDCards);
      vi.spyOn(indexStore, 'writeMarketProfile').mockResolvedValue();
      vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(null);
      vi.mocked(app.vault.createFolder).mockResolvedValue(undefined as any);
      vi.mocked(app.vault.create).mockResolvedValue({} as any);

      const result = await scanner.buildMarketProfile('Developer', 'Beijing');

      expect(result.success).toBe(true);
      // Should include max 10 sample JD IDs
      expect(result.profile!.sample_jd_ids.length).toBe(10);
    });

    it('should exclude deleted JDCards', async () => {
      const mockJDCards = [
        {
          schema_version: 1,
          jd_id: 'jd-1',
          source_note: 'jd.md',
          company: 'Company A',
          title: 'Developer',
          location: 'Beijing',
          salary_range: '20k-30k',
          skills_required: ['Python'],
          skills_optional: [],
          experience: '3-5年',
          degree: '本科',
          raw_text_hash: 'hash1',
          tags: [],
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          deleted: true, // This card is deleted
        },
        {
          schema_version: 1,
          jd_id: 'jd-2',
          source_note: 'jd.md',
          company: 'Company B',
          title: 'Developer',
          location: 'Beijing',
          salary_range: '25k-35k',
          skills_required: ['Python'],
          skills_optional: [],
          experience: '3-5年',
          degree: '本科',
          raw_text_hash: 'hash2',
          tags: [],
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];

      vi.spyOn(indexStore, 'listJDCards').mockResolvedValue(mockJDCards);
      vi.spyOn(indexStore, 'writeMarketProfile').mockResolvedValue();
      vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(null);
      vi.mocked(app.vault.createFolder).mockResolvedValue(undefined as any);
      vi.mocked(app.vault.create).mockResolvedValue({} as any);

      const result = await scanner.buildMarketProfile('Developer', 'Beijing');

      expect(result.success).toBe(true);
      // Should only include non-deleted card
      expect(result.profile!.sample_jd_ids).toEqual(['jd-2']);
      expect(result.profile!.sample_jd_ids).not.toContain('jd-1');
    });
  });

  describe('listMarketProfiles', () => {
    it('should return empty array when no profiles exist', async () => {
      vi.spyOn(indexStore, 'listMarketProfiles').mockResolvedValue([]);

      const result = await scanner.listMarketProfiles();

      expect(result).toEqual([]);
    });
  });
});
