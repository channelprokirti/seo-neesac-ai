import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { type, topic, businessInfo, ai_config } = await request.json();

    // If no AI config, return demo content
    if (!ai_config?.apiKey && ai_config?.provider !== 'ollama') {
      return NextResponse.json({
        content: getDemoContent(type, topic, businessInfo),
      });
    }

    // Generate with AI provider
    const content = await generateWithAI(type, topic, businessInfo, ai_config);
    
    return NextResponse.json({ content });
  } catch (error) {
    console.error('Content generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate content' },
      { status: 500 }
    );
  }
}

function getDemoContent(type: string, topic: string, businessInfo: string): string {
  const templates: Record<string, string> = {
    gbp_post: `🌟 ${topic}

${businessInfo}

We're excited to share this update with our community! Whether you're a long-time customer or discovering us for the first time, we're here to serve you.

📍 Visit us today!
📞 Call to learn more
💬 Questions? Send us a message!

#LocalBusiness #${topic.replace(/\s+/g, '')}`,

    gbp_update: `📢 Update: ${topic}

${businessInfo}

Thank you for your continued support! We're always working to improve your experience.

Visit us to learn more about what's new!`,

    gbp_offer: `🎉 Special Offer: ${topic}

${businessInfo}

Don't miss out on this limited-time opportunity!

Terms and conditions apply. Contact us for details.`,

    blog_post: `# ${topic}

${businessInfo}

## Why This Matters for Our Community

When it comes to ${topic.toLowerCase()}, local businesses play a crucial role in serving the community. Here's what you need to know...

## Our Approach

At our business, we believe in providing exceptional value to every customer. Our approach to ${topic.toLowerCase()} includes:

- Personalized service tailored to your needs
- Expert knowledge and years of experience
- Commitment to quality and customer satisfaction

## What Our Customers Say

Our customers consistently praise our dedication to excellence. We're proud to serve our local community and look forward to serving you too.

## Get in Touch

Ready to learn more? Contact us today to discuss how we can help you with ${topic.toLowerCase()}.`,

    meta_description: `${businessInfo.slice(0, 100)}. Specializing in ${topic.toLowerCase()}. Contact us today for expert service and personalized solutions.`,

    local_landing: `# ${topic} Services in [Location]

Looking for expert ${topic.toLowerCase()} services in your area? You've come to the right place!

## About Our ${topic} Services

${businessInfo}

## Why Choose Us?

- Local expertise and knowledge
- Personalized service
- Competitive pricing
- Years of experience

## Service Areas

We proudly serve [Location] and surrounding areas.

## Contact Us

Ready to get started? Call us today or fill out our contact form for a free consultation.`,
  };

  return templates[type] || templates.gbp_post;
}

async function generateWithAI(
  type: string,
  topic: string,
  businessInfo: string,
  config: { provider: string; model: string; apiKey?: string; baseUrl?: string }
): Promise<string> {
  const prompt = `Generate a ${type.replace(/_/g, ' ')} about "${topic}" for a local business.

Business information: ${businessInfo}

Requirements:
- Keep it engaging and professional
- Include a clear call-to-action (CTA)
- Optimize for local SEO
- Use appropriate length for the content type`;

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
    return data.choices?.[0]?.message?.content || getDemoContent(type, topic, businessInfo);
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
        model: config.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    return data.content?.[0]?.text || getDemoContent(type, topic, businessInfo);
  }

  // Google Gemini
  if (config.provider === 'gemini' && config.apiKey) {
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
    return data.candidates?.[0]?.content?.parts?.[0]?.text || getDemoContent(type, topic, businessInfo);
  }

  // Ollama
  if (config.provider === 'ollama') {
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
    return data.response || getDemoContent(type, topic, businessInfo);
  }

  return getDemoContent(type, topic, businessInfo);
}
