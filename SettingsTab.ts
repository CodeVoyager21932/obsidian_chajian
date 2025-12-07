/**
 * SettingsTab - Configuration UI for CareerOS
 * 
 * Validates: Requirements 3.5, 12.1, 12.5, 13.3
 * - LLM provider settings with separate model configuration for extract/analyze/embedding roles
 * - API key inputs with secure storage
 * - Proxy and custom base URL configuration
 * - Retry count, timeout, and concurrency settings
 * - Directory and tag exclusion configuration
 * - Taxonomy management UI
 * - Dry-run mode toggle
 * - Clear warnings for external LLM usage
 */

import { App, PluginSettingTab, Setting, Notice, TextComponent, DropdownComponent } from 'obsidian';
import type CareerOSPlugin from './main';
import { CareerOSSettings, LLMProvider, ModelRole, SkillMapping, SkillCategory, LLMConfig } from './types';

// LLM Provider options
const LLM_PROVIDERS: { value: LLMProvider; label: string; isExternal: boolean }[] = [
  { value: 'local', label: 'Local (Ollama/LM Studio)', isExternal: false },
  { value: 'openai', label: 'OpenAI', isExternal: true },
  { value: 'anthropic', label: 'Anthropic', isExternal: true },
  { value: 'google', label: 'Google AI', isExternal: true },
];

// Model role labels
const MODEL_ROLE_LABELS: Record<ModelRole, string> = {
  extract: 'Extract (NoteCard/JDCard extraction)',
  analyze: 'Analyze (Gap analysis/Plan generation)',
  embedding: 'Embedding (Future use)',
};

// Skill category options
const SKILL_CATEGORIES: { value: SkillCategory; label: string }[] = [
  { value: 'language', label: 'Programming Language' },
  { value: 'framework', label: 'Framework' },
  { value: 'database', label: 'Database' },
  { value: 'tool', label: 'Tool' },
  { value: 'platform', label: 'Platform' },
  { value: 'soft', label: 'Soft Skill' },
];

export class CareerOSSettingsTab extends PluginSettingTab {
  plugin: CareerOSPlugin;
  
  // UI state for taxonomy management
  private newSkillName: string = '';
  private newSkillAliases: string = '';
  private newSkillCategory: SkillCategory = 'tool';
  private taxonomyContainer: HTMLElement | null = null;

  constructor(app: App, plugin: CareerOSPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h1', { text: 'CareerOS Settings' });

    // External LLM Warning Banner
    this.renderExternalLLMWarning(containerEl);

    // LLM Configuration Section
    this.renderLLMConfigSection(containerEl);

    // API Keys Section
    this.renderAPIKeysSection(containerEl);

    // Network Configuration Section
    this.renderNetworkSection(containerEl);

    // Processing Configuration Section
    this.renderProcessingSection(containerEl);

    // Privacy & Exclusion Section
    this.renderPrivacySection(containerEl);

    // Taxonomy Management Section
    this.renderTaxonomySection(containerEl);

    // Dry-Run Mode Section
    this.renderDryRunSection(containerEl);

    // Directory Configuration Section
    this.renderDirectorySection(containerEl);
  }


  /**
   * Render external LLM warning banner
   * 
   * Validates: Requirements 3.5
   */
  private renderExternalLLMWarning(containerEl: HTMLElement): void {
    const hasExternalProvider = this.hasExternalLLMConfigured();
    
    if (hasExternalProvider) {
      const warningEl = containerEl.createDiv({ cls: 'career-os-warning' });
      warningEl.createEl('h3', { text: '⚠️ External LLM Warning' });
      warningEl.createEl('p', { 
        text: 'You have configured external LLM providers. Your note content will be sent to external APIs. ' +
              'PII filtering will be applied, but please review your privacy settings carefully.'
      });
      warningEl.style.backgroundColor = '#fff3cd';
      warningEl.style.border = '1px solid #ffc107';
      warningEl.style.borderRadius = '4px';
      warningEl.style.padding = '12px';
      warningEl.style.marginBottom = '20px';
    }
  }

  /**
   * Check if any external LLM provider is configured
   */
  private hasExternalLLMConfigured(): boolean {
    const { llmConfigs } = this.plugin.settings;
    return (
      llmConfigs.extract.provider !== 'local' ||
      llmConfigs.analyze.provider !== 'local' ||
      llmConfigs.embedding.provider !== 'local'
    );
  }

  /**
   * Render LLM configuration section
   * 
   * Validates: Requirements 12.1
   */
  private renderLLMConfigSection(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'LLM Configuration' });
    containerEl.createEl('p', { 
      text: 'Configure different LLM models for different tasks. Local models are recommended for privacy.',
      cls: 'setting-item-description'
    });

    // Render config for each role
    const roles: ModelRole[] = ['extract', 'analyze', 'embedding'];
    
    for (const role of roles) {
      this.renderModelRoleConfig(containerEl, role);
    }
  }

  /**
   * Render configuration for a specific model role
   */
  private renderModelRoleConfig(containerEl: HTMLElement, role: ModelRole): void {
    const config = this.plugin.settings.llmConfigs[role];
    const roleLabel = MODEL_ROLE_LABELS[role];
    
    // Role header
    const roleHeader = containerEl.createDiv({ cls: 'career-os-role-header' });
    roleHeader.createEl('h3', { text: roleLabel });
    roleHeader.style.marginTop = '16px';
    roleHeader.style.marginBottom = '8px';
    roleHeader.style.borderBottom = '1px solid var(--background-modifier-border)';
    roleHeader.style.paddingBottom = '4px';

    // Provider selection
    new Setting(containerEl)
      .setName('Provider')
      .setDesc(this.getProviderDescription(config.provider))
      .addDropdown(dropdown => {
        for (const provider of LLM_PROVIDERS) {
          dropdown.addOption(provider.value, provider.label);
        }
        dropdown.setValue(config.provider);
        dropdown.onChange(async (value: string) => {
          const newProvider = value as LLMProvider;
          this.plugin.settings.llmConfigs[role].provider = newProvider;
          
          // Set default base URL for local provider
          if (newProvider === 'local' && !config.baseUrl) {
            this.plugin.settings.llmConfigs[role].baseUrl = 'http://localhost:11434';
          }
          
          await this.plugin.saveSettings();
          this.display(); // Refresh to update warning and descriptions
        });
      });

    // Model name
    new Setting(containerEl)
      .setName('Model')
      .setDesc('Model name (e.g., llama2, gpt-4, claude-3-opus)')
      .addText(text => {
        text.setPlaceholder('llama2')
          .setValue(config.model)
          .onChange(async (value) => {
            this.plugin.settings.llmConfigs[role].model = value;
            await this.plugin.saveSettings();
          });
      });

    // Base URL (for local provider)
    if (config.provider === 'local') {
      new Setting(containerEl)
        .setName('Base URL')
        .setDesc('Local LLM server URL (e.g., http://localhost:11434 for Ollama)')
        .addText(text => {
          text.setPlaceholder('http://localhost:11434')
            .setValue(config.baseUrl || '')
            .onChange(async (value) => {
              this.plugin.settings.llmConfigs[role].baseUrl = value;
              await this.plugin.saveSettings();
            });
        });
    }

    // JSON mode toggle
    new Setting(containerEl)
      .setName('JSON Mode')
      .setDesc('Enable JSON mode for structured output (recommended for extract role)')
      .addToggle(toggle => {
        toggle.setValue(config.jsonMode || false)
          .onChange(async (value) => {
            this.plugin.settings.llmConfigs[role].jsonMode = value;
            await this.plugin.saveSettings();
          });
      });
  }

  /**
   * Get description for a provider
   */
  private getProviderDescription(provider: LLMProvider): string {
    const providerInfo = LLM_PROVIDERS.find(p => p.value === provider);
    if (providerInfo?.isExternal) {
      return '⚠️ External API - Content will be sent to external servers';
    }
    return '✅ Local - Content stays on your machine';
  }


  /**
   * Render API keys section
   */
  private renderAPIKeysSection(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'API Keys' });
    containerEl.createEl('p', { 
      text: 'API keys are stored securely in Obsidian\'s plugin data. Only enter keys for providers you plan to use.',
      cls: 'setting-item-description'
    });

    // OpenAI API Key
    new Setting(containerEl)
      .setName('OpenAI API Key')
      .setDesc('Required for OpenAI models (GPT-4, GPT-3.5, etc.)')
      .addText(text => {
        text.setPlaceholder('sk-...')
          .setValue(this.plugin.settings.openaiApiKey)
          .inputEl.type = 'password';
        text.onChange(async (value) => {
          this.plugin.settings.openaiApiKey = value;
          await this.plugin.saveSettings();
        });
      });

    // Anthropic API Key
    new Setting(containerEl)
      .setName('Anthropic API Key')
      .setDesc('Required for Anthropic models (Claude-3, etc.)')
      .addText(text => {
        text.setPlaceholder('sk-ant-...')
          .setValue(this.plugin.settings.anthropicApiKey)
          .inputEl.type = 'password';
        text.onChange(async (value) => {
          this.plugin.settings.anthropicApiKey = value;
          await this.plugin.saveSettings();
        });
      });

    // Google API Key
    new Setting(containerEl)
      .setName('Google AI API Key')
      .setDesc('Required for Google AI models (Gemini, etc.)')
      .addText(text => {
        text.setPlaceholder('AIza...')
          .setValue(this.plugin.settings.googleApiKey)
          .inputEl.type = 'password';
        text.onChange(async (value) => {
          this.plugin.settings.googleApiKey = value;
          await this.plugin.saveSettings();
        });
      });
  }

  /**
   * Render network configuration section
   * 
   * Validates: Requirements 12.4
   */
  private renderNetworkSection(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'Network Configuration' });

    // Proxy URL
    new Setting(containerEl)
      .setName('Proxy URL')
      .setDesc('Optional HTTP proxy for API requests (e.g., http://proxy:8080)')
      .addText(text => {
        text.setPlaceholder('http://proxy:8080')
          .setValue(this.plugin.settings.proxyUrl || '')
          .onChange(async (value) => {
            this.plugin.settings.proxyUrl = value || undefined;
            await this.plugin.saveSettings();
          });
      });

    // Custom Base URL
    new Setting(containerEl)
      .setName('Custom Base URL')
      .setDesc('Override the default API base URL for all external providers')
      .addText(text => {
        text.setPlaceholder('https://api.example.com')
          .setValue(this.plugin.settings.customBaseUrl || '')
          .onChange(async (value) => {
            this.plugin.settings.customBaseUrl = value || undefined;
            await this.plugin.saveSettings();
          });
      });
  }

  /**
   * Render processing configuration section
   * 
   * Validates: Requirements 12.5
   */
  private renderProcessingSection(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'Processing Configuration' });

    // Max Retries
    new Setting(containerEl)
      .setName('Max Retries')
      .setDesc('Maximum number of retry attempts for failed LLM requests (1-10)')
      .addSlider(slider => {
        slider.setLimits(1, 10, 1)
          .setValue(this.plugin.settings.maxRetries)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.maxRetries = value;
            await this.plugin.saveSettings();
          });
      })
      .addExtraButton(button => {
        button.setIcon('reset')
          .setTooltip('Reset to default (3)')
          .onClick(async () => {
            this.plugin.settings.maxRetries = 3;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    // Timeout
    new Setting(containerEl)
      .setName('Request Timeout (seconds)')
      .setDesc('Timeout for each LLM request (10-120 seconds)')
      .addSlider(slider => {
        slider.setLimits(10, 120, 5)
          .setValue(this.plugin.settings.timeout / 1000)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.timeout = value * 1000;
            await this.plugin.saveSettings();
          });
      })
      .addExtraButton(button => {
        button.setIcon('reset')
          .setTooltip('Reset to default (30s)')
          .onClick(async () => {
            this.plugin.settings.timeout = 30000;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    // Concurrency
    new Setting(containerEl)
      .setName('Concurrency')
      .setDesc('Maximum number of concurrent LLM requests (1-5)')
      .addSlider(slider => {
        slider.setLimits(1, 5, 1)
          .setValue(this.plugin.settings.concurrency)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.concurrency = value;
            await this.plugin.saveSettings();
          });
      })
      .addExtraButton(button => {
        button.setIcon('reset')
          .setTooltip('Reset to default (3)')
          .onClick(async () => {
            this.plugin.settings.concurrency = 3;
            await this.plugin.saveSettings();
            this.display();
          });
      });
  }


  /**
   * Render privacy and exclusion section
   * 
   * Validates: Requirements 3.3
   */
  private renderPrivacySection(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'Privacy & Exclusions' });
    containerEl.createEl('p', { 
      text: 'Configure which notes should be excluded from LLM processing.',
      cls: 'setting-item-description'
    });

    // Excluded Directories
    new Setting(containerEl)
      .setName('Excluded Directories')
      .setDesc('Comma-separated list of directory paths to exclude (e.g., private, journal/personal)')
      .addTextArea(text => {
        text.setPlaceholder('private, journal/personal')
          .setValue(this.plugin.settings.exclusionRules.directories.join(', '))
          .onChange(async (value) => {
            this.plugin.settings.exclusionRules.directories = value
              .split(',')
              .map(d => d.trim())
              .filter(d => d.length > 0);
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 3;
        text.inputEl.style.width = '100%';
      });

    // Excluded Tags
    new Setting(containerEl)
      .setName('Excluded Tags')
      .setDesc('Comma-separated list of tags to exclude (without #, e.g., private, personal)')
      .addTextArea(text => {
        text.setPlaceholder('private, personal, secret')
          .setValue(this.plugin.settings.exclusionRules.tags.join(', '))
          .onChange(async (value) => {
            this.plugin.settings.exclusionRules.tags = value
              .split(',')
              .map(t => t.trim())
              .filter(t => t.length > 0);
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 2;
        text.inputEl.style.width = '100%';
      });
  }

  /**
   * Render taxonomy management section
   * 
   * Validates: Requirements 13.3
   */
  private renderTaxonomySection(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'Skill Taxonomy' });
    containerEl.createEl('p', { 
      text: 'Manage skill name mappings for normalization. Aliases will be mapped to standard names.',
      cls: 'setting-item-description'
    });

    // Add new skill mapping form
    const addFormEl = containerEl.createDiv({ cls: 'career-os-taxonomy-form' });
    addFormEl.style.backgroundColor = 'var(--background-secondary)';
    addFormEl.style.padding = '12px';
    addFormEl.style.borderRadius = '4px';
    addFormEl.style.marginBottom = '16px';

    addFormEl.createEl('h4', { text: 'Add New Skill Mapping' });

    // Standard name input
    new Setting(addFormEl)
      .setName('Standard Name')
      .setDesc('The canonical name for this skill')
      .addText(text => {
        text.setPlaceholder('e.g., JavaScript')
          .setValue(this.newSkillName)
          .onChange((value) => {
            this.newSkillName = value;
          });
      });

    // Aliases input
    new Setting(addFormEl)
      .setName('Aliases')
      .setDesc('Comma-separated list of alternative names')
      .addText(text => {
        text.setPlaceholder('e.g., js, JS, javascript')
          .setValue(this.newSkillAliases)
          .onChange((value) => {
            this.newSkillAliases = value;
          });
      });

    // Category selection
    new Setting(addFormEl)
      .setName('Category')
      .setDesc('Skill category for grouping')
      .addDropdown(dropdown => {
        for (const cat of SKILL_CATEGORIES) {
          dropdown.addOption(cat.value, cat.label);
        }
        dropdown.setValue(this.newSkillCategory);
        dropdown.onChange((value) => {
          this.newSkillCategory = value as SkillCategory;
        });
      });

    // Add button
    new Setting(addFormEl)
      .addButton(button => {
        button.setButtonText('Add Skill Mapping')
          .setCta()
          .onClick(async () => {
            await this.addSkillMapping();
          });
      });

    // Existing mappings list
    this.taxonomyContainer = containerEl.createDiv({ cls: 'career-os-taxonomy-list' });
    this.renderTaxonomyList();
  }

  /**
   * Render the list of existing taxonomy mappings
   */
  private renderTaxonomyList(): void {
    if (!this.taxonomyContainer) return;
    
    this.taxonomyContainer.empty();
    
    const mappings = this.plugin.settings.taxonomy;
    
    if (mappings.length === 0) {
      this.taxonomyContainer.createEl('p', { 
        text: 'No custom skill mappings defined. Default mappings are built-in.',
        cls: 'setting-item-description'
      });
      return;
    }

    this.taxonomyContainer.createEl('h4', { text: `Custom Mappings (${mappings.length})` });

    // Create a table-like display
    const listEl = this.taxonomyContainer.createDiv({ cls: 'career-os-taxonomy-items' });
    
    for (let i = 0; i < mappings.length; i++) {
      const mapping = mappings[i];
      this.renderTaxonomyItem(listEl, mapping, i);
    }
  }

  /**
   * Render a single taxonomy item
   */
  private renderTaxonomyItem(containerEl: HTMLElement, mapping: SkillMapping, index: number): void {
    const itemEl = containerEl.createDiv({ cls: 'career-os-taxonomy-item' });
    itemEl.style.display = 'flex';
    itemEl.style.alignItems = 'center';
    itemEl.style.justifyContent = 'space-between';
    itemEl.style.padding = '8px';
    itemEl.style.borderBottom = '1px solid var(--background-modifier-border)';

    // Info section
    const infoEl = itemEl.createDiv();
    infoEl.createEl('strong', { text: mapping.standardName });
    
    if (mapping.category) {
      const categoryLabel = SKILL_CATEGORIES.find(c => c.value === mapping.category)?.label || mapping.category;
      infoEl.createEl('span', { 
        text: ` [${categoryLabel}]`,
        cls: 'setting-item-description'
      });
    }
    
    if (mapping.aliases.length > 0) {
      infoEl.createEl('div', { 
        text: `Aliases: ${mapping.aliases.join(', ')}`,
        cls: 'setting-item-description'
      });
    }

    // Delete button
    const deleteBtn = itemEl.createEl('button', { text: 'Delete' });
    deleteBtn.style.marginLeft = '8px';
    deleteBtn.addEventListener('click', async () => {
      await this.deleteSkillMapping(index);
    });
  }

  /**
   * Add a new skill mapping
   */
  private async addSkillMapping(): Promise<void> {
    if (!this.newSkillName.trim()) {
      new Notice('Please enter a standard skill name');
      return;
    }

    const aliases = this.newSkillAliases
      .split(',')
      .map(a => a.trim())
      .filter(a => a.length > 0);

    const newMapping: SkillMapping = {
      standardName: this.newSkillName.trim(),
      aliases: aliases,
      category: this.newSkillCategory,
    };

    // Check for duplicates
    const existingIndex = this.plugin.settings.taxonomy.findIndex(
      m => m.standardName.toLowerCase() === newMapping.standardName.toLowerCase()
    );

    if (existingIndex >= 0) {
      // Update existing mapping
      this.plugin.settings.taxonomy[existingIndex] = newMapping;
      new Notice(`Updated skill mapping: ${newMapping.standardName}`);
    } else {
      // Add new mapping
      this.plugin.settings.taxonomy.push(newMapping);
      new Notice(`Added skill mapping: ${newMapping.standardName}`);
    }

    await this.plugin.saveSettings();

    // Clear form
    this.newSkillName = '';
    this.newSkillAliases = '';
    this.newSkillCategory = 'tool';

    // Refresh display
    this.display();
  }

  /**
   * Delete a skill mapping
   */
  private async deleteSkillMapping(index: number): Promise<void> {
    const mapping = this.plugin.settings.taxonomy[index];
    this.plugin.settings.taxonomy.splice(index, 1);
    await this.plugin.saveSettings();
    
    new Notice(`Deleted skill mapping: ${mapping.standardName}`);
    this.renderTaxonomyList();
  }


  /**
   * Render dry-run mode section
   * 
   * Validates: Requirements 15.1, 15.2
   */
  private renderDryRunSection(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'Dry-Run Mode' });
    containerEl.createEl('p', { 
      text: 'Test extraction quality before full indexing. Results are displayed in console without writing files.',
      cls: 'setting-item-description'
    });

    // Dry-run toggle
    new Setting(containerEl)
      .setName('Enable Dry-Run Mode')
      .setDesc('When enabled, indexing will only process a limited number of notes and display results without saving')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.dryRunEnabled)
          .onChange(async (value) => {
            this.plugin.settings.dryRunEnabled = value;
            await this.plugin.saveSettings();
            this.display(); // Refresh to show/hide max notes setting
          });
      });

    // Max notes for dry-run
    if (this.plugin.settings.dryRunEnabled) {
      new Setting(containerEl)
        .setName('Dry-Run Max Notes')
        .setDesc('Maximum number of notes to process in dry-run mode (1-50)')
        .addSlider(slider => {
          slider.setLimits(1, 50, 1)
            .setValue(this.plugin.settings.dryRunMaxNotes)
            .setDynamicTooltip()
            .onChange(async (value) => {
              this.plugin.settings.dryRunMaxNotes = value;
              await this.plugin.saveSettings();
            });
        })
        .addExtraButton(button => {
          button.setIcon('reset')
            .setTooltip('Reset to default (10)')
            .onClick(async () => {
              this.plugin.settings.dryRunMaxNotes = 10;
              await this.plugin.saveSettings();
              this.display();
            });
        });

      // Dry-run info box
      const infoEl = containerEl.createDiv({ cls: 'career-os-info' });
      infoEl.createEl('p', { 
        text: '💡 Tip: Run "CareerOS: Cold Start Indexing" command to test extraction. ' +
              'Results will appear in the developer console (Ctrl+Shift+I).'
      });
      infoEl.style.backgroundColor = 'var(--background-secondary)';
      infoEl.style.padding = '12px';
      infoEl.style.borderRadius = '4px';
      infoEl.style.marginTop = '8px';
    }
  }

  /**
   * Render directory configuration section
   */
  private renderDirectorySection(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'Data Directories' });
    containerEl.createEl('p', { 
      text: 'Configure where CareerOS stores its data files. Paths are relative to the vault root.',
      cls: 'setting-item-description'
    });

    // Index directory
    new Setting(containerEl)
      .setName('Index Directory')
      .setDesc('Directory for NoteCard index files')
      .addText(text => {
        text.setPlaceholder('.career-os/index')
          .setValue(this.plugin.settings.indexDirectory)
          .onChange(async (value) => {
            this.plugin.settings.indexDirectory = value || '.career-os/index';
            await this.plugin.saveSettings();
          });
      });

    // Mapping directory
    new Setting(containerEl)
      .setName('Mapping Directory')
      .setDesc('Directory for profiles, gap analyses, and action plans')
      .addText(text => {
        text.setPlaceholder('.career-os/mapping')
          .setValue(this.plugin.settings.mappingDirectory)
          .onChange(async (value) => {
            this.plugin.settings.mappingDirectory = value || '.career-os/mapping';
            await this.plugin.saveSettings();
          });
      });

    // Market cards directory
    new Setting(containerEl)
      .setName('Market Cards Directory')
      .setDesc('Directory for JDCard files')
      .addText(text => {
        text.setPlaceholder('.career-os/market_cards')
          .setValue(this.plugin.settings.marketCardsDirectory)
          .onChange(async (value) => {
            this.plugin.settings.marketCardsDirectory = value || '.career-os/market_cards';
            await this.plugin.saveSettings();
          });
      });

    // Reset all settings button
    containerEl.createEl('h2', { text: 'Reset Settings' });
    
    new Setting(containerEl)
      .setName('Reset All Settings')
      .setDesc('Reset all settings to their default values. This cannot be undone.')
      .addButton(button => {
        button.setButtonText('Reset to Defaults')
          .setWarning()
          .onClick(async () => {
            if (confirm('Are you sure you want to reset all settings to defaults?')) {
              await this.resetToDefaults();
            }
          });
      });
  }

  /**
   * Reset all settings to defaults
   */
  private async resetToDefaults(): Promise<void> {
    // Get default settings from plugin
    const defaultSettings: CareerOSSettings = {
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

    // Preserve API keys if user wants
    const preserveKeys = confirm('Do you want to preserve your API keys?');
    if (preserveKeys) {
      defaultSettings.openaiApiKey = this.plugin.settings.openaiApiKey;
      defaultSettings.anthropicApiKey = this.plugin.settings.anthropicApiKey;
      defaultSettings.googleApiKey = this.plugin.settings.googleApiKey;
    }

    this.plugin.settings = defaultSettings;
    await this.plugin.saveSettings();
    
    new Notice('Settings reset to defaults');
    this.display();
  }
}
