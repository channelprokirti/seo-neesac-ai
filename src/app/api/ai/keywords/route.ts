import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { seedKeyword, location, ai_config } = await request.json();

    // If no AI config, return demo keywords
    if (!ai_config?.apiKey && ai_config?.provider !== 'ollama') {
      return NextResponse.json({
        keywords: getDemoKeywords(seedKeyword, location),
      });
    }

    // Generate with AI provider
    const keywords = await generateWithAI(seedKeyword, location, ai_config);
    
    return NextResponse.json({ keywords });
  } catch (error) {
    console.error('Keyword generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate keywords' },
      { status: 500 }
    );
  }
}

function getDemoKeywords(seedKeyword: string, location: string) {
  const intents = ['transactional', 'informational', 'local', 'navigational'];
  const modifiers = [
    'near me',
    `in ${location}`,
    'best',
    'affordable',
    'emergency',
    '24 hour',
    'professional',
    'licensed',
    'top rated',
    'reviews',
  ];

  return modifiers.map((modifier, index) => ({
    keyword: `${modifier === 'near me' ? seedKeyword + ' ' + modifier : modifier + ' ' + seedKeyword}${modifier.includes(location) ? '' : ` ${location}`}`.trim(),
    search_volume: Math.floor(Math.random() * 5000) + 100,
    difficulty: Math.floor(Math.random() * 100),
    intent: intents[Math.floor(Math.random() * intents.length)],
    suggested: index < 5,
  }));
}

async function generateWithAI(
  seedKeyword: string,
  location: string,
  config: { provider: string; model: string; apiKey?: string; baseUrl?: string }
) {
  const prompt = `Generate 10 local SEO keyword suggestions for "${seedKeyword}" in ${location}.

For each keyword, provide:
- The keyword phrase
- Estimated monthly search volume (100-5000)
- Difficulty score (0-100)
- Search intent (transactional, informational, local, or navigational)

Format as JSON array with objects containing: keyword, search_volume, difficulty, intent, suggested (boolean).

Focus on:
- "Near me" variations
- Location-specific terms
- Service + location combinations
- Question-based keywords
- Long-tail variations

Return ONLY the JSON array, no other text.`;

  try {
    let content = '';

    // OpenAI
    if (config.provider === 'openai' && config.apiKey) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        }),
      });

      const data = await response.json();
      content = data.choices?.[0]?.message?.content || '';
    }

    // Anthropic
    else if (config.provider === 'anthropic' && config.apiKey) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': config.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const data = await response.json();
      content = data.content?.[0]?.text || '';
    }

    // Google Gemini
    else if (config.provider === 'gemini' && config.apiKey) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1024,
            },
          }),
        }
      );

      const data = await response.json();
      content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    // Ollama
    else if (config.provider === 'ollama') {
      const baseUrl = config.baseUrl || 'http://localhost:11434';
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          prompt,
          stream: false,
        }),
      });

      const data = await response.json();
      content = data.response || '';
    }

    // Parse JSON from response
    if (content) {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (error) {
    console.error('AI generation error:', error);
  }

  return getDemoKeywords(seedKeyword, location);
}
