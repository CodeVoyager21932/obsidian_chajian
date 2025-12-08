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
  { value: 'local', label: '本地 LLM (Ollama/LM Studio)', isExternal: false },
  { value: 'openai', label: 'OpenAI', isExternal: true },
  { value: 'anthropic', label: 'Anthropic (Claude)', isExternal: true },
  { value: 'google', label: 'Google AI (Gemini)', isExternal: true },
];

// Model role labels
const MODEL_ROLE_LABELS: Record<ModelRole, string> = {
  extract: '提取角色 (NoteCard/JDCard 提取)',
  analyze: '分析角色 (差距分析/计划生成)',
  embedding: '嵌入角色 (预留功能)',
};

// Skill category options
const SKILL_CATEGORIES: { value: SkillCategory; label: string }[] = [
  { value: 'language', label: '编程语言' },
  { value: 'framework', label: '框架' },
  { value: 'database', label: '数据库' },
  { value: 'tool', label: '工具' },
  { value: 'platform', label: '平台' },
  { value: 'soft', label: '软技能' },
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

    containerEl.createEl('h1', { text: 'CareerOS 设置' });

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
      warningEl.createEl('h3', { text: '⚠️ 外部 LLM 警告' });
      warningEl.createEl('p', { 
        text: '您已配置外部 LLM 提供商。您的笔记内容将被发送到外部 API。' +
              '系统会自动过滤个人隐私信息（PII），但请仔细检查您的隐私设置。'
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
    containerEl.createEl('h2', { text: 'LLM 配置' });
    containerEl.createEl('p', { 
      text: '为不同任务配置不同的 LLM 模型。推荐使用本地模型以保护隐私。',
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
      .setName('提供商')
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
      .setName('模型名称')
      .setDesc('模型名称（如 gemini-1.5-flash, gpt-4, claude-3-opus）')
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
        .setName('服务地址')
        .setDesc('本地 LLM 服务器地址（如 Ollama 默认为 http://localhost:11434）')
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
      .setName('JSON 模式')
      .setDesc('启用 JSON 模式以获得结构化输出（推荐用于提取角色）')
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
      return '⚠️ 外部 API - 内容将发送到外部服务器';
    }
    return '✅ 本地 - 内容保留在您的电脑上';
  }


  /**
   * Render API keys section
   */
  private renderAPIKeysSection(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'API 密钥' });
    containerEl.createEl('p', { 
      text: 'API 密钥安全存储在 Obsidian 的插件数据中。只需填写您计划使用的提供商的密钥。',
      cls: 'setting-item-description'
    });

    // OpenAI API Key
    new Setting(containerEl)
      .setName('OpenAI API 密钥')
      .setDesc('用于 OpenAI 模型（GPT-4、GPT-3.5 等）')
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
      .setName('Anthropic API 密钥')
      .setDesc('用于 Anthropic 模型（Claude-3 等）')
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
      .setName('Google AI API 密钥')
      .setDesc('用于 Google AI 模型（Gemini 等）')
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
    containerEl.createEl('h2', { text: '第三方代理配置' });
    containerEl.createEl('p', { 
      text: '使用第三方代理服务（如 one-api、new-api）时，在此配置。填写后将覆盖上方的 LLM 配置。',
      cls: 'setting-item-description'
    });

    // Custom Base URL
    new Setting(containerEl)
      .setName('自定义 API 地址')
      .setDesc('第三方代理服务的 API 地址（如 https://your-proxy.com/v1/chat/completions）')
      .addText(text => {
        text.setPlaceholder('https://your-proxy.com/v1/chat/completions')
          .setValue(this.plugin.settings.customBaseUrl || '')
          .onChange(async (value) => {
            this.plugin.settings.customBaseUrl = value || undefined;
            await this.plugin.saveSettings();
            this.display(); // Refresh to show/hide related fields
          });
      });

    // Custom API Key
    new Setting(containerEl)
      .setName('自定义 API 密钥')
      .setDesc('第三方代理服务的 API 密钥')
      .addText(text => {
        text.setPlaceholder('sk-xxx...')
          .setValue(this.plugin.settings.customApiKey || '')
          .inputEl.type = 'password';
        text.onChange(async (value) => {
          this.plugin.settings.customApiKey = value || undefined;
          await this.plugin.saveSettings();
        });
      });

    // Custom Model Name
    new Setting(containerEl)
      .setName('自定义模型名称')
      .setDesc('代理服务支持的模型名称（如 gemini-1.5-flash、gpt-4o、claude-3-sonnet）')
      .addText(text => {
        text.setPlaceholder('gemini-1.5-flash')
          .setValue(this.plugin.settings.customModel || '')
          .onChange(async (value) => {
            this.plugin.settings.customModel = value || undefined;
            await this.plugin.saveSettings();
          });
      });

    // Show status hint
    if (this.plugin.settings.customBaseUrl) {
      const statusEl = containerEl.createDiv({ cls: 'career-os-info' });
      const statusText = this.plugin.settings.customApiKey && this.plugin.settings.customModel
        ? '✅ 第三方代理已配置完成，将使用此配置进行 LLM 调用。'
        : '⚠️ 请填写完整的 API 密钥和模型名称。';
      statusEl.createEl('p', { text: statusText });
      statusEl.style.backgroundColor = 'var(--background-secondary)';
      statusEl.style.padding = '12px';
      statusEl.style.borderRadius = '4px';
      statusEl.style.marginTop = '8px';
    }

    // HTTP Proxy (separate section)
    containerEl.createEl('h3', { text: 'HTTP 代理', cls: 'setting-item-heading' });
    
    // Proxy URL
    new Setting(containerEl)
      .setName('代理地址')
      .setDesc('可选的 HTTP 代理地址（用于网络受限环境，如 http://proxy:8080）')
      .addText(text => {
        text.setPlaceholder('http://proxy:8080')
          .setValue(this.plugin.settings.proxyUrl || '')
          .onChange(async (value) => {
            this.plugin.settings.proxyUrl = value || undefined;
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
    containerEl.createEl('h2', { text: '处理配置' });

    // Max Retries
    new Setting(containerEl)
      .setName('最大重试次数')
      .setDesc('LLM 请求失败时的最大重试次数（1-10）')
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
          .setTooltip('重置为默认值 (3)')
          .onClick(async () => {
            this.plugin.settings.maxRetries = 3;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    // Timeout
    new Setting(containerEl)
      .setName('请求超时时间（秒）')
      .setDesc('每个 LLM 请求的超时时间（10-120 秒）')
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
          .setTooltip('重置为默认值 (30秒)')
          .onClick(async () => {
            this.plugin.settings.timeout = 30000;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    // Concurrency
    new Setting(containerEl)
      .setName('并发数')
      .setDesc('同时处理的 LLM 请求数量（1-5）')
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
          .setTooltip('重置为默认值 (3)')
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
    containerEl.createEl('h2', { text: '隐私与排除' });
    containerEl.createEl('p', { 
      text: '配置哪些笔记应该被排除在 LLM 处理之外。',
      cls: 'setting-item-description'
    });

    // Excluded Directories
    new Setting(containerEl)
      .setName('排除目录')
      .setDesc('用逗号分隔的目录路径列表（如 private, journal/personal）')
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
      .setName('排除标签')
      .setDesc('用逗号分隔的标签列表（不带 #，如 private, personal）')
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
    containerEl.createEl('h2', { text: '技能分类' });
    containerEl.createEl('p', { 
      text: '管理技能名称映射，用于标准化。别名将被映射到标准名称。',
      cls: 'setting-item-description'
    });

    // Add new skill mapping form
    const addFormEl = containerEl.createDiv({ cls: 'career-os-taxonomy-form' });
    addFormEl.style.backgroundColor = 'var(--background-secondary)';
    addFormEl.style.padding = '12px';
    addFormEl.style.borderRadius = '4px';
    addFormEl.style.marginBottom = '16px';

    addFormEl.createEl('h4', { text: '添加新的技能映射' });

    // Standard name input
    new Setting(addFormEl)
      .setName('标准名称')
      .setDesc('该技能的规范名称')
      .addText(text => {
        text.setPlaceholder('e.g., JavaScript')
          .setValue(this.newSkillName)
          .onChange((value) => {
            this.newSkillName = value;
          });
      });

    // Aliases input
    new Setting(addFormEl)
      .setName('别名')
      .setDesc('用逗号分隔的替代名称列表')
      .addText(text => {
        text.setPlaceholder('如 js, JS, javascript')
          .setValue(this.newSkillAliases)
          .onChange((value) => {
            this.newSkillAliases = value;
          });
      });

    // Category selection
    new Setting(addFormEl)
      .setName('分类')
      .setDesc('技能分类，用于分组显示')
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
        button.setButtonText('添加技能映射')
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
        text: '暂无自定义技能映射。系统已内置默认映射。',
        cls: 'setting-item-description'
      });
      return;
    }

    this.taxonomyContainer.createEl('h4', { text: `自定义映射 (${mappings.length})` });

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
        text: `别名: ${mapping.aliases.join(', ')}`,
        cls: 'setting-item-description'
      });
    }

    // Delete button
    const deleteBtn = itemEl.createEl('button', { text: '删除' });
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
      new Notice('请输入标准技能名称');
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
      new Notice(`已更新技能映射: ${newMapping.standardName}`);
    } else {
      // Add new mapping
      this.plugin.settings.taxonomy.push(newMapping);
      new Notice(`已添加技能映射: ${newMapping.standardName}`);
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
    
    new Notice(`已删除技能映射: ${mapping.standardName}`);
    this.renderTaxonomyList();
  }


  /**
   * Render dry-run mode section
   * 
   * Validates: Requirements 15.1, 15.2
   */
  private renderDryRunSection(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: '试运行模式' });
    containerEl.createEl('p', { 
      text: '在正式索引前测试提取质量。结果显示在控制台中，不会写入文件。',
      cls: 'setting-item-description'
    });

    // Dry-run toggle
    new Setting(containerEl)
      .setName('启用试运行模式')
      .setDesc('启用后，索引只会处理有限数量的笔记，并显示结果而不保存')
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
        .setName('试运行最大笔记数')
        .setDesc('试运行模式下处理的最大笔记数量（1-50）')
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
            .setTooltip('重置为默认值 (10)')
            .onClick(async () => {
              this.plugin.settings.dryRunMaxNotes = 10;
              await this.plugin.saveSettings();
              this.display();
            });
        });

      // Dry-run info box
      const infoEl = containerEl.createDiv({ cls: 'career-os-info' });
      infoEl.createEl('p', { 
        text: '💡 提示：运行「CareerOS: Cold Start Indexing」命令来测试提取效果。' +
              '结果将显示在开发者控制台中（Ctrl+Shift+I）。'
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
    containerEl.createEl('h2', { text: '数据目录' });
    containerEl.createEl('p', { 
      text: '配置 CareerOS 存储数据文件的位置。路径相对于 Vault 根目录。',
      cls: 'setting-item-description'
    });

    // Index directory
    new Setting(containerEl)
      .setName('索引目录')
      .setDesc('NoteCard 索引文件的存储目录')
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
      .setName('画像目录')
      .setDesc('画像、差距分析和行动计划的存储目录')
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
      .setName('市场卡片目录')
      .setDesc('JDCard 文件的存储目录')
      .addText(text => {
        text.setPlaceholder('.career-os/market_cards')
          .setValue(this.plugin.settings.marketCardsDirectory)
          .onChange(async (value) => {
            this.plugin.settings.marketCardsDirectory = value || '.career-os/market_cards';
            await this.plugin.saveSettings();
          });
      });

    // Reset all settings button
    containerEl.createEl('h2', { text: '重置设置' });
    
    new Setting(containerEl)
      .setName('重置所有设置')
      .setDesc('将所有设置重置为默认值。此操作无法撤销。')
      .addButton(button => {
        button.setButtonText('重置为默认值')
          .setWarning()
          .onClick(async () => {
            if (confirm('确定要将所有设置重置为默认值吗？')) {
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
    const preserveKeys = confirm('是否保留您的 API 密钥？');
    if (preserveKeys) {
      defaultSettings.openaiApiKey = this.plugin.settings.openaiApiKey;
      defaultSettings.anthropicApiKey = this.plugin.settings.anthropicApiKey;
      defaultSettings.googleApiKey = this.plugin.settings.googleApiKey;
    }

    this.plugin.settings = defaultSettings;
    await this.plugin.saveSettings();
    
    new Notice('设置已重置为默认值');
    this.display();
  }
}
