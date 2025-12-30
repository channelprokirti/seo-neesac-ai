import { NextRequest, NextResponse } from 'next/server';
import { createAIProvider } from '@/lib/ai';
import type { AIProvider as AIProviderType } from '@/types';

interface Review {
  reviewer?: { displayName?: string };
  starRating?: string;
  comment?: string;
  createTime?: string;
}

interface AIConfig {
  provider: AIProviderType;
  model: string;
  apiKey: string;
  baseUrl?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reviews, businessName, ai_config } = body as {
      reviews: Review[];
      businessName: string;
      ai_config: AIConfig;
    };

    if (!reviews || reviews.length === 0) {
      return NextResponse.json({ error: 'No reviews provided' }, { status: 400 });
    }

    if (!ai_config?.apiKey) {
      return NextResponse.json({ error: 'AI not configured. Please add your API key in settings.' }, { status: 400 });
    }

    // Prepare reviews for analysis
    const reviewTexts = reviews
      .filter(r => r.comment)
      .map(r => ({
        rating: r.starRating || 'UNKNOWN',
        text: r.comment || '',
        date: r.createTime || '',
      }));

    const prompt = `Analyze the following ${reviewTexts.length} customer reviews for "${businessName}" and provide:

1. **Keywords**: Extract the top 20 most mentioned keywords/phrases with their count and sentiment (positive/neutral/negative)
2. **Sentiment Summary**: Calculate the percentage of positive, neutral, and negative reviews
3. **Common Themes**: Identify 5-7 recurring themes or topics customers mention
4. **Suggestions**: Provide 4-5 actionable suggestions based on the reviews to improve the business

Reviews:
${reviewTexts.map((r, i) => `Review ${i + 1} (${r.rating}): "${r.text}"`).join('\n\n')}

Respond in this exact JSON format:
{
  "keywords": [
    {"word": "keyword", "count": 10, "sentiment": "positive"},
    ...
  ],
  "sentimentSummary": {
    "positive": 70,
    "neutral": 20,
    "negative": 10
  },
  "commonThemes": [
    "Theme 1 description",
    "Theme 2 description",
    ...
  ],
  "suggestions": [
    "Suggestion 1",
    "Suggestion 2",
    ...
  ]
}`;

    const aiProvider = createAIProvider({
      provider: ai_config.provider,
      apiKey: ai_config.apiKey,
      model: ai_config.model,
      baseUrl: ai_config.baseUrl,
    });

    const response = await aiProvider.generateText(prompt);
    
    // Parse the JSON response
    let analytics;
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analytics = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', response);
      // Return a default structure
      analytics = {
        keywords: [],
        sentimentSummary: { positive: 0, neutral: 0, negative: 0 },
        commonThemes: ['Unable to analyze reviews'],
        suggestions: ['Please try again later'],
      };
    }

    return NextResponse.json({ analytics });
  } catch (error) {
    console.error('Review analysis error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to analyze reviews' 
    }, { status: 500 });
  }
}

