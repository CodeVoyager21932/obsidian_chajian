/**
 * Property-Based Tests for JSON Cleaning and Validation
 * 
 * **Feature: career-os, Property 14: JSON cleaning and validation**
 * **Validates: Requirements 5.1, 5.2**
 * 
 * Property 14: JSON cleaning and validation
 * For any LLM output expected to be JSON, the system should apply cleaning 
 * (removing markdown wrappers, extracting JSON objects), parse the result, 
 * and validate against the corresponding schema before accepting the output.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { cleanJSON, cleanAndParseJSON, isValidJSON } from './jsonCleaner';
import { NoteCardSchema, JDCardSchema, CURRENT_SCHEMA_VERSION } from '../schema';
import { z } from 'zod';

/**
 * Helper function to check if a value contains -0 (negative zero).
 * JSON.stringify converts -0 to "0", so round-trip tests fail for values containing -0.
 * This is expected JSON behavior, not a bug in our code.
 */
function containsNegativeZero(value: unknown): boolean {
  if (typeof value === 'number') {
    return Object.is(value, -0);
  }
  if (Array.isArray(value)) {
    return value.some(containsNegativeZero);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).some(containsNegativeZero);
  }
  return false;
}

describe('Property 14: JSON cleaning and validation', () => {
  
  /**
   * Property: Valid JSON objects should remain valid after cleaning
   * 
   * For any valid JSON object or array, cleaning should preserve its structure
   * and allow successful parsing.
   * 
   * Note: We only test objects and arrays because LLM outputs are always
   * structured data (NoteCard, JDCard, etc.), not primitive values.
   * We use fc.jsonValue() which generates only JSON-compatible values.
   */
  it('should preserve valid JSON objects through cleaning', () => {
    fc.assert(
      fc.property(
        fc.jsonValue(),
        (jsonValue) => {
          // Skip primitive values, only test objects and arrays
          if (typeof jsonValue !== 'object' || jsonValue === null) {
            return true;
          }
          
          // Skip values containing -0 (negative zero) as JSON.stringify converts -0 to "0"
          if (containsNegativeZero(jsonValue)) {
            return true;
          }
          
          const jsonString = JSON.stringify(jsonValue);
          const cleaned = cleanJSON(jsonString);
          const parsed = JSON.parse(cleaned);
          
          // The parsed result should be deeply equal to the original
          expect(parsed).toEqual(jsonValue);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: JSON wrapped in markdown code blocks should be extractable
   * 
   * For any valid JSON object or array, when wrapped in markdown code blocks 
   * (with or without language specifier), the cleaner should extract the JSON correctly.
   */
  it('should extract JSON from markdown code blocks', () => {
    fc.assert(
      fc.property(
        fc.jsonValue(),
        fc.constantFrom('```json\n', '```\n', '```json  \n', '```  \n'),
        fc.constantFrom('\n```', '\n```\n', '\n```  ', '\n```\n\n'),
        (jsonValue, prefix, suffix) => {
          // Skip primitive values, only test objects and arrays
          if (typeof jsonValue !== 'object' || jsonValue === null) {
            return true;
          }
          
          // Skip values containing -0 (negative zero) as JSON.stringify converts -0 to "0"
          // This is expected JSON behavior per the JSON specification
          if (containsNegativeZero(jsonValue)) {
            return true;
          }
          
          const jsonString = JSON.stringify(jsonValue, null, 2);
          const wrapped = `${prefix}${jsonString}${suffix}`;
          
          const cleaned = cleanJSON(wrapped);
          const parsed = JSON.parse(cleaned);
          
          expect(parsed).toEqual(jsonValue);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: JSON with surrounding text should be extractable
   * 
   * For any valid JSON object or array, when surrounded by explanatory text,
   * the cleaner should extract only the JSON portion.
   */
  it('should extract JSON from text with explanations', () => {
    fc.assert(
      fc.property(
        fc.jsonValue(),
        fc.string({ minLength: 0, maxLength: 100 }),
        fc.string({ minLength: 0, maxLength: 100 }),
        (jsonValue, prefixText, suffixText) => {
          // Skip primitive values, only test objects and arrays
          if (typeof jsonValue !== 'object' || jsonValue === null) {
            return true;
          }
          
          // Skip values containing -0 (negative zero) as JSON.stringify converts -0 to "0"
          if (containsNegativeZero(jsonValue)) {
            return true;
          }
          
          // Ensure prefix/suffix don't contain JSON delimiters that would confuse extraction
          const cleanPrefix = prefixText.replace(/[{}\[\]]/g, '');
          const cleanSuffix = suffixText.replace(/[{}\[\]]/g, '');
          
          const jsonString = JSON.stringify(jsonValue);
          const withText = `${cleanPrefix}${jsonString}${cleanSuffix}`;
          
          const cleaned = cleanJSON(withText);
          const parsed = JSON.parse(cleaned);
          
          expect(parsed).toEqual(jsonValue);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Cleaned JSON should be parseable
   * 
   * For any input that cleanJSON successfully processes, the result
   * should be valid JSON that can be parsed without errors.
   */
  it('should produce parseable JSON from any successful cleaning', () => {
    fc.assert(
      fc.property(
        fc.jsonValue(),
        fc.constantFrom(
          (json: string) => json,
          (json: string) => `\`\`\`json\n${json}\n\`\`\``,
          (json: string) => `Here is the result:\n${json}`,
          (json: string) => `${json}\nThat's all.`,
          (json: string) => `Some text\n\`\`\`\n${json}\n\`\`\`\nMore text`
        ),
        (jsonValue, wrapper) => {
          const jsonString = JSON.stringify(jsonValue);
          const wrapped = wrapper(jsonString);
          
          // If cleanJSON succeeds, the result must be parseable
          try {
            const cleaned = cleanJSON(wrapped);
            const parsed = JSON.parse(cleaned);
            
            // Should not throw
            expect(parsed).toBeDefined();
          } catch (error) {
            // If cleanJSON throws, that's acceptable for invalid input
            // But if it returns a value, that value must be parseable
            if (error instanceof Error && !error.message.includes('No valid JSON')) {
              throw error;
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Schema validation after cleaning
   * 
   * For any valid NoteCard data, when serialized and wrapped in various formats,
   * cleaning and parsing should produce data that validates against the schema.
   */
  it('should validate NoteCard schema after cleaning and parsing', () => {
    // Custom arbitrary for NoteCard
    const noteCardArbitrary = fc.record({
      schema_version: fc.constant(CURRENT_SCHEMA_VERSION),
      note_path: fc.string({ minLength: 1 }),
      hash: fc.hexaString({ minLength: 32, maxLength: 64 }),
      summary: fc.string(),
      type: fc.constantFrom('project', 'course', 'reflection', 'other'),
      time_span: fc.string(),
      tech_stack: fc.array(
        fc.record({
          name: fc.string({ minLength: 1 }),
          context: fc.string(),
          level: fc.constantFrom('入门', '熟悉', '熟练', '精通'),
        })
      ),
      topics: fc.array(fc.string()),
      preferences: fc.record({
        likes: fc.array(fc.string()),
        dislikes: fc.array(fc.string()),
        traits: fc.array(fc.string()),
      }),
      evidence: fc.array(fc.string()),
      last_updated: fc.date().map(d => d.toISOString()),
      detected_date: fc.date().map(d => d.toISOString()),
      status: fc.option(fc.constantFrom('draft', 'confirmed'), { nil: undefined }),
      deleted: fc.option(fc.boolean(), { nil: undefined }),
    });

    fc.assert(
      fc.property(
        noteCardArbitrary,
        fc.constantFrom(
          (json: string) => json,
          (json: string) => `\`\`\`json\n${json}\n\`\`\``,
          (json: string) => `Here's the extracted note card:\n${json}`,
        ),
        (noteCard, wrapper) => {
          const jsonString = JSON.stringify(noteCard);
          const wrapped = wrapper(jsonString);
          
          const cleaned = cleanJSON(wrapped);
          const parsed = JSON.parse(cleaned);
          
          // Should validate against schema
          const result = NoteCardSchema.safeParse(parsed);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Schema validation for JDCard after cleaning
   * 
   * For any valid JDCard data, cleaning and parsing should produce
   * data that validates against the JDCard schema.
   */
  it('should validate JDCard schema after cleaning and parsing', () => {
    // Custom arbitrary for JDCard
    const jdCardArbitrary = fc.record({
      schema_version: fc.constant(CURRENT_SCHEMA_VERSION),
      jd_id: fc.uuid(),
      source_note: fc.string({ minLength: 1 }),
      company: fc.string({ minLength: 1 }),
      title: fc.string({ minLength: 1 }),
      location: fc.string({ minLength: 1 }),
      salary_range: fc.string(),
      skills_required: fc.array(fc.string()),
      skills_optional: fc.array(fc.string()),
      experience: fc.string(),
      degree: fc.string(),
      raw_text_hash: fc.hexaString({ minLength: 32, maxLength: 64 }),
      tags: fc.array(fc.string()),
      created_at: fc.date().map(d => d.toISOString()),
      updated_at: fc.date().map(d => d.toISOString()),
      deleted: fc.option(fc.boolean(), { nil: undefined }),
    });

    fc.assert(
      fc.property(
        jdCardArbitrary,
        fc.constantFrom(
          (json: string) => `\`\`\`json\n${json}\n\`\`\``,
          (json: string) => `Extracted JD:\n${json}\nEnd of extraction.`,
        ),
        (jdCard, wrapper) => {
          const jsonString = JSON.stringify(jdCard);
          const wrapped = wrapper(jsonString);
          
          const cleaned = cleanJSON(wrapped);
          const parsed = JSON.parse(cleaned);
          
          // Should validate against schema
          const result = JDCardSchema.safeParse(parsed);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Invalid JSON should be rejected
   * 
   * For strings that don't contain valid JSON, cleanJSON should throw an error.
   */
  it('should reject strings without valid JSON', () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => {
          // Filter out strings that might accidentally contain valid JSON
          return !s.includes('{') && !s.includes('[');
        }),
        (invalidString) => {
          expect(() => cleanJSON(invalidString)).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty or whitespace-only input should be rejected
   * 
   * For empty strings or whitespace-only strings, cleanJSON should throw an error.
   */
  it('should reject empty or whitespace-only input', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('', ' ', '  ', '\n', '\t', '   \n\t  '),
        (emptyString) => {
          expect(() => cleanJSON(emptyString)).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Round-trip consistency
   * 
   * For any valid JSON object or array, the round trip of stringify -> clean -> parse
   * should produce an equivalent value.
   */
  it('should maintain round-trip consistency for JSON values', () => {
    fc.assert(
      fc.property(
        fc.jsonValue(),
        (jsonValue) => {
          // Skip primitive values, only test objects and arrays
          if (typeof jsonValue !== 'object' || jsonValue === null) {
            return true;
          }
          
          // Skip values containing -0 (negative zero) as JSON.stringify converts -0 to "0"
          if (containsNegativeZero(jsonValue)) {
            return true;
          }
          
          const stringified = JSON.stringify(jsonValue);
          const parsed = cleanAndParseJSON(stringified);
          
          expect(parsed).toEqual(jsonValue);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: isValidJSON should match cleanAndParseJSON success
   * 
   * For any string, isValidJSON should return true if and only if
   * cleanAndParseJSON succeeds without throwing.
   */
  it('should have isValidJSON match cleanAndParseJSON success', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (input) => {
          const isValid = isValidJSON(input);
          
          try {
            cleanAndParseJSON(input);
            // If cleanAndParseJSON succeeds, isValidJSON should be true
            expect(isValid).toBe(true);
          } catch {
            // If cleanAndParseJSON throws, isValidJSON should be false
            expect(isValid).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
