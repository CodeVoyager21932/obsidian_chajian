/**
 * Zod schemas for runtime validation and type safety
 */

import { z } from 'zod';

// ============================================================================
// Schema Version
// ============================================================================

export const CURRENT_SCHEMA_VERSION = 1;

// ============================================================================
// NoteCard Schemas
// ============================================================================

export const NoteTypeSchema = z.enum(['project', 'course', 'reflection', 'other']);

export const TechItemSchema = z.object({
  name: z.string(),
  context: z.string(),
  level: z.enum(['入门', '熟悉', '熟练', '精通']),
});

export const PreferencesSchema = z.object({
  likes: z.array(z.string()),
  dislikes: z.array(z.string()),
  traits: z.array(z.string()),
});

export const NoteCardSchema = z.object({
  schema_version: z.number(),
  note_path: z.string(),
  hash: z.string(),
  summary: z.string(),
  type: NoteTypeSchema,
  time_span: z.string(),
  tech_stack: z.array(TechItemSchema),
  topics: z.array(z.string()),
  preferences: PreferencesSchema,
  evidence: z.array(z.string()),
  last_updated: z.string(),
  detected_date: z.string(),
  status: z.enum(['draft', 'confirmed']).optional(),
  deleted: z.boolean().optional(),
});

export type NoteCardType = z.infer<typeof NoteCardSchema>;

// ============================================================================
// JDCard Schemas
// ============================================================================

export const JDCardSchema = z.object({
  schema_version: z.number(),
  jd_id: z.string(),
  source_note: z.string(),
  company: z.string(),
  title: z.string(),
  location: z.string(),
  salary_range: z.string(),
  skills_required: z.array(z.string()),
  skills_optional: z.array(z.string()),
  experience: z.string(),
  degree: z.string(),
  raw_text_hash: z.string(),
  tags: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
  deleted: z.boolean().optional(),
});

export type JDCardType = z.infer<typeof JDCardSchema>;

// ============================================================================
// SelfProfile Schemas
// ============================================================================

export const SkillCategorySchema = z.enum([
  'language',
  'framework',
  'database',
  'tool',
  'platform',
  'soft',
]);

export const SkillProfileSchema = z.object({
  name: z.string(),
  category: SkillCategorySchema.optional(),
  level: z.number().min(0).max(5),
  evidence_notes: z.array(z.string()),
  last_active: z.string(),
});

export const ProjectSummarySchema = z.object({
  note_path: z.string(),
  summary: z.string(),
  tech_stack: z.array(TechItemSchema),
  time_span: z.string(),
});

export const SelfProfileSchema = z.object({
  schema_version: z.number(),
  skills: z.array(SkillProfileSchema),
  preferences: PreferencesSchema,
  projects: z.array(ProjectSummarySchema),
  analysis_view: z.object({
    top_skills: z.array(SkillProfileSchema),
    recent_projects: z.array(ProjectSummarySchema),
  }).optional(),
  last_built: z.string(),
});

export type SelfProfileType = z.infer<typeof SelfProfileSchema>;

// ============================================================================
// MarketProfile Schemas
// ============================================================================

export const SkillDemandSchema = z.object({
  name: z.string(),
  frequency: z.number(),
  experience_hint: z.array(z.string()).optional(),
});

export const MarketProfileSchema = z.object({
  schema_version: z.number(),
  role: z.string(),
  location: z.string(),
  skills_demand: z.array(SkillDemandSchema),
  soft_requirements: z.array(z.string()),
  experience_distribution: z.record(z.string(), z.number()),
  sample_jd_ids: z.array(z.string()),
  last_built: z.string(),
});

export type MarketProfileType = z.infer<typeof MarketProfileSchema>;

// ============================================================================
// Gap Analysis Schemas
// ============================================================================

export const GapPrioritySchema = z.enum(['high', 'medium', 'low']);

export const GapSchema = z.object({
  skillName: z.string(),
  marketDemand: z.number(),
  currentLevel: z.number(),
  priority: GapPrioritySchema,
});

export const GapAnalysisSchema = z.object({
  matchPercentage: z.number(),
  strengths: z.array(z.string()),
  gaps: z.array(GapSchema),
  reportPath: z.string(),
});

export type GapAnalysisType = z.infer<typeof GapAnalysisSchema>;

// ============================================================================
// LLM Schemas
// ============================================================================

export const LLMProviderSchema = z.enum(['openai', 'anthropic', 'local', 'google']);

export const ModelRoleSchema = z.enum(['extract', 'analyze', 'embedding']);

export const LLMConfigSchema = z.object({
  provider: LLMProviderSchema,
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  model: z.string(),
  jsonMode: z.boolean().optional(),
});

export const CallOptionsSchema = z.object({
  maxRetries: z.number().optional(),
  timeout: z.number().optional(),
  temperature: z.number().optional(),
});

// ============================================================================
// Queue Schemas
// ============================================================================

export const TaskTypeSchema = z.enum(['extract_note', 'extract_jd', 'build_profile']);

export const TaskSchema = z.object({
  id: z.string(),
  type: TaskTypeSchema,
  data: z.any(),
  priority: z.number().optional(),
});

export const QueueStatusSchema = z.object({
  total: z.number(),
  completed: z.number(),
  failed: z.number(),
  pending: z.number(),
  isRunning: z.boolean(),
});

// ============================================================================
// Index Schemas
// ============================================================================

export const IndexOptionsSchema = z.object({
  dryRun: z.boolean().optional(),
  maxNotes: z.number().optional(),
  concurrency: z.number().optional(),
});

export const IndexResultSchema = z.object({
  totalNotes: z.number(),
  processedNotes: z.number(),
  failedNotes: z.number(),
  errors: z.array(z.object({
    path: z.string(),
    error: z.string(),
  })),
});

// ============================================================================
// Privacy Schemas
// ============================================================================

export const ExclusionRulesSchema = z.object({
  directories: z.array(z.string()),
  tags: z.array(z.string()),
});

export const PIITypeSchema = z.enum(['email', 'phone', 'name', 'custom']);

export const PIIPatternSchema = z.object({
  type: PIITypeSchema,
  pattern: z.instanceof(RegExp),
  replacement: z.string(),
});

// ============================================================================
// Taxonomy Schemas
// ============================================================================

export const SkillMappingSchema = z.object({
  standardName: z.string(),
  aliases: z.array(z.string()),
  category: SkillCategorySchema.optional(),
});

// ============================================================================
// Strategy Schemas
// ============================================================================

export const PlanConstraintsSchema = z.object({
  targetRole: z.string(),
  location: z.string(),
  periodMonths: z.number(),
  weeklyHours: z.number(),
});

export const MarketProfileSummarySchema = z.object({
  role: z.string(),
  location: z.string(),
  jdCount: z.number(),
  lastBuilt: z.string(),
});

// ============================================================================
// Settings Schemas
// ============================================================================

export const CareerOSSettingsSchema = z.object({
  llmConfigs: z.object({
    extract: LLMConfigSchema,
    analyze: LLMConfigSchema,
    embedding: LLMConfigSchema,
  }),
  openaiApiKey: z.string(),
  anthropicApiKey: z.string(),
  googleApiKey: z.string(),
  proxyUrl: z.string().optional(),
  customBaseUrl: z.string().optional(),
  maxRetries: z.number(),
  timeout: z.number(),
  concurrency: z.number(),
  exclusionRules: ExclusionRulesSchema,
  taxonomy: z.array(SkillMappingSchema),
  dryRunEnabled: z.boolean(),
  dryRunMaxNotes: z.number(),
  indexDirectory: z.string(),
  mappingDirectory: z.string(),
  marketCardsDirectory: z.string(),
});

export type CareerOSSettingsType = z.infer<typeof CareerOSSettingsSchema>;

// ============================================================================
// Schema Migration Utilities
// ============================================================================

/**
 * Migrate data from an older schema version to the current version
 */
export function migrateSchema<T>(
  data: any,
  schema: z.ZodSchema<T>,
  fromVersion: number,
  toVersion: number = CURRENT_SCHEMA_VERSION
): T {
  let migrated = data;
  
  // Apply migrations sequentially
  for (let v = fromVersion; v < toVersion; v++) {
    migrated = applyMigration(migrated, v, v + 1);
  }
  
  // Validate against target schema
  return schema.parse(migrated);
}

/**
 * Apply a single migration step
 */
function applyMigration(data: any, fromVersion: number, toVersion: number): any {
  // Currently only version 1 exists, so no migrations needed yet
  // Future migrations would be implemented here
  
  if (fromVersion === 1 && toVersion === 2) {
    // Example: Add new field with default value
    // return { ...data, newField: defaultValue };
  }
  
  return data;
}

/**
 * Validate and ensure schema version
 */
export function validateSchemaVersion(data: any, expectedVersion: number = CURRENT_SCHEMA_VERSION): boolean {
  return data.schema_version === expectedVersion;
}
