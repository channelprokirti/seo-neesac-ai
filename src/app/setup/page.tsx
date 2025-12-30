'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Database,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Shield,
} from 'lucide-react';

const STEPS = [
  { id: 'welcome', title: 'Welcome', icon: Shield },
  { id: 'supabase', title: 'Database', icon: Database },
  { id: 'complete', title: 'Complete', icon: CheckCircle2 },
];

export default function SetupPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  
  // Form states
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');

  // Load existing config if any
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('localseo-supabase');
      if (stored) {
        try {
          const config = JSON.parse(stored);
          if (config.url) setSupabaseUrl(config.url);
          if (config.anonKey) setSupabaseKey(config.anonKey);
        } catch (e) {
          console.error('Failed to parse stored config:', e);
        }
      }
    }
  }, []);

  const progress = ((currentStep) / (STEPS.length - 1)) * 100;
  const currentStepData = STEPS[currentStep];

  const testSupabaseConnection = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      
      if (response.ok || response.status === 404) {
        setTestResult('success');
        // Save config on successful test
        localStorage.setItem('localseo-supabase', JSON.stringify({
          url: supabaseUrl,
          anonKey: supabaseKey,
        }));
      } else {
        setTestResult('error');
      }
    } catch {
      setTestResult('error');
    }
    
    setTesting(false);
  };

  const handleNext = () => {
    setTestResult(null);
    setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setTestResult(null);
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleComplete = () => {
    setIsNavigating(true);
    
    // Save config to localStorage
    localStorage.setItem('localseo-supabase', JSON.stringify({
      url: supabaseUrl,
      anonKey: supabaseKey,
    }));
    
    // Mark setup as complete
    localStorage.setItem('localseo-setup-complete', 'true');
    
    // Navigate to register using full page navigation
    window.location.href = '/register';
  };

  const canProceed = () => {
    switch (currentStepData.id) {
      case 'welcome':
        return true;
      case 'supabase':
        return supabaseUrl && supabaseKey && testResult === 'success';
      case 'complete':
        return true;
      default:
        return true;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                  index < currentStep
                    ? 'bg-primary border-primary text-primary-foreground'
                    : index === currentStep
                    ? 'border-primary text-primary'
                    : 'border-muted text-muted-foreground'
                }`}
              >
                <step.icon className="w-5 h-5" />
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-1" />
        </div>

        <Card className="shadow-2xl border-border/50">
          {/* Welcome Step */}
          {currentStepData.id === 'welcome' && (
            <>
              <CardHeader className="text-center pb-2">
                <div className="flex justify-center mb-4">
                  <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground">
                    <Shield className="w-8 h-8" />
                  </div>
                </div>
                <Badge variant="secondary" className="mb-2 mx-auto">Admin Setup</Badge>
                <CardTitle className="text-2xl">Initial Configuration</CardTitle>
                <CardDescription>
                  One-time setup to configure your database connection
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This setup is for <strong>administrators</strong> deploying LocalSEO Pro. 
                    Once configured, users can register and login normally.
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4 text-sm">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                    <Database className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">Connect Supabase</p>
                      <p className="text-muted-foreground">Required for authentication and data storage</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-dashed">
                  <p className="text-sm text-muted-foreground">
                    <strong>For Production:</strong> Set environment variables instead:
                  </p>
                  <code className="block mt-2 text-xs bg-muted p-2 rounded">
                    NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co<br/>
                    NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
                  </code>
                </div>
              </CardContent>
            </>
          )}

          {/* Supabase Step */}
          {currentStepData.id === 'supabase' && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Database Configuration
                </CardTitle>
                <CardDescription>
                  Connect to your Supabase project for authentication and data storage
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Create a free Supabase project at{' '}
                    <a
                      href="https://supabase.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      supabase.com
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    {' '}and find your credentials in Project Settings → API
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Project URL *</Label>
                    <Input
                      placeholder="https://your-project.supabase.co"
                      value={supabaseUrl}
                      onChange={(e) => {
                        setSupabaseUrl(e.target.value);
                        setTestResult(null);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Anon/Public Key *</Label>
                    <Input
                      type="password"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={supabaseKey}
                      onChange={(e) => {
                        setSupabaseKey(e.target.value);
                        setTestResult(null);
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={testSupabaseConnection}
                    disabled={testing || !supabaseUrl || !supabaseKey}
                  >
                    {testing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : testResult === 'success' ? (
                      <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                    ) : testResult === 'error' ? (
                      <AlertCircle className="mr-2 h-4 w-4 text-red-500" />
                    ) : null}
                    Test Connection
                  </Button>
                  {testResult === 'success' && (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      Connected
                    </Badge>
                  )}
                  {testResult === 'error' && (
                    <Badge variant="outline" className="text-red-600 border-red-600">
                      Failed - Check credentials
                    </Badge>
                  )}
                </div>

                {testResult === 'success' && (
                  <Alert className="border-green-200 bg-green-50 text-green-800">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      Connection successful! Make sure you&apos;ve run the database migrations in Supabase SQL Editor.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </>
          )}

          {/* Complete Step */}
          {currentStepData.id === 'complete' && (
            <>
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-500 text-white">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                </div>
                <CardTitle className="text-2xl">Database Connected!</CardTitle>
                <CardDescription>
                  Your LocalSEO Pro instance is ready for user registration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-3 text-sm">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <span className="flex items-center gap-2">
                      <Database className="w-4 h-4" />
                      Supabase
                    </span>
                    <Badge variant="default">Connected</Badge>
                  </div>
                </div>

                <Alert>
                  <AlertDescription>
                    <strong>Next Steps:</strong>
                    <ol className="list-decimal list-inside mt-2 space-y-1">
                      <li>Register your admin account</li>
                      <li>Login to access the dashboard</li>
                      <li>Configure AI providers in Settings</li>
                    </ol>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between p-6 pt-0">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 0}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            
            {currentStepData.id === 'complete' ? (
              <Button onClick={handleComplete} disabled={isNavigating}>
                {isNavigating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Continue to Register
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={!canProceed()}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}





