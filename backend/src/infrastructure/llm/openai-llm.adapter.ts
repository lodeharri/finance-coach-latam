// Future adapter for OpenAI fallback per work.md ADR-005.
import type { LLMPort } from '../../domain/ports/llm.port';

export class OpenAILLMAdapter implements LLMPort {
  constructor(private readonly apiKey: string) {}

  async generateText(_prompt: string): Promise<string> {
    void this.apiKey;
    throw new Error('OpenAILLMAdapter: not yet implemented — Phase 2');
  }

  async embed(_text: string): Promise<number[]> {
    void this.apiKey;
    throw new Error('OpenAILLMAdapter: not yet implemented — Phase 2');
  }
}
