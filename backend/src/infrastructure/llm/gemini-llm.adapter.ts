// Skeleton for swappability — actual Gemini API calls land in Phase 2 (categorizer-worker).
import type { LLMPort } from '../../domain/ports/llm.port';

export class GeminiLLMAdapter implements LLMPort {
  constructor(private readonly apiKey: string) {}

  async generateText(_prompt: string): Promise<string> {
    void this.apiKey;
    throw new Error('GeminiLLMAdapter: not yet implemented — Phase 2');
  }

  async embed(_text: string): Promise<number[]> {
    void this.apiKey;
    throw new Error('GeminiLLMAdapter: not yet implemented — Phase 2');
  }
}
