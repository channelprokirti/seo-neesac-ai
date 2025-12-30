import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const config = await request.json();

    // OpenAI
    if (config.provider === 'openai' && config.apiKey) {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
        },
      });

      if (response.ok) {
        return NextResponse.json({ success: true, provider: 'openai' });
      }
      return NextResponse.json(
        { success: false, error: 'Invalid OpenAI API key' },
        { status: 400 }
      );
    }

    // Anthropic
    if (config.provider === 'anthropic' && config.apiKey) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': config.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });

      if (response.ok) {
        return NextResponse.json({ success: true, provider: 'anthropic' });
      }
      return NextResponse.json(
        { success: false, error: 'Invalid Anthropic API key' },
        { status: 400 }
      );
    }

    // Google Gemini
    if (config.provider === 'gemini' && config.apiKey) {
      const model = config.model || 'gemini-1.5-flash';
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Hi' }] }],
          }),
        }
      );

      if (response.ok) {
        return NextResponse.json({ success: true, provider: 'gemini', model });
      }
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { success: false, error: errorData.error?.message || 'Invalid Gemini API key or model' },
        { status: 400 }
      );
    }

    // Ollama
    if (config.provider === 'ollama') {
      const baseUrl = config.baseUrl || 'http://localhost:11434';
      try {
        const response = await fetch(`${baseUrl}/api/tags`);

        if (response.ok) {
          return NextResponse.json({ success: true, provider: 'ollama' });
        }
      } catch {
        return NextResponse.json(
          { success: false, error: 'Cannot connect to Ollama server' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'Ollama server not responding' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Invalid configuration' },
      { status: 400 }
    );
  } catch (error) {
    console.error('AI test error:', error);
    return NextResponse.json(
      { success: false, error: 'Connection test failed' },
      { status: 500 }
    );
  }
}
