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
      reviewerName,
      reviewText,
      starRating,
      responseType,
      tone,
      ai_config 
    } = body;

    if (!businessName || !reviewText) {
      return NextResponse.json(
        { error: 'Business name and review text are required' },
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

    // Determine response strategy based on rating
    let responseStrategy = '';
    const rating = typeof starRating === 'string' 
      ? { FIVE: 5, FOUR: 4, THREE: 3, TWO: 2, ONE: 1 }[starRating] || 5
      : starRating || 5;

    if (rating >= 4) {
      responseStrategy = `This is a positive review. The response should:
- Express genuine gratitude
- Highlight specific points they mentioned positively
- Encourage them to return/recommend
- Keep it warm and personal`;
    } else if (rating === 3) {
      responseStrategy = `This is a mixed review. The response should:
- Thank them for feedback
- Acknowledge both positive and negative points
- Address concerns professionally
- Invite them to give you another chance`;
    } else {
      responseStrategy = `This is a negative review. The response should:
- Remain calm and professional
- Apologize for their experience without being defensive
- Address specific complaints
- Offer to resolve the issue offline
- Provide contact information`;
    }

    const prompt = `You are responding to a Google Business Profile review on behalf of a business.

Business: ${businessName}
Reviewer: ${reviewerName || 'Customer'}
Star Rating: ${rating}/5
Review: "${reviewText}"
${tone ? `Desired Tone: ${tone}` : ''}
${responseType ? `Response Type: ${responseType}` : ''}

${responseStrategy}

Requirements:
1. Keep the response between 50-150 words (concise but meaningful)
2. Personalize by mentioning specifics from the review
3. Never be defensive or argumentative
4. Include the reviewer's name if provided
5. Sign off as the business owner or team

Generate a review response in JSON format:
{
  "response": "The review response text",
  "wordCount": number,
  "sentiment": "positive" | "neutral" | "apologetic",
  "keyPoints": ["Points addressed in the response"]
}`;

    const response = await ai.generateContent(prompt);
    
    // Parse the JSON response
    let responseData;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        responseData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      // Fallback: return raw content
      responseData = {
        response: response,
        wordCount: response.split(/\s+/).length,
        sentiment: rating >= 4 ? 'positive' : rating >= 3 ? 'neutral' : 'apologetic',
        keyPoints: []
      };
    }

    return NextResponse.json({
      success: true,
      result: responseData,
    });
  } catch (error) {
    console.error('Response generation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate response';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}



