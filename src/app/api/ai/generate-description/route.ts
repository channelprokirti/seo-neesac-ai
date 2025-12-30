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
      descriptionType,
      type, // Alternative field name
      itemName,
      serviceName, // For service descriptions
      currentDescription,
      currentContent, // Alternative field name
      keywords,
      maxLength,
      ai_config,
      aiConfig: aiConfigAlt, // Alternative field name
      brandingInfo
    } = body;

    const effectiveType = descriptionType || type || 'business';
    const effectiveItemName = itemName || serviceName;
    const effectiveContent = currentDescription || currentContent;

    if (!businessName) {
      return NextResponse.json(
        { error: 'Business name is required' },
        { status: 400 }
      );
    }

    const aiConfig = (ai_config || aiConfigAlt) as AIConfig;
    if (!aiConfig?.apiKey || !aiConfig?.model) {
      return NextResponse.json(
        { error: 'AI configuration is required' },
        { status: 400 }
      );
    }

    const ai = createAIProvider(aiConfig);

    // Build type specific instructions
    let typeInstructions = '';
    let recommendedLength = maxLength || 750;
    
    switch (effectiveType) {
      case 'business':
        typeInstructions = `Create a compelling business description for Google Business Profile.
The description should:
- Highlight unique selling points
- Mention key services/products
- Include location/service area mentions
- Build trust and credibility`;
        recommendedLength = 750;
        break;
      case 'product':
        typeInstructions = `Create a product description for GBP product listing.
The description should:
- Highlight key features and benefits
- Address customer pain points
- Include relevant specifications
- Create urgency or desire`;
        recommendedLength = 300;
        break;
      case 'service':
        typeInstructions = `Create a service description for GBP service listing.
The description should:
- Explain what the service includes
- Highlight benefits to the customer
- Mention any guarantees or unique approaches
- Encourage booking/inquiry`;
        recommendedLength = 300;
        break;
      case 'response':
        typeInstructions = `Create a professional response to a customer review.
The response should:
- Thank the customer
- Address specific points they mentioned
- Maintain professionalism
- Invite them back or offer resolution`;
        recommendedLength = 200;
        break;
      default:
        typeInstructions = 'Create an engaging description.';
    }

    const prompt = `You are a local SEO expert writing optimized descriptions for Google Business Profile.

Business: ${businessName}
${businessCategory ? `Category: ${businessCategory}` : ''}
Description Type: ${effectiveType}
${effectiveItemName ? `Item Name: ${effectiveItemName}` : ''}
${effectiveContent ? `Current Description to improve: ${effectiveContent}` : ''}
${keywords?.length > 0 ? `Keywords to include: ${keywords.join(', ')}` : ''}
${brandingInfo ? `Contact/Branding to include: ${brandingInfo}` : ''}
Maximum Length: ${recommendedLength} characters

${typeInstructions}

Requirements:
1. Keep within ${recommendedLength} characters
2. ${keywords?.length > 0 ? 'Naturally incorporate the provided keywords' : 'Include relevant local SEO keywords'}
3. Write in a professional yet approachable tone
4. Focus on customer benefits
5. Include a subtle call-to-action where appropriate

Generate the description in JSON format:
{
  "description": "The main description text",
  "characterCount": number,
  "keywordsUsed": ["list", "of", "keywords"],
  "suggestions": ["Optional improvement suggestions"]
}`;

    const response = await ai.generateText(prompt);
    
    // Parse the JSON response
    let descriptionData;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        descriptionData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      // Fallback: return raw content
      descriptionData = {
        description: response.slice(0, recommendedLength),
        characterCount: response.length,
        keywordsUsed: [],
        suggestions: []
      };
    }

    return NextResponse.json({
      success: true,
      content: descriptionData.description,
      result: descriptionData,
    });
  } catch (error) {
    console.error('Description generation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate description';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}



