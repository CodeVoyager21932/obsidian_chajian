/**
 * StrategyCore - Gap analysis and action plan generation
 * 
 * Responsible for:
 * - Loading compressed SelfProfile analysis_view and target MarketProfile
 * - Constructing prompt with top N skills, recent M projects, and market demands
 * - Calling high-quality LLM (analyze role) with PROMPT 3
 * - Parsing Markdown report with match percentages, strengths, and gaps
 * - Saving gap analysis report to mapping directory with frontmatter metadata
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */

import { App, normalizePath } from 'obsidian';
import {
  SelfProfile,
  MarketProfile,
  GapAnalysis,
  Gap,
  GapPriority,
  PlanConstraints,
  CareerOSSettings,
  SkillProfile,
  SkillDemand,
} from './types';
import { GapAnalysisSchema, CURRENT_SCHEMA_VERSION } from './schema';
import { LLMClient } from './llmClient';
import { IndexStore } from './IndexStore';
import { PromptStore, getPlanPrompt } from './PromptStore';
import { FileService } from './fs';

// ============================================================================
// Types
// ============================================================================

export interface AnalyzeGapResult {
  success: boolean;
  gapAnalysis?: GapAnalysis;
  error?: string;
}

export interface GeneratePlanResult {
  success: boolean;
  planPath?: string;
  error?: string;
}

/**
 * Parsed gap analysis data from LLM response
 */
interface ParsedGapAnalysis {
  matchPercentage: number;
  strengths: string[];
  gaps: Gap[];
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate match percentage between self profile and market profile
 * 
 * Formula:
 * - Skill coverage rate = user skills count / market required skills count
 * - Proficiency match = user skill avg level / market avg demand
 * - Overall match = (coverage * 0.6 + proficiency * 0.4) * 100%
 */
function calculateMatchPercentage(
  selfSkills: SkillProfile[],
  marketDemands: SkillDemand[]
): number {
  if (marketDemands.length === 0) {
    return 100; // No market demands means full match
  }

  // Create a map of user skills for quick lookup
  const userSkillMap = new Map<string, SkillProfile>();
  for (const skill of selfSkills) {
    userSkillMap.set(skill.name.toLowerCase(), skill);
  }

  // Calculate skill coverage
  let matchedSkills = 0;
  let totalProficiencyMatch = 0;
  const maxDemand = Math.max(...marketDemands.map(d => d.frequency));

  for (const demand of marketDemands) {
    const userSkill = userSkillMap.get(demand.name.toLowerCase());
    if (userSkill) {
      matchedSkills++;
      // Normalize demand frequency to 0-5 scale for comparison
      const normalizedDemand = (demand.frequency / maxDemand) * 5;
      const proficiencyRatio = Math.min(userSkill.level / normalizedDemand, 1);
      totalProficiencyMatch += proficiencyRatio;
    }
  }

  const coverageRate = matchedSkills / marketDemands.length;
  const avgProficiencyMatch = matchedSkills > 0 
    ? totalProficiencyMatch / matchedSkills 
    : 0;

  // Overall match = coverage * 0.6 + proficiency * 0.4
  const overallMatch = (coverageRate * 0.6 + avgProficiencyMatch * 0.4) * 100;

  return Math.round(overallMatch * 10) / 10; // Round to 1 decimal place
}

/**
 * Identify strengths (skills that exceed market demands)
 */
function identifyStrengths(
  selfSkills: SkillProfile[],
  marketDemands: SkillDemand[]
): string[] {
  const strengths: string[] = [];
  
  // Create a map of market demands for quick lookup
  const demandMap = new Map<string, SkillDemand>();
  const maxDemand = Math.max(...marketDemands.map(d => d.frequency), 1);
  
  for (const demand of marketDemands) {
    demandMap.set(demand.name.toLowerCase(), demand);
  }

  // Find skills that exceed market expectations
  for (const skill of selfSkills) {
    const demand = demandMap.get(skill.name.toLowerCase());
    if (demand) {
      // Normalize demand to 0-5 scale
      const normalizedDemand = (demand.frequency / maxDemand) * 5;
      if (skill.level >= normalizedDemand * 0.8) {
        strengths.push(skill.name);
      }
    } else if (skill.level >= 3) {
      // High-level skills not in market demands are also strengths
      strengths.push(`${skill.name} (独特优势)`);
    }
  }

  return strengths.slice(0, 10); // Limit to top 10 strengths
}

/**
 * Identify gaps (skills that need improvement)
 */
function identifyGaps(
  selfSkills: SkillProfile[],
  marketDemands: SkillDemand[]
): Gap[] {
  const gaps: Gap[] = [];
  
  // Create a map of user skills for quick lookup
  const userSkillMap = new Map<string, SkillProfile>();
  for (const skill of selfSkills) {
    userSkillMap.set(skill.name.toLowerCase(), skill);
  }

  const maxDemand = Math.max(...marketDemands.map(d => d.frequency), 1);

  for (const demand of marketDemands) {
    const userSkill = userSkillMap.get(demand.name.toLowerCase());
    const currentLevel = userSkill?.level || 0;
    
    // Normalize demand to 0-5 scale
    const normalizedDemand = (demand.frequency / maxDemand) * 5;
    
    // If user level is below 80% of market demand, it's a gap
    if (currentLevel < normalizedDemand * 0.8) {
      // Determine priority based on market demand frequency
      let priority: GapPriority;
      if (demand.frequency >= maxDemand * 0.7) {
        priority = 'high';
      } else if (demand.frequency >= maxDemand * 0.4) {
        priority = 'medium';
      } else {
        priority = 'low';
      }

      gaps.push({
        skillName: demand.name,
        marketDemand: demand.frequency,
        currentLevel,
        priority,
      });
    }
  }

  // Sort by priority (high > medium > low) and then by market demand
  const priorityOrder: Record<GapPriority, number> = { high: 0, medium: 1, low: 2 };
  gaps.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.marketDemand - a.marketDemand;
  });

  return gaps;
}

/**
 * Parse match percentage from LLM response
 */
function parseMatchPercentage(content: string): number | null {
  // Look for patterns like "整体匹配度：XX%" or "Overall match: XX%"
  const patterns = [
    /整体匹配度[：:]\s*(\d+(?:\.\d+)?)\s*%/,
    /匹配度[：:]\s*(\d+(?:\.\d+)?)\s*%/,
    /Overall match[：:]?\s*(\d+(?:\.\d+)?)\s*%/i,
    /Match[：:]?\s*(\d+(?:\.\d+)?)\s*%/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return parseFloat(match[1]);
    }
  }

  return null;
}

/**
 * Parse strengths from LLM response
 */
function parseStrengths(content: string): string[] {
  const strengths: string[] = [];
  
  // Look for strengths section
  const strengthsSection = content.match(/###?\s*优势分析[\s\S]*?(?=###?\s|$)/i) ||
                          content.match(/###?\s*Strengths[\s\S]*?(?=###?\s|$)/i) ||
                          content.match(/###?\s*核心技能匹配[\s\S]*?(?=###?\s|$)/i);
  
  if (strengthsSection) {
    // Extract bullet points
    const bulletMatches = strengthsSection[0].matchAll(/[-*]\s+(.+)/g);
    for (const match of bulletMatches) {
      const strength = match[1].trim();
      if (strength && !strength.includes('|')) { // Exclude table rows
        strengths.push(strength);
      }
    }
  }

  return strengths.slice(0, 10);
}

/**
 * Parse gaps from LLM response
 */
function parseGapsFromContent(content: string): Gap[] {
  const gaps: Gap[] = [];
  
  // Look for gaps section or table
  const gapsSection = content.match(/###?\s*差距分析[\s\S]*?(?=##\s|$)/i) ||
                     content.match(/###?\s*关键差距[\s\S]*?(?=##\s|$)/i) ||
                     content.match(/###?\s*Gaps[\s\S]*?(?=##\s|$)/i);
  
  if (gapsSection) {
    // Try to parse table format
    const tableRows = gapsSection[0].matchAll(/\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*(高|中|低|high|medium|low)\s*\|/gi);
    
    for (const row of tableRows) {
      const skillName = row[1].trim();
      if (skillName && !skillName.includes('---') && skillName !== '技能') {
        const marketDemand = parseFloat(row[2]) || 0;
        const currentLevel = parseFloat(row[3]) || 0;
        let priority: GapPriority = 'medium';
        
        const priorityStr = row[4].toLowerCase().trim();
        if (priorityStr === '高' || priorityStr === 'high') {
          priority = 'high';
        } else if (priorityStr === '低' || priorityStr === 'low') {
          priority = 'low';
        }

        gaps.push({
          skillName,
          marketDemand,
          currentLevel,
          priority,
        });
      }
    }

    // If no table found, try bullet points
    if (gaps.length === 0) {
      const bulletMatches = gapsSection[0].matchAll(/[-*]\s+\*?\*?([^*\n]+)\*?\*?/g);
      for (const match of bulletMatches) {
        const skillName = match[1].trim();
        if (skillName && !skillName.includes('|')) {
          gaps.push({
            skillName,
            marketDemand: 0,
            currentLevel: 0,
            priority: 'medium',
          });
        }
      }
    }
  }

  return gaps;
}

// ============================================================================
// StrategyCore Class
// ============================================================================

export class StrategyCore {
  private llmClient: LLMClient;
  private indexStore: IndexStore;
  private promptStore: PromptStore;
  private fileService: FileService;
  private settings: CareerOSSettings;

  constructor(
    private app: App,
    settings: CareerOSSettings,
    llmClient: LLMClient,
    indexStore: IndexStore,
    promptStore: PromptStore,
    pluginDataDir: string
  ) {
    this.settings = settings;
    this.llmClient = llmClient;
    this.indexStore = indexStore;
    this.promptStore = promptStore;
    this.fileService = new FileService(app, pluginDataDir);
  }

  /**
   * Update settings (e.g., when user changes configuration)
   */
  updateSettings(settings: CareerOSSettings): void {
    this.settings = settings;
    this.llmClient.updateSettings(settings);
  }

  // ============================================================================
  // Gap Analysis
  // Requirements: 9.1, 9.2, 9.3, 9.4
  // ============================================================================

  /**
   * Generate gap analysis between self and market profiles
   * 
   * Requirements:
   * - 9.1: Load compressed SelfProfile analysis_view and target MarketProfile
   * - 9.2: Include only top N skills, recent M projects, and high-frequency preferences
   * - 9.3: Receive Markdown report with match percentages, strengths, and gaps
   * - 9.4: Save report to mapping directory with metadata in frontmatter
   * 
   * @param selfProfile - User's self profile
   * @param marketProfile - Target market profile
   * @returns Gap analysis result
   */
  async analyzeGap(
    selfProfile: SelfProfile,
    marketProfile: MarketProfile
  ): Promise<AnalyzeGapResult> {
    try {
      // Requirement 9.1: Load compressed analysis_view
      const analysisView = selfProfile.analysis_view;
      if (!analysisView) {
        return {
          success: false,
          error: 'SelfProfile does not have analysis_view. Please rebuild the profile.',
        };
      }

      // Calculate initial gap analysis locally (for validation)
      const localMatchPercentage = calculateMatchPercentage(
        analysisView.top_skills,
        marketProfile.skills_demand
      );
      const localStrengths = identifyStrengths(
        analysisView.top_skills,
        marketProfile.skills_demand
      );
      const localGaps = identifyGaps(
        analysisView.top_skills,
        marketProfile.skills_demand
      );

      // Requirement 9.2: Prepare compressed data for LLM
      // Only include top N skills, recent M projects, and high-frequency preferences
      const compressedSelfProfile = JSON.stringify({
        top_skills: analysisView.top_skills.map(s => ({
          name: s.name,
          level: s.level,
          category: s.category,
        })),
        recent_projects: analysisView.recent_projects.map(p => ({
          summary: p.summary,
          tech_stack: p.tech_stack.map(t => t.name),
          time_span: p.time_span,
        })),
        preferences: {
          likes: selfProfile.preferences.likes.slice(0, 5),
          dislikes: selfProfile.preferences.dislikes.slice(0, 3),
        },
      }, null, 2);

      const compressedMarketProfile = JSON.stringify({
        role: marketProfile.role,
        location: marketProfile.location,
        top_skills_demand: marketProfile.skills_demand.slice(0, 15).map(s => ({
          name: s.name,
          frequency: s.frequency,
        })),
        experience_distribution: marketProfile.experience_distribution,
        soft_requirements: marketProfile.soft_requirements.slice(0, 5),
      }, null, 2);

      // Build prompt for LLM
      const prompt = await getPlanPrompt(
        this.promptStore,
        compressedSelfProfile,
        compressedMarketProfile,
        marketProfile.role,
        marketProfile.location,
        3, // Default 3 months for gap analysis
        10 // Default 10 hours/week
      );

      // Requirement 9.3: Call LLM (analyze role) to generate report
      console.log('Calling LLM for gap analysis...');
      const llmResponse = await this.llmClient.call('analyze', prompt);

      // Parse LLM response for structured data
      const parsedMatchPercentage = parseMatchPercentage(llmResponse);
      const parsedStrengths = parseStrengths(llmResponse);
      const parsedGaps = parseGapsFromContent(llmResponse);

      // Use LLM-parsed values if available, otherwise use local calculations
      const finalMatchPercentage = parsedMatchPercentage ?? localMatchPercentage;
      const finalStrengths = parsedStrengths.length > 0 ? parsedStrengths : localStrengths;
      const finalGaps = parsedGaps.length > 0 ? parsedGaps : localGaps;

      // Requirement 9.4: Save report to mapping directory with frontmatter
      const timestamp = new Date().toISOString();
      const dateStr = timestamp.split('T')[0];
      const reportFilename = `gap_analysis_${marketProfile.role.replace(/\s+/g, '_')}_${marketProfile.location}_${dateStr}.md`;
      const reportPath = `${this.settings.mappingDirectory}/${reportFilename}`;

      // Build report with frontmatter
      const reportContent = this.buildGapAnalysisReport(
        llmResponse,
        finalMatchPercentage,
        finalStrengths,
        finalGaps,
        selfProfile,
        marketProfile,
        timestamp
      );

      // Save report
      await this.saveReport(reportPath, reportContent);

      // Build GapAnalysis result
      const gapAnalysis: GapAnalysis = {
        matchPercentage: finalMatchPercentage,
        strengths: finalStrengths,
        gaps: finalGaps,
        reportPath,
      };

      console.log(`Gap analysis completed: ${finalMatchPercentage}% match, ${finalGaps.length} gaps identified`);

      return {
        success: true,
        gapAnalysis,
      };
    } catch (error) {
      console.error('Gap analysis failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Build gap analysis report with frontmatter
   */
  private buildGapAnalysisReport(
    llmResponse: string,
    matchPercentage: number,
    strengths: string[],
    gaps: Gap[],
    selfProfile: SelfProfile,
    marketProfile: MarketProfile,
    timestamp: string
  ): string {
    const dateStr = timestamp.split('T')[0];
    
    // Build frontmatter
    const frontmatter = `---
type: gap_analysis
target_role: "${marketProfile.role}"
target_location: "${marketProfile.location}"
match_percentage: ${matchPercentage}
strengths_count: ${strengths.length}
gaps_count: ${gaps.length}
generated_at: "${timestamp}"
source_self_profile: "self_profile_${dateStr}.json"
source_market_profile: "market_${marketProfile.role.toLowerCase().replace(/\s+/g, '_')}_${marketProfile.location.toLowerCase()}_${dateStr}.json"
schema_version: ${CURRENT_SCHEMA_VERSION}
---

`;

    // Build summary section
    const summary = `# Gap Analysis Summary

## Overview
- **Target Role**: ${marketProfile.role}
- **Target Location**: ${marketProfile.location}
- **Match Percentage**: ${matchPercentage}%
- **Generated**: ${timestamp}

## Quick Stats
- **Strengths Identified**: ${strengths.length}
- **Gaps Identified**: ${gaps.length}
- **High Priority Gaps**: ${gaps.filter(g => g.priority === 'high').length}

---

`;

    // Combine with LLM response
    return frontmatter + summary + llmResponse;
  }

  /**
   * Save report to file
   */
  private async saveReport(reportPath: string, content: string): Promise<void> {
    const normalizedPath = normalizePath(reportPath);
    
    // Ensure parent directory exists
    const parentPath = normalizedPath.split('/').slice(0, -1).join('/');
    if (parentPath) {
      const parentDir = this.app.vault.getAbstractFileByPath(parentPath);
      if (!parentDir) {
        await this.app.vault.createFolder(parentPath);
      }
    }

    // Write or update file
    const existingFile = this.app.vault.getAbstractFileByPath(normalizedPath);
    if (existingFile) {
      await this.app.vault.modify(existingFile as any, content);
    } else {
      await this.app.vault.create(normalizedPath, content);
    }
  }

  // ============================================================================
  // Action Plan Generation (Placeholder for Task 14)
  // ============================================================================

  /**
   * Generate action plan based on gap analysis
   * 
   * Note: This is a placeholder for Task 14. Full implementation will be done
   * when that task is executed.
   * 
   * @param gapAnalysis - Gap analysis result
   * @param constraints - User constraints for plan generation
   * @returns Plan generation result
   */
  async generatePlan(
    gapAnalysis: GapAnalysis,
    constraints: PlanConstraints
  ): Promise<GeneratePlanResult> {
    // Placeholder - will be implemented in Task 14
    return {
      success: false,
      error: 'Action plan generation not yet implemented. See Task 14.',
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Factory function to create a StrategyCore instance
 */
export function createStrategyCore(
  app: App,
  settings: CareerOSSettings,
  llmClient: LLMClient,
  indexStore: IndexStore,
  promptStore: PromptStore,
  pluginDataDir: string
): StrategyCore {
  return new StrategyCore(
    app,
    settings,
    llmClient,
    indexStore,
    promptStore,
    pluginDataDir
  );
}
