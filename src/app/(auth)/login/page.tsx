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
import { MapPin, Loader2, AlertCircle, Clock, XCircle } from 'lucide-react';

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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [accountStatus, setAccountStatus] = useState<'pending' | 'rejected' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    const { url, anonKey } = getSupabaseCredentials();
    setIsConfigured(!!(url && anonKey));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setAccountStatus(null);

    try {
      const { url, anonKey } = getSupabaseCredentials();
      
      if (!url || !anonKey) {
        setError('Supabase is not configured. Please complete admin setup first.');
        setIsLoading(false);
        return;
      }

      const supabase = createBrowserClient(url, anonKey);
      
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setIsLoading(false);
        return;
      }

      // Check user status
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', authData.user?.id)
        .single();

      if (userError || !userData) {
        // User record might not exist yet, sign out and show error
        await supabase.auth.signOut();
        setError('Account not found. Please register first.');
        setIsLoading(false);
        return;
      }

      // Check if pending
      if (userData.status === 'pending') {
        await supabase.auth.signOut();
        setAccountStatus('pending');
        setIsLoading(false);
        return;
      }

      // Check if rejected
      if (userData.status === 'rejected') {
        await supabase.auth.signOut();
        setAccountStatus('rejected');
        setIsLoading(false);
        return;
      }

      // Approved - redirect based on role
      if (userData.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred during login';
      setError(message);
      setIsLoading(false);
    }
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
                Database connection needs to be configured before you can sign in.
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

  // Pending approval status
  if (accountStatus === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="w-full max-w-md shadow-2xl border-border/50">
          <CardHeader className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500 text-white shadow-lg">
                <Clock className="w-7 h-7" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold tracking-tight">Pending Approval</CardTitle>
              <CardDescription className="text-muted-foreground">
                Your account is waiting for admin approval. You&apos;ll receive an email once your access is granted.
              </CardDescription>
            </div>
          </CardHeader>
          <CardFooter className="flex flex-col space-y-4">
            <Button variant="outline" className="w-full" onClick={() => {
              setAccountStatus(null);
              setEmail('');
              setPassword('');
            }}>
              Try Another Account
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => router.push('/')}>
              Back to Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Rejected status
  if (accountStatus === 'rejected') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="w-full max-w-md shadow-2xl border-border/50">
          <CardHeader className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-red-500 text-white shadow-lg">
                <XCircle className="w-7 h-7" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold tracking-tight">Access Denied</CardTitle>
              <CardDescription className="text-muted-foreground">
                Your account registration was not approved. Please contact the administrator for more information.
              </CardDescription>
            </div>
          </CardHeader>
          <CardFooter className="flex flex-col space-y-4">
            <Button variant="outline" className="w-full" onClick={() => {
              setAccountStatus(null);
              setEmail('');
              setPassword('');
            }}>
              Try Another Account
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => router.push('/')}>
              Back to Home
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
            <CardTitle className="text-2xl font-bold tracking-tight">Welcome back</CardTitle>
            <CardDescription className="text-muted-foreground">
              Sign in to your LocalSEO Pro account
            </CardDescription>
          </div>
        </CardHeader>
        
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive" className="animate-in fade-in-50 slide-in-from-top-1">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
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
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full h-11 font-semibold" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
            
            <p className="text-sm text-muted-foreground text-center">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-primary font-medium hover:underline">
                Sign up
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
