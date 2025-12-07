# CareerOS Design Document

## Overview

CareerOS is an Obsidian plugin that implements a career planning operating system. The system analyzes user notes (projects, courses, reflections) and market job descriptions to automatically generate capability profiles, market profiles, gap analyses, and actionable plans. The architecture prioritizes local processing, privacy protection, and extensibility.

The system follows a three-layer data architecture:
- **Raw Layer**: Original Markdown notes in the Obsidian vault
- **Card Layer**: Structured JSON cards extracted from notes (NoteCard, JDCard)
- **Profile/View Layer**: Aggregated profiles and analyses (SelfProfile, MarketProfile, Plans)

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Obsidian Plugin                          │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Dashboard    │  │ Settings     │  │ Commands     │     │
│  │ View (React) │  │ Tab          │  │ Registry     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Profile      │  │ Market       │  │ Strategy     │     │
│  │ Engine       │  │ Scanner      │  │ Core         │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Taxonomy     │  │ Privacy      │  │ Index        │     │
│  │              │  │ Guard        │  │ Store        │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ LLM Client   │  │ Queue        │  │ File         │     │
│  │              │  │ Manager      │  │ Service      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  LLM Providers         │
              │  - OpenAI              │
              │  - Anthropic           │
              │  - Local (Ollama)      │
              │  - Google              │
              └────────────────────────┘
```

### Data Flow

1. **Indexing Flow**: Raw Notes → ProfileEngine → LLM → NoteCard → IndexStore
2. **Market Analysis Flow**: JD Notes → MarketScanner → LLM → JDCard → IndexStore
3. **Profile Building Flow**: NoteCards → ProfileEngine → SelfProfile (with Taxonomy normalization)
4. **Gap Analysis Flow**: SelfProfile + MarketProfile → StrategyCore → LLM → Gap Analysis Report
5. **Plan Generation Flow**: Gap Analysis + User Constraints → StrategyCore → LLM → Action Plan

## Components and Interfaces

### Core Modules

#### ProfileEngine

Responsible for building and maintaining the self-capability profile.

```typescript
interface ProfileEngine {
  // Cold start: index all notes in selected directories
  coldStartIndex(directories: string[], options: IndexOptions): Promise<IndexResult>;
  
  // Incremental update: process a single note
  processNote(notePath: string): Promise<NoteCard>;
  
  // Build aggregated self profile from all note cards
  buildSelfProfile(): Promise<SelfProfile>;
  
  // Handle file system events
  onNoteSaved(notePath: string): Promise<void>;
  onNoteRenamed(oldPath: string, newPath: string): Promise<void>;
  onNoteDeleted(notePath: string): Promise<void>;
}

interface IndexOptions {
  dryRun?: boolean;
  maxNotes?: number;
  concurrency?: number;
}

interface IndexResult {
  totalNotes: number;
  processedNotes: number;
  failedNotes: number;
  errors: Array<{ path: string; error: string }>;
}
```

#### MarketScanner

Responsible for extracting and aggregating job market data.

```typescript
interface MarketScanner {
  // Extract JD cards from a market note
  extractJDCards(notePath: string): Promise<JDCard[]>;
  
  // Build market profile for a specific role and location
  buildMarketProfile(role: string, location: string): Promise<MarketProfile>;
  
  // Get all available market profiles
  listMarketProfiles(): Promise<MarketProfileSummary[]>;
}

interface MarketProfileSummary {
  role: string;
  location: string;
  jdCount: number;
  lastBuilt: string;
}
```

#### StrategyCore

Responsible for gap analysis and action plan generation.

```typescript
interface StrategyCore {
  // Generate gap analysis between self and market profiles
  analyzeGap(
    selfProfile: SelfProfile,
    marketProfile: MarketProfile
  ): Promise<GapAnalysis>;
  
  // Generate action plan based on gap analysis
  generatePlan(
    gapAnalysis: GapAnalysis,
    constraints: PlanConstraints
  ): Promise<ActionPlan>;
}

interface PlanConstraints {
  targetRole: string;
  location: string;
  periodMonths: number;
  weeklyHours: number;
}

interface GapAnalysis {
  matchPercentage: number;
  strengths: string[];
  gaps: Gap[];
  reportPath: string;
}

interface Gap {
  skillName: string;
  marketDemand: number;
  currentLevel: number;
  priority: 'high' | 'medium' | 'low';
}
```

#### Taxonomy

Manages skill name normalization and standardization.

```typescript
interface Taxonomy {
  // Normalize a skill name to its standard form
  normalize(skillName: string): string;
  
  // Add a new skill alias mapping
  addAlias(alias: string, standardName: string): Promise<void>;
  
  // Get all unmapped skills from recent processing
  getUnmappedSkills(): string[];
  
  // Load taxonomy from settings
  load(): Promise<void>;
  
  // Save taxonomy to settings
  save(): Promise<void>;
}

interface SkillMapping {
  standardName: string;
  aliases: string[];
  category?: SkillCategory;
}
```

#### PrivacyGuard

Filters personally identifiable information before sending to external LLMs.

```typescript
interface PrivacyGuard {
  // Filter PII from content
  filterPII(content: string, targetProvider: LLMProvider): string;
  
  // Check if a note should be excluded from processing
  shouldExclude(notePath: string, tags: string[]): boolean;
  
  // Get configured exclusion rules
  getExclusionRules(): ExclusionRules;
}

interface ExclusionRules {
  directories: string[];
  tags: string[];
}

interface PIIPattern {
  type: 'email' | 'phone' | 'name' | 'custom';
  pattern: RegExp;
  replacement: string;
}
```

#### IndexStore

Manages reading, writing, and versioning of all index files.

```typescript
interface IndexStore {
  // Read a note card with schema validation and migration
  readNoteCard(notePath: string): Promise<NoteCard | null>;
  
  // Write a note card with backup
  writeNoteCard(card: NoteCard): Promise<void>;
  
  // Read self profile
  readSelfProfile(): Promise<SelfProfile | null>;
  
  // Write self profile
  writeSelfProfile(profile: SelfProfile): Promise<void>;
  
  // Read market profile
  readMarketProfile(role: string, location: string): Promise<MarketProfile | null>;
  
  // Write market profile
  writeMarketProfile(profile: MarketProfile): Promise<void>;
  
  // Migrate old schema version to current
  migrate(data: any, fromVersion: number, toVersion: number): any;
}
```

### Utility Modules

#### LLMClient

Unified interface for calling different LLM providers with retry and validation.

```typescript
interface LLMClient {
  // Call LLM with specific role configuration
  call(
    role: ModelRole,
    prompt: string,
    options?: CallOptions
  ): Promise<string>;
  
  // Call LLM expecting JSON output
  callJSON<T>(
    role: ModelRole,
    prompt: string,
    schema: z.ZodSchema<T>,
    options?: CallOptions
  ): Promise<T>;
}

type ModelRole = 'extract' | 'analyze' | 'embedding';

interface CallOptions {
  maxRetries?: number;
  timeout?: number;
  temperature?: number;
}

interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'local' | 'google';
  baseUrl?: string;
  apiKey?: string;
  model: string;
  jsonMode?: boolean;
}
```

#### QueueManager

Manages asynchronous task processing with concurrency control.

```typescript
interface QueueManager {
  // Add a task to the queue
  enqueue(task: Task): Promise<void>;
  
  // Start processing the queue
  start(): void;
  
  // Pause processing
  pause(): void;
  
  // Resume processing
  resume(): void;
  
  // Cancel all pending tasks
  cancel(): void;
  
  // Get current queue status
  getStatus(): QueueStatus;
}

interface Task {
  id: string;
  type: 'extract_note' | 'extract_jd' | 'build_profile';
  data: any;
  priority?: number;
}

interface QueueStatus {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  isRunning: boolean;
}
```

#### FileService

Provides safe file operations with atomic writes and backups.

```typescript
interface FileService {
  // Read file content
  read(path: string): Promise<string>;
  
  // Write file with atomic operation
  write(path: string, content: string): Promise<void>;
  
  // Write JSON with schema validation
  writeJSON<T>(path: string, data: T, schema: z.ZodSchema<T>): Promise<void>;
  
  // Read JSON with schema validation
  readJSON<T>(path: string, schema: z.ZodSchema<T>): Promise<T | null>;
  
  // Create backup of existing file
  backup(path: string): Promise<void>;
  
  // Restore from backup
  restore(path: string): Promise<void>;
}
```

## Data Models

### NoteCard

Structured representation of a single note's career-relevant information.

```typescript
type NoteType = 'project' | 'course' | 'reflection' | 'other';

interface TechItem {
  name: string;            // Original skill name (not normalized)
  context: string;         // Usage context
  level: '入门' | '熟悉' | '熟练' | '精通';
}

interface Preferences {
  likes: string[];
  dislikes: string[];
  traits: string[];
}

interface NoteCard {
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
```

### JDCard

Structured representation of a job description.

```typescript
interface JDCard {
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
```

### SelfProfile

Aggregated self-capability profile.

```typescript
type SkillCategory =
  | 'language'
  | 'framework'
  | 'database'
  | 'tool'
  | 'platform'
  | 'soft';

interface SkillProfile {
  name: string;            // Normalized standard name
  category?: SkillCategory;
  level: number;           // 0-5 float, weighted score
  evidence_notes: string[]; // Paths to source NoteCards
  last_active: string;     // Most recent activity date
}

interface ProjectSummary {
  note_path: string;
  summary: string;
  tech_stack: TechItem[];
  time_span: string;
}

interface SelfProfile {
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
```

### MarketProfile

Aggregated market demand profile for a specific role and location.

```typescript
interface SkillDemand {
  name: string;                   // Normalized skill name
  frequency: number;              // Occurrence count or percentage
  experience_hint?: string[];     // Typical experience descriptions
}

interface MarketProfile {
  schema_version: number;         // Current: 1
  
  role: string;
  location: string;
  skills_demand: SkillDemand[];
  soft_requirements: string[];
  experience_distribution: Record<string, number>;
  sample_jd_ids: string[];
  last_built: string;
}
```

### ActionPlan

Generated action plan in Markdown format with frontmatter metadata.

```markdown
---
role: "Python 后端（杭州）"
period: "3 个月"
weekly_hours: 10
generated_at: "2024-12-07"
source_self_profile: "self_profile_2024-12-07.json"
source_market_profile: "market_python_backend_hz_2024-12-07.json"
---

# Action Plan Content
...
```

## 
Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

Before defining the correctness properties, we performed a reflection to eliminate redundancy:

**Identified Redundancies:**
- Properties related to file operations (hash calculation, queue addition, path updates) can be combined into higher-level properties about system state consistency
- Multiple properties about LLM routing can be consolidated into a single property about configuration-based routing
- Properties about UI display can be simplified to focus on data correctness rather than specific UI elements
- Schema validation and retry logic can be combined into a single robust error handling property

**Consolidation Strategy:**
- Combine low-level file operation properties into state consistency properties
- Merge similar routing/configuration properties
- Focus on data integrity rather than implementation details
- Emphasize end-to-end correctness over intermediate steps

### Core Properties

**Property 1: Skill name preservation at NoteCard level**
*For any* note content processed by the extraction system, the generated NoteCard should preserve the original skill names exactly as they appear in the source text without any normalization or modification.
**Validates: Requirements 1.2**

**Property 2: Preference extraction conservatism**
*For any* note processed as reflection or journal type, the system should only extract preferences when explicit preference-indicating phrases (like/dislike/enjoy/hate) are present in the text, and should return empty arrays when such phrases are absent.
**Validates: Requirements 1.3**

**Property 3: Content hash consistency**
*For any* note content, if the content remains unchanged, the generated hash should be identical across multiple calculations, and if the content changes, the hash should differ.
**Validates: Requirements 1.4**

**Property 4: Empty value fallback**
*For any* note with missing or ambiguous information, the extraction system should use appropriate empty values (empty strings or empty arrays) rather than generating guessed or hallucinated content.
**Validates: Requirements 1.5**

**Property 5: Incremental update correctness**
*For any* monitored note file, when the file is saved with modified content, the system should detect the hash change and queue the note for re-extraction, and when saved without changes, the system should skip re-extraction.
**Validates: Requirements 2.1, 2.2**

**Property 6: File operation state consistency**
*For any* file operation (rename, move, delete), the corresponding NoteCard metadata should be updated to reflect the new state, maintaining referential integrity between notes and cards.
**Validates: Requirements 2.3, 2.4**

**Property 7: Configuration-based LLM routing**
*For any* LLM request with a specified role (extract/analyze/embedding), the system should route the request to the model configured for that role, respecting custom base URLs and proxy settings.
**Validates: Requirements 3.1, 12.2, 12.3, 12.4**

**Property 8: PII filtering for external LLMs**
*For any* content sent to an external LLM provider, the system should apply PII filtering to remove patterns matching phone numbers, email addresses, and configured person names before transmission.
**Validates: Requirements 3.2**

**Property 9: Directory and tag exclusion**
*For any* note in an excluded directory or with an excluded tag, the system should skip that note during all LLM processing operations.
**Validates: Requirements 3.3**

**Property 10: Concurrency control**
*For any* task queue processing LLM requests, the number of concurrent active requests should never exceed the configured maximum concurrency limit.
**Validates: Requirements 4.2**

**Property 11: Progress tracking accuracy**
*For any* indexing operation, the displayed progress (completed/total) should accurately reflect the actual number of processed and total tasks in the queue.
**Validates: Requirements 4.3**

**Property 12: Pause and resume consistency**
*For any* queue in running state, pausing should prevent new tasks from starting while allowing current tasks to complete, and resuming should continue processing from the paused position without losing or duplicating tasks.
**Validates: Requirements 4.4**

**Property 13: Error logging and continuation**
*For any* LLM extraction that fails after exhausting all retry attempts, the system should log the error with note path and details to the error log file, and continue processing remaining tasks without halting the entire operation.
**Validates: Requirements 4.5**

**Property 14: JSON cleaning and validation**
*For any* LLM output expected to be JSON, the system should apply cleaning (removing markdown wrappers, extracting JSON objects), parse the result, and validate against the corresponding schema before accepting the output.
**Validates: Requirements 5.1, 5.2**

**Property 15: Schema validation retry**
*For any* LLM response that fails schema validation, the system should retry the request up to the configured maximum retry count, and only after exhausting retries should it log the failure.
**Validates: Requirements 5.3, 5.4**

**Property 16: Schema version migration**
*For any* card file with an older schema version, reading the file should trigger automatic migration to the current schema version, preserving all compatible data.
**Validates: Requirements 5.5**

**Property 17: JD deduplication by hash**
*For any* JD element extracted from a market note, if a JDCard with the same raw_text_hash already exists, the system should update that card while preserving its jd_id; otherwise, it should create a new card with a fresh UUID.
**Validates: Requirements 6.3, 6.4, 6.5**

**Property 18: Skill normalization consistency**
*For any* skill name appearing in NoteCards or JDCards, when building SelfProfile or MarketProfile, the system should apply the same Taxonomy normalization rules, mapping aliases to standard names consistently across both profiles.
**Validates: Requirements 7.1, 8.2, 13.1, 13.4**

**Property 19: Skill scoring with time decay**
*For any* skill appearing in multiple NoteCards, the aggregated skill score in SelfProfile should reflect weighted contributions based on note type, skill level, and time decay, with more recent activities weighted higher.
**Validates: Requirements 7.2**

**Property 20: Profile serialization round-trip**
*For any* SelfProfile or MarketProfile, serializing to JSON and then deserializing should produce an equivalent profile object with all fields preserved.
**Validates: Requirements 7.5, 8.5**

**Property 21: Analysis view compression**
*For any* SelfProfile with N skills and M projects, the generated analysis_view should contain exactly the top N skills (by score) and the most recent M projects (by date), providing a compressed representation for LLM context.
**Validates: Requirements 9.2**

**Property 22: Atomic file writes**
*For any* file write operation, the system should write to a temporary file first and then atomically rename it to the target path, ensuring that the target file is never left in a partially written state.
**Validates: Requirements 14.1**

**Property 23: Backup before overwrite**
*For any* existing card file being updated, the system should create a backup copy before writing the new content, allowing recovery in case of corruption.
**Validates: Requirements 14.2**

**Property 24: Dry-run isolation**
*For any* indexing operation in dry-run mode, the system should process the specified number of notes and display results, but should not write any card files to disk or modify any existing index data.
**Validates: Requirements 15.1, 15.3**

## Error Handling

### Error Categories

1. **LLM Errors**
   - Network failures: Retry with exponential backoff
   - Rate limiting: Respect retry-after headers, apply throttling
   - Invalid responses: Apply JSON cleaning, retry if validation fails
   - Timeout: Configurable timeout per request

2. **File System Errors**
   - Read failures: Log error, skip file, continue processing
   - Write failures: Retry atomic write, restore from backup if available
   - Corruption: Attempt regeneration from source, log if unsuccessful
   - Permission errors: Log error, notify user

3. **Schema Validation Errors**
   - Version mismatch: Attempt automatic migration
   - Invalid structure: Retry LLM extraction, log if persistent
   - Missing required fields: Use default values where safe, otherwise fail

4. **User Input Errors**
   - Invalid configuration: Validate on save, show clear error messages
   - Missing API keys: Detect before LLM calls, prompt user
   - Invalid paths: Validate directory selections, show warnings

### Error Recovery Strategies

1. **Graceful Degradation**
   - If a single note extraction fails, continue with others
   - If profile building fails, use cached version if available
   - If LLM is unavailable, queue operations for later

2. **User Notification**
   - Show error counts in dashboard
   - Provide "View Error Log" button
   - Display actionable error messages

3. **Automatic Recovery**
   - Retry transient failures automatically
   - Regenerate corrupted cards from source notes
   - Restore from backups when available

4. **Logging**
   - All errors logged to `error_log.md` with timestamps
   - Include context: file path, operation type, error details
   - Structured format for easy parsing

## Testing Strategy

### Unit Testing

Unit tests will verify specific functionality of individual components:

1. **Utility Functions**
   - Hash calculation correctness
   - JSON cleaning edge cases
   - Time decay calculation
   - Skill normalization logic

2. **Schema Validation**
   - Valid data passes validation
   - Invalid data fails with clear errors
   - Migration functions preserve data

3. **File Operations**
   - Atomic writes work correctly
   - Backups are created
   - Restoration works

4. **PII Filtering**
   - Known PII patterns are removed
   - Non-PII content is preserved
   - Edge cases (partial matches) handled

### Property-Based Testing

Property-based tests will verify universal properties across many randomly generated inputs. The testing framework will be **fast-check** for TypeScript, configured to run a minimum of 100 iterations per property.

Each property-based test must be tagged with a comment explicitly referencing the correctness property from this design document using the format: `**Feature: career-os, Property {number}: {property_text}**`

1. **Data Extraction Properties**
   - Property 1: Skill name preservation
   - Property 2: Preference extraction conservatism
   - Property 3: Content hash consistency
   - Property 4: Empty value fallback

2. **State Management Properties**
   - Property 5: Incremental update correctness
   - Property 6: File operation state consistency
   - Property 16: Schema version migration
   - Property 20: Profile serialization round-trip

3. **Configuration Properties**
   - Property 7: Configuration-based LLM routing
   - Property 8: PII filtering for external LLMs
   - Property 9: Directory and tag exclusion

4. **Concurrency Properties**
   - Property 10: Concurrency control
   - Property 12: Pause and resume consistency

5. **Error Handling Properties**
   - Property 13: Error logging and continuation
   - Property 14: JSON cleaning and validation
   - Property 15: Schema validation retry

6. **Business Logic Properties**
   - Property 17: JD deduplication by hash
   - Property 18: Skill normalization consistency
   - Property 19: Skill scoring with time decay
   - Property 21: Analysis view compression

7. **File Safety Properties**
   - Property 22: Atomic file writes
   - Property 23: Backup before overwrite
   - Property 24: Dry-run isolation

### Integration Testing

Integration tests will verify end-to-end workflows:

1. **Cold Start Flow**
   - Create test vault with sample notes
   - Run cold start indexing
   - Verify all cards created correctly
   - Verify SelfProfile generated

2. **Incremental Update Flow**
   - Modify a note
   - Verify card updated
   - Verify profile reflects changes

3. **Market Analysis Flow**
   - Add JD note
   - Extract JDCards
   - Build MarketProfile
   - Verify aggregation correct

4. **Gap Analysis Flow**
   - Generate SelfProfile and MarketProfile
   - Run gap analysis
   - Verify report generated
   - Verify plan generated

### Testing Tools and Configuration

- **Framework**: fast-check for property-based testing, Jest for unit tests
- **Iterations**: Minimum 100 iterations per property test
- **Coverage**: Aim for >80% code coverage
- **Mocking**: Minimize mocking; use real file system operations in test directories
- **LLM Mocking**: Mock LLM responses for deterministic testing

### Test Data Strategy

1. **Synthetic Notes**: Generate notes with known properties for validation
2. **Real-World Samples**: Include anonymized real notes for realistic testing
3. **Edge Cases**: Empty notes, very long notes, special characters, malformed content
4. **Adversarial Inputs**: Intentionally malformed JSON, invalid schemas, corrupted files

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- Plugin skeleton and settings
- Type definitions and schemas
- LLM client with basic retry
- File service with atomic writes
- Basic queue manager

### Phase 2: Core Extraction (Week 3-4)
- ProfileEngine with cold start
- NoteCard extraction and validation
- Incremental update handling
- IndexStore with versioning
- Error logging

### Phase 3: UI and Dashboard (Week 5)
- React dashboard view
- Progress indicators
- Error display
- Basic profile visualization

### Phase 4: Market Analysis (Week 6-7)
- MarketScanner implementation
- JDCard extraction
- MarketProfile building
- Taxonomy management

### Phase 5: Strategy and Planning (Week 8-9)
- StrategyCore implementation
- Gap analysis
- Plan generation
- Dashboard integration

### Phase 6: Polish and Testing (Week 10)
- Comprehensive testing
- Performance optimization
- Documentation
- Bug fixes

## Performance Considerations

### Optimization Strategies

1. **Lazy Loading**
   - Load cards on demand rather than all at once
   - Cache frequently accessed profiles

2. **Incremental Processing**
   - Only process changed notes
   - Debounce rapid file changes

3. **Batch Operations**
   - Group LLM requests when possible
   - Batch file writes

4. **Memory Management**
   - Stream large files
   - Clear caches periodically
   - Limit queue size

### Scalability Targets

- Support vaults with 1000+ notes
- Cold start indexing: <5 minutes for 100 notes
- Incremental update: <2 seconds per note
- Profile building: <10 seconds for 500 cards
- Dashboard load: <1 second

## Security and Privacy

### Privacy Protection Layers

1. **Local-First Architecture**
   - All data stored locally by default
   - No telemetry or analytics

2. **PII Filtering**
   - Regex-based filtering for common PII patterns
   - Configurable custom patterns
   - Applied before external LLM calls

3. **Exclusion Controls**
   - Directory-level exclusions
   - Tag-based exclusions
   - Manual review before sending sensitive content

4. **Transparent Configuration**
   - Clear labeling of external vs local LLM options
   - Warnings when data will be sent externally
   - Audit log of external API calls (optional)

### Data Security

1. **File Permissions**
   - Respect Obsidian vault permissions
   - No modification of original notes (except frontmatter)

2. **Backup Strategy**
   - Automatic backups before overwrites
   - Configurable backup retention

3. **API Key Management**
   - Stored in Obsidian settings (encrypted by Obsidian)
   - Never logged or transmitted except to configured endpoints

## Future Enhancements

### Phase 6+ (Post-MVP)

1. **TaskBridge**
   - Task extraction from plans
   - Integration with daily notes
   - Completion feedback loop

2. **RAG Enhancement**
   - Embedding-based retrieval
   - Semantic skill matching
   - Context-aware gap analysis

3. **Advanced Analytics**
   - Skill growth tracking over time
   - Market trend analysis
   - Personalized recommendations

4. **Collaboration Features**
   - Export anonymized profiles
   - Share market insights
   - Community taxonomy

5. **Multi-Language Support**
   - Internationalization of UI
   - Multi-language note processing
   - Cross-language skill mapping
