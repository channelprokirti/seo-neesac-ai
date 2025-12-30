'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart3,
  TrendingUp,
  Activity,
  Calendar,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Loader2,
  Clock,
  Sparkles,
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

interface ActionLog {
  id: string;
  action_type: string;
  action_data: Record<string, unknown>;
  ai_generated: boolean;
  performed_at: string;
  result: string;
  business_name?: string;
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');
  const [actions, setActions] = useState<ActionLog[]>([]);
  const [businessCount, setBusinessCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      const { url, anonKey } = getSupabaseCredentials();
      if (!url || !anonKey) {
        setLoading(false);
        return;
      }

      const supabase = createBrowserClient(url, anonKey);
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Get business count
        const { count } = await supabase
          .from('businesses')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);
        setBusinessCount(count || 0);

        // Try to get actions log (table may not exist yet)
        const { data: actionsData } = await supabase
          .from('seo_actions')
          .select('*')
          .order('performed_at', { ascending: false })
          .limit(50);
        
        if (actionsData) {
          setActions(actionsData);
        }
      }
      setLoading(false);
    };

    fetchData();
  }, [dateRange]);

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
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Reports</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Track your local SEO performance and actions
          </p>
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[180px]">
            <Calendar className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="health">
        <TabsList>
          <TabsTrigger value="health" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            SEO Health
          </TabsTrigger>
          <TabsTrigger value="actions" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Actions Log
          </TabsTrigger>
          <TabsTrigger value="rankings" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Rankings
          </TabsTrigger>
        </TabsList>

        {/* SEO Health Tab */}
        <TabsContent value="health" className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Total Businesses</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{businessCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Avg. GBP Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-bold text-emerald-600">--</p>
                  <Badge variant="secondary">Coming Soon</Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Actions This Period</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{actions.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">AI-Generated</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-bold">{actions.filter(a => a.ai_generated).length}</p>
                  <Sparkles className="w-5 h-5 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Score History</CardTitle>
              <CardDescription>Track your GBP score changes over time</CardDescription>
            </CardHeader>
            <CardContent className="py-12 text-center">
              <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Score tracking will be available after you sync your business data.</p>
              <p className="text-sm text-slate-400 mt-2">Historical data will be recorded each time you sync.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Actions Log Tab */}
        <TabsContent value="actions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Actions Log</CardTitle>
              <CardDescription>All SEO actions taken on your businesses</CardDescription>
            </CardHeader>
            <CardContent>
              {actions.length > 0 ? (
                <div className="space-y-4">
                  {actions.map((action) => (
                    <div key={action.id} className="flex items-start gap-4 p-4 rounded-lg border">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        action.ai_generated ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {action.ai_generated ? <Sparkles className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{action.action_type}</p>
                          {action.ai_generated && (
                            <Badge variant="secondary" className="text-xs">AI Generated</Badge>
                          )}
                        </div>
                        {action.business_name && (
                          <p className="text-sm text-slate-500">{action.business_name}</p>
                        )}
                        <p className="text-xs text-slate-400 mt-1">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {new Date(action.performed_at).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant={action.result === 'success' ? 'default' : 'destructive'}>
                        {action.result}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No actions recorded yet</p>
                  <p className="text-sm text-slate-400 mt-2">
                    Actions like posting updates, responding to reviews, and generating content will appear here.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rankings Tab */}
        <TabsContent value="rankings" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Ranking Movement</CardTitle>
              <CardDescription>Track your local search ranking positions over time</CardDescription>
            </CardHeader>
            <CardContent className="py-12 text-center">
              <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Ranking tracking coming soon</p>
              <p className="text-sm text-slate-400 mt-2">
                Monitor your positions in local search results and track changes.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}



