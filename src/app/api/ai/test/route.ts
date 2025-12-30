import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const config = await request.json();

    if (config.provider === 'openai' && config.apiKey) {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
        },
      });

      if (response.ok) {
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ success: false }, { status: 400 });
    }

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
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ success: false }, { status: 400 });
    }

    if (config.provider === 'ollama') {
      const baseUrl = config.baseUrl || 'http://localhost:11434';
      const response = await fetch(`${baseUrl}/api/tags`);

      if (response.ok) {
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ success: false }, { status: 400 });
    }

    return NextResponse.json({ success: false }, { status: 400 });
  } catch (error) {
    console.error('AI test error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}





