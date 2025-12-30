import { NextRequest, NextResponse } from 'next/server';
import { DALLEProvider, generatePostImagePrompt, generateBrandingPrompt } from '@/lib/ai/providers/dalle';
import { GeminiImageProvider } from '@/lib/ai/providers/gemini-image';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Support both old format (imageType + apiKey at root) and new format (prompt + aiConfig)
    const {
      // New format from in-tab dialogs
      prompt: directPrompt,
      aiConfig,
      includeLogo,
      logoUrl,
      includeContactInfo,
      contactInfo,
      // Old format (keep for backward compatibility)
      businessName,
      businessCategory,
      imageType,
      customPrompt,
      postContent,
      postType,
      style,
      apiKey: directApiKey,
      model: directModel = 'dall-e-3',
      size: directSize = '1024x1024',
      quality: directQuality = 'standard',
    } = body;

    // Determine provider and API key
    const provider = aiConfig?.provider || 'openai';
    const apiKey = aiConfig?.apiKey || directApiKey;
    const model = aiConfig?.model || directModel;
    const size = aiConfig?.size || directSize;
    const quality = aiConfig?.quality || directQuality;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required for image generation. Please configure an image generation model in Settings.' },
        { status: 400 }
      );
    }

    let prompt: string;

    // Check if using new format (direct prompt)
    if (directPrompt) {
      // Build prompt with branding context if provided
      let brandingContext = '';
      if (includeLogo && logoUrl) {
        brandingContext += ' Include visual elements that would work well with a company logo.';
      }
      if (includeContactInfo && contactInfo) {
        const contactParts = [];
        if (contactInfo.phone) contactParts.push('phone number');
        if (contactInfo.email) contactParts.push('email');
        if (contactInfo.website) contactParts.push('website');
        if (contactParts.length > 0) {
          brandingContext += ` Design with space for ${contactParts.join(', ')} to be overlaid.`;
        }
      }
      
      prompt = `${directPrompt}${brandingContext} Professional quality, suitable for Google Business Profile. No text rendered in the image unless specifically requested.`;
    } else {
      // Old format with imageType
      switch (imageType) {
        case 'post':
          if (!businessName || !businessCategory || !postContent) {
            return NextResponse.json(
              { error: 'Business name, category, and post content are required for post images' },
              { status: 400 }
            );
          }
          prompt = generatePostImagePrompt(businessName, businessCategory, postContent, postType || 'update');
          break;

        case 'branding':
          if (!businessName || !businessCategory) {
            return NextResponse.json(
              { error: 'Business name and category are required for branding images' },
              { status: 400 }
            );
          }
          prompt = generateBrandingPrompt(businessName, businessCategory, style);
          break;

        case 'custom':
          if (!customPrompt) {
            return NextResponse.json(
              { error: 'Custom prompt is required' },
              { status: 400 }
            );
          }
          prompt = customPrompt;
          break;

        default:
          return NextResponse.json(
            { error: 'Invalid request. Provide either a direct prompt or imageType (post, branding, custom)' },
            { status: 400 }
          );
      }
    }

    console.log(`Generating image with ${provider} (${model}), prompt:`, prompt.slice(0, 200) + '...');

    let image: { url: string; revisedPrompt?: string };

    if (provider === 'gemini') {
      // Use Gemini for image generation (supports any Gemini model)
      const gemini = new GeminiImageProvider({
        apiKey,
        model, // Pass the model directly - supports any Gemini model
      });
      image = await gemini.generateImage(prompt);
    } else {
      // Default to OpenAI DALL-E
      const dalle = new DALLEProvider({
        apiKey,
        model,
        size,
        quality,
      });
      image = await dalle.generateImage(prompt);
    }

    return NextResponse.json({
      success: true,
      // Support both response formats
      image: {
        url: image.url,
        revisedPrompt: image.revisedPrompt,
        model,
        size,
        provider,
      },
      imageUrl: image.url, // For new format consumers
    });

  } catch (error) {
    console.error('Image generation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate image';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}



