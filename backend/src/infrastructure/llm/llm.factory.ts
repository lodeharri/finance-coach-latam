import type { LLMPort } from '../../domain/ports/llm.port';
import type { LLMProviderConfig } from '../config/env.config';
import { GeminiLLMAdapter } from './gemini-llm.adapter';
import { OpenAILLMAdapter } from './openai-llm.adapter';

export function createLLMProvider(config: LLMProviderConfig): LLMPort {
  switch (config.provider) {
    case 'gemini':
      return new GeminiLLMAdapter(config.geminiApiKey!);
    case 'openai':
      return new OpenAILLMAdapter(config.openaiApiKey!);
    default:
      throw new Error(`createLLMProvider: unknown provider "${(config as any).provider}"`);
  }
}
