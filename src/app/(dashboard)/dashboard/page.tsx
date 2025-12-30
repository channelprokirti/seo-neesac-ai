'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Building2,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Star,
  Image,
  MessageSquare,
  Loader2,
  AlertTriangle,
  Zap,
  RefreshCw,
  TrendingUp,
  CloudOff,
  BarChart3,
  Settings,
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

interface BusinessSummary {
  id: string;
  name: string;
  gbp_connected: boolean;
  gbp_data?: {
    averageRating?: number;
    totalReviews?: number;
    totalPhotos?: number;
    syncedAt?: string;
  };
  address?: { city?: string; state?: string };
}

interface AlertItem {
  id: string;
  type: 'warning' | 'info' | 'success';
  title: string;
  description: string;
  action?: { label: string; href: string };
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [user, setUser] = useState<{ full_name?: string; role?: string } | null>(null);
  const [gbpOAuthConfigured, setGbpOAuthConfigured] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [aiConfigured, setAiConfigured] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { url, anonKey } = getSupabaseCredentials();
      if (!url || !anonKey) return;

      const supabase = createBrowserClient(url, anonKey);

      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: userData } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', authUser.id)
          .single();
        setUser(userData);

        // Get all businesses
        const { data: businessData } = await supabase
          .from('businesses')
          .select('id, name, gbp_connected, gbp_data, address')
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false });

        if (businessData) {
          setBusinesses(businessData);
          generateAlerts(businessData);
        }
      }

      // Check if GBP OAuth is configured
      const { data: settings } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'gbp_oauth')
        .single();

      if (settings?.value) {
        const config = settings.value as { client_id?: string };
        setGbpOAuthConfigured(!!config.client_id);
      }

      // Check AI configuration
      const storedAIConfigs = localStorage.getItem('localseo-ai-configs');
      if (storedAIConfigs) {
        const parsed = JSON.parse(storedAIConfigs);
        setAiConfigured(!!parsed.active && !!parsed.providers[parsed.active]?.apiKey);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  const generateAlerts = (businessData: BusinessSummary[]) => {
    const newAlerts: AlertItem[] = [];

    // Check for businesses that need sync
    const needsSync = businessData.filter(b => b.gbp_connected && !b.gbp_data?.syncedAt);
    if (needsSync.length > 0) {
      newAlerts.push({
        id: 'needs-sync',
        type: 'warning',
        title: `${needsSync.length} business${needsSync.length > 1 ? 'es' : ''} need${needsSync.length === 1 ? 's' : ''} data sync`,
        description: 'Sync GBP data to get reviews, photos, and SEO recommendations.',
        action: { label: 'View Businesses', href: '/businesses' },
      });
    }

    // Check for low ratings
    const lowRatings = businessData.filter(b => b.gbp_data?.averageRating && b.gbp_data.averageRating < 4.0);
    if (lowRatings.length > 0) {
      newAlerts.push({
        id: 'low-ratings',
        type: 'warning',
        title: `${lowRatings.length} business${lowRatings.length > 1 ? 'es have' : ' has'} rating below 4.0`,
        description: 'Consider responding to reviews to improve ratings.',
        action: { label: 'View', href: '/businesses' },
      });
    }

    // Check for low photos
    const lowPhotos = businessData.filter(b => b.gbp_data?.syncedAt && (!b.gbp_data?.totalPhotos || b.gbp_data.totalPhotos < 10));
    if (lowPhotos.length > 0) {
      newAlerts.push({
        id: 'low-photos',
        type: 'info',
        title: `${lowPhotos.length} business${lowPhotos.length > 1 ? 'es need' : ' needs'} more photos`,
        description: 'Google recommends at least 10 photos per business.',
        action: { label: 'View', href: '/businesses' },
      });
    }

    setAlerts(newAlerts);
  };

  // Calculate stats
  const totalBusinesses = businesses.length;
  const syncedCount = businesses.filter(b => b.gbp_connected && b.gbp_data?.syncedAt).length;
  const needsSyncCount = businesses.filter(b => b.gbp_connected && !b.gbp_data?.syncedAt).length;
  const manualCount = businesses.filter(b => !b.gbp_connected).length;
  
  const totalReviews = businesses.reduce((sum, b) => sum + (b.gbp_data?.totalReviews || 0), 0);
  const totalPhotos = businesses.reduce((sum, b) => sum + (b.gbp_data?.totalPhotos || 0), 0);
  
  // Average rating only from synced businesses
  const syncedWithRatings = businesses.filter(b => b.gbp_data?.averageRating);
  const avgRating = syncedWithRatings.length > 0 
    ? syncedWithRatings.reduce((sum, b) => sum + (b.gbp_data?.averageRating || 0), 0) / syncedWithRatings.length 
    : 0;

  const syncProgress = totalBusinesses > 0 ? (syncedCount / totalBusinesses) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Welcome{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}!
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Here's your local SEO overview
          </p>
        </div>
        {user?.role === 'admin' && (
          <Link href="/admin">
            <Button variant="outline" className="border-amber-500 text-amber-600 hover:bg-amber-50">
              Admin Panel
            </Button>
          </Link>
        )}
      </div>

      {/* No Businesses State */}
      {totalBusinesses === 0 && (
        <Card className="bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-950/50 dark:to-cyan-950/50 border-emerald-200 dark:border-emerald-800">
          <CardContent className="py-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500 text-white">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Get Started with Local SEO
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 mt-1 max-w-md">
                    Connect your Google Business Profile to import your businesses and start optimizing.
                  </p>
                </div>
              </div>
              <Link href="/settings">
                <Button className="bg-emerald-600 hover:bg-emerald-500">
                  <Building2 className="w-4 h-4 mr-2" />
                  Connect GBP
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overview Stats */}
      {totalBusinesses > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Total Businesses */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Businesses</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{totalBusinesses}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>Sync Progress</span>
                  <span>{syncedCount}/{totalBusinesses} synced</span>
                </div>
                <Progress value={syncProgress} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Average Rating */}
          <Card className={avgRating >= 4.0 ? 'border-emerald-200 bg-emerald-50/50' : avgRating > 0 ? 'border-amber-200 bg-amber-50/50' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Avg. Rating</p>
                  <div className="flex items-baseline gap-1">
                    <p className={`text-3xl font-bold ${avgRating >= 4.5 ? 'text-emerald-600' : avgRating >= 4.0 ? 'text-amber-600' : avgRating > 0 ? 'text-orange-500' : 'text-slate-400'}`}>
                      {avgRating > 0 ? avgRating.toFixed(1) : '--'}
                    </p>
                    {avgRating > 0 && <span className="text-slate-400">/5</span>}
                  </div>
                </div>
                <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                  <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {syncedWithRatings.length > 0 ? `From ${syncedWithRatings.length} synced business${syncedWithRatings.length > 1 ? 'es' : ''}` : 'Sync businesses to see ratings'}
              </p>
            </CardContent>
          </Card>

          {/* Total Reviews */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Reviews</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{totalReviews}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-blue-500" />
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">Across all synced businesses</p>
            </CardContent>
          </Card>

          {/* Total Photos */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Photos</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{totalPhotos}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <Image className="w-6 h-6 text-purple-500" />
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">Across all synced businesses</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sync Status Summary */}
      {totalBusinesses > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-slate-500" />
              Sync Status Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {/* Synced */}
              <Link href="/businesses" className="block">
                <div className="p-4 rounded-lg border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-emerald-700">{syncedCount}</p>
                      <p className="text-sm text-emerald-600">Data Synced</p>
                    </div>
                  </div>
                  <p className="text-xs text-emerald-600 mt-2">Full GBP data available</p>
                </div>
              </Link>

              {/* Needs Sync */}
              <Link href="/businesses" className="block">
                <div className="p-4 rounded-lg border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center">
                      <RefreshCw className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-amber-700">{needsSyncCount}</p>
                      <p className="text-sm text-amber-600">Needs Sync</p>
                    </div>
                  </div>
                  <p className="text-xs text-amber-600 mt-2">GBP connected, data not fetched</p>
                </div>
              </Link>

              {/* Manual */}
              <Link href="/businesses" className="block">
                <div className="p-4 rounded-lg border-2 border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-400 flex items-center justify-center">
                      <CloudOff className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-700">{manualCount}</p>
                      <p className="text-sm text-slate-600">Manual</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Not linked to GBP</p>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Items */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Action Items
            </CardTitle>
            <CardDescription>Things that need your attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  alert.type === 'warning'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={alert.type === 'warning' ? 'text-amber-500' : 'text-blue-500'}>
                    {alert.type === 'warning' ? <AlertTriangle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{alert.title}</p>
                    <p className="text-sm text-slate-600">{alert.description}</p>
                  </div>
                </div>
                {alert.action && (
                  <Link href={alert.action.href}>
                    <Button variant="outline" size="sm">{alert.action.label}</Button>
                  </Link>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      {totalBusinesses > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/businesses" className="block">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 dark:text-white">Manage Businesses</h3>
                    <p className="text-sm text-slate-500">View, sync, and manage all your businesses</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-400" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/reports" className="block">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 dark:text-white">View Reports</h3>
                    <p className="text-sm text-slate-500">SEO health, actions log, rankings</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-400" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/settings" className="block">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Settings className="w-6 h-6 text-slate-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 dark:text-white">Settings</h3>
                    <p className="text-sm text-slate-500">
                      {!aiConfigured ? 'Configure AI provider' : 'GBP, AI, automation settings'}
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-400" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      {/* Setup Checklist for new users */}
      {totalBusinesses === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Setup Checklist</CardTitle>
            <CardDescription>Complete these steps to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                <div className="flex-1">
                  <h3 className="font-medium text-slate-900">Account Created</h3>
                  <p className="text-sm text-slate-600">Your account is set up and approved</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
                <AlertCircle className="w-6 h-6 text-slate-400" />
                <div className="flex-1">
                  <h3 className="font-medium text-slate-900">Connect Google Business Profile</h3>
                  <p className="text-sm text-slate-600">Import your business locations from GBP</p>
                </div>
                <Link href="/settings">
                  <Button size="sm">Connect</Button>
                </Link>
              </div>
              
              <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
                <AlertCircle className="w-6 h-6 text-slate-400" />
                <div className="flex-1">
                  <h3 className="font-medium text-slate-900">Configure AI Provider (Optional)</h3>
                  <p className="text-sm text-slate-600">Enable AI-powered content and analysis</p>
                </div>
                <Link href="/settings">
                  <Button variant="outline" size="sm">Setup</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
