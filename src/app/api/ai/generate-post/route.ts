import { NextRequest, NextResponse } from 'next/server';
import { createAIProvider } from '@/lib/ai';

interface AIConfig {
  provider: 'openai' | 'anthropic' | 'ollama' | 'gemini';
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      businessName,
      businessCategory,
      postType,
      topic,
      keywords,
      tone,
      ai_config 
    } = body;

    if (!businessName || !postType) {
      return NextResponse.json(
        { error: 'Business name and post type are required' },
        { status: 400 }
      );
    }

    const aiConfig = ai_config as AIConfig;
    if (!aiConfig?.apiKey || !aiConfig?.model) {
      return NextResponse.json(
        { error: 'AI configuration is required' },
        { status: 400 }
      );
    }

    const ai = createAIProvider(aiConfig);

    // Build post type specific instructions
    let postTypeInstructions = '';
    switch (postType) {
      case 'update':
        postTypeInstructions = 'Create a general business update post that engages customers.';
        break;
      case 'offer':
        postTypeInstructions = 'Create a promotional offer post with a compelling call-to-action.';
        break;
      case 'event':
        postTypeInstructions = 'Create an event announcement post with date/time placeholders.';
        break;
      case 'product':
        postTypeInstructions = 'Create a product highlight post showcasing features and benefits.';
        break;
      default:
        postTypeInstructions = 'Create an engaging business post.';
    }

    const prompt = `You are a local SEO expert creating Google Business Profile posts.

Business: ${businessName}
${businessCategory ? `Category: ${businessCategory}` : ''}
Post Type: ${postType}
${topic ? `Topic/Subject: ${topic}` : ''}
${keywords?.length > 0 ? `Keywords to include: ${keywords.join(', ')}` : ''}
${tone ? `Tone: ${tone}` : 'Tone: Professional yet friendly'}

${postTypeInstructions}

Requirements:
1. Keep the post between 100-300 words (optimal for GBP)
2. Include a clear call-to-action
3. Make it engaging and relevant to local customers
4. ${keywords?.length > 0 ? 'Naturally incorporate the provided keywords' : 'Include relevant local SEO keywords'}
5. Use emojis sparingly but effectively

Generate a GBP post in JSON format:
{
  "title": "Short catchy title (optional, max 58 characters)",
  "content": "The main post content",
  "callToAction": "The CTA text (e.g., 'Learn more', 'Book now', 'Call us')",
  "suggestedImage": "Description of ideal image to accompany this post"
}`;

    const response = await ai.generateContent(prompt);
    
    // Parse the JSON response
    let postData;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        postData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      // Fallback: return raw content
      postData = {
        content: response,
        callToAction: 'Learn more',
        suggestedImage: 'Relevant business image'
      };
    }

    return NextResponse.json({
      success: true,
      post: postData,
    });
  } catch (error) {
    console.error('Post generation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate post';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}



