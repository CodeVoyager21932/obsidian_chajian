/**
 * JSON Cleaner Utility
 * 
 * Extracts valid JSON from LLM responses that may contain:
 * - Markdown code blocks (```json ... ```)
 * - Explanatory text before/after JSON
 * - Extraneous whitespace
 */

/**
 * Clean and extract JSON from potentially messy LLM output
 * 
 * @param rawOutput - Raw string output from LLM
 * @returns Cleaned JSON string ready for parsing
 * @throws Error if no valid JSON can be extracted
 */
export function cleanJSON(rawOutput: string): string {
  if (!rawOutput || typeof rawOutput !== 'string') {
    throw new Error('Invalid input: expected non-empty string');
  }

  let cleaned = rawOutput.trim();

  // Remove markdown code blocks
  // Pattern: ```json ... ``` or ``` ... ```
  const codeBlockPattern = /```(?:json)?\s*([\s\S]*?)```/;
  const codeBlockMatch = cleaned.match(codeBlockPattern);
  
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  // Try to find JSON object or array boundaries
  // Look for the first { or [ and the last } or ]
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  const lastBrace = cleaned.lastIndexOf('}');
  const lastBracket = cleaned.lastIndexOf(']');

  // Determine which comes first: object or array
  let start = -1;
  let end = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    // Object comes first
    start = firstBrace;
    end = lastBrace;
  } else if (firstBracket !== -1) {
    // Array comes first
    start = firstBracket;
    end = lastBracket;
  }

  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.substring(start, end + 1);
  }

  // Final validation: ensure we have something that looks like JSON
  cleaned = cleaned.trim();
  
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    throw new Error('No valid JSON object or array found in output');
  }

  if (!cleaned.endsWith('}') && !cleaned.endsWith(']')) {
    throw new Error('No valid JSON object or array found in output');
  }

  return cleaned;
}

/**
 * Clean and parse JSON in one step
 * 
 * @param rawOutput - Raw string output from LLM
 * @returns Parsed JSON object
 * @throws Error if cleaning or parsing fails
 */
export function cleanAndParseJSON<T = any>(rawOutput: string): T {
  const cleaned = cleanJSON(rawOutput);
  
  try {
    return JSON.parse(cleaned) as T;
  } catch (error) {
    throw new Error(`Failed to parse cleaned JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Validate that a string contains parseable JSON after cleaning
 * 
 * @param rawOutput - Raw string output to validate
 * @returns true if valid JSON can be extracted and parsed
 */
export function isValidJSON(rawOutput: string): boolean {
  try {
    cleanAndParseJSON(rawOutput);
    return true;
  } catch {
    return false;
  }
}
