/**
 * DALL-E / GPT Image Generation Provider
 * Supports: dall-e-2, dall-e-3, gpt-image-1
 */

export interface DALLEConfig {
  apiKey: string;
  model?: 'dall-e-2' | 'dall-e-3' | 'gpt-image-1';
  size?: '256x256' | '512x512' | '1024x1024' | '1024x1792' | '1792x1024';
  quality?: 'standard' | 'hd' | 'low' | 'medium' | 'high' | 'auto';
  style?: 'vivid' | 'natural';
}

export interface GeneratedImage {
  url: string;
  revisedPrompt?: string;
}

export class DALLEProvider {
  private config: DALLEConfig;
  private baseUrl = 'https://api.openai.com/v1';

  constructor(config: DALLEConfig) {
    this.config = {
      model: 'dall-e-3',
      size: '1024x1024',
      quality: 'standard',
      ...config,
    };
  }

  async generateImage(prompt: string): Promise<GeneratedImage> {
    // Build request body based on model capabilities
    const requestBody: Record<string, unknown> = {
      model: this.config.model,
      prompt,
      n: 1,
      size: this.config.size,
    };

    // Only DALL-E 3 supports style and quality parameters
    if (this.config.model === 'dall-e-3') {
      requestBody.quality = this.config.quality || 'standard';
      requestBody.style = this.config.style || 'vivid';
    }
    
    // GPT Image 1 uses different quality values
    if (this.config.model === 'gpt-image-1') {
      // gpt-image-1 quality options: low, medium, high, auto
      const qualityMap: Record<string, string> = {
        'standard': 'medium',
        'hd': 'high',
      };
      requestBody.quality = qualityMap[this.config.quality as string] || this.config.quality || 'auto';
    }

    const response = await fetch(`${this.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to generate image');
    }

    const data = await response.json();
    return {
      url: data.data[0].url,
      revisedPrompt: data.data[0].revised_prompt,
    };
  }

  async generateMultiple(prompt: string, count: number = 2): Promise<GeneratedImage[]> {
    // DALL-E 3 only supports n=1, so we need to make multiple requests
    if (this.config.model === 'dall-e-3') {
      const results: GeneratedImage[] = [];
      for (let i = 0; i < count; i++) {
        const image = await this.generateImage(prompt);
        results.push(image);
      }
      return results;
    }

    // DALL-E 2 supports multiple images
    const response = await fetch(`${this.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        prompt,
        n: Math.min(count, 10),
        size: this.config.size,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to generate images');
    }

    const data = await response.json();
    return data.data.map((item: { url: string; revised_prompt?: string }) => ({
      url: item.url,
      revisedPrompt: item.revised_prompt,
    }));
  }

  async editImage(
    imageUrl: string, 
    prompt: string, 
    maskUrl?: string
  ): Promise<GeneratedImage> {
    // Note: This requires image to be PNG and < 4MB
    // For simplicity, we'll just generate a new image with the prompt
    // In production, you'd download the image, convert to base64, etc.
    return this.generateImage(prompt);
  }

  async createVariation(imageUrl: string): Promise<GeneratedImage> {
    // Note: This requires DALL-E 2 and image upload
    // Simplified implementation
    throw new Error('Image variation requires direct image upload');
  }
}

/**
 * Generate a post image prompt based on business and post content
 */
export function generatePostImagePrompt(
  businessName: string,
  businessCategory: string,
  postContent: string,
  postType: string
): string {
  let style = 'professional, modern, clean design';
  let subject = '';

  switch (postType) {
    case 'offer':
      style = 'promotional, vibrant colors, eye-catching';
      subject = 'promotional banner or sale announcement';
      break;
    case 'event':
      style = 'exciting, festive, inviting';
      subject = 'event announcement or celebration';
      break;
    case 'product':
      style = 'product photography, clean background, professional lighting';
      subject = 'product showcase';
      break;
    default:
      style = 'professional, warm, welcoming';
      subject = 'business atmosphere or service in action';
  }

  return `Create a ${style} image for a ${businessCategory} business called "${businessName}". 
The image should represent: ${subject}.
Context from post: ${postContent.slice(0, 200)}
Style: Suitable for Google Business Profile post, no text overlays, realistic or illustration style.`;
}

/**
 * Generate a logo/branding image prompt
 */
export function generateBrandingPrompt(
  businessName: string,
  businessCategory: string,
  style: 'modern' | 'classic' | 'playful' | 'professional' = 'modern'
): string {
  const styleDescriptions = {
    modern: 'minimalist, geometric, contemporary design',
    classic: 'timeless, elegant, traditional elements',
    playful: 'colorful, friendly, approachable',
    professional: 'corporate, trustworthy, sophisticated',
  };

  return `Create a ${styleDescriptions[style]} logo concept for a ${businessCategory} business called "${businessName}".
The design should be suitable for business cards and digital presence.
Simple, memorable, and versatile design that works in both color and monochrome.`;
}



