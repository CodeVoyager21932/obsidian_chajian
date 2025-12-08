/**
 * LLM Client Module
 * 
 * Unified interface for calling different LLM providers with retry and validation.
 * Supports: OpenAI, Anthropic, Local (Ollama), Google
 * 
 * Requirements: 4.1, 4.2, 5.1, 12.1, 12.2, 12.3
 */

import { z } from 'zod';
import { 
  LLMConfig, 
  ModelRole, 
  CallOptions, 
  CareerOSSettings,
  LLMProvider 
} from './types';
import { cleanAndParseJSON } from './utils/jsonCleaner';

// Default call options
const DEFAULT_CALL_OPTIONS: Required<CallOptions> = {
  maxRetries: 3,
  timeout: 30000,
  temperature: 0.7,
};

/**
 * Error class for LLM-related errors
 */
export class LLMError extends Error {
  constructor(
    message: string,
    public readonly provider: LLMProvider,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 * @param attempt - Current attempt number (0-indexed)
 * @param baseDelay - Base delay in milliseconds
 * @returns Delay in milliseconds with jitter
 */
function getBackoffDelay(attempt: number, baseDelay: number = 1000): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  // Add jitter (±25%)
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
}

/**
 * Build request headers for different providers
 */
function buildHeaders(config: LLMConfig, settings: CareerOSSettings): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // If custom base URL is configured with custom API key, use it
  const useCustomKey = settings.customBaseUrl && settings.customApiKey;

  switch (config.provider) {
    case 'openai':
      headers['Authorization'] = `Bearer ${useCustomKey ? settings.customApiKey : (config.apiKey || settings.openaiApiKey)}`;
      break;
    case 'anthropic':
      if (useCustomKey) {
        // Most proxy services use Bearer token format
        headers['Authorization'] = `Bearer ${settings.customApiKey}`;
      } else {
        headers['x-api-key'] = config.apiKey || settings.anthropicApiKey;
        headers['anthropic-version'] = '2023-06-01';
      }
      break;
    case 'google':
      if (useCustomKey) {
        // Most proxy services use Bearer token format
        headers['Authorization'] = `Bearer ${settings.customApiKey}`;
      } else {
        // Google uses API key in URL or header depending on endpoint
        headers['x-goog-api-key'] = config.apiKey || settings.googleApiKey;
      }
      break;
    case 'local':
      // Local LLMs typically don't need auth
      break;
  }

  return headers;
}

/**
 * Get the API endpoint URL for a provider
 */
function getEndpointUrl(config: LLMConfig, settings: CareerOSSettings): string {
  // Custom base URL has highest priority (for third-party proxy services)
  if (settings.customBaseUrl) {
    return settings.customBaseUrl;
  }
  
  // Provider-specific base URL (e.g., for local LLM)
  if (config.baseUrl) {
    // For local provider, append the chat endpoint
    if (config.provider === 'local') {
      return `${config.baseUrl}/api/chat`;
    }
    return config.baseUrl;
  }

  // Default endpoints
  switch (config.provider) {
    case 'openai':
      return 'https://api.openai.com/v1/chat/completions';
    case 'anthropic':
      return 'https://api.anthropic.com/v1/messages';
    case 'google':
      return `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`;
    case 'local':
      return 'http://localhost:11434/api/chat';
    default:
      throw new LLMError(`Unknown provider: ${config.provider}`, config.provider);
  }
}


/**
 * Build request body for different providers
 */
function buildRequestBody(
  config: LLMConfig,
  prompt: string,
  options: Required<CallOptions>,
  settings: CareerOSSettings
): Record<string, any> {
  // Use custom model if configured, otherwise use config model
  const modelName = settings.customBaseUrl && settings.customModel 
    ? settings.customModel 
    : config.model;

  // When using custom proxy, always use OpenAI-compatible format
  if (settings.customBaseUrl) {
    return {
      model: modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature,
      ...(config.jsonMode && { response_format: { type: 'json_object' } }),
    };
  }

  switch (config.provider) {
    case 'openai':
      return {
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature,
        ...(config.jsonMode && { response_format: { type: 'json_object' } }),
      };
    
    case 'anthropic':
      return {
        model: modelName,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature,
      };
    
    case 'google':
      return {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options.temperature,
        },
      };
    
    case 'local':
      // Ollama format
      return {
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: {
          temperature: options.temperature,
        },
        ...(config.jsonMode && { format: 'json' }),
      };
    
    default:
      throw new LLMError(`Unknown provider: ${config.provider}`, config.provider);
  }
}

/**
 * Extract response text from different provider response formats
 */
function extractResponseText(config: LLMConfig, responseData: any, settings: CareerOSSettings): string {
  // When using custom proxy, always use OpenAI-compatible format
  if (settings.customBaseUrl) {
    return responseData.choices?.[0]?.message?.content || '';
  }

  switch (config.provider) {
    case 'openai':
      return responseData.choices?.[0]?.message?.content || '';
    
    case 'anthropic':
      return responseData.content?.[0]?.text || '';
    
    case 'google':
      return responseData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    case 'local':
      // Ollama format
      return responseData.message?.content || '';
    
    default:
      throw new LLMError(`Unknown provider: ${config.provider}`, config.provider);
  }
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: any): boolean {
  // Network errors are retryable
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return true;
  }
  
  // Rate limiting (429) and server errors (5xx) are retryable
  if (error instanceof LLMError) {
    const status = error.statusCode;
    if (status === 429 || (status && status >= 500 && status < 600)) {
      return true;
    }
  }
  
  return false;
}

/**
 * LLM Client class
 * 
 * Provides unified interface for calling different LLM providers
 */
export class LLMClient {
  private settings: CareerOSSettings;

  constructor(settings: CareerOSSettings) {
    this.settings = settings;
  }

  /**
   * Update settings (e.g., when user changes configuration)
   */
  updateSettings(settings: CareerOSSettings): void {
    this.settings = settings;
  }

  /**
   * Get LLM config for a specific role
   */
  private getConfigForRole(role: ModelRole): LLMConfig {
    return this.settings.llmConfigs[role];
  }

  /**
   * Call LLM with specific role configuration
   * 
   * @param role - Model role (extract, analyze, embedding)
   * @param prompt - Prompt string to send
   * @param options - Optional call options
   * @returns Response text from LLM
   */
  async call(
    role: ModelRole,
    prompt: string,
    options?: CallOptions
  ): Promise<string> {
    const config = this.getConfigForRole(role);
    const mergedOptions: Required<CallOptions> = {
      ...DEFAULT_CALL_OPTIONS,
      maxRetries: this.settings.maxRetries,
      timeout: this.settings.timeout,
      ...options,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= mergedOptions.maxRetries; attempt++) {
      try {
        const response = await this.makeRequest(config, prompt, mergedOptions);
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if we should retry
        if (attempt < mergedOptions.maxRetries && isRetryableError(error)) {
          const delay = getBackoffDelay(attempt);
          console.log(`LLM request failed (attempt ${attempt + 1}), retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }
        
        // Non-retryable error or max retries reached
        break;
      }
    }

    throw lastError || new LLMError('Unknown error', config.provider);
  }


  /**
   * Call LLM expecting JSON output with schema validation
   * 
   * @param role - Model role (extract, analyze, embedding)
   * @param prompt - Prompt string to send
   * @param schema - Zod schema for validation
   * @param options - Optional call options
   * @returns Parsed and validated JSON object
   */
  async callJSON<T>(
    role: ModelRole,
    prompt: string,
    schema: z.ZodSchema<T>,
    options?: CallOptions
  ): Promise<T> {
    const config = this.getConfigForRole(role);
    const mergedOptions: Required<CallOptions> = {
      ...DEFAULT_CALL_OPTIONS,
      maxRetries: this.settings.maxRetries,
      timeout: this.settings.timeout,
      ...options,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= mergedOptions.maxRetries; attempt++) {
      try {
        // Make LLM request
        const responseText = await this.makeRequest(config, prompt, mergedOptions);
        
        // Clean and parse JSON
        const parsed = cleanAndParseJSON(responseText);
        
        // Validate against schema
        const validated = schema.parse(parsed);
        
        return validated;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // For JSON/schema errors, always retry (LLM might produce better output)
        // For network errors, check if retryable
        const shouldRetry = attempt < mergedOptions.maxRetries && (
          error instanceof z.ZodError ||
          (error instanceof Error && error.message.includes('JSON')) ||
          isRetryableError(error)
        );
        
        if (shouldRetry) {
          const delay = getBackoffDelay(attempt);
          console.log(`LLM JSON request failed (attempt ${attempt + 1}), retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }
        
        break;
      }
    }

    throw lastError || new LLMError('Unknown error', config.provider);
  }

  /**
   * Make a single HTTP request to the LLM provider
   */
  private async makeRequest(
    config: LLMConfig,
    prompt: string,
    options: Required<CallOptions>
  ): Promise<string> {
    const url = getEndpointUrl(config, this.settings);
    const headers = buildHeaders(config, this.settings);
    const body = buildRequestBody(config, prompt, options, this.settings);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new LLMError(
          `LLM request failed: ${response.status} ${response.statusText} - ${errorText}`,
          config.provider,
          response.status,
          response.status === 429 || response.status >= 500
        );
      }

      const responseData = await response.json();
      return extractResponseText(config, responseData, this.settings);
    } catch (error) {
      if (error instanceof LLMError) {
        throw error;
      }
      
      // Handle abort/timeout
      if (error instanceof Error && error.name === 'AbortError') {
        throw new LLMError(
          `LLM request timed out after ${options.timeout}ms`,
          config.provider,
          undefined,
          true
        );
      }
      
      // Wrap other errors
      throw new LLMError(
        `LLM request failed: ${error instanceof Error ? error.message : String(error)}`,
        config.provider,
        undefined,
        true
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Check if the LLM provider is available
   * Useful for testing connectivity before batch operations
   */
  async checkAvailability(role: ModelRole): Promise<boolean> {
    try {
      const config = this.getConfigForRole(role);
      
      // For local providers, try a simple request
      if (config.provider === 'local') {
        const url = config.baseUrl || 'http://localhost:11434';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        try {
          const response = await fetch(`${url}/api/tags`, {
            method: 'GET',
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          return response.ok;
        } catch {
          clearTimeout(timeoutId);
          return false;
        }
      }
      
      // For cloud providers, just check if API key is configured
      switch (config.provider) {
        case 'openai':
          return !!(config.apiKey || this.settings.openaiApiKey);
        case 'anthropic':
          return !!(config.apiKey || this.settings.anthropicApiKey);
        case 'google':
          return !!(config.apiKey || this.settings.googleApiKey);
        default:
          return false;
      }
    } catch {
      return false;
    }
  }
}

/**
 * Create a new LLM client instance
 */
export function createLLMClient(settings: CareerOSSettings): LLMClient {
  return new LLMClient(settings);
}
