import { Plugin, TFile, Notice } from 'obsidian';
import { CareerOSSettings, QueueStatus } from './types';
import { CareerOSSettingsSchema, CURRENT_SCHEMA_VERSION } from './schema';
import { ProfileEngine, createProfileEngine } from './ProfileEngine';
import { LLMClient, createLLMClient } from './llmClient';
import { IndexStore } from './IndexStore';
import { PromptStore, createPromptStore } from './PromptStore';
import { PrivacyGuard, createPrivacyGuard } from './PrivacyGuard';

// Default settings
const DEFAULT_SETTINGS: CareerOSSettings = {
  llmConfigs: {
    extract: {
      provider: 'local',
      baseUrl: 'http://localhost:11434',
      model: 'llama2',
      jsonMode: true,
    },
    analyze: {
      provider: 'local',
      baseUrl: 'http://localhost:11434',
      model: 'llama2',
      jsonMode: false,
    },
    embedding: {
      provider: 'local',
      baseUrl: 'http://localhost:11434',
      model: 'llama2',
      jsonMode: false,
    },
  },
  openaiApiKey: '',
  anthropicApiKey: '',
  googleApiKey: '',
  proxyUrl: '',
  customBaseUrl: '',
  maxRetries: 3,
  timeout: 30000,
  concurrency: 3,
  exclusionRules: {
    directories: [],
    tags: [],
  },
  taxonomy: [],
  dryRunEnabled: false,
  dryRunMaxNotes: 10,
  indexDirectory: '.career-os/index',
  mappingDirectory: '.career-os/mapping',
  marketCardsDirectory: '.career-os/market_cards',
};

export default class CareerOSPlugin extends Plugin {
  settings: CareerOSSettings;
  
  // Core services
  private profileEngine?: ProfileEngine;
  private llmClient?: LLMClient;
  private indexStore?: IndexStore;
  private promptStore?: PromptStore;
  private privacyGuard?: PrivacyGuard;
  
  // Plugin data directory
  private pluginDataDir: string = '';

  async onload() {
    console.log('Loading CareerOS plugin');

    // Load settings
    await this.loadSettings();
    
    // Initialize plugin data directory
    this.pluginDataDir = `${this.app.vault.configDir}/plugins/career-os`;
    
    // Initialize core services
    await this.initializeServices();

    // Register commands
    this.registerCommands();

    // Register file event listeners
    this.registerFileEvents();

    // Add ribbon icon
    this.addRibbonIcon('briefcase', 'CareerOS Dashboard', () => {
      console.log('CareerOS Dashboard clicked');
      // TODO: Open dashboard view
    });
  }
  
  /**
   * Initialize core services
   */
  private async initializeServices(): Promise<void> {
    // Create LLM client
    this.llmClient = createLLMClient(this.settings);
    
    // Create IndexStore
    this.indexStore = new IndexStore(
      this.app,
      this.pluginDataDir,
      this.settings.indexDirectory,
      this.settings.mappingDirectory,
      this.settings.marketCardsDirectory
    );
    
    // Create PromptStore
    this.promptStore = createPromptStore(this.app);
    
    // Create PrivacyGuard
    this.privacyGuard = createPrivacyGuard(this.settings.exclusionRules);
    
    // Create ProfileEngine
    this.profileEngine = createProfileEngine(
      this.app,
      this.settings,
      this.llmClient,
      this.indexStore,
      this.promptStore,
      this.privacyGuard,
      this.pluginDataDir
    );
  }

  onunload() {
    console.log('Unloading CareerOS plugin');
  }

  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    
    // Validate settings with schema
    try {
      CareerOSSettingsSchema.parse(this.settings);
    } catch (error) {
      console.error('Settings validation failed, using defaults:', error);
      this.settings = DEFAULT_SETTINGS;
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  registerCommands() {
    // Cold Start Indexing
    this.addCommand({
      id: 'cold-start-indexing',
      name: 'Cold Start Indexing',
      callback: async () => {
        await this.runColdStartIndexing();
      },
    });
    
    // Pause Indexing
    this.addCommand({
      id: 'pause-indexing',
      name: 'Pause Indexing',
      callback: () => {
        if (this.profileEngine?.isIndexingRunning()) {
          this.profileEngine.pauseIndexing();
          new Notice('Indexing paused');
        } else {
          new Notice('No indexing in progress');
        }
      },
    });
    
    // Resume Indexing
    this.addCommand({
      id: 'resume-indexing',
      name: 'Resume Indexing',
      callback: () => {
        if (this.profileEngine?.isIndexingPaused()) {
          this.profileEngine.resumeIndexing();
          new Notice('Indexing resumed');
        } else {
          new Notice('Indexing is not paused');
        }
      },
    });
    
    // Cancel Indexing
    this.addCommand({
      id: 'cancel-indexing',
      name: 'Cancel Indexing',
      callback: () => {
        if (this.profileEngine?.isIndexingRunning() || this.profileEngine?.isIndexingPaused()) {
          this.profileEngine.cancelIndexing();
          new Notice('Indexing cancelled');
        } else {
          new Notice('No indexing in progress');
        }
      },
    });

    // Extract JD Cards
    this.addCommand({
      id: 'extract-jd-cards',
      name: 'Extract JD Cards from Current Note',
      callback: () => {
        console.log('Extract JD Cards command triggered');
        // TODO: Implement JD card extraction
      },
    });

    // Build Self Profile
    this.addCommand({
      id: 'build-self-profile',
      name: 'Build Self Profile',
      callback: () => {
        console.log('Build Self Profile command triggered');
        // TODO: Implement self profile building
      },
    });

    // Build Market Profile
    this.addCommand({
      id: 'build-market-profile',
      name: 'Build Market Profile',
      callback: () => {
        console.log('Build Market Profile command triggered');
        // TODO: Implement market profile building
      },
    });

    // Generate Gap Analysis
    this.addCommand({
      id: 'generate-gap-analysis',
      name: 'Generate Gap Analysis',
      callback: () => {
        console.log('Generate Gap Analysis command triggered');
        // TODO: Implement gap analysis
      },
    });

    // Generate Action Plan
    this.addCommand({
      id: 'generate-action-plan',
      name: 'Generate Action Plan',
      callback: () => {
        console.log('Generate Action Plan command triggered');
        // TODO: Implement action plan generation
      },
    });

    // Open Dashboard
    this.addCommand({
      id: 'open-dashboard',
      name: 'Open Dashboard',
      callback: () => {
        console.log('Open Dashboard command triggered');
        // TODO: Implement dashboard view
      },
    });

    // View Error Log
    this.addCommand({
      id: 'view-error-log',
      name: 'View Error Log',
      callback: () => {
        console.log('View Error Log command triggered');
        // TODO: Implement error log viewer
      },
    });
  }

  registerFileEvents() {
    // File saved event
    this.registerEvent(
      this.app.vault.on('modify', (file: TFile) => {
        if (file.extension === 'md') {
          this.onNoteSaved(file.path);
        }
      })
    );

    // File renamed event
    this.registerEvent(
      this.app.vault.on('rename', (file: TFile, oldPath: string) => {
        if (file.extension === 'md') {
          this.onNoteRenamed(oldPath, file.path);
        }
      })
    );

    // File deleted event
    this.registerEvent(
      this.app.vault.on('delete', (file: TFile) => {
        if (file.extension === 'md') {
          this.onNoteDeleted(file.path);
        }
      })
    );
  }

  async onNoteSaved(notePath: string) {
    console.log(`Note saved: ${notePath}`);
    // TODO: Implement incremental update logic
    // 1. Calculate content hash
    // 2. Compare with existing NoteCard hash
    // 3. If different, add to processing queue
  }

  async onNoteRenamed(oldPath: string, newPath: string) {
    console.log(`Note renamed: ${oldPath} -> ${newPath}`);
    // TODO: Implement rename handling
    // 1. Update NoteCard path
    // 2. Relocate card file
  }

  async onNoteDeleted(notePath: string) {
    console.log(`Note deleted: ${notePath}`);
    // TODO: Implement deletion handling
    // 1. Mark NoteCard as deleted
    // 2. Don't physically remove card file
  }
  
  /**
   * Run cold start indexing
   * 
   * Requirements: 4.1, 4.2, 4.3, 15.1, 15.2, 15.3
   */
  private async runColdStartIndexing(): Promise<void> {
    if (!this.profileEngine) {
      new Notice('ProfileEngine not initialized');
      return;
    }
    
    // Check if already running
    if (this.profileEngine.isIndexingRunning()) {
      new Notice('Indexing is already in progress');
      return;
    }
    
    const isDryRun = this.settings.dryRunEnabled;
    
    // Show start notice
    if (isDryRun) {
      new Notice(`Starting dry-run indexing (max ${this.settings.dryRunMaxNotes} notes)...`);
    } else {
      new Notice('Starting cold start indexing...');
    }
    
    // Track progress for UI updates
    let lastProgressUpdate = 0;
    const progressCallback = (status: QueueStatus) => {
      // Throttle progress updates to avoid too many notices
      const now = Date.now();
      if (now - lastProgressUpdate > 2000) { // Update every 2 seconds
        lastProgressUpdate = now;
        const percent = status.total > 0 
          ? Math.round((status.completed / status.total) * 100) 
          : 0;
        new Notice(`Indexing progress: ${status.completed}/${status.total} (${percent}%)`);
      }
    };
    
    try {
      // Run cold start indexing
      // Empty array means scan entire vault
      const result = await this.profileEngine.coldStartIndex(
        [], // Scan entire vault
        {
          dryRun: isDryRun,
          maxNotes: isDryRun ? this.settings.dryRunMaxNotes : undefined,
          concurrency: this.settings.concurrency,
        },
        progressCallback
      );
      
      // Show completion notice
      if (isDryRun) {
        new Notice(
          `Dry-run complete: ${result.processedNotes} processed, ${result.failedNotes} failed. Check console for details.`
        );
      } else {
        new Notice(
          `Indexing complete: ${result.processedNotes} notes indexed, ${result.failedNotes} failed`
        );
      }
      
      // Log errors if any
      if (result.errors.length > 0) {
        console.log('Indexing errors:', result.errors);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      new Notice(`Indexing failed: ${errorMessage}`);
      console.error('Cold start indexing error:', error);
    }
  }
}
