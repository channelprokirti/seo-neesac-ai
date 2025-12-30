'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { 
  Bot, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Save,
  ExternalLink,
  Info,
  Building2,
  Search,
  RefreshCw,
  Trash2,
  Link as LinkIcon,
  Zap,
  Image as ImageIcon,
  Palette,
  Upload,
  Phone,
  Mail,
  Globe,
} from 'lucide-react';

function getSupabaseCredentials() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('localseo-supabase');
      if (stored) {
        const config = JSON.parse(stored);
        return { url: config.url, anonKey: config.anonKey };
      }
    } catch (e) {
      console.error('Failed to parse stored config:', e);
    }
  }
  return { url: '', anonKey: '' };
}

interface AIProviderConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  isConnected: boolean;
}

interface AIConfigs {
  active: string;
  providers: Record<string, AIProviderConfig>;
}

interface ImageModelConfig {
  provider: 'openai' | 'gemini' | 'nanobanana' | 'none';
  model: string;
  apiKey: string;
  useSameAsText: boolean;
}

interface ImageAIConfigs {
  active: string; // Key of the active image provider (e.g., 'openai-gpt-image-1')
  providers: Record<string, ImageModelConfig>;
}

interface BrandingConfig {
  logo: string | null;
  email: string;
  phone: string;
  website: string;
  defaults: {
    includeLogo: boolean;
    includePhone: boolean;
    includeWebsite: boolean;
    includeEmail: boolean;
  };
}

interface GoogleSettings {
  placesApiKey: string;
}

interface ConnectedGBP {
  id: string;
  google_email: string;
  location_name: string;
  location_id: string;
  account_name: string;
  created_at: string;
}

interface BusinessSyncStatus {
  gbp_location_id: string;
  name: string;
  gbp_data?: {
    syncedAt?: string;
    totalReviews?: number;
  };
}

// Group GBP connections by Google account email
interface GroupedGBPAccount {
  email: string;
  accountName: string;
  connectedAt: string;
  locations: ConnectedGBP[];
}

const FALLBACK_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  gemini: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
  ollama: ['llama3.2', 'llama3.1', 'llama3', 'mistral', 'mixtral', 'codellama'],
};

// OpenAI image models are hardcoded as they don't have a models API for image generation
const OPENAI_IMAGE_MODELS = [
  { id: 'gpt-image-1', name: 'GPT Image 1 (Best - text rendering)' },
  { id: 'dall-e-3', name: 'DALL-E 3 (High quality)' },
  { id: 'dall-e-2', name: 'DALL-E 2 (Budget)' },
];

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  
  // Multi-provider AI configuration
  const [aiConfigs, setAiConfigs] = useState<AIConfigs>({
    active: '',
    providers: {},
  });
  const [currentProvider, setCurrentProvider] = useState<string>('openai');
  const [currentApiKey, setCurrentApiKey] = useState<string>('');
  const [currentModel, setCurrentModel] = useState<string>('');
  const [currentBaseUrl, setCurrentBaseUrl] = useState<string>('');
  
  const [googleSettings, setGoogleSettings] = useState<GoogleSettings>({
    placesApiKey: '',
  });

  // Multi-provider Image model configuration (similar to text models)
  const [imageConfigs, setImageConfigs] = useState<ImageAIConfigs>({
    active: '',
    providers: {},
  });
  // Current image config being edited
  const [currentImageProvider, setCurrentImageProvider] = useState<'openai' | 'gemini' | 'nanobanana' | 'none'>('openai');
  const [currentImageModel, setCurrentImageModel] = useState<string>('gpt-image-1');
  const [currentImageApiKey, setCurrentImageApiKey] = useState<string>('');
  const [currentImageUseSameAsText, setCurrentImageUseSameAsText] = useState<boolean>(true);
  
  const [testingImage, setTestingImage] = useState(false);
  const [imageTestResult, setImageTestResult] = useState<'success' | 'error' | null>(null);

  // Branding configuration
  const [brandingConfig, setBrandingConfig] = useState<BrandingConfig>({
    logo: null,
    email: '',
    phone: '',
    website: '',
    defaults: {
      includeLogo: true,
      includePhone: true,
      includeWebsite: true,
      includeEmail: false,
    },
  });

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [modelsFetched, setModelsFetched] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // Image model fetching state (for Gemini)
  const [availableImageModels, setAvailableImageModels] = useState<string[]>([]);
  const [fetchingImageModels, setFetchingImageModels] = useState(false);
  const [imageModelsError, setImageModelsError] = useState<string | null>(null);

  // GBP Connection state
  const [connectedGBP, setConnectedGBP] = useState<ConnectedGBP[]>([]);
  const [businessSyncStatus, setBusinessSyncStatus] = useState<BusinessSyncStatus[]>([]);
  const [gbpOAuthConfigured, setGbpOAuthConfigured] = useState(false);
  const [loadingGBP, setLoadingGBP] = useState(true);

  // Fix hydration mismatch with Radix UI
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Load from localStorage - support both old and new format
    const storedAIConfigs = localStorage.getItem('localseo-ai-configs');
    const storedAI = localStorage.getItem('localseo-ai');
    const storedGoogle = localStorage.getItem('localseo-google');
    const storedImageConfig = localStorage.getItem('localseo-ai-image');
    const storedBranding = localStorage.getItem('localseo-branding');

    if (storedAIConfigs) {
      // New multi-provider format
      const parsed = JSON.parse(storedAIConfigs);
      setAiConfigs(parsed);
    } else if (storedAI) {
      // Migrate from old single-provider format
      const parsed = JSON.parse(storedAI);
      if (parsed.apiKey && parsed.provider) {
        const migrated: AIConfigs = {
          active: parsed.provider,
          providers: {
            [parsed.provider]: {
              provider: parsed.provider,
              model: parsed.model,
              apiKey: parsed.apiKey,
              baseUrl: parsed.baseUrl,
              isConnected: true,
            },
          },
        };
        setAiConfigs(migrated);
        // Save in new format
        localStorage.setItem('localseo-ai-configs', JSON.stringify(migrated));
      }
    }
    if (storedGoogle) setGoogleSettings(JSON.parse(storedGoogle));
    if (storedImageConfig) {
      const parsedImageConfig = JSON.parse(storedImageConfig);
      // Check if it's the new multi-provider format or old single-provider format
      if (parsedImageConfig.providers && typeof parsedImageConfig.providers === 'object') {
        // New multi-provider format
        setImageConfigs(parsedImageConfig);
      } else if (parsedImageConfig.provider && parsedImageConfig.provider !== 'none') {
        // Migrate from old single-provider format
        const key = `${parsedImageConfig.provider}-${parsedImageConfig.model}`;
        const migrated: ImageAIConfigs = {
          active: key,
          providers: {
            [key]: parsedImageConfig,
          },
        };
        setImageConfigs(migrated);
        // Save in new format
        localStorage.setItem('localseo-ai-image', JSON.stringify(migrated));
      }
    }
    if (storedBranding) setBrandingConfig(JSON.parse(storedBranding));

    // Load connected GBP from Supabase
    const loadGBP = async () => {
      const { url, anonKey } = getSupabaseCredentials();
      if (!url || !anonKey) {
        setLoadingGBP(false);
        return;
      }

      const supabase = createBrowserClient(url, anonKey);
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: gbpData } = await supabase
          .from('connected_gbp')
          .select('id, google_email, location_name, location_id, account_name, created_at')
          .eq('user_id', user.id);

        if (gbpData) {
          setConnectedGBP(gbpData);
        }

        // Also fetch business sync status
        const { data: businessData } = await supabase
          .from('businesses')
          .select('gbp_location_id, name, gbp_data')
          .eq('user_id', user.id)
          .not('gbp_location_id', 'is', null);

        if (businessData) {
          setBusinessSyncStatus(businessData);
        }
      }

      // Check if GBP OAuth is configured
      const { data: settings, error: settingsError } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'gbp_oauth')
        .single();

      console.log('GBP OAuth settings query:', { settings, settingsError });

      if (settings?.value) {
        const config = settings.value as { client_id?: string };
        console.log('GBP OAuth config found:', { hasClientId: !!config.client_id });
        setGbpOAuthConfigured(!!config.client_id);
      } else {
        console.log('No GBP OAuth settings found');
      }

      setLoadingGBP(false);
    };

    loadGBP();
  }, []);

  const fetchModels = useCallback(async (provider: string, apiKey: string, baseUrl?: string) => {
    setFetchingModels(true);
    setModelsError(null);
    setModelsFetched(false);

    try {
      const response = await fetch('/api/ai/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey, baseUrl }),
      });

      const data = await response.json();

      if (response.ok && data.models?.length > 0) {
        setAvailableModels(data.models);
        setModelsFetched(true);
        if (!data.models.includes(currentModel)) {
          setCurrentModel(data.models[0]);
        }
      } else if (data.needsKey) {
        const fallback = FALLBACK_MODELS[provider] || [];
        setAvailableModels(fallback);
        setModelsError('Enter API key to fetch available models');
      } else {
        setModelsError(data.error || 'Failed to fetch models');
        const fallback = FALLBACK_MODELS[provider] || [];
        setAvailableModels(fallback);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
      setModelsError('Failed to fetch models');
      const fallback = FALLBACK_MODELS[provider] || [];
      setAvailableModels(fallback);
    }

    setFetchingModels(false);
  }, [currentModel]);

  useEffect(() => {
    if (currentProvider) {
      if (currentProvider === 'ollama' || currentApiKey) {
        fetchModels(currentProvider, currentApiKey, currentBaseUrl);
      } else {
        setAvailableModels(FALLBACK_MODELS[currentProvider] || []);
        setModelsError('Enter API key to fetch available models');
      }
    }
  }, [currentProvider, fetchModels, currentApiKey, currentBaseUrl]);

  // Fetch image models for Gemini (uses the same API as text models)
  const fetchImageModels = useCallback(async (apiKey: string) => {
    if (!apiKey) {
      setAvailableImageModels(FALLBACK_MODELS['gemini'] || []);
      setImageModelsError('Enter API key to fetch available models');
      return;
    }

    setFetchingImageModels(true);
    setImageModelsError(null);

    try {
      const response = await fetch('/api/ai/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'gemini', apiKey }),
      });

      const data = await response.json();

      if (response.ok && data.models?.length > 0) {
        setAvailableImageModels(data.models);
        // Set first model if current model is not in the list
        if (!data.models.includes(currentImageModel)) {
          setCurrentImageModel(data.models[0]);
        }
      } else if (data.needsKey) {
        setAvailableImageModels(FALLBACK_MODELS['gemini'] || []);
        setImageModelsError('Enter API key to fetch available models');
      } else {
        setImageModelsError(data.error || 'Failed to fetch models');
        setAvailableImageModels(FALLBACK_MODELS['gemini'] || []);
      }
    } catch (error) {
      console.error('Failed to fetch image models:', error);
      setImageModelsError('Failed to fetch models');
      setAvailableImageModels(FALLBACK_MODELS['gemini'] || []);
    }

    setFetchingImageModels(false);
  }, [currentImageModel]);

  // Auto-fetch Gemini models when Gemini is selected for image generation
  useEffect(() => {
    if (currentImageProvider === 'gemini') {
      let apiKey = currentImageApiKey;
      // If using same as text and Gemini text model is configured, use that API key
      if (currentImageUseSameAsText && aiConfigs.providers['gemini']?.apiKey) {
        apiKey = aiConfigs.providers['gemini'].apiKey;
      }
      if (apiKey) {
        fetchImageModels(apiKey);
      } else {
        setAvailableImageModels(FALLBACK_MODELS['gemini'] || []);
        setImageModelsError('Enter API key or configure Gemini text model to fetch available models');
      }
    }
  }, [currentImageProvider, currentImageApiKey, currentImageUseSameAsText, aiConfigs.providers, fetchImageModels]);

  const handleSave = () => {
    setSaving(true);
    // Save multi-provider config for text models
    localStorage.setItem('localseo-ai-configs', JSON.stringify(aiConfigs));
    // Also save active provider in old format for backward compatibility
    if (aiConfigs.active && aiConfigs.providers[aiConfigs.active]) {
      localStorage.setItem('localseo-ai', JSON.stringify(aiConfigs.providers[aiConfigs.active]));
    }
    localStorage.setItem('localseo-google', JSON.stringify(googleSettings));
    
    // Save multi-provider image config
    localStorage.setItem('localseo-ai-image', JSON.stringify(imageConfigs));
    
    // Save branding config
    localStorage.setItem('localseo-branding', JSON.stringify(brandingConfig));
    
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 5000);
    }, 500);
  };

  const testAndConnectProvider = async () => {
    setTesting(true);
    setTestResult(null);
    setTestError(null);
    
    try {
      const response = await fetch('/api/config/test-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: currentProvider,
          apiKey: currentApiKey,
          model: currentModel,
          baseUrl: currentBaseUrl,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setTestResult('success');
        // Add this provider to connected providers
        const newConfig: AIProviderConfig = {
          provider: currentProvider,
          model: currentModel,
          apiKey: currentApiKey,
          baseUrl: currentBaseUrl,
          isConnected: true,
        };
        
        setAiConfigs(prev => {
          const updated = {
            ...prev,
            providers: {
              ...prev.providers,
              [currentProvider]: newConfig,
            },
            // If no active provider set, make this one active
            active: prev.active || currentProvider,
          };
          // Save immediately
          localStorage.setItem('localseo-ai-configs', JSON.stringify(updated));
          // Also update old format for backward compatibility
          if (updated.active === currentProvider) {
            localStorage.setItem('localseo-ai', JSON.stringify(newConfig));
          }
          return updated;
        });
        
        // Reset form for next provider
        setTimeout(() => {
          setCurrentApiKey('');
          setCurrentModel('');
          setTestResult(null);
        }, 2000);
      } else {
        setTestResult('error');
        setTestError(data.error || 'Connection failed');
      }
    } catch {
      setTestResult('error');
      setTestError('Connection failed');
    }
    
    setTesting(false);
  };

  const setActiveProvider = (provider: string) => {
    setAiConfigs(prev => {
      const updated = { ...prev, active: provider };
      localStorage.setItem('localseo-ai-configs', JSON.stringify(updated));
      // Update old format
      if (updated.providers[provider]) {
        localStorage.setItem('localseo-ai', JSON.stringify(updated.providers[provider]));
      }
      return updated;
    });
  };

  const removeProvider = (provider: string) => {
    setAiConfigs(prev => {
      const newProviders = { ...prev.providers };
      delete newProviders[provider];
      const updated = {
        ...prev,
        providers: newProviders,
        active: prev.active === provider ? Object.keys(newProviders)[0] || '' : prev.active,
      };
      localStorage.setItem('localseo-ai-configs', JSON.stringify(updated));
      if (updated.active && updated.providers[updated.active]) {
        localStorage.setItem('localseo-ai', JSON.stringify(updated.providers[updated.active]));
      } else {
        localStorage.removeItem('localseo-ai');
      }
      return updated;
    });
  };

  const getProviderDisplayName = (provider: string) => {
    const names: Record<string, string> = {
      openai: 'OpenAI',
      anthropic: 'Anthropic',
      gemini: 'Google Gemini',
      ollama: 'Ollama',
    };
    return names[provider] || provider;
  };

  const handleConnectGBP = () => {
    console.log('handleConnectGBP clicked!');
    // Set cookie with supabase config for the API route to read
    const { url, anonKey } = getSupabaseCredentials();
    console.log('Supabase credentials:', { url: url ? 'set' : 'missing', anonKey: anonKey ? 'set' : 'missing' });
    if (url && anonKey) {
      document.cookie = `supabase-config=${encodeURIComponent(JSON.stringify({ url, anonKey }))};path=/;max-age=300`;
      console.log('Cookie set, redirecting to /api/auth/google...');
    } else {
      console.error('Missing Supabase credentials!');
    }
    // Redirect to OAuth endpoint
    window.location.href = '/api/auth/google';
  };

  const handleDisconnectGBP = async (gbpId: string) => {
    const { url, anonKey } = getSupabaseCredentials();
    if (!url || !anonKey) return;

    const supabase = createBrowserClient(url, anonKey);
    await supabase.from('connected_gbp').delete().eq('id', gbpId);
    setConnectedGBP(prev => prev.filter(g => g.id !== gbpId));
  };

  // Show loading skeleton until client-side hydration is complete
  if (!mounted) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Settings</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Configure your integrations and preferences
          </p>
        </div>
        <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Configure your integrations and preferences
        </p>
      </div>

      {saved && (
        <Alert className="bg-emerald-50 border-emerald-200 text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Settings saved successfully!</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="gbp">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="gbp" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Google Business
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Bot className="w-4 h-4" />
            AI Models
          </TabsTrigger>
          <TabsTrigger value="branding" className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="places" className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            Places API
          </TabsTrigger>
          <TabsTrigger value="automation" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Automation
          </TabsTrigger>
        </TabsList>

        {/* GBP Connection Tab */}
        <TabsContent value="gbp" className="mt-6 space-y-6" id="gbp">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-600" />
                Google Business Profile Connection
              </CardTitle>
              <CardDescription>
                Connect your Google account to import and manage your business profiles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loadingGBP ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : (
                <>
                  {/* Group GBP connections by Google account */}
                  {(() => {
                    // Group by email
                    const grouped: GroupedGBPAccount[] = [];
                    connectedGBP.forEach((gbp) => {
                      const existing = grouped.find((g) => g.email === gbp.google_email);
                      if (existing) {
                        existing.locations.push(gbp);
                      } else {
                        grouped.push({
                          email: gbp.google_email,
                          accountName: gbp.account_name,
                          connectedAt: gbp.created_at,
                          locations: [gbp],
                        });
                      }
                    });

                    if (grouped.length === 0) {
                      return gbpOAuthConfigured ? (
                        <div className="p-6 border-2 border-dashed rounded-lg text-center">
                          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                          <h3 className="font-medium text-slate-900 dark:text-white mb-2">
                            No Google Account Connected
                          </h3>
                          <p className="text-sm text-slate-500 mb-4">
                            Connect your Google account to import all your GBP business locations
                          </p>
                          <Button onClick={handleConnectGBP} className="bg-emerald-600 hover:bg-emerald-500">
                            <LinkIcon className="w-4 h-4 mr-2" />
                            Connect with Google
                          </Button>
                        </div>
                      ) : (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>OAuth Not Configured</AlertTitle>
                          <AlertDescription>
                            The administrator needs to configure GBP OAuth credentials before you can connect your profile.
                          </AlertDescription>
                        </Alert>
                      );
                    }

                    return (
                      <div className="space-y-6">
                        {grouped.map((account) => {
                          const getSyncStatus = (locationId: string) => {
                            return businessSyncStatus.find((b) => b.gbp_location_id === locationId);
                          };

                          return (
                            <div key={account.email} className="border rounded-lg overflow-hidden">
                              {/* Google Account Header */}
                              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-b">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                      </svg>
                                    </div>
                                    <div>
                                      <p className="font-medium text-slate-900 dark:text-white">{account.email}</p>
                                      <p className="text-sm text-slate-500">
                                        {account.locations.length} business location{account.locations.length !== 1 ? 's' : ''} • 
                                        Connected {new Date(account.connectedAt).toLocaleDateString()}
                                      </p>
                                    </div>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-red-500 border-red-200 hover:text-red-600 hover:bg-red-50"
                                    onClick={async () => {
                                      // Disconnect all locations for this account
                                      for (const loc of account.locations) {
                                        await handleDisconnectGBP(loc.id);
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4 mr-1" />
                                    Disconnect Account
                                  </Button>
                                </div>
                              </div>

                              {/* Business Locations List */}
                              <div className="divide-y">
                                {account.locations.map((loc) => {
                                  const syncStatus = getSyncStatus(loc.location_id);
                                  const isSynced = !!syncStatus?.gbp_data?.syncedAt;

                                  return (
                                    <div
                                      key={loc.id}
                                      className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                          isSynced 
                                            ? 'bg-emerald-100 dark:bg-emerald-900' 
                                            : 'bg-slate-100 dark:bg-slate-800'
                                        }`}>
                                          <Building2 className={`w-4 h-4 ${
                                            isSynced 
                                              ? 'text-emerald-600 dark:text-emerald-400' 
                                              : 'text-slate-400'
                                          }`} />
                                        </div>
                                        <div>
                                          <p className="font-medium text-sm">{loc.location_name}</p>
                                          <div className="flex items-center gap-2 mt-0.5">
                                            {isSynced ? (
                                              <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-600 bg-emerald-50">
                                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                                Data Synced
                                              </Badge>
                                            ) : (
                                              <Badge variant="secondary" className="text-xs">
                                                Not Synced
                                              </Badge>
                                            )}
                                            {isSynced && syncStatus?.gbp_data?.syncedAt && (
                                              <span className="text-xs text-slate-400">
                                                Last sync: {new Date(syncStatus.gbp_data.syncedAt).toLocaleDateString()}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <Link href={`/businesses`}>
                                        <Button variant="ghost" size="sm" className="text-xs">
                                          {isSynced ? 'View' : 'Sync Data'}
                                          <ExternalLink className="w-3 h-3 ml-1" />
                                        </Button>
                                      </Link>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}

                        {/* Add another account button */}
                        {gbpOAuthConfigured && (
                          <Button onClick={handleConnectGBP} variant="outline" size="sm">
                            <LinkIcon className="w-4 h-4 mr-2" />
                            Connect Another Google Account
                          </Button>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </CardContent>
          </Card>

          {/* Info Card about the process */}
          {connectedGBP.length > 0 && (
            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-medium mb-1">How GBP Connection Works:</p>
                    <ol className="list-decimal list-inside space-y-1 text-blue-700 dark:text-blue-300">
                      <li><strong>Connect Account:</strong> Link your Google account to import business locations</li>
                      <li><strong>Sync Data:</strong> Go to each business and click "Sync GBP Data" to fetch reviews, photos, etc.</li>
                      <li><strong>Get Insights:</strong> Once synced, you'll see scores, recommendations, and can generate content</li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* AI Provider Tab */}
        <TabsContent value="ai" className="mt-6 space-y-6">
          {/* Connected Models - Text & Image */}
          {(Object.keys(aiConfigs.providers).length > 0 || Object.keys(imageConfigs.providers).length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Connected AI Models
                </CardTitle>
                <CardDescription>
                  Select one model for text generation and one for image generation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Text Generation Models */}
                {Object.keys(aiConfigs.providers).length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                      <Bot className="w-4 h-4" />
                      Text Generation Models
                    </div>
                    {Object.entries(aiConfigs.providers).map(([key, config]) => (
                      <div
                        key={key}
                        className={`flex items-center justify-between p-4 rounded-lg border transition-colors cursor-pointer ${
                          aiConfigs.active === key 
                            ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-700' 
                            : 'bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                        onClick={() => setActiveProvider(key)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            aiConfigs.active === key 
                              ? 'border-emerald-600' 
                              : 'border-slate-400'
                          }`}>
                            {aiConfigs.active === key && (
                              <div className="w-2 h-2 rounded-full bg-emerald-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{getProviderDisplayName(config.provider)}</p>
                            <p className="text-sm text-slate-500">{config.model}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {aiConfigs.active === key && (
                            <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeProvider(key);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Separator if both sections exist */}
                {Object.keys(aiConfigs.providers).length > 0 && Object.keys(imageConfigs.providers).length > 0 && (
                  <Separator />
                )}

                {/* Image Generation Models */}
                {Object.keys(imageConfigs.providers).length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                      <ImageIcon className="w-4 h-4" />
                      Image Generation Models
                    </div>
                    {Object.entries(imageConfigs.providers).map(([key, config]) => (
                      <div
                        key={key}
                        className={`flex items-center justify-between p-4 rounded-lg border transition-colors cursor-pointer ${
                          imageConfigs.active === key 
                            ? 'bg-purple-50 border-purple-300 dark:bg-purple-900/20 dark:border-purple-700' 
                            : 'bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                        onClick={() => setImageConfigs(prev => ({ ...prev, active: key }))}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            imageConfigs.active === key 
                              ? 'border-purple-600' 
                              : 'border-slate-400'
                          }`}>
                            {imageConfigs.active === key && (
                              <div className="w-2 h-2 rounded-full bg-purple-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">
                              {config.provider === 'openai' && 'OpenAI (DALL-E / GPT Image)'}
                              {config.provider === 'gemini' && 'Google Gemini'}
                              {config.provider === 'nanobanana' && 'Nano Banana'}
                            </p>
                            <p className="text-sm text-slate-500">
                              {config.model}
                              {config.useSameAsText && (config.provider === 'openai' || config.provider === 'gemini') && ' (using Text API key)'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {imageConfigs.active === key && (
                            <Badge className="bg-purple-100 text-purple-700">Active</Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Remove this image provider
                              setImageConfigs(prev => {
                                const newProviders = { ...prev.providers };
                                delete newProviders[key];
                                return {
                                  active: prev.active === key ? (Object.keys(newProviders)[0] || '') : prev.active,
                                  providers: newProviders,
                                };
                              });
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty state */}
                {Object.keys(aiConfigs.providers).length === 0 && Object.keys(imageConfigs.providers).length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">
                    No AI models connected yet. Add a text or image model below.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Add New Provider */}
          <Card>
            <CardHeader>
              <CardTitle>
                {Object.keys(aiConfigs.providers).length > 0 ? 'Add Another AI Provider' : 'Connect AI Provider'}
              </CardTitle>
              <CardDescription>
                Connect multiple AI providers and switch between them as needed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select
                  value={currentProvider}
                  onValueChange={(value) => {
                    setCurrentProvider(value);
                    setCurrentApiKey('');
                    setCurrentModel('');
                    setCurrentBaseUrl('');
                    setTestResult(null);
                    setTestError(null);
                    setAvailableModels([]);
                    setModelsFetched(false);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI (GPT-4o)</SelectItem>
                    <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                    <SelectItem value="gemini">Google Gemini</SelectItem>
                    <SelectItem value="ollama">Ollama (Local)</SelectItem>
                  </SelectContent>
                </Select>
                {aiConfigs.providers[currentProvider] && (
                  <p className="text-xs text-amber-600">
                    ⚠️ This provider is already connected. Adding again will update the existing configuration.
                  </p>
                )}
              </div>

              {currentProvider !== 'ollama' && (
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={currentApiKey}
                    onChange={(e) => setCurrentApiKey(e.target.value)}
                    onBlur={() => {
                      if (currentApiKey) {
                        fetchModels(currentProvider, currentApiKey, currentBaseUrl);
                      }
                    }}
                    placeholder="Enter your API key..."
                  />
                  <p className="text-xs text-slate-500">
                    {currentProvider === 'openai' && (
                      <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                        Get OpenAI API key <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {currentProvider === 'anthropic' && (
                      <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                        Get Anthropic API key <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {currentProvider === 'gemini' && (
                      <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                        Get Gemini API key <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </p>
                </div>
              )}

              {currentProvider === 'ollama' && (
                <div className="space-y-2">
                  <Label>Ollama Base URL</Label>
                  <Input
                    value={currentBaseUrl}
                    onChange={(e) => setCurrentBaseUrl(e.target.value)}
                    placeholder="http://localhost:11434"
                  />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Model</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchModels(currentProvider, currentApiKey, currentBaseUrl)}
                    disabled={fetchingModels}
                  >
                    {fetchingModels ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    <span className="ml-1 text-xs">Refresh</span>
                  </Button>
                </div>
                <Select
                  value={currentModel}
                  onValueChange={(value) => setCurrentModel(value)}
                  disabled={availableModels.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map((model) => (
                      <SelectItem key={model} value={model}>{model}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {modelsFetched && (
                  <p className="text-xs text-emerald-600">✓ {availableModels.length} models available</p>
                )}
                {modelsError && <p className="text-xs text-amber-600">{modelsError}</p>}
              </div>

              <Separator />

              <div className="flex items-center gap-3">
                <Button 
                  onClick={testAndConnectProvider} 
                  disabled={testing || !currentModel || (!currentApiKey && currentProvider !== 'ollama')}
                  className="bg-emerald-600 hover:bg-emerald-500"
                >
                  {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Test & Connect
                </Button>
                {testResult === 'success' && <Badge className="bg-emerald-100 text-emerald-700">Connected!</Badge>}
                {testResult === 'error' && (
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">Failed</Badge>
                    {testError && <span className="text-sm text-red-500">{testError}</span>}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Add Image Generation Model */}
          <Card className="border-purple-200 dark:border-purple-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-purple-600" />
                {Object.keys(imageConfigs.providers).length > 0 ? 'Add Another Image Model' : 'Add Image Generation Model'}
              </CardTitle>
              <CardDescription>
                Configure AI models for generating images (posts, photos, promotional content)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select
                  value={currentImageProvider}
                  onValueChange={(value: 'openai' | 'gemini' | 'nanobanana' | 'none') => {
                    setCurrentImageProvider(value);
                    setCurrentImageUseSameAsText(value === 'openai' || value === 'gemini');
                    // Set default model based on provider
                    if (value === 'openai') {
                      setCurrentImageModel('gpt-image-1');
                    } else if (value === 'gemini') {
                      // Will be set by useEffect after fetching models
                      setCurrentImageModel('');
                      setAvailableImageModels([]);
                      setImageModelsError(null);
                    } else {
                      setCurrentImageModel('');
                    }
                    setCurrentImageApiKey('');
                    setImageTestResult(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI (DALL-E / GPT Image)</SelectItem>
                    <SelectItem value="gemini">Google Gemini</SelectItem>
                    <SelectItem value="nanobanana">Nano Banana</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {currentImageProvider === 'openai' && (
                <>
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Select
                      value={currentImageModel}
                      onValueChange={(value) => setCurrentImageModel(value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-image-1">GPT Image 1 (Best - text rendering)</SelectItem>
                        <SelectItem value="dall-e-3">DALL-E 3 (High quality)</SelectItem>
                        <SelectItem value="dall-e-2">DALL-E 2 (Budget)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">
                      GPT Image 1 is recommended for images with text (promotional content, banners)
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="useSameAsText"
                      checked={currentImageUseSameAsText}
                      onChange={(e) => setCurrentImageUseSameAsText(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    <Label htmlFor="useSameAsText" className="text-sm font-normal cursor-pointer">
                      Use same API key as Text model (OpenAI)
                    </Label>
                  </div>

                  {currentImageUseSameAsText && !aiConfigs.providers['openai']?.apiKey && (
                    <Alert variant="default" className="border-amber-300 bg-amber-50 dark:bg-amber-900/20">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-700 dark:text-amber-400">
                        No OpenAI text model configured. Add an OpenAI text model above, or uncheck this option to enter a separate API key.
                      </AlertDescription>
                    </Alert>
                  )}

                  {!currentImageUseSameAsText && (
                    <div className="space-y-2">
                      <Label>OpenAI API Key (for images)</Label>
                      <Input
                        type="password"
                        value={currentImageApiKey}
                        onChange={(e) => setCurrentImageApiKey(e.target.value)}
                        placeholder="sk-..."
                      />
                    </div>
                  )}
                </>
              )}

              {currentImageProvider === 'gemini' && (
                <>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="useSameAsTextGemini"
                      checked={currentImageUseSameAsText}
                      onChange={(e) => setCurrentImageUseSameAsText(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    <Label htmlFor="useSameAsTextGemini" className="text-sm font-normal cursor-pointer">
                      Use same API key as Text model (Gemini)
                    </Label>
                  </div>

                  {currentImageUseSameAsText && !aiConfigs.providers['gemini']?.apiKey && (
                    <Alert variant="default" className="border-amber-300 bg-amber-50 dark:bg-amber-900/20">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-700 dark:text-amber-400">
                        No Gemini text model configured. Add a Gemini text model above, or uncheck this option to enter a separate API key.
                      </AlertDescription>
                    </Alert>
                  )}

                  {!currentImageUseSameAsText && (
                    <div className="space-y-2">
                      <Label>Gemini API Key (for images)</Label>
                      <Input
                        type="password"
                        value={currentImageApiKey}
                        onChange={(e) => setCurrentImageApiKey(e.target.value)}
                        onBlur={() => {
                          if (currentImageApiKey) {
                            fetchImageModels(currentImageApiKey);
                          }
                        }}
                        placeholder="AIza..."
                      />
                      <p className="text-xs text-slate-500">
                        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                          Get Gemini API key <ExternalLink className="w-3 h-3" />
                        </a>
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Model</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          let apiKey = currentImageApiKey;
                          if (currentImageUseSameAsText && aiConfigs.providers['gemini']?.apiKey) {
                            apiKey = aiConfigs.providers['gemini'].apiKey;
                          }
                          fetchImageModels(apiKey);
                        }}
                        disabled={fetchingImageModels}
                      >
                        {fetchingImageModels ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        <span className="ml-1 text-xs">Refresh</span>
                      </Button>
                    </div>
                    <Select
                      value={currentImageModel}
                      onValueChange={(value) => setCurrentImageModel(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableImageModels.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {imageModelsError && (
                      <p className="text-xs text-amber-600">{imageModelsError}</p>
                    )}
                    <p className="text-xs text-slate-500">
                      Select any Gemini model for image generation. Models with multimodal capabilities can generate images.
                    </p>
                  </div>
                </>
              )}

              {currentImageProvider === 'nanobanana' && (
                <div className="space-y-2">
                  <Label>Nano Banana API Key</Label>
                  <Input
                    type="password"
                    value={currentImageApiKey}
                    onChange={(e) => setCurrentImageApiKey(e.target.value)}
                    placeholder="Enter your Nano Banana API key..."
                  />
                  <p className="text-xs text-slate-500">
                    <a href="https://nano-banana.ai" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                      Get Nano Banana API key <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                </div>
              )}

              {/* Check if this model is already configured */}
              {currentImageProvider !== 'none' && imageConfigs.providers[`${currentImageProvider}-${currentImageModel}`] && (
                <Alert variant="default" className="border-amber-300 bg-amber-50 dark:bg-amber-900/20">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-700 dark:text-amber-400">
                    This model is already configured. Adding it again will update the existing configuration.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex items-center gap-3">
                <Button 
                  variant="outline"
                  onClick={async () => {
                    setTestingImage(true);
                    setImageTestResult(null);
                    
                    try {
                      // Get the API key to use
                      let apiKey = currentImageApiKey;
                      if (currentImageProvider === 'openai' && currentImageUseSameAsText) {
                        const openaiConfig = aiConfigs.providers['openai'];
                        if (openaiConfig?.apiKey) {
                          apiKey = openaiConfig.apiKey;
                        } else {
                          throw new Error('OpenAI text model is not configured. Please configure an OpenAI text model first, or uncheck "Use same API key as Text Model".');
                        }
                      } else if (currentImageProvider === 'gemini' && currentImageUseSameAsText) {
                        const geminiConfig = aiConfigs.providers['gemini'];
                        if (geminiConfig?.apiKey) {
                          apiKey = geminiConfig.apiKey;
                        } else {
                          throw new Error('Gemini text model is not configured. Please configure a Gemini text model first, or uncheck "Use same API key as Text Model".');
                        }
                      }

                      if (!apiKey && !currentImageUseSameAsText) {
                        throw new Error('Please enter an API key');
                      }

                      // Simple test - just verify the key format
                      if (currentImageProvider === 'openai' && apiKey && !apiKey.startsWith('sk-')) {
                        throw new Error('Invalid OpenAI API key format. Key should start with "sk-"');
                      }
                      if (currentImageProvider === 'gemini' && apiKey && !apiKey.startsWith('AIza')) {
                        throw new Error('Invalid Gemini API key format. Key should start with "AIza"');
                      }

                      // Create the config to add
                      const key = `${currentImageProvider}-${currentImageModel || 'default'}`;
                      const newConfig: ImageModelConfig = {
                        provider: currentImageProvider,
                        model: currentImageModel,
                        apiKey: currentImageUseSameAsText ? '' : apiKey,
                        useSameAsText: currentImageUseSameAsText,
                      };

                      // Add to providers
                      setImageConfigs(prev => ({
                        active: prev.active || key, // Set as active if first one
                        providers: {
                          ...prev.providers,
                          [key]: newConfig,
                        },
                      }));

                      setImageTestResult('success');
                      
                      // Reset form
                      setTimeout(() => {
                        setCurrentImageApiKey('');
                        setImageTestResult(null);
                      }, 2000);
                    } catch (err) {
                      setImageTestResult('error');
                      console.error('Image config error:', err);
                    }
                    
                    setTestingImage(false);
                  }}
                  disabled={testingImage || currentImageProvider === 'none'}
                >
                  {testingImage ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Add Image Model
                </Button>
                {imageTestResult === 'success' && <Badge className="bg-emerald-100 text-emerald-700">Added!</Badge>}
                {imageTestResult === 'error' && <Badge variant="destructive">Configuration Error</Badge>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-purple-600" />
                Business Branding
              </CardTitle>
              <CardDescription>
                Set defaults for AI-generated content. These will be auto-filled when generating content.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo Upload */}
              <div className="space-y-3">
                <Label>Company Logo</Label>
                <div className="flex items-start gap-4">
                  <div className="w-24 h-24 border-2 border-dashed rounded-lg flex items-center justify-center bg-slate-50 dark:bg-slate-800 overflow-hidden">
                    {brandingConfig.logo ? (
                      <img src={brandingConfig.logo} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-slate-300" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <input
                      type="file"
                      id="logo-upload"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setBrandingConfig(prev => ({ ...prev, logo: reader.result as string }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => document.getElementById('logo-upload')?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Logo
                    </Button>
                    {brandingConfig.logo && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-red-500"
                        onClick={() => setBrandingConfig(prev => ({ ...prev, logo: null }))}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove
                      </Button>
                    )}
                    <p className="text-xs text-slate-500">PNG, JPG, or SVG. Max 2MB.</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Contact Information */}
              <div className="space-y-4">
                <Label className="text-base">Contact Information</Label>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-400" />
                      Email
                    </Label>
                    <Input
                      value={brandingConfig.email}
                      onChange={(e) => setBrandingConfig(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="info@company.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400" />
                      Phone
                    </Label>
                    <Input
                      value={brandingConfig.phone}
                      onChange={(e) => setBrandingConfig(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+91-9876543210"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-slate-400" />
                    Website
                  </Label>
                  <Input
                    value={brandingConfig.website}
                    onChange={(e) => setBrandingConfig(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="https://www.company.com"
                  />
                </div>
              </div>

              <Separator />

              {/* Default Include Options */}
              <div className="space-y-4">
                <Label className="text-base">Default Include in AI-Generated Content</Label>
                <p className="text-sm text-slate-500">
                  These options will be pre-selected when generating content. You can change them per generation.
                </p>
                
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="default-logo"
                      checked={brandingConfig.defaults.includeLogo}
                      onChange={(e) => setBrandingConfig(prev => ({ 
                        ...prev, 
                        defaults: { ...prev.defaults, includeLogo: e.target.checked }
                      }))}
                      className="rounded border-slate-300"
                    />
                    <Label htmlFor="default-logo" className="text-sm font-normal cursor-pointer">
                      Company Logo (for images)
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="default-phone"
                      checked={brandingConfig.defaults.includePhone}
                      onChange={(e) => setBrandingConfig(prev => ({ 
                        ...prev, 
                        defaults: { ...prev.defaults, includePhone: e.target.checked }
                      }))}
                      className="rounded border-slate-300"
                    />
                    <Label htmlFor="default-phone" className="text-sm font-normal cursor-pointer">
                      Phone Number
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="default-website"
                      checked={brandingConfig.defaults.includeWebsite}
                      onChange={(e) => setBrandingConfig(prev => ({ 
                        ...prev, 
                        defaults: { ...prev.defaults, includeWebsite: e.target.checked }
                      }))}
                      className="rounded border-slate-300"
                    />
                    <Label htmlFor="default-website" className="text-sm font-normal cursor-pointer">
                      Website URL
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="default-email"
                      checked={brandingConfig.defaults.includeEmail}
                      onChange={(e) => setBrandingConfig(prev => ({ 
                        ...prev, 
                        defaults: { ...prev.defaults, includeEmail: e.target.checked }
                      }))}
                      className="rounded border-slate-300"
                    />
                    <Label htmlFor="default-email" className="text-sm font-normal cursor-pointer">
                      Email Address
                    </Label>
                  </div>
                </div>
              </div>

              <Separator />

              <Button 
                onClick={() => {
                  localStorage.setItem('localseo-branding', JSON.stringify(brandingConfig));
                  setSaved(true);
                  setTimeout(() => setSaved(false), 3000);
                }}
                className="bg-emerald-600 hover:bg-emerald-500"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Branding Settings
              </Button>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card className="bg-slate-50 dark:bg-slate-800/50">
            <CardHeader>
              <CardTitle className="text-sm">Preview</CardTitle>
              <CardDescription>
                How your branding will appear in generated content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border space-y-3">
                {brandingConfig.logo && (
                  <img src={brandingConfig.logo} alt="Logo" className="h-10 object-contain" />
                )}
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  [Your AI-generated content will appear here]
                </p>
                <div className="text-xs text-slate-500 space-y-1">
                  {brandingConfig.defaults.includePhone && brandingConfig.phone && (
                    <p>📞 {brandingConfig.phone}</p>
                  )}
                  {brandingConfig.defaults.includeEmail && brandingConfig.email && (
                    <p>✉️ {brandingConfig.email}</p>
                  )}
                  {brandingConfig.defaults.includeWebsite && brandingConfig.website && (
                    <p>🌐 {brandingConfig.website}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Places API Tab */}
        <TabsContent value="places" className="mt-6 space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Optional</AlertTitle>
            <AlertDescription>
              Places API is only needed for competitor analysis or auditing businesses you don&apos;t own.
              If you&apos;ve connected your GBP above, you don&apos;t need this.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Google Places API
                <Badge variant="secondary">Optional</Badge>
              </CardTitle>
              <CardDescription>
                Enable public data audits for any business (competitors, prospects)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Google Places API Key</Label>
                <Input
                  type="password"
                  value={googleSettings.placesApiKey}
                  onChange={(e) => setGoogleSettings({ ...googleSettings, placesApiKey: e.target.value })}
                  placeholder="AIza..."
                />
                <p className="text-xs text-slate-500">
                  <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                    Get from Google Cloud Console <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Automation Tab */}
        <TabsContent value="automation" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-600" />
                Automation Settings
              </CardTitle>
              <CardDescription>
                Configure AI-powered automation for posts and review responses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6">
                <p className="text-slate-500 mb-4">
                  Set up automatic posting schedules and review response automation
                </p>
                <Link href="/settings/automation">
                  <Button className="bg-purple-600 hover:bg-purple-500">
                    <Zap className="w-4 h-4 mr-2" />
                    Configure Automation
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end items-center gap-3">
        {saved && (
          <span className="text-sm text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" />
            Settings saved!
          </span>
        )}
        <Button 
          onClick={handleSave} 
          disabled={saving}
          variant={saved ? "outline" : "default"}
          className={saved ? "border-emerald-500 text-emerald-600" : ""}
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
          ) : saved ? (
            <><CheckCircle2 className="w-4 h-4 mr-2" /> Saved</>
          ) : (
            <><Save className="w-4 h-4 mr-2" /> Save Settings</>
          )}
        </Button>
      </div>
    </div>
  );
}
