'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MapPin, Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

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

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isFirstUser, setIsFirstUser] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    const checkConfig = async () => {
      const { url, anonKey } = getSupabaseCredentials();
      if (!url || !anonKey) {
        setIsConfigured(false);
        return;
      }
      setIsConfigured(true);

      // Check if this is the first user
      const supabase = createBrowserClient(url, anonKey);
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      
      setIsFirstUser(count === 0);
    };

    checkConfig();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      setIsLoading(false);
      return;
    }

    try {
      const { url, anonKey } = getSupabaseCredentials();
      
      if (!url || !anonKey) {
        setError('Supabase is not configured. Please complete admin setup first.');
        setIsLoading(false);
        return;
      }
      
      const supabase = createBrowserClient(url, anonKey);
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        setError(error.message);
        setIsLoading(false);
        return;
      }

      setSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred during registration';
      setError(message);
    }
    
    setIsLoading(false);
  };

  if (isConfigured === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="w-full max-w-md shadow-2xl border-border/50">
          <CardHeader className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-500 text-white shadow-lg">
                <AlertCircle className="w-7 h-7" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold tracking-tight">Setup Required</CardTitle>
              <CardDescription className="text-muted-foreground">
                Database connection needs to be configured before you can register.
              </CardDescription>
            </div>
          </CardHeader>
          <CardFooter className="flex flex-col space-y-4">
            <Button className="w-full" onClick={() => router.push('/setup')}>
              Go to Admin Setup
            </Button>
            <Button variant="outline" className="w-full" onClick={() => router.push('/')}>
              Back to Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="w-full max-w-md shadow-2xl border-border/50">
          <CardHeader className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500 text-white shadow-lg">
                {isFirstUser ? <CheckCircle2 className="w-7 h-7" /> : <Clock className="w-7 h-7" />}
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold tracking-tight">
                {isFirstUser ? 'Admin Account Created!' : 'Registration Submitted'}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {isFirstUser ? (
                  <>
                    You&apos;re the first user, so you&apos;ve been granted <strong>admin access</strong>.
                    Check your email to verify your account, then log in to configure the system.
                  </>
                ) : (
                  <>
                    Your account is <strong>pending approval</strong>. An administrator will review 
                    your registration. You&apos;ll be able to log in once approved.
                  </>
                )}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Alert className={isFirstUser ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}>
              <AlertDescription className={isFirstUser ? 'text-emerald-800' : 'text-amber-800'}>
                {isFirstUser 
                  ? 'Check your email for a verification link, then proceed to login.'
                  : 'You will receive an email notification when your account is approved.'}
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button variant="outline" className="w-full" onClick={() => router.push('/login')}>
              Go to Sign In
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />
      
      <Card className="w-full max-w-md relative z-10 shadow-2xl border-border/50 backdrop-blur-sm">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-lg">
              <MapPin className="w-7 h-7" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">Create an account</CardTitle>
            <CardDescription className="text-muted-foreground">
              {isFirstUser 
                ? 'You\'ll be the first user (admin)' 
                : 'Request access to LocalSEO Pro'}
            </CardDescription>
          </div>
        </CardHeader>
        
        <form onSubmit={handleRegister}>
          <CardContent className="space-y-4">
            {!isFirstUser && (
              <Alert className="bg-amber-50 border-amber-200">
                <Clock className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 text-sm">
                  New accounts require admin approval before you can log in.
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive" className="animate-in fade-in-50 slide-in-from-top-1">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={isLoading}
                className="h-11"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="h-11"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
                className="h-11"
              />
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full h-11 font-semibold" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : isFirstUser ? (
                'Create Admin Account'
              ) : (
                'Request Access'
              )}
            </Button>
            
            <p className="text-sm text-muted-foreground text-center">
              Already have an account?{' '}
              <Link href="/login" className="text-primary font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
