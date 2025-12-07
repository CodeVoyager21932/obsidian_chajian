# Implementation Plan

- [x] 1. Set up project structure and core type definitions





  - Create Obsidian plugin skeleton with manifest.json and main.ts
  - Define all TypeScript interfaces in types.ts (NoteCard, JDCard, SelfProfile, MarketProfile, etc.)
  - Set up Zod schemas in schema.ts with schema_version support
  - Configure TypeScript build and development environment
  - _Requirements: 1.1, 1.2, 1.4, 5.5_

- [x] 1.1 Write property test for schema validation










  - **Property 14: JSON cleaning and validation**
  - **Validates: Requirements 5.1, 5.2**

- [x] 2. Implement LLM client and queue infrastructure




  - Create llmClient.ts with multi-provider support (OpenAI, Anthropic, Local, Google)
  - Implement JSON cleaner to extract valid JSON from LLM responses
  - Add retry logic with exponential backoff
  - Build QueueManager in queue.ts with concurrency control, pause/resume, and progress tracking
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 12.1, 12.2, 12.3_

- [ ]* 2.1 Write property test for LLM routing
  - **Property 7: Configuration-based LLM routing**
  - **Validates: Requirements 3.1, 12.2, 12.3, 12.4**

- [ ]* 2.2 Write property test for concurrency control
  - **Property 10: Concurrency control**
  - **Validates: Requirements 4.2**

- [ ]* 2.3 Write property test for queue pause and resume
  - **Property 12: Pause and resume consistency**
  - **Validates: Requirements 4.4**

- [x] 3. Implement file service and index store










  - Create FileService in fs.ts with atomic write operations (write to temp, then rename)
  - Implement backup creation before file overwrites
  - Build IndexStore in IndexStore.ts for reading/writing cards with schema validation
  - Add schema version migration logic
  - Implement getCardPath() utility for consistent card file path resolution
  - _Requirements: 2.3, 5.5, 14.1, 14.2, 14.3, 14.4_

- [ ]* 3.1 Write property test for atomic writes
  - **Property 22: Atomic file writes**
  - **Validates: Requirements 14.1**

- [ ]* 3.2 Write property test for backup creation
  - **Property 23: Backup before overwrite**
  - **Validates: Requirements 14.2**

- [ ]* 3.3 Write property test for schema migration
  - **Property 16: Schema version migration**
  - **Validates: Requirements 5.5**

- [x] 4. Implement privacy guard and taxonomy





  - Create PrivacyGuard in PrivacyGuard.ts with PII filtering (email, phone, names)
  - Implement directory and tag exclusion checking
  - Build Taxonomy in Taxonomy.ts for skill name normalization
  - Add skill alias mapping and unmapped skill tracking
  - _Requirements: 3.2, 3.3, 7.1, 13.1, 13.2, 13.3_

- [ ]* 4.1 Write property test for PII filtering
  - **Property 8: PII filtering for external LLMs**
  - **Validates: Requirements 3.2**

- [ ]* 4.2 Write property test for exclusion rules
  - **Property 9: Directory and tag exclusion**
  - **Validates: Requirements 3.3**

- [ ]* 4.3 Write property test for skill normalization
  - **Property 18: Skill normalization consistency**
  - **Validates: Requirements 7.1, 8.2, 13.1, 13.4**

- [x] 5. Create prompt templates





  - Create prompts/ directory
  - Write noteCardPrompt.txt for NoteCard extraction (PROMPT 1)
  - Write jdCardPrompt.txt for JDCard extraction (PROMPT 2)
  - Write planPrompt.txt for gap analysis and plan generation (PROMPT 3)
  - Implement PromptStore utility to load and interpolate prompts
  - _Requirements: 1.1, 6.1, 9.3, 10.3_

- [x] 6. Implement ProfileEngine core extraction





  - Create ProfileEngine.ts with processNote() method
  - Implement NoteCard extraction using LLM with PROMPT 1
  - Add content hash calculation for change detection
  - Implement time parsing logic (from content, filename, file metadata)
  - Apply Zod schema validation to extracted NoteCards
  - Handle extraction failures with retry and error logging
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.2, 5.3, 5.4_

- [ ]* 6.1 Write property test for skill name preservation
  - **Property 1: Skill name preservation at NoteCard level**
  - **Validates: Requirements 1.2**

- [ ]* 6.2 Write property test for preference extraction
  - **Property 2: Preference extraction conservatism**
  - **Validates: Requirements 1.3**

- [ ]* 6.3 Write property test for content hash
  - **Property 3: Content hash consistency**
  - **Validates: Requirements 1.4**

- [ ]* 6.4 Write property test for empty value fallback
  - **Property 4: Empty value fallback**
  - **Validates: Requirements 1.5**

- [ ]* 6.5 Write property test for schema validation retry
  - **Property 15: Schema validation retry**
  - **Validates: Requirements 5.3, 5.4**

- [x] 7. Implement cold start indexing





  - Add coldStartIndex() method to ProfileEngine
  - Implement directory scanning to find all markdown files
  - Build task queue for unindexed notes (check hash against existing cards)
  - Add dry-run mode support (process N notes, display results, don't write files)
  - Integrate with QueueManager for concurrent processing
  - Display progress indicator in UI
  - _Requirements: 4.1, 4.2, 4.3, 15.1, 15.2, 15.3_

- [ ]* 7.1 Write property test for dry-run isolation
  - **Property 24: Dry-run isolation**
  - **Validates: Requirements 15.1, 15.3**

- [x] 8. Implement incremental update handling






  - Add file event listeners (onNoteSaved, onNoteRenamed, onNoteDeleted)
  - Implement hash comparison to detect content changes
  - Add notes to queue when hash differs
  - Update NoteCard paths on rename/move operations
  - Implement logical deletion (set deleted flag, don't remove file)
  - Add debouncing to prevent rapid re-indexing
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 8.1 Write property test for incremental updates

  - **Property 5: Incremental update correctness**
  - **Validates: Requirements 2.1, 2.2**

- [ ]* 8.2 Write property test for file operations
  - **Property 6: File operation state consistency**
  - **Validates: Requirements 2.3, 2.4**

- [x] 9. Implement SelfProfile building





  - Add buildSelfProfile() method to ProfileEngine
  - Read all non-deleted NoteCards from IndexStore
  - Apply Taxonomy normalization to skill names
  - Calculate skill scores with weights (note type, skill level, time decay)
  - Aggregate preferences from reflection-type notes, rank by frequency
  - Extract project summaries from project-type notes
  - Generate analysis_view with top N skills and recent M projects
  - Save SelfProfile as both JSON and Markdown
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ]* 9.1 Write property test for skill scoring
  - **Property 19: Skill scoring with time decay**
  - **Validates: Requirements 7.2**

- [ ]* 9.2 Write property test for analysis view compression
  - **Property 21: Analysis view compression**
  - **Validates: Requirements 9.2**

- [ ]* 9.3 Write property test for profile serialization
  - **Property 20: Profile serialization round-trip**
  - **Validates: Requirements 7.5, 8.5**

- [x] 10. Checkpoint - Ensure all tests pass






  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement MarketScanner for JD extraction





  - Create MarketScanner.ts with extractJDCards() method
  - Implement JD extraction using LLM with PROMPT 2
  - Parse LLM output as array of JDCard objects
  - Calculate raw_text_hash for each JD
  - Check for existing JDCards with same hash (deduplication)
  - Update existing cards (preserve jd_id) or create new cards (generate UUID)
  - Save JDCards to market_cards/ directory
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ]* 11.1 Write property test for JD deduplication
  - **Property 17: JD deduplication by hash**
  - **Validates: Requirements 6.3, 6.4, 6.5**

- [x] 12. Implement MarketProfile building





  - Add buildMarketProfile() method to MarketScanner
  - Filter JDCards by specified role and location
  - Apply Taxonomy normalization to skill names
  - Calculate skill demand frequency statistics
  - Aggregate experience and degree requirements
  - Select sample JD IDs for reference
  - Save MarketProfile as both JSON and Markdown
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 13. Implement StrategyCore for gap analysis





  - Create StrategyCore.ts with analyzeGap() method
  - Load compressed SelfProfile analysis_view and target MarketProfile
  - Construct prompt with top N skills, recent M projects, and market demands
  - Call high-quality LLM (analyze role) with PROMPT 3
  - Parse Markdown report with match percentages, strengths, and gaps
  - Save gap analysis report to mapping directory with frontmatter metadata
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 14. Implement action plan generation





  - Add generatePlan() method to StrategyCore
  - Prompt user for target role, location, period, and weekly hours
  - Send compressed profiles and constraints to LLM
  - Receive Markdown plan with phased goals and task checklists
  - Save plan with frontmatter metadata (role, period, hours, timestamps)
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [-] 15. Implement settings tab



  - Create SettingsTab.ts with configuration UI
  - Add LLM provider settings (OpenAI, Anthropic, Local, Google)
  - Add separate model configuration for extract, analyze, and embedding roles
  - Add API key inputs with secure storage
  - Add proxy and custom base URL configuration
  - Add retry count, timeout, and concurrency settings
  - Add directory and tag exclusion configuration
  - Add Taxonomy management UI (view/add skill aliases)
  - Add dry-run mode toggle
  - Display clear warnings for external LLM usage
  - _Requirements: 3.5, 12.1, 12.5, 13.3_

- [ ] 16. Implement dashboard view foundation
  - Create DashboardView.tsx with React
  - Set up DashboardContext for state management
  - Create basic layout with sections for skills, projects, and workflow
  - Add refresh button to trigger SelfProfile rebuild
  - _Requirements: 11.4_

- [ ] 17. Implement dashboard skills and projects display
  - Display top N skills with proficiency levels and evidence counts
  - Display recent M projects from SelfProfile
  - Add skill detail view (click to see evidence notes)
  - Add project detail view (click to see full summary)
  - _Requirements: 11.1, 11.2_

- [ ] 18. Implement dashboard error handling display
  - Read error_log.md and parse error entries
  - Display error count summary
  - Add "View Error Log" button to show detailed errors
  - Highlight errors by type (extraction, validation, file operation)
  - _Requirements: 11.3_

- [ ] 19. Implement dashboard guided workflow
  - Create workflow status indicators (self-profile, market-profile, plan)
  - Show completion checkmarks for completed steps
  - Add action buttons for each step (Index Notes, Extract JDs, Generate Plan)
  - Display current step with helpful guidance text
  - _Requirements: 11.5_

- [ ] 20. Implement dashboard market and plan sections
  - Display list of available MarketProfiles with role, location, JD count
  - Add button to build new MarketProfile
  - Display list of recent gap analyses and action plans
  - Show plan summaries with match scores and key gaps
  - Add "Set as Active Plan" button
  - _Requirements: 9.5, 10.5_

- [ ] 21. Implement command registry
  - Register "CareerOS: Cold Start Indexing" command
  - Register "CareerOS: Extract JD Cards from Current Note" command
  - Register "CareerOS: Build Self Profile" command
  - Register "CareerOS: Build Market Profile" command
  - Register "CareerOS: Generate Gap Analysis" command
  - Register "CareerOS: Generate Action Plan" command
  - Register "CareerOS: Open Dashboard" command
  - Register "CareerOS: View Error Log" command

- [ ] 22. Implement error logging system
  - Create logger.ts utility
  - Implement error_log.md writer with structured format
  - Add timestamp, error type, file path, and error details to each entry
  - Implement log rotation (keep last N entries or last M days)
  - Add error categorization (LLM, file system, schema, user input)
  - _Requirements: 4.5, 5.4_

- [ ]* 22.1 Write property test for error logging
  - **Property 13: Error logging and continuation**
  - **Validates: Requirements 4.5**

- [ ] 23. Add progress tracking and UI feedback
  - Implement progress bar component for indexing operations
  - Show real-time progress updates (completed/total tasks)
  - Add pause/resume/cancel buttons for long-running operations
  - Display estimated time remaining
  - Show success/failure notifications
  - _Requirements: 4.3, 4.4_

- [ ]* 23.1 Write property test for progress accuracy
  - **Property 11: Progress tracking accuracy**
  - **Validates: Requirements 4.3**

- [ ] 24. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 25. Polish and documentation
  - Add inline code comments for complex logic
  - Create README.md with setup instructions
  - Document configuration options
  - Add example prompts and expected outputs
  - Create troubleshooting guide
  - Add performance optimization notes
