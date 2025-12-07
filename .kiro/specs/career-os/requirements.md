# Requirements Document

## Introduction

CareerOS 是一个 Obsidian 插件，旨在构建一套「职业规划操作系统」。该系统通过分析用户在 Obsidian 中积累的笔记（项目、课程、反思等）和市场招聘信息（JD），自动生成能力画像、市场画像、差距分析和可执行的行动计划。所有数据处理优先在本地完成，支持本地 LLM，确保用户隐私安全。

## Glossary

- **CareerOS**: 职业规划操作系统插件
- **NoteCard**: 从单篇自我笔记中提取的结构化卡片，包含技能、项目、偏好等信息
- **JDCard**: 从招聘信息中提取的结构化岗位卡片
- **SelfProfile**: 聚合所有 NoteCard 生成的自我能力画像
- **MarketProfile**: 聚合 JDCard 生成的市场需求画像
- **LLM**: Large Language Model，大语言模型
- **PII**: Personally Identifiable Information，个人身份信息
- **Vault**: Obsidian 笔记库
- **Taxonomy**: 技能标准化分类体系

## Requirements

### Requirement 1

**User Story:** 作为用户，我希望系统能从我的项目笔记中提取技能和经验信息，以便自动构建我的能力画像

#### Acceptance Criteria

1. WHEN the system processes a project note THEN the CareerOS SHALL extract technical skills with proficiency levels and usage context
2. WHEN the system extracts skills from notes THEN the CareerOS SHALL preserve the original skill names without normalization at the NoteCard level
3. WHEN the system encounters reflection or journal notes THEN the CareerOS SHALL extract preferences only when explicitly stated in the text
4. WHEN the system generates a NoteCard THEN the CareerOS SHALL include a content hash for change detection
5. WHEN the system cannot infer a field value from the note THEN the CareerOS SHALL use appropriate empty values instead of guessing

### Requirement 2

**User Story:** 作为用户，我希望系统能够增量更新笔记索引，以便在修改笔记后自动同步能力画像

#### Acceptance Criteria

1. WHEN a user saves a monitored note file THEN the CareerOS SHALL calculate the content hash and compare it with the existing NoteCard
2. WHEN the content hash differs from the stored hash THEN the CareerOS SHALL add the note to the LLM processing queue for re-extraction
3. WHEN a user renames or moves a note file THEN the CareerOS SHALL update the corresponding NoteCard path and relocate the card file
4. WHEN a user deletes a note file THEN the CareerOS SHALL mark the corresponding NoteCard as deleted without physically removing the card file
5. WHEN the system detects a corrupted card file THEN the CareerOS SHALL attempt to regenerate it from the source note and log the error

### Requirement 3

**User Story:** 作为用户，我希望系统支持本地 LLM 和隐私保护，以便在不泄露个人信息的情况下使用该功能

#### Acceptance Criteria

1. WHEN a user configures a local LLM base URL THEN the CareerOS SHALL route NoteCard and JDCard extraction requests to the local endpoint
2. WHEN the system sends content to an external LLM THEN the CareerOS SHALL apply PII filtering to remove phone numbers, emails, and specific person names
3. WHEN a user excludes certain directories or tags in settings THEN the CareerOS SHALL skip those notes during any LLM processing
4. WHEN the system stores NoteCard or JDCard data THEN the CareerOS SHALL save all files locally within the plugin data directory
5. WHEN the settings display external LLM options THEN the CareerOS SHALL clearly indicate that content will be sent to external APIs

### Requirement 4

**User Story:** 作为用户，我希望系统能够批量处理大量笔记，以便在首次使用时快速建立能力画像索引

#### Acceptance Criteria

1. WHEN a user initiates a cold start indexing THEN the CareerOS SHALL scan the selected directories and build a task queue for all unindexed notes
2. WHEN the task queue processes LLM requests THEN the CareerOS SHALL limit concurrent requests to a configurable maximum number
3. WHEN the indexing process is running THEN the CareerOS SHALL display a progress indicator showing completed and total tasks
4. WHEN a user pauses the indexing process THEN the CareerOS SHALL stop processing new tasks and allow resumption from the current position
5. WHEN an LLM extraction fails after maximum retries THEN the CareerOS SHALL log the error to an error log file and continue processing remaining tasks

### Requirement 5

**User Story:** 作为用户，我希望系统能够验证 LLM 输出的 JSON 格式，以便确保数据质量和系统稳定性

#### Acceptance Criteria

1. WHEN the system receives LLM output THEN the CareerOS SHALL apply a JSON cleaner to remove extraneous text and extract valid JSON
2. WHEN the cleaned JSON is obtained THEN the CareerOS SHALL validate it against the corresponding Zod schema
3. WHEN schema validation fails THEN the CareerOS SHALL retry the LLM request up to a configurable maximum number of times
4. WHEN all retry attempts are exhausted THEN the CareerOS SHALL record the failure in the error log with the note path and error details
5. WHEN a NoteCard or JDCard file is read THEN the CareerOS SHALL validate the schema version and perform migration if necessary

### Requirement 6

**User Story:** 作为用户，我希望系统能够从招聘信息中提取岗位要求，以便了解市场对目标岗位的需求

#### Acceptance Criteria

1. WHEN a user executes the JD extraction command on a market note THEN the CareerOS SHALL send the entire note content to the LLM with the JD extraction prompt
2. WHEN the LLM returns JD data THEN the CareerOS SHALL parse it as an array of JDCard objects
3. WHEN the system processes each JD element THEN the CareerOS SHALL calculate a raw text hash and check for existing JDCards with the same hash
4. WHEN a matching hash is found THEN the CareerOS SHALL update the existing JDCard and preserve its original jd_id
5. WHEN no matching hash is found THEN the CareerOS SHALL create a new JDCard with a generated UUID and creation timestamp

### Requirement 7

**User Story:** 作为用户，我希望系统能够聚合我的技能数据并生成自我画像，以便全面了解自己的能力状况

#### Acceptance Criteria

1. WHEN the system builds a SelfProfile THEN the CareerOS SHALL aggregate all non-deleted NoteCards and normalize skill names using the Taxonomy
2. WHEN calculating skill proficiency scores THEN the CareerOS SHALL apply weights based on note type, skill level, and time decay
3. WHEN aggregating preferences THEN the CareerOS SHALL prioritize reflection-type NoteCards and rank by frequency
4. WHEN generating the SelfProfile THEN the CareerOS SHALL create both a detailed view and a compressed analysis view with top N skills and recent M projects
5. WHEN the SelfProfile is complete THEN the CareerOS SHALL save it as both JSON and Markdown formats in the mapping directory

### Requirement 8

**User Story:** 作为用户，我希望系统能够聚合市场招聘数据并生成市场画像，以便了解目标岗位的共识要求

#### Acceptance Criteria

1. WHEN the system builds a MarketProfile THEN the CareerOS SHALL filter JDCards by specified role and location
2. WHEN calculating skill demand THEN the CareerOS SHALL normalize skill names using the Taxonomy and compute frequency statistics
3. WHEN aggregating experience requirements THEN the CareerOS SHALL extract and summarize the distribution of experience levels
4. WHEN the MarketProfile is complete THEN the CareerOS SHALL include sample JD IDs for reference
5. WHEN saving the MarketProfile THEN the CareerOS SHALL write both JSON and Markdown formats with a schema version

### Requirement 9

**User Story:** 作为用户，我希望系统能够对比自我画像和市场画像，以便识别我的优势和短板

#### Acceptance Criteria

1. WHEN a user initiates gap analysis THEN the CareerOS SHALL load the compressed SelfProfile analysis view and the target MarketProfile
2. WHEN sending data to the LLM THEN the CareerOS SHALL include only top N skills, recent M projects, and high-frequency preferences to control token usage
3. WHEN the LLM generates the analysis THEN the CareerOS SHALL receive a Markdown report containing match percentages, strengths, and gaps
4. WHEN the analysis is complete THEN the CareerOS SHALL save the report to the mapping directory with metadata in frontmatter
5. WHEN multiple analyses exist THEN the CareerOS SHALL display a list of recent analyses in the dashboard

### Requirement 10

**User Story:** 作为用户，我希望系统能够基于差距分析生成可执行的行动计划，以便有针对性地提升能力

#### Acceptance Criteria

1. WHEN a user requests an action plan THEN the CareerOS SHALL prompt for target role, location, time period, and weekly available hours
2. WHEN generating the plan THEN the CareerOS SHALL send the compressed SelfProfile, MarketProfile, and user constraints to a high-quality LLM
3. WHEN the LLM returns the plan THEN the CareerOS SHALL receive a Markdown document with phased goals and weekly task checklists
4. WHEN saving the plan THEN the CareerOS SHALL include metadata in frontmatter such as role, period, weekly hours, and generation timestamp
5. WHEN the plan is displayed in the dashboard THEN the CareerOS SHALL show a summary with match scores and key gaps

### Requirement 11

**User Story:** 作为用户，我希望系统提供一个可视化面板，以便集中查看能力画像、市场画像和行动计划

#### Acceptance Criteria

1. WHEN a user opens the CareerOS dashboard THEN the system SHALL display top N skills with proficiency levels and evidence counts
2. WHEN the dashboard loads THEN the system SHALL show recent M projects from the SelfProfile
3. WHEN indexing errors exist THEN the system SHALL display an error summary with a count and a button to view the error log
4. WHEN the user clicks the refresh button THEN the system SHALL trigger a rebuild of the SelfProfile and update the display
5. WHEN the dashboard shows the guided workflow THEN the system SHALL indicate completion status for self-profile, market-profile, and action plan steps

### Requirement 12

**User Story:** 作为用户，我希望系统支持多种 LLM 提供商和模型配置，以便根据任务类型选择合适的模型并控制成本

#### Acceptance Criteria

1. WHEN a user configures LLM settings THEN the CareerOS SHALL allow separate model selections for extract, analyze, and embedding roles
2. WHEN the system performs NoteCard or JDCard extraction THEN the CareerOS SHALL use the model configured for the extract role
3. WHEN the system performs gap analysis or plan generation THEN the CareerOS SHALL use the model configured for the analyze role
4. WHEN a user specifies a proxy or custom base URL THEN the CareerOS SHALL route all requests through the specified endpoint
5. WHEN the system calls an LLM THEN the CareerOS SHALL apply the configured retry count, timeout, and rate limiting settings

### Requirement 13

**User Story:** 作为用户，我希望系统能够标准化技能名称，以便准确聚合和比较不同笔记中的相同技能

#### Acceptance Criteria

1. WHEN the system builds a SelfProfile THEN the CareerOS SHALL apply the Taxonomy to map skill aliases to standard names
2. WHEN a skill name cannot be matched in the Taxonomy THEN the CareerOS SHALL retain the original name and optionally flag it for manual review
3. WHEN the user updates the Taxonomy THEN the CareerOS SHALL allow adding new skill aliases through the settings interface
4. WHEN normalizing skills in MarketProfile THEN the CareerOS SHALL apply the same Taxonomy mapping as used for SelfProfile
5. WHEN displaying skills in the dashboard THEN the CareerOS SHALL show the normalized standard skill names

### Requirement 14

**User Story:** 作为用户，我希望系统能够安全地读写文件，以便避免并发写入导致的数据损坏

#### Acceptance Criteria

1. WHEN the system writes a JSON file THEN the CareerOS SHALL use atomic write operations by writing to a temporary file and then renaming
2. WHEN the system writes a card file THEN the CareerOS SHALL create a backup of the existing file before overwriting
3. WHEN the system detects a file write conflict THEN the CareerOS SHALL implement a simple locking mechanism to serialize writes
4. WHEN a card file is corrupted THEN the CareerOS SHALL attempt to restore from the most recent backup
5. WHEN the system performs file operations THEN the CareerOS SHALL use a centralized FileService module for all read and write operations

### Requirement 15

**User Story:** 作为用户，我希望系统能够提供 dry-run 模式，以便在正式索引前验证提取质量

#### Acceptance Criteria

1. WHEN a user enables dry-run mode in settings THEN the CareerOS SHALL process only the first N notes specified by the user
2. WHEN dry-run mode is active THEN the CareerOS SHALL display extraction results in the developer console or a preview view
3. WHEN dry-run mode is active THEN the CareerOS SHALL not write any card files to disk
4. WHEN the user confirms extraction quality THEN the CareerOS SHALL allow switching to full indexing mode
5. WHEN dry-run completes THEN the CareerOS SHALL display a summary of extracted data for user review
