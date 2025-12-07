import { Plugin, TFile } from 'obsidian';
import { CareerOSSettings } from './types';
import { CareerOSSettingsSchema, CURRENT_SCHEMA_VERSION } from './schema';

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

  async onload() {
    console.log('Loading CareerOS plugin');

    // Load settings
    await this.loadSettings();

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
      callback: () => {
        console.log('Cold Start Indexing command triggered');
        // TODO: Implement cold start indexing
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
}
