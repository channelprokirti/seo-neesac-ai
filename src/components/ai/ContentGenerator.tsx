'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  Sparkles,
  FileText,
  MessageSquare,
  Send,
  Copy,
  Check,
  AlertCircle,
  Wand2,
  Image as ImageIcon,
  Download,
} from 'lucide-react';

interface ContentGeneratorProps {
  businessId: string;
  businessName: string;
  businessCategory?: string;
  onPostCreated?: () => void;
  // Optional external control
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultTab?: 'post' | 'description' | 'response' | 'image';
}

interface AIConfig {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

function getAIConfig(): AIConfig | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem('localseo-ai');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    return null;
  }
  return null;
}

export function ContentGenerator({ 
  businessId, 
  businessName, 
  businessCategory,
  onPostCreated,
  open,
  onOpenChange,
  defaultTab = 'post',
}: ContentGeneratorProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [generating, setGenerating] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  
  // Use external control if provided, otherwise use internal state
  const dialogOpen = open !== undefined ? open : internalOpen;
  const setDialogOpen = onOpenChange || setInternalOpen;

  // Post generation state
  const [postType, setPostType] = useState('update');
  const [postTopic, setPostTopic] = useState('');
  const [postKeywords, setPostKeywords] = useState('');
  const [generatedPost, setGeneratedPost] = useState<{
    title?: string;
    content: string;
    callToAction: string;
    suggestedImage?: string;
  } | null>(null);

  // Description generation state
  const [descType, setDescType] = useState('business');
  const [itemName, setItemName] = useState('');
  const [currentDesc, setCurrentDesc] = useState('');
  const [descKeywords, setDescKeywords] = useState('');
  const [generatedDesc, setGeneratedDesc] = useState<{
    description: string;
    characterCount: number;
    keywordsUsed: string[];
    suggestions: string[];
  } | null>(null);

  // Review response state
  const [reviewText, setReviewText] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [starRating, setStarRating] = useState('5');
  const [generatedResponse, setGeneratedResponse] = useState<{
    response: string;
    wordCount: number;
    sentiment: string;
    keyPoints: string[];
  } | null>(null);

  // Image generation state
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageStyle, setImageStyle] = useState('realistic');
  const [generatedImage, setGeneratedImage] = useState<{
    url: string;
    prompt: string;
    revisedPrompt?: string;
  } | null>(null);
  const [dalleConfigured, setDalleConfigured] = useState(false);

  const aiConfig = getAIConfig();
  
  // Check if DALL-E is configured
  useState(() => {
    try {
      const stored = localStorage.getItem('localseo-ai-providers');
      if (stored) {
        const providers = JSON.parse(stored);
        const dalleProvider = providers.find((p: { provider: string; apiKey: string }) => 
          p.provider === 'openai' && p.apiKey
        );
        setDalleConfigured(!!dalleProvider);
      }
    } catch {
      setDalleConfigured(false);
    }
  });

  const handleGeneratePost = async () => {
    if (!aiConfig) {
      setError('Please configure your AI provider in Settings first.');
      return;
    }

    setGenerating(true);
    setError(null);
    setGeneratedPost(null);

    try {
      const response = await fetch('/api/ai/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          businessCategory,
          postType,
          topic: postTopic,
          keywords: postKeywords.split(',').map(k => k.trim()).filter(Boolean),
          ai_config: aiConfig,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate post');
      }

      setGeneratedPost(data.post);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate post');
    }

    setGenerating(false);
  };

  const handleGenerateDescription = async () => {
    if (!aiConfig) {
      setError('Please configure your AI provider in Settings first.');
      return;
    }

    setGenerating(true);
    setError(null);
    setGeneratedDesc(null);

    try {
      const response = await fetch('/api/ai/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          businessCategory,
          descriptionType: descType,
          itemName,
          currentDescription: currentDesc,
          keywords: descKeywords.split(',').map(k => k.trim()).filter(Boolean),
          ai_config: aiConfig,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate description');
      }

      setGeneratedDesc(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate description');
    }

    setGenerating(false);
  };

  const handleGenerateResponse = async () => {
    if (!aiConfig) {
      setError('Please configure your AI provider in Settings first.');
      return;
    }

    if (!reviewText) {
      setError('Please enter the review text to respond to.');
      return;
    }

    setGenerating(true);
    setError(null);
    setGeneratedResponse(null);

    try {
      const response = await fetch('/api/ai/generate-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          reviewerName,
          reviewText,
          starRating,
          ai_config: aiConfig,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate response');
      }

      setGeneratedResponse(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate response');
    }

    setGenerating(false);
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt) {
      setError('Please enter an image description.');
      return;
    }

    // Get OpenAI API key for DALL-E
    let openaiKey = '';
    try {
      const stored = localStorage.getItem('localseo-ai-providers');
      if (stored) {
        const providers = JSON.parse(stored);
        const openaiProvider = providers.find((p: { provider: string; apiKey: string }) => 
          p.provider === 'openai' && p.apiKey
        );
        if (openaiProvider) {
          openaiKey = openaiProvider.apiKey;
        }
      }
    } catch {
      // Fallback to single config
      if (aiConfig?.provider === 'openai') {
        openaiKey = aiConfig.apiKey;
      }
    }

    if (!openaiKey) {
      setError('Please configure OpenAI API key in Settings to use DALL-E image generation.');
      return;
    }

    setGenerating(true);
    setError(null);
    setGeneratedImage(null);

    try {
      const response = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageType: 'custom',
          customPrompt: `${imagePrompt}. Style: ${imageStyle}. For a business called ${businessName}${businessCategory ? ` in the ${businessCategory} industry` : ''}.`,
          style: imageStyle,
          apiKey: openaiKey,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate image');
      }

      setGeneratedImage({
        url: data.image?.url || data.imageUrl,
        prompt: imagePrompt,
        revisedPrompt: data.image?.revisedPrompt || data.revisedPrompt,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate image');
    }

    setGenerating(false);
  };

  const handlePublishPost = async () => {
    if (!generatedPost) return;

    setPosting(true);
    setError(null);

    try {
      // Set supabase cookie for server-side auth
      const storedSupabase = localStorage.getItem('localseo-supabase');
      if (storedSupabase) {
        const config = JSON.parse(storedSupabase);
        document.cookie = `supabase-config=${encodeURIComponent(JSON.stringify(config))};path=/;max-age=300`;
      }

      const response = await fetch('/api/gbp/posts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          content: generatedPost.content,
          title: generatedPost.title,
          callToAction: { type: 'LEARN_MORE' },
          ai_generated: true,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to publish post');
      }

      // Success - close dialog and reset
      setDialogOpen(false);
      setGeneratedPost(null);
      setPostTopic('');
      setPostKeywords('');
      onPostCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish post');
    }

    setPosting(false);
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!aiConfig) {
    return (
      <Alert className="bg-amber-50 border-amber-200">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-700">
          Configure your AI provider in Settings to use content generation.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button className="bg-purple-600 hover:bg-purple-500">
          <Wand2 className="w-4 h-4 mr-2" />
          AI Content Generator
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            AI Content Generator
          </DialogTitle>
          <DialogDescription>
            Generate posts, descriptions, and review responses for {businessName}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="post" className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              Post
            </TabsTrigger>
            <TabsTrigger value="description" className="flex items-center gap-1">
              <Sparkles className="w-4 h-4" />
              Description
            </TabsTrigger>
            <TabsTrigger value="response" className="flex items-center gap-1">
              <MessageSquare className="w-4 h-4" />
              Response
            </TabsTrigger>
            <TabsTrigger value="image" className="flex items-center gap-1">
              <ImageIcon className="w-4 h-4" />
              Image
            </TabsTrigger>
          </TabsList>

          {/* Post Generation */}
          <TabsContent value="post" className="space-y-4">
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Post Type</Label>
                  <Select value={postType} onValueChange={setPostType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="update">General Update</SelectItem>
                      <SelectItem value="offer">Special Offer</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="product">Product Highlight</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Topic/Subject (optional)</Label>
                  <Input 
                    value={postTopic}
                    onChange={(e) => setPostTopic(e.target.value)}
                    placeholder="e.g., Holiday hours, New service"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Keywords (comma-separated, optional)</Label>
                <Input 
                  value={postKeywords}
                  onChange={(e) => setPostKeywords(e.target.value)}
                  placeholder="e.g., discount, limited time, free consultation"
                />
              </div>
              <Button onClick={handleGeneratePost} disabled={generating}>
                {generating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> Generate Post</>
                )}
              </Button>
            </div>

            {generatedPost && (
              <Card className="bg-slate-50 dark:bg-slate-800">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Generated Post</CardTitle>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => copyToClipboard(generatedPost.content)}
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {generatedPost.title && (
                    <p className="font-semibold">{generatedPost.title}</p>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{generatedPost.content}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">CTA: {generatedPost.callToAction}</Badge>
                  </div>
                  {generatedPost.suggestedImage && (
                    <p className="text-xs text-slate-500">
                      Suggested image: {generatedPost.suggestedImage}
                    </p>
                  )}
                  <Button onClick={handlePublishPost} disabled={posting} className="w-full">
                    {posting ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Publishing...</>
                    ) : (
                      <><Send className="w-4 h-4 mr-2" /> Publish to GBP</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Description Generation */}
          <TabsContent value="description" className="space-y-4">
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Description Type</Label>
                  <Select value={descType} onValueChange={setDescType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="business">Business Description</SelectItem>
                      <SelectItem value="product">Product Description</SelectItem>
                      <SelectItem value="service">Service Description</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(descType === 'product' || descType === 'service') && (
                  <div className="space-y-2">
                    <Label>Item Name</Label>
                    <Input 
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      placeholder="e.g., Premium Massage"
                    />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Current Description (to improve, optional)</Label>
                <Textarea 
                  value={currentDesc}
                  onChange={(e) => setCurrentDesc(e.target.value)}
                  placeholder="Paste existing description to improve it"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Keywords (comma-separated, optional)</Label>
                <Input 
                  value={descKeywords}
                  onChange={(e) => setDescKeywords(e.target.value)}
                  placeholder="e.g., professional, affordable, local"
                />
              </div>
              <Button onClick={handleGenerateDescription} disabled={generating}>
                {generating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> Generate Description</>
                )}
              </Button>
            </div>

            {generatedDesc && (
              <Card className="bg-slate-50 dark:bg-slate-800">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Generated Description</CardTitle>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => copyToClipboard(generatedDesc.description)}
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm whitespace-pre-wrap">{generatedDesc.description}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{generatedDesc.characterCount} chars</Badge>
                    {generatedDesc.keywordsUsed.slice(0, 5).map((kw, i) => (
                      <Badge key={i} variant="secondary">{kw}</Badge>
                    ))}
                  </div>
                  {generatedDesc.suggestions.length > 0 && (
                    <div className="text-xs text-slate-500">
                      <p className="font-medium mb-1">Suggestions:</p>
                      <ul className="list-disc pl-4 space-y-1">
                        {generatedDesc.suggestions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Review Response Generation */}
          <TabsContent value="response" className="space-y-4">
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Reviewer Name (optional)</Label>
                  <Input 
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    placeholder="e.g., John D."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Star Rating</Label>
                  <Select value={starRating} onValueChange={setStarRating}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 Stars ⭐⭐⭐⭐⭐</SelectItem>
                      <SelectItem value="4">4 Stars ⭐⭐⭐⭐</SelectItem>
                      <SelectItem value="3">3 Stars ⭐⭐⭐</SelectItem>
                      <SelectItem value="2">2 Stars ⭐⭐</SelectItem>
                      <SelectItem value="1">1 Star ⭐</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Review Text *</Label>
                <Textarea 
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Paste the review you want to respond to"
                  rows={4}
                />
              </div>
              <Button onClick={handleGenerateResponse} disabled={generating || !reviewText}>
                {generating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> Generate Response</>
                )}
              </Button>
            </div>

            {generatedResponse && (
              <Card className="bg-slate-50 dark:bg-slate-800">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Generated Response</CardTitle>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => copyToClipboard(generatedResponse.response)}
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm whitespace-pre-wrap">{generatedResponse.response}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{generatedResponse.wordCount} words</Badge>
                    <Badge variant={
                      generatedResponse.sentiment === 'positive' ? 'default' :
                      generatedResponse.sentiment === 'apologetic' ? 'destructive' : 'secondary'
                    }>
                      {generatedResponse.sentiment}
                    </Badge>
                  </div>
                  {generatedResponse.keyPoints.length > 0 && (
                    <div className="text-xs text-slate-500">
                      <p className="font-medium mb-1">Points addressed:</p>
                      <ul className="list-disc pl-4 space-y-1">
                        {generatedResponse.keyPoints.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Image Generation */}
          <TabsContent value="image" className="space-y-4">
            <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
              <ImageIcon className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700 dark:text-blue-300">
                <strong>DALL-E 3</strong> generates high-quality images from text descriptions. 
                Requires OpenAI API key configured in Settings.
              </AlertDescription>
            </Alert>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Image Style</Label>
                <Select value={imageStyle} onValueChange={setImageStyle}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realistic">Realistic / Photography</SelectItem>
                    <SelectItem value="illustration">Illustration</SelectItem>
                    <SelectItem value="3d">3D Render</SelectItem>
                    <SelectItem value="minimalist">Minimalist / Clean</SelectItem>
                    <SelectItem value="professional">Professional / Corporate</SelectItem>
                    <SelectItem value="vintage">Vintage / Retro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Image Description *</Label>
                <Textarea 
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  placeholder="Describe the image you want to generate, e.g., 'A professional photo of a modern office with plants, natural lighting, and collaborative workspace'"
                  rows={3}
                />
                <p className="text-xs text-slate-500">
                  Be specific about colors, composition, objects, mood, and lighting for better results.
                </p>
              </div>
              <Button onClick={handleGenerateImage} disabled={generating || !imagePrompt}>
                {generating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><ImageIcon className="w-4 h-4 mr-2" /> Generate Image</>
                )}
              </Button>
            </div>

            {generatedImage && (
              <Card className="bg-slate-50 dark:bg-slate-800">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Generated Image</CardTitle>
                    <a 
                      href={generatedImage.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      download="generated-image.png"
                    >
                      <Button variant="ghost" size="sm">
                        <Download className="w-4 h-4 mr-1" /> Download
                      </Button>
                    </a>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <img 
                    src={generatedImage.url} 
                    alt={generatedImage.prompt}
                    className="w-full rounded-lg shadow-md"
                  />
                  {generatedImage.revisedPrompt && (
                    <div className="text-xs text-slate-500">
                      <p className="font-medium">AI-enhanced prompt:</p>
                      <p className="italic">{generatedImage.revisedPrompt}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copyToClipboard(generatedImage.url)}
                    >
                      {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                      Copy URL
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



