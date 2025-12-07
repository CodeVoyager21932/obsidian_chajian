/**
 * PrivacyGuard - PII filtering and content exclusion
 * 
 * Validates: Requirements 3.2, 3.3
 * - Property 8: PII filtering for external LLMs
 * - Property 9: Directory and tag exclusion
 */

import { LLMProvider, ExclusionRules, PIIPattern, PIIType } from './types';

export class PrivacyGuard {
  private exclusionRules: ExclusionRules;
  private piiPatterns: PIIPattern[];
  
  constructor(exclusionRules: ExclusionRules) {
    this.exclusionRules = exclusionRules;
    this.piiPatterns = this.initializePIIPatterns();
  }
  
  /**
   * Initialize default PII patterns for filtering
   */
  private initializePIIPatterns(): PIIPattern[] {
    return [
      // Email pattern
      {
        type: 'email',
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        replacement: '[EMAIL_REDACTED]'
      },
      // Phone pattern (Chinese mobile numbers)
      {
        type: 'phone',
        pattern: /\b1[3-9]\d{9}\b/g,
        replacement: '[PHONE_REDACTED]'
      },
      // Phone pattern (international format)
      {
        type: 'phone',
        pattern: /\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g,
        replacement: '[PHONE_REDACTED]'
      },
      // Chinese ID card pattern
      {
        type: 'custom',
        pattern: /\b\d{17}[\dXx]\b/g,
        replacement: '[ID_REDACTED]'
      }
    ];
  }
  
  /**
   * Filter PII from content before sending to external LLM
   * 
   * Property 8: For any content sent to an external LLM provider,
   * the system should apply PII filtering to remove patterns matching
   * phone numbers, email addresses, and configured person names.
   * 
   * @param content - Original content
   * @param targetProvider - Target LLM provider
   * @returns Filtered content with PII removed
   */
  filterPII(content: string, targetProvider: LLMProvider): string {
    // Skip filtering for local LLM
    if (targetProvider === 'local') {
      return content;
    }
    
    let filtered = content;
    
    // Apply all PII patterns
    for (const pattern of this.piiPatterns) {
      filtered = filtered.replace(pattern.pattern, pattern.replacement);
    }
    
    return filtered;
  }
  
  /**
   * Check if a note should be excluded from processing
   * 
   * Property 9: For any note in an excluded directory or with an excluded tag,
   * the system should skip that note during all LLM processing operations.
   * 
   * @param notePath - Path to the note file
   * @param tags - Tags associated with the note
   * @returns true if the note should be excluded
   */
  shouldExclude(notePath: string, tags: string[]): boolean {
    // Check directory exclusions
    for (const excludedDir of this.exclusionRules.directories) {
      // Normalize paths for comparison
      const normalizedPath = notePath.replace(/\\/g, '/');
      const normalizedExcluded = excludedDir.replace(/\\/g, '/');
      
      // Check if note path starts with excluded directory
      if (normalizedPath.startsWith(normalizedExcluded)) {
        return true;
      }
    }
    
    // Check tag exclusions
    for (const excludedTag of this.exclusionRules.tags) {
      if (tags.includes(excludedTag)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Get current exclusion rules
   */
  getExclusionRules(): ExclusionRules {
    return {
      directories: [...this.exclusionRules.directories],
      tags: [...this.exclusionRules.tags]
    };
  }
  
  /**
   * Update exclusion rules
   */
  updateExclusionRules(rules: ExclusionRules): void {
    this.exclusionRules = rules;
  }
  
  /**
   * Add a custom PII pattern
   */
  addCustomPattern(pattern: PIIPattern): void {
    this.piiPatterns.push(pattern);
  }
  
  /**
   * Remove a custom PII pattern by type
   */
  removeCustomPattern(type: PIIType): void {
    this.piiPatterns = this.piiPatterns.filter(p => p.type !== type);
  }
  
  /**
   * Get all current PII patterns
   */
  getPIIPatterns(): PIIPattern[] {
    return [...this.piiPatterns];
  }
}


/**
 * Factory function to create a PrivacyGuard instance
 */
export function createPrivacyGuard(exclusionRules: ExclusionRules): PrivacyGuard {
  return new PrivacyGuard(exclusionRules);
}
