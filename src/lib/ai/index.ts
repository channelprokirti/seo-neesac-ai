import type { AIConfig } from '@/types';

export interface AIProvider {
  generateText(prompt: string): Promise<string>;
  generateJSON<T>(prompt: string): Promise<T>;
}

export function createAIProvider(config: AIConfig): AIProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'gemini':
      return new GeminiProvider(config);
    case 'ollama':
      return new OllamaProvider(config);
    default:
      throw new Error(`Unknown AI provider: ${config.provider}`);
  }
}

class OpenAIProvider implements AIProvider {
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
  }

  async generateText(prompt: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  async generateJSON<T>(prompt: string): Promise<T> {
    const response = await this.generateText(prompt + '\n\nRespond with valid JSON only.');
    const jsonMatch = response.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Failed to parse JSON from response');
  }
}

class AnthropicProvider implements AIProvider {
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
  }

  async generateText(prompt: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey!,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    return data.content?.[0]?.text || '';
  }

  async generateJSON<T>(prompt: string): Promise<T> {
    const response = await this.generateText(prompt + '\n\nRespond with valid JSON only.');
    const jsonMatch = response.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Failed to parse JSON from response');
  }
}

class GeminiProvider implements AIProvider {
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
  }

  async generateText(prompt: string): Promise<string> {
    const model = this.config.model || 'gemini-1.5-flash';
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    const data = await response.json();
    
    // Check for API errors
    if (data.error) {
      console.error('Gemini API error:', data.error);
      throw new Error(data.error.message || 'Gemini API error');
    }
    
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error('Gemini response:', JSON.stringify(data));
      throw new Error('No response from Gemini API');
    }
    
    return text;
  }

  async generateJSON<T>(prompt: string): Promise<T> {
    const response = await this.generateText(prompt + '\n\nRespond with valid JSON only.');
    const jsonMatch = response.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Failed to parse JSON from response');
  }
}

class OllamaProvider implements AIProvider {
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
  }

  async generateText(prompt: string): Promise<string> {
    const baseUrl = this.config.baseUrl || 'http://localhost:11434';
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        prompt,
        stream: false,
      }),
    });

    const data = await response.json();
    return data.response || '';
  }

  async generateJSON<T>(prompt: string): Promise<T> {
    const response = await this.generateText(prompt + '\n\nRespond with valid JSON only.');
    const jsonMatch = response.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Failed to parse JSON from response');
  }
}
