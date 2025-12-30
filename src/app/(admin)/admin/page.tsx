'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  ArrowRight,
  Settings,
  AlertCircle,
  TrendingUp,
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

interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

interface PendingClient {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [pendingClients, setPendingClients] = useState<PendingClient[]>([]);
  const [gbpConfigured, setGbpConfigured] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { url, anonKey } = getSupabaseCredentials();
      if (!url || !anonKey) return;

      const supabase = createBrowserClient(url, anonKey);

      // Fetch stats
      const { data: users } = await supabase
        .from('profiles')
        .select('status, role')
        .eq('role', 'client');

      if (users) {
        setStats({
          total: users.length,
          pending: users.filter(u => u.status === 'pending').length,
          approved: users.filter(u => u.status === 'approved').length,
          rejected: users.filter(u => u.status === 'rejected').length,
        });
      }

      // Fetch pending clients
      const { data: pending } = await supabase
        .from('profiles')
        .select('id, email, full_name, created_at')
        .eq('role', 'client')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5);

      if (pending) {
        setPendingClients(pending);
      }

      // Check GBP config
      const { data: gbpSettings } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'gbp_oauth')
        .single();

      if (gbpSettings?.value) {
        const config = gbpSettings.value as { client_id?: string };
        setGbpConfigured(!!config.client_id);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-slate-400 mt-1">
          Manage clients and system configuration
        </p>
      </div>

      {/* Alert if GBP not configured */}
      {!gbpConfigured && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <div>
                  <p className="font-medium text-amber-200">GBP OAuth Not Configured</p>
                  <p className="text-sm text-amber-300/70">
                    Clients won&apos;t be able to connect their Google Business Profiles
                  </p>
                </div>
              </div>
              <Link href="/admin/settings">
                <Button variant="outline" className="border-amber-500 text-amber-500 hover:bg-amber-500/10">
                  Configure Now
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Total Clients</CardTitle>
            <Users className="w-4 h-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Pending Approval</CardTitle>
            <Clock className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Approved</CardTitle>
            <UserCheck className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">{stats.approved}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Rejected</CardTitle>
            <UserX className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending Approvals */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white">Pending Approvals</CardTitle>
                <CardDescription className="text-slate-400">
                  Clients waiting for your approval
                </CardDescription>
              </div>
              {stats.pending > 0 && (
                <Badge className="bg-amber-500">{stats.pending} pending</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {pendingClients.length > 0 ? (
              <div className="space-y-3">
                {pendingClients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50"
                  >
                    <div>
                      <p className="font-medium text-white">
                        {client.full_name || 'No name'}
                      </p>
                      <p className="text-sm text-slate-400">{client.email}</p>
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatDate(client.created_at)}
                    </div>
                  </div>
                ))}
                <Link href="/admin/clients">
                  <Button variant="outline" className="w-full border-slate-700 text-slate-300 hover:bg-slate-800">
                    View All Clients
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-8">
                <UserCheck className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500">No pending approvals</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Quick Actions</CardTitle>
            <CardDescription className="text-slate-400">
              Common administrative tasks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/admin/clients" className="block">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors cursor-pointer">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400">
                  <Users className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">Manage Clients</p>
                  <p className="text-sm text-slate-400">Approve, reject, or view client details</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-500" />
              </div>
            </Link>

            <Link href="/admin/settings" className="block">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors cursor-pointer">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-500/10 text-purple-400">
                  <Settings className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">System Settings</p>
                  <p className="text-sm text-slate-400">Configure GBP OAuth and defaults</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-500" />
              </div>
            </Link>

            <Link href="/dashboard" className="block">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors cursor-pointer">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">Client Dashboard</p>
                  <p className="text-sm text-slate-400">Switch to client view</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-500" />
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

