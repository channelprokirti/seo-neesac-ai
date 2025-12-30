'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Bot,
  Clock,
  Zap,
  Calendar,
  MessageSquare,
  FileText,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface AutomationSettings {
  autoPostEnabled: boolean;
  postFrequency: 'daily' | 'weekly' | 'biweekly';
  preferredPostTime: string;
  autoReplyEnabled: boolean;
  autoReplyDelay: number; // hours
  autoReplyToPositive: boolean;
  autoReplyToNegative: boolean;
  autoReplyToNeutral: boolean;
  requireApproval: boolean;
  aiTone: 'professional' | 'friendly' | 'casual';
}

const defaultSettings: AutomationSettings = {
  autoPostEnabled: false,
  postFrequency: 'weekly',
  preferredPostTime: '10:00',
  autoReplyEnabled: false,
  autoReplyDelay: 24,
  autoReplyToPositive: true,
  autoReplyToNegative: false,
  autoReplyToNeutral: true,
  requireApproval: true,
  aiTone: 'professional',
};

export default function AutomationSettingsPage() {
  const [settings, setSettings] = useState<AutomationSettings>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);

  useEffect(() => {
    // Load saved settings
    const stored = localStorage.getItem('localseo-automation');
    if (stored) {
      setSettings(JSON.parse(stored));
    }

    // Check if AI is configured
    const storedAI = localStorage.getItem('localseo-ai');
    if (storedAI) {
      const config = JSON.parse(storedAI);
      setAiConfigured(!!(config.apiKey && config.model));
    }
  }, []);

  const handleSave = () => {
    setSaving(true);
    localStorage.setItem('localseo-automation', JSON.stringify(settings));
    
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }, 500);
  };

  const updateSetting = <K extends keyof AutomationSettings>(
    key: K,
    value: AutomationSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Automation</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Configure AI-powered automation for your GBP
          </p>
        </div>
      </div>

      {!aiConfigured && (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700">
            Configure an AI provider in{' '}
            <Link href="/settings" className="font-medium underline">
              Settings
            </Link>{' '}
            to enable automation features.
          </AlertDescription>
        </Alert>
      )}

      {saved && (
        <Alert className="bg-emerald-50 border-emerald-200 text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Automation settings saved!</AlertDescription>
        </Alert>
      )}

      {/* Auto-Posting Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                Auto-Posting
              </CardTitle>
              <CardDescription>
                Automatically generate and publish GBP posts
              </CardDescription>
            </div>
            <Switch
              checked={settings.autoPostEnabled}
              onCheckedChange={(checked) => updateSetting('autoPostEnabled', checked)}
              disabled={!aiConfigured}
            />
          </div>
        </CardHeader>
        {settings.autoPostEnabled && (
          <CardContent className="space-y-6 border-t pt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Post Frequency</Label>
                <Select
                  value={settings.postFrequency}
                  onValueChange={(value: 'daily' | 'weekly' | 'biweekly') => 
                    updateSetting('postFrequency', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Bi-weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Preferred Time</Label>
                <Select
                  value={settings.preferredPostTime}
                  onValueChange={(value) => updateSetting('preferredPostTime', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="09:00">9:00 AM</SelectItem>
                    <SelectItem value="10:00">10:00 AM</SelectItem>
                    <SelectItem value="12:00">12:00 PM</SelectItem>
                    <SelectItem value="14:00">2:00 PM</SelectItem>
                    <SelectItem value="17:00">5:00 PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
              <div>
                <p className="font-medium">Require Approval</p>
                <p className="text-sm text-slate-500">Review posts before publishing</p>
              </div>
              <Switch
                checked={settings.requireApproval}
                onCheckedChange={(checked) => updateSetting('requireApproval', checked)}
              />
            </div>

            <Alert className="bg-blue-50 border-blue-200">
              <Calendar className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                Posts will be generated {settings.postFrequency} at {settings.preferredPostTime}.
                {settings.requireApproval && ' You&apos;ll be notified to approve before publishing.'}
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>

      {/* Auto-Reply Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-500" />
                Auto-Reply to Reviews
              </CardTitle>
              <CardDescription>
                Automatically generate responses to new reviews
              </CardDescription>
            </div>
            <Switch
              checked={settings.autoReplyEnabled}
              onCheckedChange={(checked) => updateSetting('autoReplyEnabled', checked)}
              disabled={!aiConfigured}
            />
          </div>
        </CardHeader>
        {settings.autoReplyEnabled && (
          <CardContent className="space-y-6 border-t pt-6">
            <div className="space-y-4">
              <Label>Reply to these review types:</Label>
              <div className="grid gap-3">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-100 text-emerald-700">4-5 ★</Badge>
                    <span className="text-sm">Positive reviews</span>
                  </div>
                  <Switch
                    checked={settings.autoReplyToPositive}
                    onCheckedChange={(checked) => updateSetting('autoReplyToPositive', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-slate-100 text-slate-700">3 ★</Badge>
                    <span className="text-sm">Neutral reviews</span>
                  </div>
                  <Switch
                    checked={settings.autoReplyToNeutral}
                    onCheckedChange={(checked) => updateSetting('autoReplyToNeutral', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">1-2 ★</Badge>
                    <span className="text-sm">Negative reviews</span>
                  </div>
                  <Switch
                    checked={settings.autoReplyToNegative}
                    onCheckedChange={(checked) => updateSetting('autoReplyToNegative', checked)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Reply Delay (hours)</Label>
                <span className="text-sm font-medium">{settings.autoReplyDelay}h</span>
              </div>
              <Slider
                value={[settings.autoReplyDelay]}
                onValueChange={([value]) => updateSetting('autoReplyDelay', value)}
                min={1}
                max={72}
                step={1}
              />
              <p className="text-xs text-slate-500">
                Wait this long before auto-replying to give you time to respond personally
              </p>
            </div>

            {!settings.autoReplyToNegative && (
              <Alert className="bg-amber-50 border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700">
                  Negative reviews are excluded. We recommend reviewing these manually.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        )}
      </Card>

      {/* AI Tone Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-slate-500" />
            AI Content Tone
          </CardTitle>
          <CardDescription>
            Set the default tone for AI-generated content
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Default Tone</Label>
            <Select
              value={settings.aiTone}
              onValueChange={(value: 'professional' | 'friendly' | 'casual') => 
                updateSetting('aiTone', value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              This affects how AI writes posts, descriptions, and review responses
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Coming Soon Features */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-400">
            <Zap className="w-5 h-5" />
            Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Scheduled posting queue</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>Holiday & event auto-posts</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              <span>Q&A auto-response</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Automation Settings
        </Button>
      </div>
    </div>
  );
}



