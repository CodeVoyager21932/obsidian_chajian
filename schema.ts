/**
 * Zod Schemas for Runtime Validation and Type Safety
 * 
 * This module defines all data schemas used in CareerOS for:
 * - Runtime validation of LLM outputs
 * - Type inference for TypeScript
 * - Schema versioning and migration
 * 
 * Key Design Decisions:
 * 1. All core data structures include schema_version for future migrations
 * 2. Schemas are designed to be strict but allow optional fields for flexibility
 * 3. String enums are used for type safety on categorical fields
 * 
 * Requirements: 5.2, 5.5
 * - Property 14: JSON cleaning and validation
 * - Property 16: Schema version migration
 */

import { z } from 'zod';

// ============================================================================
// Schema Version
// ============================================================================

/**
 * Current schema version for all data structures.
 * Increment this when making breaking changes to schemas.
 * 
 * Version History:
 * - v1 (2024-12): Initial release
 */
export const CURRENT_SCHEMA_VERSION = 1;

// ============================================================================
// NoteCard Schemas
// ============================================================================

/**
 * Note type classification for different kinds of user notes.
 * 
 * - project: Technical project notes with implementation details
 * - course: Learning/course notes with educational content
 * - reflection: Personal reflections, career thoughts, preferences
 * - other: Uncategorized notes
 * 
 * Note type affects skill scoring weights (see ProfileEngine.ts)
 */
export const NoteTypeSchema = z.enum(['project', 'course', 'reflection', 'other']);

/**
 * Technical skill item extracted from notes.
 * 
 * Property 1: Skill names are preserved exactly as written in the source note.
 * Normalization happens later in ProfileEngine using Taxonomy.
 * 
 * Proficiency levels (Chinese):
 * - 入门 (Beginner): Basic understanding, limited practical experience
 * - 熟悉 (Familiar): Working knowledge, can use with guidance
 * - 熟练 (Proficient): Strong skills, can work independently
 * - 精通 (Expert): Deep expertise, can mentor others
 */
export const TechItemSchema = z.object({
  name: z.string(),           // Original skill name (not normalized)
  context: z.string(),        // Usage context or description
  level: z.enum(['入门', '熟悉', '熟练', '精通']),
});

/**
 * User preferences extracted from notes.
 * 
 * Property 2: Preferences are only extracted when explicitly stated.
 * The LLM should not infer preferences from context.
 * 
 * - likes: Things the user explicitly enjoys or prefers
 * - dislikes: Things the user explicitly dislikes or avoids
 * - traits: Personal characteristics or work style attributes
 */
export const PreferencesSchema = z.object({
  likes: z.array(z.string()),
  dislikes: z.array(z.string()),
  traits: z.array(z.string()),
});

/**
 * NoteCard - Structured representation of a single note's career-relevant information.
 * 
 * This is the primary data structure for storing extracted information from user notes.
 * Each note in the vault can have at most one corresponding NoteCard.
 * 
 * Key Properties:
 * - Property 3: hash is used for change detection (content hash consistency)
 * - Property 4: Empty values are used for unknown fields (no guessing)
 * 
 * File Location: {indexDirectory}/{sanitized_note_path}.json
 */
export const NoteCardSchema = z.object({
  schema_version: z.number(),           // Schema version for migration
  note_path: z.string(),                // Relative path to source note in vault
  hash: z.string(),                     // Content hash for change detection
  summary: z.string(),                  // Brief summary of the note (1-2 sentences)
  type: NoteTypeSchema,                 // Note classification
  time_span: z.string(),                // Time period (e.g., "2023-01 到 2023-06")
  tech_stack: z.array(TechItemSchema),  // Technical skills mentioned
  topics: z.array(z.string()),          // Topic tags
  preferences: PreferencesSchema,       // User preferences (conservative extraction)
  evidence: z.array(z.string()),        // Concrete achievements or facts
  last_updated: z.string(),             // Inferred last update time
  detected_date: z.string(),            // When this card was created/updated
  status: z.enum(['draft', 'confirmed']).optional(),  // Review status
  deleted: z.boolean().optional(),      // Soft delete flag
});

export type NoteCardType = z.infer<typeof NoteCardSchema>;

// ============================================================================
// JDCard Schemas
// ============================================================================

/**
 * JDCard - Structured representation of a job description.
 * 
 * Multiple JDCards can be extracted from a single market note.
 * Each JDCard represents one job posting.
 * 
 * Key Properties:
 * - Property 17: raw_text_hash is used for deduplication
 * - jd_id is preserved when updating existing cards
 * 
 * File Location: {marketCardsDirectory}/{jd_id}.json
 */
export const JDCardSchema = z.object({
  schema_version: z.number(),           // Schema version for migration
  jd_id: z.string(),                    // UUID, preserved on updates
  source_note: z.string(),              // Path to source market note
  company: z.string(),                  // Company name
  title: z.string(),                    // Job title
  location: z.string(),                 // Work location
  salary_range: z.string(),             // Salary range (e.g., "15k-25k")
  skills_required: z.array(z.string()), // Required skills
  skills_optional: z.array(z.string()), // Nice-to-have skills
  experience: z.string(),               // Experience requirement
  degree: z.string(),                   // Education requirement
  raw_text_hash: z.string(),            // Hash for deduplication
  tags: z.array(z.string()),            // Classification tags
  created_at: z.string(),               // First extraction time
  updated_at: z.string(),               // Last update time
  deleted: z.boolean().optional(),      // Soft delete flag
});

export type JDCardType = z.infer<typeof JDCardSchema>;

// ============================================================================
// SelfProfile Schemas
// ============================================================================

/**
 * Skill category classification for organizing skills.
 * 
 * Categories are assigned via Taxonomy configuration.
 * Used for grouping and visualization in the dashboard.
 */
export const SkillCategorySchema = z.enum([
  'language',   // Programming languages (Python, JavaScript, etc.)
  'framework',  // Frameworks and libraries (React, Django, etc.)
  'database',   // Databases (PostgreSQL, Redis, etc.)
  'tool',       // Development tools (Git, Docker, etc.)
  'platform',   // Platforms and cloud services (AWS, Linux, etc.)
  'soft',       // Soft skills (Communication, Leadership, etc.)
]);

/**
 * Aggregated skill profile with weighted scoring.
 * 
 * Property 18: Skill names are normalized using Taxonomy
 * Property 19: Level is calculated with time decay weighting
 * 
 * Level calculation formula:
 *   score = Σ(skill_level × note_type_weight × time_decay)
 *   normalized_level = (score / max_score) × 5
 */
export const SkillProfileSchema = z.object({
  name: z.string(),                     // Normalized skill name
  category: SkillCategorySchema.optional(),
  level: z.number().min(0).max(5),      // Weighted proficiency (0-5)
  evidence_notes: z.array(z.string()),  // Source NoteCard paths
  last_active: z.string(),              // Most recent activity date
});

export const ProjectSummarySchema = z.object({
  note_path: z.string(),
  summary: z.string(),
  tech_stack: z.array(TechItemSchema),
  time_span: z.string(),
});

/**
 * SelfProfile - Aggregated self-capability profile.
 * 
 * Built from all non-deleted NoteCards in the index.
 * Saved as both JSON and Markdown formats.
 * 
 * Property 20: Profile serialization round-trip
 * Property 21: analysis_view provides compressed data for LLM context
 * 
 * File Location: {mappingDirectory}/self_profile_{date}.json
 */
export const SelfProfileSchema = z.object({
  schema_version: z.number(),
  skills: z.array(SkillProfileSchema),          // All aggregated skills
  preferences: PreferencesSchema,               // Aggregated preferences
  projects: z.array(ProjectSummarySchema),      // All project summaries
  analysis_view: z.object({                     // Compressed view for LLM
    top_skills: z.array(SkillProfileSchema),    // Top N skills by level
    recent_projects: z.array(ProjectSummarySchema), // Recent M projects
  }).optional(),
  last_built: z.string(),                       // Build timestamp
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
