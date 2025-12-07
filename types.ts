/**
 * Core type definitions for CareerOS
 */

// ============================================================================
// NoteCard Types
// ============================================================================

export type NoteType = 'project' | 'course' | 'reflection' | 'other';

export interface TechItem {
  name: string;            // Original skill name (not normalized)
  context: string;         // Usage context
  level: '入门' | '熟悉' | '熟练' | '精通';
}

export interface Preferences {
  likes: string[];
  dislikes: string[];
  traits: string[];
}

export interface NoteCard {
  schema_version: number;  // Current: 1
  
  note_path: string;       // Relative path in vault
  hash: string;            // Content hash for change detection
  
  summary: string;
  type: NoteType;
  time_span: string;
  
  tech_stack: TechItem[];
  topics: string[];
  preferences: Preferences;
  evidence: string[];
  
  last_updated: string;    // Inferred from note content/metadata
  detected_date: string;   // ISO timestamp of extraction
  
  status?: 'draft' | 'confirmed';
  deleted?: boolean;
}

// ============================================================================
// JDCard Types
// ============================================================================

export interface JDCard {
  schema_version: number;  // Current: 1
  
  jd_id: string;           // UUID
  source_note: string;     // Path to source markdown file
  
  company: string;
  title: string;
  location: string;
  salary_range: string;
  
  skills_required: string[];
  skills_optional: string[];
  experience: string;
  degree: string;
  
  raw_text_hash: string;   // For deduplication
  tags: string[];
  
  created_at: string;
  updated_at: string;
  deleted?: boolean;
}

// ============================================================================
// SelfProfile Types
// ============================================================================

export type SkillCategory =
  | 'language'
  | 'framework'
  | 'database'
  | 'tool'
  | 'platform'
  | 'soft';

export interface SkillProfile {
  name: string;            // Normalized standard name
  category?: SkillCategory;
  level: number;           // 0-5 float, weighted score
  evidence_notes: string[]; // Paths to source NoteCards
  last_active: string;     // Most recent activity date
}

export interface ProjectSummary {
  note_path: string;
  summary: string;
  tech_stack: TechItem[];
  time_span: string;
}

export interface SelfProfile {
  schema_version: number;  // Current: 1
  
  skills: SkillProfile[];
  preferences: Preferences;
  projects: ProjectSummary[];
  
  // Compressed view for LLM analysis
  analysis_view?: {
    top_skills: SkillProfile[];       // Top N skills
    recent_projects: ProjectSummary[]; // Most recent M projects
  };
  
  last_built: string;      // ISO timestamp
}

// ============================================================================
// MarketProfile Types
// ============================================================================

export interface SkillDemand {
  name: string;                   // Normalized skill name
  frequency: number;              // Occurrence count or percentage
  experience_hint?: string[];     // Typical experience descriptions
}

export interface MarketProfile {
  schema_version: number;         // Current: 1
  
  role: string;
  location: string;
  skills_demand: SkillDemand[];
  soft_requirements: string[];
  experience_distribution: Record<string, number>;
  sample_jd_ids: string[];
  last_built: string;
}

// ============================================================================
// Action Plan Types
// ============================================================================

export interface ActionPlanMetadata {
  role: string;
  period: string;
  weekly_hours: number;
  generated_at: string;
  source_self_profile: string;
  source_market_profile: string;
}

// ============================================================================
// LLM Types
// ============================================================================

export type ModelRole = 'extract' | 'analyze' | 'embedding';

export type LLMProvider = 'openai' | 'anthropic' | 'local' | 'google';

export interface LLMConfig {
  provider: LLMProvider;
  baseUrl?: string;
  apiKey?: string;
  model: string;
  jsonMode?: boolean;
}

export interface CallOptions {
  maxRetries?: number;
  timeout?: number;
  temperature?: number;
}

// ============================================================================
// Queue Types
// ============================================================================

export type TaskType = 'extract_note' | 'extract_jd' | 'build_profile';

export interface Task {
  id: string;
  type: TaskType;
  data: any;
  priority?: number;
}

export interface QueueStatus {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  isRunning: boolean;
}

// ============================================================================
// Index Types
// ============================================================================

export interface IndexOptions {
  dryRun?: boolean;
  maxNotes?: number;
  concurrency?: number;
}

export interface IndexResult {
  totalNotes: number;
  processedNotes: number;
  failedNotes: number;
  errors: Array<{ path: string; error: string }>;
}

// ============================================================================
// Privacy Types
// ============================================================================

export interface ExclusionRules {
  directories: string[];
  tags: string[];
}

export type PIIType = 'email' | 'phone' | 'name' | 'custom';

export interface PIIPattern {
  type: PIIType;
  pattern: RegExp;
  replacement: string;
}

// ============================================================================
// Taxonomy Types
// ============================================================================

export interface SkillMapping {
  standardName: string;
  aliases: string[];
  category?: SkillCategory;
}

// ============================================================================
// Gap Analysis Types
// ============================================================================

export type GapPriority = 'high' | 'medium' | 'low';

export interface Gap {
  skillName: string;
  marketDemand: number;
  currentLevel: number;
  priority: GapPriority;
}

export interface GapAnalysis {
  matchPercentage: number;
  strengths: string[];
  gaps: Gap[];
  reportPath: string;
}

// ============================================================================
// Strategy Types
// ============================================================================

export interface PlanConstraints {
  targetRole: string;
  location: string;
  periodMonths: number;
  weeklyHours: number;
}

export interface MarketProfileSummary {
  role: string;
  location: string;
  jdCount: number;
  lastBuilt: string;
}

// ============================================================================
// Settings Types
// ============================================================================

export interface CareerOSSettings {
  // LLM Configuration
  llmConfigs: {
    extract: LLMConfig;
    analyze: LLMConfig;
    embedding: LLMConfig;
  };
  
  // API Keys
  openaiApiKey: string;
  anthropicApiKey: string;
  googleApiKey: string;
  
  // Proxy and Custom URLs
  proxyUrl?: string;
  customBaseUrl?: string;
  
  // Retry and Timeout
  maxRetries: number;
  timeout: number;
  concurrency: number;
  
  // Privacy
  exclusionRules: ExclusionRules;
  
  // Taxonomy
  taxonomy: SkillMapping[];
  
  // Dry Run
  dryRunEnabled: boolean;
  dryRunMaxNotes: number;
  
  // Directories
  indexDirectory: string;
  mappingDirectory: string;
  marketCardsDirectory: string;
}
