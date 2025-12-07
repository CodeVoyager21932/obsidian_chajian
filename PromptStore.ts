/**
 * PromptStore - Centralized prompt management for CareerOS
 * 
 * Handles loading, caching, and interpolating prompt templates.
 * All prompts are stored in the prompts/ directory as .txt files.
 */

import { App, TFile } from 'obsidian';

// Prompt template names
export type PromptName = 'noteCard' | 'jdCard' | 'plan';

// Mapping from prompt names to file paths
const PROMPT_FILES: Record<PromptName, string> = {
  noteCard: 'prompts/noteCardPrompt.txt',
  jdCard: 'prompts/jdCardPrompt.txt',
  plan: 'prompts/planPrompt.txt',
};

// Variable interpolation pattern: {{variable_name}}
const INTERPOLATION_PATTERN = /\{\{(\w+)\}\}/g;

/**
 * PromptStore class for managing prompt templates
 */
export class PromptStore {
  private app: App;
  private pluginDir: string;
  private cache: Map<PromptName, string> = new Map();

  constructor(app: App, pluginDir: string) {
    this.app = app;
    this.pluginDir = pluginDir;
  }

  /**
   * Load a prompt template from file
   * @param name - The prompt template name
   * @returns The raw prompt template string
   */
  async loadPrompt(name: PromptName): Promise<string> {
    // Check cache first
    const cached = this.cache.get(name);
    if (cached) {
      return cached;
    }

    const filePath = this.getPromptPath(name);
    
    try {
      const content = await this.readPromptFile(filePath);
      this.cache.set(name, content);
      return content;
    } catch (error) {
      throw new Error(`Failed to load prompt '${name}' from ${filePath}: ${error}`);
    }
  }

  /**
   * Load and interpolate a prompt template with variables
   * @param name - The prompt template name
   * @param variables - Key-value pairs for interpolation
   * @returns The interpolated prompt string
   */
  async getPrompt(name: PromptName, variables: Record<string, string> = {}): Promise<string> {
    const template = await this.loadPrompt(name);
    return this.interpolate(template, variables);
  }

  /**
   * Interpolate variables into a template string
   * @param template - The template string with {{variable}} placeholders
   * @param variables - Key-value pairs for interpolation
   * @returns The interpolated string
   */
  interpolate(template: string, variables: Record<string, string>): string {
    return template.replace(INTERPOLATION_PATTERN, (match, varName) => {
      if (varName in variables) {
        return variables[varName];
      }
      // Keep the placeholder if variable not provided
      return match;
    });
  }

  /**
   * Clear the prompt cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear a specific prompt from cache
   * @param name - The prompt template name to clear
   */
  clearPromptCache(name: PromptName): void {
    this.cache.delete(name);
  }

  /**
   * Get the full path to a prompt file
   * @param name - The prompt template name
   * @returns The full path to the prompt file
   */
  private getPromptPath(name: PromptName): string {
    const relativePath = PROMPT_FILES[name];
    return `${this.pluginDir}/${relativePath}`;
  }

  /**
   * Read prompt file content
   * @param filePath - Path to the prompt file
   * @returns The file content as string
   */
  private async readPromptFile(filePath: string): Promise<string> {
    const adapter = this.app.vault.adapter;
    
    // Check if file exists
    const exists = await adapter.exists(filePath);
    if (!exists) {
      throw new Error(`Prompt file not found: ${filePath}`);
    }

    return await adapter.read(filePath);
  }

  /**
   * Get all available prompt names
   * @returns Array of prompt names
   */
  getAvailablePrompts(): PromptName[] {
    return Object.keys(PROMPT_FILES) as PromptName[];
  }

  /**
   * Check if a prompt file exists
   * @param name - The prompt template name
   * @returns True if the prompt file exists
   */
  async promptExists(name: PromptName): Promise<boolean> {
    const filePath = this.getPromptPath(name);
    return await this.app.vault.adapter.exists(filePath);
  }
}

/**
 * Helper function to generate NoteCard extraction prompt
 */
export async function getNoteCardPrompt(
  store: PromptStore,
  notePath: string,
  noteContent: string,
  contentHash: string,
  currentDate: string
): Promise<string> {
  return store.getPrompt('noteCard', {
    note_path: notePath,
    note_content: noteContent,
    content_hash: contentHash,
    current_date: currentDate,
  });
}

/**
 * Helper function to generate JDCard extraction prompt
 */
export async function getJDCardPrompt(
  store: PromptStore,
  sourceNote: string,
  noteContent: string,
  currentDate: string
): Promise<string> {
  return store.getPrompt('jdCard', {
    source_note: sourceNote,
    note_content: noteContent,
    current_date: currentDate,
  });
}

/**
 * Helper function to generate plan/gap analysis prompt
 */
export async function getPlanPrompt(
  store: PromptStore,
  selfProfileAnalysisView: string,
  marketProfile: string,
  targetRole: string,
  targetLocation: string,
  periodMonths: number,
  weeklyHours: number
): Promise<string> {
  return store.getPrompt('plan', {
    self_profile_analysis_view: selfProfileAnalysisView,
    market_profile: marketProfile,
    target_role: targetRole,
    target_location: targetLocation,
    period_months: String(periodMonths),
    weekly_hours: String(weeklyHours),
  });
}

/**
 * Create a PromptStore instance with embedded prompts (for testing or fallback)
 * This version doesn't require file system access
 */
export class EmbeddedPromptStore {
  private prompts: Map<PromptName, string> = new Map();

  constructor() {
    this.initializeEmbeddedPrompts();
  }

  private initializeEmbeddedPrompts(): void {
    // NoteCard prompt (simplified version for embedding)
    this.prompts.set('noteCard', `你是一个专业的职业规划助手，负责从用户的笔记中提取结构化的职业相关信息。

# 任务
从下面的笔记内容中提取技能、项目、偏好等信息，生成一个 NoteCard JSON 对象。

# 输入信息
- 笔记路径：{{note_path}}
- 笔记内容：
\`\`\`
{{note_content}}
\`\`\`

# 输出要求
返回一个 JSON 对象，包含以下字段：
- schema_version: 1
- note_path: 笔记路径
- hash: "{{content_hash}}"
- summary: 笔记摘要
- type: "project" | "course" | "reflection" | "other"
- time_span: 时间跨度
- tech_stack: [{name, context, level}]
- topics: []
- preferences: {likes: [], dislikes: [], traits: []}
- evidence: []
- last_updated: 推断的更新时间
- detected_date: "{{current_date}}"
- status: "draft"

直接返回 JSON，不要添加 Markdown 格式。`);

    // JDCard prompt (simplified version for embedding)
    this.prompts.set('jdCard', `你是一个专业的招聘信息分析助手。

# 任务
从笔记中提取职位描述，生成 JDCard JSON 数组。

# 输入信息
- 笔记路径：{{source_note}}
- 笔记内容：
\`\`\`
{{note_content}}
\`\`\`

# 输出要求
返回 JSON 数组，每个元素包含：
- schema_version: 1
- jd_id: UUID
- source_note: 笔记路径
- company, title, location, salary_range
- skills_required: [], skills_optional: []
- experience, degree
- raw_text_hash, tags: []
- created_at, updated_at: "{{current_date}}"

直接返回 JSON 数组。`);

    // Plan prompt (simplified version for embedding)
    this.prompts.set('plan', `你是一个专业的职业规划顾问。

# 任务
根据用户画像和市场画像，生成差距分析和行动计划。

# 用户能力画像
{{self_profile_analysis_view}}

# 目标市场画像
{{market_profile}}

# 约束条件
- 目标岗位：{{target_role}}
- 目标地点：{{target_location}}
- 计划周期：{{period_months}} 个月
- 每周可用时间：{{weekly_hours}} 小时

# 输出要求
生成 Markdown 格式的行动计划，包含：
1. 差距分析摘要（匹配度、优势、差距）
2. 阶段性目标
3. 每周任务清单
4. 学习资源推荐
5. 里程碑检查点`);
  }

  /**
   * Get an interpolated prompt
   */
  getPrompt(name: PromptName, variables: Record<string, string> = {}): string {
    const template = this.prompts.get(name);
    if (!template) {
      throw new Error(`Unknown prompt: ${name}`);
    }
    return this.interpolate(template, variables);
  }

  /**
   * Interpolate variables into template
   */
  interpolate(template: string, variables: Record<string, string>): string {
    return template.replace(INTERPOLATION_PATTERN, (match, varName) => {
      if (varName in variables) {
        return variables[varName];
      }
      return match;
    });
  }
}


/**
 * Factory function to create a PromptStore instance
 */
export function createPromptStore(app: App, pluginDir?: string): PromptStore {
  const dir = pluginDir || `${app.vault.configDir}/plugins/career-os`;
  return new PromptStore(app, dir);
}
