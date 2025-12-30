'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  Mail,
  Calendar,
  Building2,
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

interface Client {
  id: string;
  email: string;
  full_name: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  approved_at?: string;
  connected_gbp?: { location_name: string }[];
}

export default function AdminClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    clientId: string;
    action: 'approve' | 'reject';
    clientName: string;
  }>({ open: false, clientId: '', action: 'approve', clientName: '' });

  const fetchClients = async () => {
    const { url, anonKey } = getSupabaseCredentials();
    if (!url || !anonKey) return;

    const supabase = createBrowserClient(url, anonKey);

    // Simple query without join to avoid RLS issues
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, status, created_at, approved_at')
      .eq('role', 'client')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching clients:', error);
    }

    if (data) {
      // Add empty connected_gbp array for now
      const clientsWithGbp = data.map(client => ({
        ...client,
        connected_gbp: []
      }));
      setClients(clientsWithGbp as Client[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleAction = async (clientId: string, action: 'approve' | 'reject') => {
    setActionLoading(clientId);
    const { url, anonKey } = getSupabaseCredentials();
    if (!url || !anonKey) return;

    const supabase = createBrowserClient(url, anonKey);
    const { data: { user } } = await supabase.auth.getUser();

    await supabase
      .from('profiles')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', clientId);

    await fetchClients();
    setActionLoading(null);
    setConfirmDialog({ open: false, clientId: '', action: 'approve', clientName: '' });
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch = 
      client.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.full_name?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesTab = activeTab === 'all' || client.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Rejected</Badge>;
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const pendingCount = clients.filter(c => c.status === 'pending').length;
  const approvedCount = clients.filter(c => c.status === 'approved').length;
  const rejectedCount = clients.filter(c => c.status === 'rejected').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Client Management</h1>
        <p className="text-slate-400 mt-1">
          Approve, reject, and manage client accounts
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-slate-500" />
              <div>
                <p className="text-2xl font-bold text-white">{clients.length}</p>
                <p className="text-sm text-slate-400">Total Clients</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold text-amber-500">{pendingCount}</p>
                <p className="text-sm text-slate-400">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <UserCheck className="w-8 h-8 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold text-emerald-500">{approvedCount}</p>
                <p className="text-sm text-slate-400">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <UserX className="w-8 h-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold text-red-500">{rejectedCount}</p>
                <p className="text-sm text-slate-400">Rejected</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-white">All Clients</CardTitle>
              <CardDescription className="text-slate-400">
                {filteredClients.length} clients found
              </CardDescription>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-slate-800">
              <TabsTrigger value="pending" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                Pending ({pendingCount})
              </TabsTrigger>
              <TabsTrigger value="approved" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
                Approved ({approvedCount})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400">
                Rejected ({rejectedCount})
              </TabsTrigger>
              <TabsTrigger value="all" className="data-[state=active]:bg-slate-700">
                All ({clients.length})
              </TabsTrigger>
            </TabsList>

            <div className="mt-4">
              {filteredClients.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800">
                      <TableHead className="text-slate-400">Client</TableHead>
                      <TableHead className="text-slate-400">Status</TableHead>
                      <TableHead className="text-slate-400">Connected GBP</TableHead>
                      <TableHead className="text-slate-400">Registered</TableHead>
                      <TableHead className="text-slate-400 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.map((client) => (
                      <TableRow key={client.id} className="border-slate-800">
                        <TableCell>
                          <div>
                            <p className="font-medium text-white">
                              {client.full_name || 'No name'}
                            </p>
                            <p className="text-sm text-slate-400 flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {client.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(client.status)}</TableCell>
                        <TableCell>
                          {client.connected_gbp && client.connected_gbp.length > 0 ? (
                            <span className="flex items-center gap-1 text-emerald-400">
                              <Building2 className="w-4 h-4" />
                              {client.connected_gbp.length} connected
                            </span>
                          ) : (
                            <span className="text-slate-500">Not connected</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-slate-400">
                            <Calendar className="w-3 h-3" />
                            {formatDate(client.created_at)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {client.status === 'pending' && (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-500"
                                onClick={() => setConfirmDialog({
                                  open: true,
                                  clientId: client.id,
                                  action: 'approve',
                                  clientName: client.full_name || client.email,
                                })}
                                disabled={actionLoading === client.id}
                              >
                                {actionLoading === client.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-4 h-4 mr-1" />
                                )}
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                                onClick={() => setConfirmDialog({
                                  open: true,
                                  clientId: client.id,
                                  action: 'reject',
                                  clientName: client.full_name || client.email,
                                })}
                                disabled={actionLoading === client.id}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          )}
                          {client.status === 'approved' && (
                            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
                              Active
                            </Badge>
                          )}
                          {client.status === 'rejected' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-slate-600 text-slate-400 hover:bg-slate-800"
                              onClick={() => handleAction(client.id, 'approve')}
                              disabled={actionLoading === client.id}
                            >
                              Reactivate
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500">No clients found</p>
                </div>
              )}
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent className="bg-slate-900 border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              {confirmDialog.action === 'approve' ? 'Approve Client' : 'Reject Client'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {confirmDialog.action === 'approve'
                ? `Are you sure you want to approve ${confirmDialog.clientName}? They will be able to log in and use the platform.`
                : `Are you sure you want to reject ${confirmDialog.clientName}? They will not be able to access the platform.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className={confirmDialog.action === 'approve' 
                ? 'bg-emerald-600 hover:bg-emerald-500' 
                : 'bg-red-600 hover:bg-red-500'}
              onClick={() => handleAction(confirmDialog.clientId, confirmDialog.action)}
            >
              {confirmDialog.action === 'approve' ? 'Approve' : 'Reject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

