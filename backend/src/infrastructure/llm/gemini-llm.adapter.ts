import type { LLMPort } from '../../domain/ports/llm.port';

interface GenerateContentResponse {
  readonly candidates?: Array<{
    readonly content?: {
      readonly parts?: Array<{ readonly text?: string }>;
    };
  }>;
}

interface EmbedContentResponse {
  readonly embedding?: { readonly values?: number[] };
  readonly embeddings?: Array<{ readonly values?: number[] }>;
}

export class GeminiLLMAdapter implements LLMPort {
  constructor(private readonly apiKey: string) {
    if (!apiKey.trim()) {
      throw new Error('GeminiLLMAdapter: apiKey is required');
    }
  }

  async generateText(prompt: string): Promise<string> {
    const response = await this.post<GenerateContentResponse>(
      'generateText',
      // gemini-flash-latest is the alias for the newest Flash model (3.6
      // Flash). gemini-2.0-flash and gemini-2.0-flash-lite returned 429
      // (FreeTier) on this project's API key. The `service_tier: 'flex'`
      // request option selects Gemini's cheapest generation tier (higher
      // latency, irrelevant for the async categorizer worker).
      'v1beta/models/gemini-flash-latest:generateContent',
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { service_tier: 'flex' },
      },
    );
    const text = response.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim();
    if (!text) {
      throw new Error('GeminiLLMAdapter.generateText: response contained no text');
    }
    return text;
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.post<EmbedContentResponse>(
      'embed',
      'v1beta/models/gemini-embedding-001:embedContent',
      {
        content: { parts: [{ text }] },
        // gemini-embedding-001 returns 3072 by default; the schema column is
        // vector(768), so we request 768 explicitly.
        output_dimensionality: 768,
      },
    );
    const values = response.embedding?.values ?? response.embeddings?.[0]?.values;
    if (!values || values.length === 0 || values.some((value) => !Number.isFinite(value))) {
      throw new Error('GeminiLLMAdapter.embed: response contained no valid embedding');
    }
    return values;
  }

  private async post<T>(
    operation: string,
    path: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const url = new URL(`https://generativelanguage.googleapis.com/${path}`);
    url.searchParams.set('key', this.apiKey);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`GeminiLLMAdapter.${operation}: request failed: ${message}`);
    }

    if (!response.ok) {
      const detail = (await response.text()).trim().slice(0, 500);
      throw new Error(
        `GeminiLLMAdapter.${operation}: Gemini returned ${response.status} ${response.statusText}${detail ? `: ${detail}` : ''}`,
      );
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`GeminiLLMAdapter.${operation}: invalid JSON response: ${message}`);
    }
  }
}
