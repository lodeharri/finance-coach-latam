/**
 * LLM port — defined before a provider is wired into application use cases.
 *
 * Phase 2's `GeminiLLMAdapter` or `OpenAILLMAdapter` implements this interface.
 * Use cases that need natural language generation or embeddings depend on
 * this port, never on a concrete provider.
 */
export interface LLMPort {
  generateText(prompt: string): Promise<string>;

  embed(text: string): Promise<number[]>;
}
