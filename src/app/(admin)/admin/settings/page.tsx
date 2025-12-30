'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Building2,
  Bot,
  Save,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Info,
  Shield,
  Key,
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

interface GBPOAuthConfig {
  client_id: string;
  client_secret: string;
}

interface DefaultAIConfig {
  provider: string;
  model: string;
  api_key?: string;
}

export default function AdminSettingsPage() {
  const [gbpConfig, setGbpConfig] = useState<GBPOAuthConfig>({
    client_id: '',
    client_secret: '',
  });
  const [aiConfig, setAiConfig] = useState<DefaultAIConfig>({
    provider: 'openai',
    model: 'gpt-4o-mini',
    api_key: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const { url, anonKey } = getSupabaseCredentials();
      if (!url || !anonKey) return;

      const supabase = createBrowserClient(url, anonKey);

      // Fetch GBP OAuth settings
      const { data: gbpData } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'gbp_oauth')
        .single();

      if (gbpData?.value) {
        setGbpConfig(gbpData.value as GBPOAuthConfig);
      }

      // Fetch default AI settings
      const { data: aiData } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'default_ai')
        .single();

      if (aiData?.value) {
        setAiConfig(aiData.value as DefaultAIConfig);
      }

      setLoading(false);
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { url, anonKey } = getSupabaseCredentials();
    if (!url || !anonKey) return;

    const supabase = createBrowserClient(url, anonKey);
    const { data: { user } } = await supabase.auth.getUser();

    // Save GBP OAuth
    await supabase
      .from('admin_settings')
      .upsert({
        key: 'gbp_oauth',
        value: gbpConfig,
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    // Save default AI
    await supabase
      .from('admin_settings')
      .upsert({
        key: 'default_ai',
        value: aiConfig,
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    setSaving(false);
    setSaved(true);
  };

  const callbackUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/auth/google/callback`
    : '';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-white">System Settings</h1>
        <p className="text-slate-400 mt-1">
          Configure system-wide settings for all clients
        </p>
      </div>

      {saved && (
        <Alert className="bg-emerald-500/10 border-emerald-500/30">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <AlertDescription className="text-emerald-300">
            Settings saved successfully!
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="gbp">
        <TabsList className="bg-slate-800">
          <TabsTrigger value="gbp" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
            <Building2 className="w-4 h-4 mr-2" />
            GBP OAuth
          </TabsTrigger>
          <TabsTrigger value="ai" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
            <Bot className="w-4 h-4 mr-2" />
            Default AI
          </TabsTrigger>
        </TabsList>

        {/* GBP OAuth Tab */}
        <TabsContent value="gbp" className="mt-6 space-y-6">
          <Alert className="bg-blue-500/10 border-blue-500/30">
            <Shield className="h-4 w-4 text-blue-400" />
            <AlertTitle className="text-blue-300">Admin-Only Configuration</AlertTitle>
            <AlertDescription className="text-blue-300/70">
              These OAuth credentials allow your clients to connect their Google Business Profiles.
              Clients only need to click &quot;Connect GBP&quot; and sign in - no API keys required on their end.
            </AlertDescription>
          </Alert>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-500" />
                Google Business Profile OAuth
              </CardTitle>
              <CardDescription className="text-slate-400">
                Set up OAuth 2.0 to let clients connect their GBP accounts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-slate-800/50 rounded-lg space-y-3">
                <h4 className="font-medium text-sm text-white">Setup Instructions:</h4>
                <ol className="text-sm text-slate-400 space-y-2 list-decimal list-inside">
                  <li>
                    Go to{' '}
                    <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline inline-flex items-center gap-1">
                      Google Cloud Console <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                  <li>Create a new project or select existing</li>
                  <li>Go to &quot;APIs & Services&quot; → &quot;Credentials&quot;</li>
                  <li>Create &quot;OAuth 2.0 Client ID&quot; (Web application)</li>
                  <li>Add authorized redirect URI below</li>
                  <li>Enable &quot;Google Business Profile API&quot;</li>
                </ol>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Authorized Redirect URI</Label>
                <div className="flex gap-2">
                  <Input
                    value={callbackUrl}
                    readOnly
                    className="bg-slate-800 border-slate-700 text-slate-300 font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    className="border-slate-700 text-slate-300"
                    onClick={() => navigator.clipboard.writeText(callbackUrl)}
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-slate-500">Add this URL to your OAuth consent screen</p>
              </div>

              <Separator className="bg-slate-800" />

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">OAuth Client ID</Label>
                  <Input
                    value={gbpConfig.client_id}
                    onChange={(e) => {
                      setGbpConfig({ ...gbpConfig, client_id: e.target.value });
                      setSaved(false);
                    }}
                    placeholder="123456789-xxxxxxxx.apps.googleusercontent.com"
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">OAuth Client Secret</Label>
                  <Input
                    type="password"
                    value={gbpConfig.client_secret}
                    onChange={(e) => {
                      setGbpConfig({ ...gbpConfig, client_secret: e.target.value });
                      setSaved(false);
                    }}
                    placeholder="GOCSPX-..."
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              {gbpConfig.client_id && gbpConfig.client_secret && (
                <Alert className="bg-emerald-500/10 border-emerald-500/30">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <AlertDescription className="text-emerald-300">
                    OAuth configured! Clients can now connect their Google Business Profiles.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Default AI Tab */}
        <TabsContent value="ai" className="mt-6 space-y-6">
          <Alert className="bg-slate-800 border-slate-700">
            <Info className="h-4 w-4 text-slate-400" />
            <AlertTitle className="text-slate-300">Optional System Default</AlertTitle>
            <AlertDescription className="text-slate-400">
              If set, clients without their own AI keys will use these defaults.
              Clients can always override with their own API keys in their settings.
            </AlertDescription>
          </Alert>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Bot className="w-5 h-5 text-amber-500" />
                Default AI Provider
              </CardTitle>
              <CardDescription className="text-slate-400">
                System-wide default for AI features (optional)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Default Provider</Label>
                <Input
                  value={aiConfig.provider}
                  onChange={(e) => {
                    setAiConfig({ ...aiConfig, provider: e.target.value });
                    setSaved(false);
                  }}
                  placeholder="openai"
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Default Model</Label>
                <Input
                  value={aiConfig.model}
                  onChange={(e) => {
                    setAiConfig({ ...aiConfig, model: e.target.value });
                    setSaved(false);
                  }}
                  placeholder="gpt-4o-mini"
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">System API Key (Optional)</Label>
                <Input
                  type="password"
                  value={aiConfig.api_key || ''}
                  onChange={(e) => {
                    setAiConfig({ ...aiConfig, api_key: e.target.value });
                    setSaved(false);
                  }}
                  placeholder="sk-..."
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
                <p className="text-xs text-slate-500">
                  If provided, clients without their own keys will use this. Leave empty to require clients to add their own.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className={saved ? "bg-emerald-600 hover:bg-emerald-500" : "bg-amber-600 hover:bg-amber-500"}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : saved ? (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Saved!
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}


