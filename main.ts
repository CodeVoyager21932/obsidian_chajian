import { Plugin, TFile, Notice, WorkspaceLeaf } from 'obsidian';
import { CareerOSSettings, QueueStatus, SelfProfile, MarketProfile, ErrorLogSummary } from './types';
import { parseErrorLog, generateErrorSummary } from './utils/errorLogParser';
import { CareerOSSettingsSchema, CURRENT_SCHEMA_VERSION } from './schema';
import { ProfileEngine, createProfileEngine } from './ProfileEngine';
import { LLMClient, createLLMClient } from './llmClient';
import { IndexStore } from './IndexStore';
import { PromptStore, createPromptStore } from './PromptStore';
import { PrivacyGuard, createPrivacyGuard } from './PrivacyGuard';
import { CareerOSSettingsTab } from './SettingsTab';
import { DashboardItemView, DASHBOARD_VIEW_TYPE } from './views/DashboardView';

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

    // Register dashboard view
    this.registerDashboardView();

    // Register commands
    this.registerCommands();

    // Register file event listeners
    this.registerFileEvents();

    // Add settings tab
    this.addSettingTab(new CareerOSSettingsTab(this.app, this));

    // Add ribbon icon
    this.addRibbonIcon('briefcase', 'CareerOS Dashboard', () => {
      this.activateDashboardView();
    });
  }
  
  /**
   * Register the Dashboard view
   */
  private registerDashboardView(): void {
    this.registerView(
      DASHBOARD_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new DashboardItemView(leaf, {
        onLoadSelfProfile: () => this.loadSelfProfile(),
        onLoadMarketProfiles: () => this.loadMarketProfiles(),
        onLoadMarketProfileSummaries: () => this.loadMarketProfileSummaries(),
        onLoadGapAnalyses: () => this.loadGapAnalyses(),
        onLoadActionPlans: () => this.loadActionPlans(),
        onLoadErrorCount: () => this.loadErrorCount(),
        onLoadErrorLog: () => this.loadErrorLog(),
        onRefreshSelfProfile: () => this.refreshSelfProfile(),
        onIndexNotes: () => this.runColdStartIndexingAsync(),
        onExtractJDs: () => this.extractJDsFromCurrentNote(),
        onGeneratePlan: () => this.generateActionPlan(),
        onCheckActionPlans: () => this.checkActionPlansExist(),
        onBuildMarketProfile: (role, location) => this.buildMarketProfile(role, location),
        onSetActivePlan: (planPath) => this.setActivePlan(planPath),
        onLoadActivePlan: () => this.loadActivePlan(),
      })
    );
  }
  
  /**
   * Activate (open) the Dashboard view
   */
  async activateDashboardView(): Promise<void> {
    const { workspace } = this.app;
    
    // Check if view is already open
    let leaf = workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE)[0];
    
    if (!leaf) {
      // Create new leaf in right sidebar
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        leaf = rightLeaf;
        await leaf.setViewState({
          type: DASHBOARD_VIEW_TYPE,
          active: true,
        });
      }
    }
    
    // Reveal the leaf
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }
  
  /**
   * Load SelfProfile from IndexStore
   */
  private async loadSelfProfile(): Promise<SelfProfile | null> {
    if (!this.indexStore) {
      console.warn('IndexStore not initialized');
      return null;
    }
    
    try {
      return await this.indexStore.readSelfProfile();
    } catch (error) {
      console.error('Failed to load SelfProfile:', error);
      return null;
    }
  }
  
  /**
   * Load all MarketProfiles from IndexStore
   */
  private async loadMarketProfiles(): Promise<MarketProfile[]> {
    if (!this.indexStore) {
      console.warn('IndexStore not initialized');
      return [];
    }
    
    try {
      return await this.indexStore.listMarketProfiles();
    } catch (error) {
      console.error('Failed to load MarketProfiles:', error);
      return [];
    }
  }
  
  /**
   * Load market profile summaries for dashboard display
   * Requirements: 9.5, 20
   */
  private async loadMarketProfileSummaries(): Promise<MarketProfileSummary[]> {
    if (!this.indexStore) {
      console.warn('IndexStore not initialized');
      return [];
    }
    
    try {
      const profiles = await this.indexStore.listMarketProfiles();
      return profiles.map(profile => ({
        role: profile.role,
        location: profile.location,
        jdCount: profile.sample_jd_ids.length,
        lastBuilt: profile.last_built,
      }));
    } catch (error) {
      console.error('Failed to load MarketProfileSummaries:', error);
      return [];
    }
  }
  
  /**
   * Load gap analysis summaries for dashboard display
   * Requirements: 9.5, 20
   */
  private async loadGapAnalyses(): Promise<GapAnalysisSummary[]> {
    if (!this.indexStore) {
      console.warn('IndexStore not initialized');
      return [];
    }
    
    try {
      return await this.indexStore.listGapAnalyses();
    } catch (error) {
      console.error('Failed to load GapAnalyses:', error);
      return [];
    }
  }
  
  /**
   * Load action plan summaries for dashboard display
   * Requirements: 10.5, 20
   */
  private async loadActionPlans(): Promise<ActionPlanSummary[]> {
    if (!this.indexStore) {
      console.warn('IndexStore not initialized');
      return [];
    }
    
    try {
      return await this.indexStore.listActionPlans();
    } catch (error) {
      console.error('Failed to load ActionPlans:', error);
      return [];
    }
  }
  
  /**
   * Build a new market profile
   * Requirements: 9.5, 20
   */
  private async buildMarketProfile(role: string, location: string): Promise<void> {
    new Notice(`Building market profile for ${role} in ${location}...`);
    
    try {
      const { createMarketScanner } = await import('./MarketScanner');
      const { Taxonomy } = await import('./Taxonomy');
      
      if (!this.llmClient || !this.indexStore || !this.promptStore || !this.privacyGuard) {
        throw new Error('Required services not initialized');
      }
      
      const taxonomy = new Taxonomy(this.settings.taxonomy);
      
      const marketScanner = createMarketScanner(
        this.app,
        this.settings,
        this.llmClient,
        this.indexStore,
        this.promptStore,
        this.privacyGuard,
        taxonomy
      );
      
      const result = await marketScanner.buildMarketProfile(role, location);
      
      if (!result.success) {
        new Notice(`Failed to build market profile: ${result.error}`);
        throw new Error(result.error);
      }
      
      new Notice(`Market profile built successfully!`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      new Notice(`Failed to build market profile: ${errorMessage}`);
      throw error;
    }
  }
  
  /**
   * Set a plan as active
   * Requirements: 10.5, 20
   */
  private async setActivePlan(planPath: string): Promise<void> {
    if (!this.indexStore) {
      throw new Error('IndexStore not initialized');
    }
    
    try {
      await this.indexStore.setActivePlan(planPath);
      new Notice('Plan set as active');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      new Notice(`Failed to set active plan: ${errorMessage}`);
      throw error;
    }
  }
  
  /**
   * Load the currently active plan path
   * Requirements: 10.5, 20
   */
  private async loadActivePlan(): Promise<string | null> {
    if (!this.indexStore) {
      return null;
    }
    
    try {
      return await this.indexStore.getActivePlanPath();
    } catch (error) {
      console.error('Failed to load active plan:', error);
      return null;
    }
  }
  
  /**
   * Load error count from error log
   */
  private async loadErrorCount(): Promise<number> {
    try {
      const errorLogPath = `${this.pluginDataDir}/error_log.md`;
      const file = this.app.vault.getAbstractFileByPath(errorLogPath);
      
      if (!file || !(file instanceof TFile)) {
        return 0;
      }
      
      const content = await this.app.vault.read(file);
      // Count error entries (each starts with "## ")
      const matches = content.match(/^## \d{4}-\d{2}-\d{2}/gm);
      return matches ? matches.length : 0;
    } catch (error) {
      console.error('Failed to load error count:', error);
      return 0;
    }
  }
  
  /**
   * Load and parse error log for detailed display
   * 
   * Requirements: 11.3
   * - Read error_log.md and parse error entries
   * - Categorize errors by type (extraction, validation, file operation)
   */
  private async loadErrorLog(): Promise<ErrorLogSummary | null> {
    try {
      const errorLogPath = `${this.pluginDataDir}/error_log.md`;
      const file = this.app.vault.getAbstractFileByPath(errorLogPath);
      
      if (!file || !(file instanceof TFile)) {
        return {
          totalErrors: 0,
          byType: {
            extraction: 0,
            validation: 0,
            file_operation: 0,
            llm: 0,
            unknown: 0,
          },
          entries: [],
        };
      }
      
      const content = await this.app.vault.read(file);
      const entries = parseErrorLog(content);
      return generateErrorSummary(entries);
    } catch (error) {
      console.error('Failed to load error log:', error);
      return null;
    }
  }
  
  /**
   * Refresh (rebuild) SelfProfile
   * 
   * Requirements: 11.4 - Refresh button triggers SelfProfile rebuild
   */
  private async refreshSelfProfile(): Promise<SelfProfile> {
    if (!this.profileEngine) {
      throw new Error('ProfileEngine not initialized');
    }
    
    new Notice('Building Self Profile...');
    
    try {
      const profile = await this.profileEngine.buildSelfProfile();
      new Notice('Self Profile built successfully!');
      return profile;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      new Notice(`Failed to build Self Profile: ${errorMessage}`);
      throw error;
    }
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
    
    // Clean up debounce timers
    if (this.profileEngine) {
      this.profileEngine.clearDebounceTimers();
    }
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
        this.activateDashboardView();
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

  /**
   * Handle note saved event
   * 
   * Requirements: 2.1, 2.2
   * - Calculate content hash and compare with existing NoteCard
   * - Add note to queue when hash differs
   */
  async onNoteSaved(notePath: string) {
    if (!this.profileEngine) {
      console.warn('ProfileEngine not initialized, skipping note save handling');
      return;
    }
    
    console.log(`Note saved: ${notePath}`);
    
    try {
      const result = await this.profileEngine.handleNoteSaved(notePath);
      
      switch (result.action) {
        case 'queued':
          console.log(`Note queued for re-extraction: ${notePath} (${result.reason})`);
          break;
        case 'skipped':
          console.log(`Note skipped: ${notePath} (${result.reason})`);
          break;
        case 'error':
          console.error(`Error handling note save: ${notePath} - ${result.reason}`);
          break;
      }
    } catch (error) {
      console.error(`Failed to handle note save: ${notePath}`, error);
    }
  }

  /**
   * Handle note renamed/moved event
   * 
   * Requirements: 2.3
   * - Update NoteCard path and relocate card file
   */
  async onNoteRenamed(oldPath: string, newPath: string) {
    if (!this.profileEngine) {
      console.warn('ProfileEngine not initialized, skipping note rename handling');
      return;
    }
    
    console.log(`Note renamed: ${oldPath} -> ${newPath}`);
    
    try {
      const result = await this.profileEngine.handleNoteRenamed(oldPath, newPath);
      
      if (result.success) {
        console.log(`NoteCard path updated: ${oldPath} -> ${newPath}`);
      } else {
        console.error(`Failed to update NoteCard path: ${result.error}`);
      }
    } catch (error) {
      console.error(`Failed to handle note rename: ${oldPath} -> ${newPath}`, error);
    }
  }

  /**
   * Handle note deleted event
   * 
   * Requirements: 2.4
   * - Mark NoteCard as deleted without physically removing the card file
   */
  async onNoteDeleted(notePath: string) {
    if (!this.profileEngine) {
      console.warn('ProfileEngine not initialized, skipping note delete handling');
      return;
    }
    
    console.log(`Note deleted: ${notePath}`);
    
    try {
      const result = await this.profileEngine.handleNoteDeleted(notePath);
      
      if (result.success) {
        console.log(`NoteCard marked as deleted: ${notePath}`);
      } else {
        console.error(`Failed to mark NoteCard as deleted: ${result.error}`);
      }
    } catch (error) {
      console.error(`Failed to handle note deletion: ${notePath}`, error);
    }
  }
  
  /**
   * Run cold start indexing (async version for dashboard)
   * Returns a promise that resolves when indexing is complete
   * 
   * Requirements: 11.5 - Workflow action for Index Notes
   */
  private async runColdStartIndexingAsync(): Promise<void> {
    await this.runColdStartIndexing();
    // After indexing, build the self profile
    if (this.profileEngine) {
      await this.profileEngine.buildSelfProfile();
    }
  }
  
  /**
   * Extract JDs from current note
   * 
   * Requirements: 11.5 - Workflow action for Extract JDs
   */
  private async extractJDsFromCurrentNote(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    
    if (!activeFile) {
      new Notice('No active note. Please open a note containing job descriptions.');
      throw new Error('No active note');
    }
    
    if (activeFile.extension !== 'md') {
      new Notice('Active file is not a markdown note.');
      throw new Error('Not a markdown file');
    }
    
    new Notice('Extracting JD cards from current note...');
    
    try {
      // Import MarketScanner dynamically to avoid circular dependencies
      const { createMarketScanner } = await import('./MarketScanner');
      const { Taxonomy } = await import('./Taxonomy');
      
      if (!this.llmClient || !this.indexStore || !this.promptStore || !this.privacyGuard) {
        throw new Error('Required services not initialized');
      }
      
      // Create taxonomy instance
      const taxonomy = new Taxonomy(this.settings.taxonomy);
      
      const marketScanner = createMarketScanner(
        this.app,
        this.settings,
        this.llmClient,
        this.indexStore,
        this.promptStore,
        this.privacyGuard,
        taxonomy
      );
      
      const result = await marketScanner.extractJDCards(activeFile.path);
      
      if (!result.success) {
        new Notice(`Failed to extract JDs: ${result.error}`);
        throw new Error(result.error);
      }
      
      if (result.cards.length === 0) {
        new Notice('No job descriptions found in the current note.');
      } else {
        new Notice(`Extracted ${result.cards.length} JD card(s) successfully! (${result.newCards} new, ${result.updatedCards} updated)`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      new Notice(`Failed to extract JDs: ${errorMessage}`);
      throw error;
    }
  }
  
  /**
   * Generate action plan
   * 
   * Requirements: 11.5 - Workflow action for Generate Plan
   */
  private async generateActionPlan(): Promise<void> {
    new Notice('Generating action plan...');
    
    try {
      // Import StrategyCore dynamically
      const { createStrategyCore } = await import('./StrategyCore');
      
      if (!this.llmClient || !this.indexStore || !this.promptStore) {
        throw new Error('Required services not initialized');
      }
      
      const strategyCore = createStrategyCore(
        this.app,
        this.settings,
        this.llmClient,
        this.indexStore,
        this.promptStore,
        this.pluginDataDir
      );
      
      // Load self profile
      const selfProfile = await this.indexStore.readSelfProfile();
      if (!selfProfile) {
        new Notice('No self profile found. Please index your notes first.');
        throw new Error('No self profile');
      }
      
      // Load market profiles
      const marketProfiles = await this.indexStore.listMarketProfiles();
      if (marketProfiles.length === 0) {
        new Notice('No market profile found. Please extract JDs first.');
        throw new Error('No market profile');
      }
      
      // Use the first market profile for now
      // TODO: Let user select which market profile to use
      const marketProfile = await this.indexStore.readMarketProfile(
        marketProfiles[0].role,
        marketProfiles[0].location
      );
      
      if (!marketProfile) {
        throw new Error('Failed to load market profile');
      }
      
      // Generate gap analysis first
      const gapResult = await strategyCore.analyzeGap(selfProfile, marketProfile);
      
      if (!gapResult.success || !gapResult.gapAnalysis) {
        new Notice(`Gap analysis failed: ${gapResult.error}`);
        throw new Error(gapResult.error || 'Gap analysis failed');
      }
      
      // Generate action plan with default constraints
      // TODO: Let user configure these constraints
      const planResult = await strategyCore.generatePlan({
        targetRole: marketProfile.role,
        location: marketProfile.location,
        periodMonths: 3,
        weeklyHours: 10,
      });
      
      if (!planResult.success) {
        new Notice(`Plan generation failed: ${planResult.error}`);
        throw new Error(planResult.error || 'Plan generation failed');
      }
      
      new Notice(`Action plan generated! Match: ${gapResult.gapAnalysis.matchPercentage}%`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      new Notice(`Failed to generate plan: ${errorMessage}`);
      throw error;
    }
  }
  
  /**
   * Check if any action plans exist
   * 
   * Requirements: 11.5 - Check workflow completion status
   */
  private async checkActionPlansExist(): Promise<boolean> {
    try {
      const mappingDir = `${this.pluginDataDir}/${this.settings.mappingDirectory}`;
      const folder = this.app.vault.getAbstractFileByPath(mappingDir);
      
      if (!folder) {
        return false;
      }
      
      // Check for plan files (files starting with "plan_")
      const files = this.app.vault.getFiles().filter(f => 
        f.path.startsWith(mappingDir) && f.name.startsWith('plan_')
      );
      
      return files.length > 0;
    } catch (error) {
      console.error('Failed to check action plans:', error);
      return false;
    }
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
