'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Building2, Plus, MapPin, Globe, Phone, Loader2, 
  CheckCircle2, Link as LinkIcon, Star, MessageSquare, Image as ImageIcon,
  Clock, RefreshCw, ArrowRight, AlertCircle, CloudOff
} from 'lucide-react';
import type { Business } from '@/types';

// Extended type for GBP fields
interface BusinessWithGBP extends Business {
  gbp_connected?: boolean;
  gbp_location_id?: string;
  google_place_id?: string;
  gbp_data?: {
    averageRating?: number;
    totalReviews?: number;
    totalPhotos?: number;
    syncedAt?: string;
  };
}

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

function BusinessesContent() {
  const searchParams = useSearchParams();
  const [businesses, setBusinesses] = useState<BusinessWithGBP[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  useEffect(() => {
    // Check for success message from GBP connection
    if (searchParams.get('success') === 'gbp_connected') {
      setShowSuccess(true);
      const count = searchParams.get('count');
      if (count) setImportedCount(parseInt(count, 10));
      // Clear URL params after showing
      setTimeout(() => {
        window.history.replaceState({}, '', '/businesses');
      }, 100);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchBusinesses = async () => {
      const { url, anonKey } = getSupabaseCredentials();
      if (!url || !anonKey) {
        setLoading(false);
        return;
      }

      const supabase = createBrowserClient(url, anonKey);
      const { data } = await supabase
        .from('businesses')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) {
        setBusinesses(data);
      }
      setLoading(false);
    };

    fetchBusinesses();
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 4.5) return 'text-emerald-600';
    if (score >= 4.0) return 'text-amber-600';
    if (score >= 3.0) return 'text-orange-500';
    return 'text-red-500';
  };

  // Categorize businesses
  const syncedBusinesses = businesses.filter(b => b.gbp_connected && b.gbp_data?.syncedAt);
  const needsSyncBusinesses = businesses.filter(b => b.gbp_connected && !b.gbp_data?.syncedAt);
  const manualBusinesses = businesses.filter(b => !b.gbp_connected);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {showSuccess && (
        <Alert className="bg-emerald-50 border-emerald-200 text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            Google Business Profile connected successfully! 
            {importedCount > 0 && ` ${importedCount} business${importedCount > 1 ? 'es' : ''} imported.`}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Businesses</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Manage your business profiles and locations
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/settings">
            <Button variant="outline">
              <LinkIcon className="w-4 h-4 mr-2" />
              Connect GBP
            </Button>
          </Link>
          <Link href="/businesses/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Business
            </Button>
          </Link>
        </div>
      </div>

      {businesses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="w-12 h-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              No businesses yet
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-center mb-4">
              Connect your Google Business Profile or add a business manually
            </p>
            <div className="flex gap-3">
              <Link href="/settings">
                <Button variant="outline">
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Connect GBP
                </Button>
              </Link>
              <Link href="/businesses/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Manually
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Synced Businesses - Full data available */}
          {syncedBusinesses.length > 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  Data Synced ({syncedBusinesses.length})
                </h2>
                <p className="text-sm text-slate-500 mt-1">Full GBP data available - reviews, photos, and insights</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {syncedBusinesses.map((business) => (
                  <Card key={business.id} className="hover:shadow-lg transition-shadow border-emerald-100 dark:border-emerald-900/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{business.name}</CardTitle>
                            {business.address && (
                              <p className="text-xs text-slate-500 mt-0.5">
                                {business.address.city}, {business.address.state}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 text-xs">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Synced
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Stats Grid */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 mx-auto mb-1" />
                          <p className={`text-xl font-bold ${business.gbp_data?.averageRating ? getScoreColor(business.gbp_data.averageRating) : 'text-slate-400'}`}>
                            {business.gbp_data?.averageRating?.toFixed(1) || '--'}
                          </p>
                          <p className="text-xs text-slate-500">Rating</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                          <MessageSquare className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                          <p className="text-xl font-bold text-slate-700 dark:text-slate-300">
                            {business.gbp_data?.totalReviews || 0}
                          </p>
                          <p className="text-xs text-slate-500">Reviews</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                          <ImageIcon className="w-4 h-4 text-purple-500 mx-auto mb-1" />
                          <p className="text-xl font-bold text-slate-700 dark:text-slate-300">
                            {business.gbp_data?.totalPhotos || 0}
                          </p>
                          <p className="text-xs text-slate-500">Photos</p>
                        </div>
                      </div>

                      {/* Contact Info */}
                      <div className="space-y-1.5 text-sm text-slate-500">
                        {business.website && (
                          <div className="flex items-center gap-2 truncate">
                            <Globe className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{business.website.replace(/^https?:\/\//, '')}</span>
                          </div>
                        )}
                        {business.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3 h-3" />
                            <span>{business.phone}</span>
                          </div>
                        )}
                      </div>

                      {/* Sync Status */}
                      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Synced: {new Date(business.gbp_data!.syncedAt!).toLocaleDateString()}
                        </span>
                      </div>

                      <Link href={`/businesses/${business.id}`} className="block">
                        <Button variant="outline" className="w-full">
                          View & Manage <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Needs Sync - GBP connected but no data */}
          {needsSyncBusinesses.length > 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-amber-500" />
                  Needs Data Sync ({needsSyncBusinesses.length})
                </h2>
                <p className="text-sm text-slate-500 mt-1">GBP account connected - sync to fetch reviews, photos & get SEO scores</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {needsSyncBusinesses.map((business) => (
                  <Card key={business.id} className="hover:shadow-md transition-shadow border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{business.name}</CardTitle>
                            {business.address && (
                              <p className="text-xs text-slate-500 mt-0.5">
                                {business.address.city}, {business.address.state}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className="border-amber-300 text-amber-600 bg-amber-50 text-xs">
                          <CloudOff className="w-3 h-3 mr-1" />
                          Not Synced
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Contact Info */}
                      <div className="space-y-1.5 text-sm text-slate-500">
                        {business.website && (
                          <div className="flex items-center gap-2 truncate">
                            <Globe className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{business.website.replace(/^https?:\/\//, '')}</span>
                          </div>
                        )}
                        {business.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3 h-3" />
                            <span>{business.phone}</span>
                          </div>
                        )}
                        {business.categories && business.categories.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {business.categories[0]}
                          </Badge>
                        )}
                      </div>

                      <div className="p-3 rounded-lg bg-amber-100/50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-center">
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          <RefreshCw className="w-4 h-4 inline mr-2" />
                          Click to sync reviews, photos & insights
                        </p>
                      </div>

                      <Link href={`/businesses/${business.id}`} className="block">
                        <Button className="w-full bg-amber-500 hover:bg-amber-400 text-white">
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Sync GBP Data
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Manual Businesses - Not connected to GBP */}
          {manualBusinesses.length > 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-slate-400" />
                  Manual Entries ({manualBusinesses.length})
                </h2>
                <p className="text-sm text-slate-500 mt-1">Added manually - connect Google account to link with GBP</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {manualBusinesses.map((business) => (
                  <Card key={business.id} className="hover:shadow-md transition-shadow border-dashed">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-slate-400" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{business.name}</CardTitle>
                            {business.address && (
                              <p className="text-xs text-slate-500 mt-0.5">
                                {business.address.city}, {business.address.state}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          Manual
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Contact Info */}
                      <div className="space-y-1.5 text-sm text-slate-500">
                        {business.website && (
                          <div className="flex items-center gap-2 truncate">
                            <Globe className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{business.website.replace(/^https?:\/\//, '')}</span>
                          </div>
                        )}
                        {business.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3 h-3" />
                            <span>{business.phone}</span>
                          </div>
                        )}
                        {business.categories && business.categories.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {business.categories[0]}
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-slate-500 text-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        Connect GBP in Settings to enable data sync
                      </p>

                      <div className="flex gap-2">
                        <Link href={`/businesses/${business.id}`} className="flex-1">
                          <Button variant="outline" className="w-full">
                            View Details
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BusinessesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    }>
      <BusinessesContent />
    </Suspense>
  );
}
