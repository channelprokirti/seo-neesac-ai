import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { provider, apiKey, baseUrl } = await request.json();

    let models: string[] = [];

    // OpenAI - Fetch from models API
    if (provider === 'openai' && apiKey) {
      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          // Filter for chat models and sort by name
          models = data.data
            ?.filter((m: { id: string }) => 
              m.id.includes('gpt') && 
              !m.id.includes('instruct') &&
              !m.id.includes('vision') &&
              !m.id.includes('realtime') &&
              !m.id.includes('audio')
            )
            .map((m: { id: string }) => m.id)
            .sort((a: string, b: string) => {
              // Sort with gpt-4o first, then gpt-4, then gpt-3.5
              if (a.includes('gpt-4o') && !b.includes('gpt-4o')) return -1;
              if (!a.includes('gpt-4o') && b.includes('gpt-4o')) return 1;
              if (a.includes('gpt-4') && !b.includes('gpt-4')) return -1;
              if (!a.includes('gpt-4') && b.includes('gpt-4')) return 1;
              return a.localeCompare(b);
            }) || [];
        } else {
          return NextResponse.json(
            { error: 'Failed to fetch OpenAI models. Check your API key.' },
            { status: 400 }
          );
        }
      } catch (error) {
        console.error('OpenAI models fetch error:', error);
        return NextResponse.json(
          { error: 'Failed to connect to OpenAI' },
          { status: 500 }
        );
      }
    }

    // Anthropic - No public models API, but we can verify key and return known models
    else if (provider === 'anthropic' && apiKey) {
      try {
        // Test the key with a minimal request
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'hi' }],
          }),
        });

        if (response.ok || response.status === 400) {
          // Key is valid, return known models (Anthropic doesn't have a models list API)
          models = [
            'claude-sonnet-4-20250514',
            'claude-3-5-sonnet-20241022',
            'claude-3-5-haiku-20241022',
            'claude-3-opus-20240229',
            'claude-3-sonnet-20240229',
            'claude-3-haiku-20240307',
          ];
        } else if (response.status === 401) {
          return NextResponse.json(
            { error: 'Invalid Anthropic API key' },
            { status: 400 }
          );
        } else {
          // Still return models - key format might be valid
          models = [
            'claude-sonnet-4-20250514',
            'claude-3-5-sonnet-20241022',
            'claude-3-5-haiku-20241022',
            'claude-3-opus-20240229',
            'claude-3-sonnet-20240229',
            'claude-3-haiku-20240307',
          ];
        }
      } catch (error) {
        console.error('Anthropic models fetch error:', error);
        return NextResponse.json(
          { error: 'Failed to connect to Anthropic' },
          { status: 500 }
        );
      }
    }

    // Google Gemini - Fetch from models API
    else if (provider === 'gemini' && apiKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );

        if (response.ok) {
          const data = await response.json();
          models = data.models
            ?.filter((m: { name: string; supportedGenerationMethods?: string[] }) => 
              m.name.includes('gemini') &&
              m.supportedGenerationMethods?.includes('generateContent')
            )
            .map((m: { name: string }) => m.name.replace('models/', ''))
            .sort((a: string, b: string) => {
              // Sort with 2.0 first, then 1.5, then 1.0
              if (a.includes('2.0') && !b.includes('2.0')) return -1;
              if (!a.includes('2.0') && b.includes('2.0')) return 1;
              if (a.includes('1.5-pro') && !b.includes('1.5-pro')) return -1;
              if (!a.includes('1.5-pro') && b.includes('1.5-pro')) return 1;
              return a.localeCompare(b);
            }) || [];
        } else {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json(
            { error: error.error?.message || 'Failed to fetch Gemini models' },
            { status: 400 }
          );
        }
      } catch (error) {
        console.error('Gemini models fetch error:', error);
        return NextResponse.json(
          { error: 'Failed to connect to Gemini' },
          { status: 500 }
        );
      }
    }

    // Ollama - Fetch from local server
    else if (provider === 'ollama') {
      const ollamaUrl = baseUrl || 'http://localhost:11434';
      try {
        const response = await fetch(`${ollamaUrl}/api/tags`);

        if (response.ok) {
          const data = await response.json();
          models = data.models?.map((m: { name: string }) => m.name) || [];
        } else {
          return NextResponse.json(
            { error: 'Failed to fetch Ollama models. Is Ollama running?' },
            { status: 400 }
          );
        }
      } catch (error) {
        console.error('Ollama models fetch error:', error);
        return NextResponse.json(
          { error: 'Cannot connect to Ollama server. Make sure Ollama is running.' },
          { status: 500 }
        );
      }
    }

    // No API key provided
    else if (!apiKey && provider !== 'ollama') {
      return NextResponse.json(
        { error: 'API key is required to fetch models', needsKey: true },
        { status: 400 }
      );
    }

    return NextResponse.json({ models });
  } catch (error) {
    console.error('Models fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    );
  }
}





