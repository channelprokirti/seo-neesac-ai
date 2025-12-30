'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  ArrowLeft,
  MapPin,
  Globe,
  Phone,
  Trash2,
  Loader2,
  BarChart3,
  RefreshCw,
  Link as LinkIcon,
  Star,
  Image as ImageIcon,
  Clock,
  MessageSquare,
  TrendingUp,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Minus,
  AlertCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Package,
  Briefcase,
  HelpCircle,
  Settings,
  Zap,
  Plus,
} from 'lucide-react';
import type { Business } from '@/types';
import { calculateGBPScore, getScoreColor, getScoreBgColor } from '@/lib/scoring/gbp-scorer';
import type { GBPScoreBreakdown } from '@/lib/scoring/gbp-scorer';
// Content generation is now handled in-tab with dedicated dialogs

// Types
interface GBPReview {
  reviewer?: { displayName?: string; profilePhotoUrl?: string };
  starRating?: string;
  comment?: string;
  createTime?: string;
  reviewReply?: { comment?: string; updateTime?: string };
}

interface GBPPhoto {
  name?: string;
  mediaFormat?: string;
  googleUrl?: string;
  thumbnailUrl?: string;
  sourceUrl?: string;
  category?: string;
}

interface GBPPost {
  name?: string;
  topicType?: string;
  createTime?: string;
  summary?: string;
  media?: Array<{ googleUrl?: string }>;
  callToAction?: { actionType?: string; url?: string };
}

interface GBPProduct {
  name?: string;
  productDescription?: string;
  price?: { currencyCode?: string; units?: string };
  media?: Array<{ googleUrl?: string }>;
}

interface GBPService {
  serviceName?: string;
  displayName?: string;
  description?: string;
  price?: { currencyCode?: string; units?: string };
  raw?: unknown; // Raw data from API for debugging
}

interface GBPData {
  name?: string;
  description?: string;
  phone?: string;
  website?: string;
  address?: Record<string, unknown>;
  reviews?: GBPReview[];
  categories?: {
    primaryCategory?: { displayName?: string };
    additionalCategories?: Array<{ displayName?: string }>;
  };
  hours?: {
    periods?: Array<{ 
      openDay?: string; 
      openTime?: { hours?: number; minutes?: number } | string; 
      closeDay?: string; 
      closeTime?: { hours?: number; minutes?: number } | string;
    }>;
  };
  photos?: GBPPhoto[];
  posts?: GBPPost[];
  products?: GBPProduct[];
  services?: GBPService[];
  questions?: Array<{
    text?: string;
    createTime?: string;
    topAnswers?: Array<{ text?: string; author?: { type?: string } }>;
  }>;
  attributes?: {
    profile?: { description?: string };
    openInfo?: { status?: string; openingDate?: unknown };
    serviceItems?: unknown[];
    [key: string]: unknown;
  };
  performance?: {
    totalInteractions?: number;
    calls?: number;
    directions?: number;
    websiteClicks?: number;
    bookings?: number;
    messageCount?: number;
    searchImpressions?: number;
    mapViews?: number;
    periodStart?: string;
    periodEnd?: string;
    timeSeries?: Record<string, Array<{date: string; value: number}>>;
  };
  averageRating?: number;
  totalReviews?: number;
  totalPhotos?: number;
  totalProducts?: number;
  totalServices?: number;
  ratingDistribution?: Record<string, number>;
  syncedAt?: string;
  reviewAnalytics?: ReviewAnalytics;
  analyticsGeneratedAt?: string;
}

interface ReviewAnalytics {
  keywords: Array<{ word: string; count: number; sentiment: string }>;
  sentimentSummary: { positive: number; neutral: number; negative: number };
  commonThemes: string[];
  suggestions: string[];
}

// Helper functions
function formatTime(time?: { hours?: number; minutes?: number } | string): string {
  if (!time) return '';
  if (typeof time === 'string') return time;
  const hours = time.hours ?? 0;
  const minutes = time.minutes ?? 0;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function ratingToNumber(rating?: string): number {
  const map: Record<string, number> = { FIVE: 5, FOUR: 4, THREE: 3, TWO: 2, ONE: 1 };
  return map[rating || 'FIVE'] || 5;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
        />
      ))}
    </div>
  );
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

// Score weights for calculating final GBP score
const SCORE_WEIGHTS: Record<string, { weight: number; label: string }> = {
  profileInfo: { weight: 20, label: 'Profile Info' },
  reviews: { weight: 20, label: 'Reviews' },
  photos: { weight: 15, label: 'Photos' },
  posts: { weight: 15, label: 'Posts' },
  products: { weight: 10, label: 'Products' },
  services: { weight: 5, label: 'Services' },
  qAndA: { weight: 10, label: 'Q&A' },
  attributes: { weight: 5, label: 'Attributes' },
};

// Performance Section Component with Charts
function PerformanceSection({ gbpData }: { gbpData: GBPData | null }) {
  const [dateRange, setDateRange] = useState<'1m' | '3m' | '6m' | 'all'>('all');
  const [chartView, setChartView] = useState<'combined' | 'individual'>('combined');
  
  // Filter time series data based on date range
  const filterDataByDateRange = (data: Array<{date: string; value: number}>) => {
    if (!data || dateRange === 'all') return data;
    
    const now = new Date();
    const cutoffDate = new Date();
    
    switch (dateRange) {
      case '1m': cutoffDate.setMonth(now.getMonth() - 1); break;
      case '3m': cutoffDate.setMonth(now.getMonth() - 3); break;
      case '6m': cutoffDate.setMonth(now.getMonth() - 6); break;
    }
    
    return data.filter(d => new Date(d.date) >= cutoffDate);
  };
  
  // Calculate filtered totals
  const getFilteredTotals = () => {
    if (!gbpData?.performance?.timeSeries) {
      return gbpData?.performance || { calls: 0, directions: 0, websiteClicks: 0, bookings: 0, totalInteractions: 0 };
    }
    
    const timeSeries = gbpData.performance.timeSeries;
    let calls = 0, directions = 0, websiteClicks = 0, bookings = 0;
    
    Object.entries(timeSeries).forEach(([metric, data]) => {
      const filtered = filterDataByDateRange(data);
      const sum = filtered.reduce((acc, d) => acc + d.value, 0);
      
      switch (metric) {
        case 'CALL_CLICKS': calls = sum; break;
        case 'BUSINESS_DIRECTION_REQUESTS': directions = sum; break;
        case 'WEBSITE_CLICKS': websiteClicks = sum; break;
        case 'BUSINESS_BOOKINGS': bookings = sum; break;
      }
    });
    
    return { calls, directions, websiteClicks, bookings, totalInteractions: calls + directions + websiteClicks + bookings };
  };
  
  const filteredTotals = getFilteredTotals();
  
  // Metric colors and labels
  const metricConfig: Record<string, { color: string; bgColor: string; label: string; icon: React.ElementType }> = {
    'WEBSITE_CLICKS': { color: 'text-purple-500', bgColor: 'bg-purple-500', label: 'Website Clicks', icon: Globe },
    'CALL_CLICKS': { color: 'text-emerald-500', bgColor: 'bg-emerald-500', label: 'Phone Calls', icon: Phone },
    'BUSINESS_DIRECTION_REQUESTS': { color: 'text-red-500', bgColor: 'bg-red-500', label: 'Direction Requests', icon: MapPin },
    'BUSINESS_BOOKINGS': { color: 'text-amber-500', bgColor: 'bg-amber-500', label: 'Bookings', icon: Clock },
  };
  
  // Prepare combined chart data (all metrics by date)
  const getCombinedChartData = () => {
    if (!gbpData?.performance?.timeSeries) return [];
    
    const allDates = new Set<string>();
    Object.values(gbpData.performance.timeSeries).forEach(data => {
      filterDataByDateRange(data).forEach(d => allDates.add(d.date));
    });
    
    const sortedDates = Array.from(allDates).sort();
    
    return sortedDates.map(date => {
      const entry: Record<string, number | string> = { date };
      Object.entries(gbpData.performance!.timeSeries!).forEach(([metric, data]) => {
        const filtered = filterDataByDateRange(data);
        const point = filtered.find(d => d.date === date);
        entry[metric] = point?.value || 0;
      });
      return entry;
    });
  };
  
  // Get weekly aggregated data for cleaner charts
  const getWeeklyData = () => {
    if (!gbpData?.performance?.timeSeries) return [];
    
    const weeklyData: Record<string, Record<string, number>> = {};
    
    Object.entries(gbpData.performance.timeSeries).forEach(([metric, data]) => {
      const filtered = filterDataByDateRange(data);
      filtered.forEach(d => {
        const date = new Date(d.date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];
        
        if (!weeklyData[weekKey]) weeklyData[weekKey] = {};
        weeklyData[weekKey][metric] = (weeklyData[weekKey][metric] || 0) + d.value;
      });
    });
    
    return Object.entries(weeklyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, metrics]) => ({ week, ...metrics }));
  };
  
  const weeklyData = getWeeklyData();
  const maxWeeklyTotal = Math.max(...weeklyData.map(w => 
    Object.entries(w).reduce((sum, [k, v]) => k !== 'week' ? sum + (v as number) : sum, 0)
  ), 1);
  
  if (!gbpData?.performance || gbpData.performance.totalInteractions === undefined) {
    return (
      <>
        <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Performance data shows how customers interact with your Google Business Profile - 
              including phone calls, direction requests, website clicks, and bookings.
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="py-12 text-center">
            <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No performance data available</p>
            <p className="text-sm text-slate-400 mt-2">
              Sync your GBP data to fetch performance metrics
            </p>
            <Alert className="mt-4 max-w-lg mx-auto bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs text-amber-700 dark:text-amber-300">
                <strong>Note:</strong> Performance data requires the Business Profile Performance API to be enabled in your Google Cloud project.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </>
    );
  }
  
  return (
    <>
      {/* Header with Date Filter */}
      <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200 dark:border-blue-800">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              Performance Metrics
            </CardTitle>
            
            {/* Date Range Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Time Period:</span>
              <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                {(['1m', '3m', '6m', 'all'] as const).map(range => (
                  <button
                    key={range}
                    onClick={() => setDateRange(range)}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      dateRange === range 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {range === 'all' ? 'All' : range.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Performance data from {gbpData.performance.periodStart && new Date(gbpData.performance.periodStart).toLocaleDateString()} 
            {' '}to {gbpData.performance.periodEnd && new Date(gbpData.performance.periodEnd).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>
      
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-4xl font-bold">
                {filteredTotals.totalInteractions}
              </div>
              <p className="text-sm text-blue-100 mt-1">Total Interactions</p>
              <p className="text-xs text-blue-200 mt-2">
                {dateRange === 'all' ? 'All time' : `Last ${dateRange === '1m' ? '1 month' : dateRange === '3m' ? '3 months' : '6 months'}`}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="text-center">
              <Phone className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <div className="text-3xl font-bold text-slate-800 dark:text-white">
                {filteredTotals.calls}
              </div>
              <p className="text-sm text-slate-500">Phone Calls</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="text-center">
              <MapPin className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <div className="text-3xl font-bold text-slate-800 dark:text-white">
                {filteredTotals.directions}
              </div>
              <p className="text-sm text-slate-500">Direction Requests</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="text-center">
              <Globe className="w-8 h-8 text-purple-500 mx-auto mb-2" />
              <div className="text-3xl font-bold text-slate-800 dark:text-white">
                {filteredTotals.websiteClicks}
              </div>
              <p className="text-sm text-slate-500">Website Clicks</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="text-center">
              <Clock className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <div className="text-3xl font-bold text-slate-800 dark:text-white">
                {filteredTotals.bookings}
              </div>
              <p className="text-sm text-slate-500">Bookings</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      {gbpData.performance.timeSeries && Object.keys(gbpData.performance.timeSeries).length > 0 && (
        <>
          {/* Chart View Toggle */}
          <div className="flex justify-end">
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button
                onClick={() => setChartView('combined')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  chartView === 'combined' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                Combined View
              </button>
              <button
                onClick={() => setChartView('individual')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  chartView === 'individual' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                Individual Metrics
              </button>
            </div>
          </div>

          {chartView === 'combined' ? (
            /* Combined Stacked Bar Chart */
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                  Weekly Interactions Overview
                </CardTitle>
                <CardDescription>All metrics combined by week</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Legend */}
                <div className="flex flex-wrap gap-4 mb-6">
                  {Object.entries(metricConfig).map(([key, config]) => (
                    <div key={key} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded ${config.bgColor}`} />
                      <span className="text-xs text-slate-600 dark:text-slate-400">{config.label}</span>
                    </div>
                  ))}
                </div>
                
                {/* Stacked Bar Chart */}
                <div className="h-64 flex items-end gap-1">
                  {weeklyData.map((week, idx) => {
                    const metrics = Object.entries(week).filter(([k]) => k !== 'week');
                    const total = metrics.reduce((sum, [, v]) => sum + (v as number), 0);
                    const barHeight = Math.max((total / maxWeeklyTotal) * 200, 8);
                    
                    let currentHeight = 0;
                    
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center group relative">
                        <div 
                          className="w-full max-w-12 flex flex-col-reverse rounded-t overflow-hidden"
                          style={{ height: `${barHeight}px` }}
                        >
                          {Object.entries(metricConfig).map(([metricKey, config]) => {
                            const value = (week[metricKey] as number) || 0;
                            const segmentHeight = total > 0 ? (value / total) * 100 : 0;
                            return (
                              <div 
                                key={metricKey}
                                className={`w-full ${config.bgColor} transition-opacity hover:opacity-80`}
                                style={{ height: `${segmentHeight}%` }}
                              />
                            );
                          })}
                        </div>
                        
                        {/* Tooltip */}
                        <div className="absolute -top-20 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-3 py-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                          <p className="font-medium mb-1">{new Date(week.week as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                          {Object.entries(metricConfig).map(([key, config]) => (
                            <p key={key} className="text-[10px]">
                              <span className={config.color}>{config.label}:</span> {(week[key] as number) || 0}
                            </p>
                          ))}
                          <p className="font-medium mt-1 pt-1 border-t border-slate-600">Total: {total}</p>
                        </div>
                        
                        <p className="text-[9px] text-slate-400 mt-1 rotate-45 origin-left whitespace-nowrap">
                          {new Date(week.week as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Individual Metric Charts */
            <div className="grid gap-4 md:grid-cols-2">
              {Object.entries(gbpData.performance.timeSeries).map(([metricName, data]) => {
                if (!data || data.length === 0) return null;
                
                const filtered = filterDataByDateRange(data);
                const config = metricConfig[metricName] || { color: 'text-blue-500', bgColor: 'bg-blue-500', label: metricName, icon: BarChart3 };
                const Icon = config.icon;
                
                // Group by week
                const weeklyMetric: Record<string, number> = {};
                filtered.forEach(d => {
                  const date = new Date(d.date);
                  const weekStart = new Date(date);
                  weekStart.setDate(date.getDate() - date.getDay());
                  const weekKey = weekStart.toISOString().split('T')[0];
                  weeklyMetric[weekKey] = (weeklyMetric[weekKey] || 0) + d.value;
                });
                
                const weeks = Object.keys(weeklyMetric).sort();
                const maxValue = Math.max(...Object.values(weeklyMetric), 1);
                const total = Object.values(weeklyMetric).reduce((a, b) => a + b, 0);
                
                return (
                  <Card key={metricName}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${config.color}`} />
                          {config.label}
                        </span>
                        <Badge variant="secondary">{total} total</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Line Chart */}
                      <div className="h-32 flex items-end gap-0.5 pt-4 relative">
                        {/* Y-axis labels */}
                        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[9px] text-slate-400 -ml-1">
                          <span>{maxValue}</span>
                          <span>{Math.round(maxValue / 2)}</span>
                          <span>0</span>
                        </div>
                        
                        {/* Bars with connecting line */}
                        <div className="flex-1 ml-6 flex items-end gap-0.5 relative">
                          {weeks.map((week, idx) => {
                            const value = weeklyMetric[week];
                            const height = Math.max((value / maxValue) * 100, 2);
                            
                            return (
                              <div key={week} className="flex-1 flex flex-col items-center group relative">
                                <div 
                                  className={`w-full ${config.bgColor} rounded-t transition-all hover:opacity-80`}
                                  style={{ height: `${height}%` }}
                                />
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                  {value}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      
                      {/* X-axis labels */}
                      <div className="flex justify-between mt-2 ml-6 text-[9px] text-slate-400">
                        {weeks.length > 0 && (
                          <>
                            <span>{new Date(weeks[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            <span>{new Date(weeks[weeks.length - 1]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Messages if available */}
      {gbpData.performance.messageCount !== undefined && gbpData.performance.messageCount > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <MessageSquare className="w-8 h-8 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{gbpData.performance.messageCount}</div>
                <p className="text-sm text-slate-500">Messages / Conversations</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

// Score Section Card Component
function ScoreSectionCard({ 
  title, 
  sectionKey,
  icon: Icon, 
  score, 
  maxScore, 
  issues, 
  recommendations,
  details,
  showDetails = false,
}: {
  title: string;
  sectionKey: string;
  icon: React.ElementType;
  score: number;
  maxScore: number;
  issues: string[];
  recommendations: string[];
  details?: Record<string, unknown>;
  showDetails?: boolean;
}) {
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const weight = SCORE_WEIGHTS[sectionKey]?.weight || 0;
  const contributionScore = Math.round((percentage * weight) / 100);
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Icon className="w-4 h-4 text-emerald-500" />
            {title}
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-normal">
              {score}/{maxScore} pts
            </span>
            <Badge className={getScoreBgColor(percentage)}>
              {percentage}%
            </Badge>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 mt-1">
          Weight: {weight}% → Contributes {contributionScore} pts to final score
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={percentage} className="h-2" />
        
        {issues.length > 0 && (
          <div className="space-y-1">
            {issues.map((issue, i) => (
              <p key={i} className="text-xs text-red-600 flex items-start gap-1">
                <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                {issue}
              </p>
            ))}
          </div>
        )}
        
        {recommendations.length > 0 && issues.length === 0 && (
          <div className="space-y-1">
            {recommendations.slice(0, 1).map((rec, i) => (
              <p key={i} className="text-xs text-emerald-600 flex items-start gap-1">
                <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" />
                {rec}
              </p>
            ))}
          </div>
        )}

        {showDetails && details && (
          <div className="mt-2 pt-2 border-t text-xs text-slate-500 space-y-1">
            {Object.entries(details).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                <span className={typeof value === 'boolean' ? (value ? 'text-emerald-600' : 'text-red-500') : ''}>
                  {typeof value === 'boolean' ? (value ? '✓' : '✗') : String(value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Branding Options Component
interface BrandingOptions {
  includeLogo: boolean;
  includeEmail: boolean;
  includePhone: boolean;
  includeWebsite: boolean;
  logoUrl?: string;
  email?: string;
  phone?: string;
  website?: string;
}

function BrandingOptionsPanel({ 
  options, 
  onChange 
}: { 
  options: BrandingOptions; 
  onChange: (options: BrandingOptions) => void 
}) {
  return (
    <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
      <p className="text-sm font-medium">Include in Generated Content:</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="logo" 
            checked={options.includeLogo}
            onCheckedChange={(checked) => onChange({ ...options, includeLogo: checked === true })}
          />
          <Label htmlFor="logo" className="text-sm">Company Logo</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="email" 
            checked={options.includeEmail}
            onCheckedChange={(checked) => onChange({ ...options, includeEmail: checked === true })}
          />
          <Label htmlFor="email" className="text-sm">Email</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="phone" 
            checked={options.includePhone}
            onCheckedChange={(checked) => onChange({ ...options, includePhone: checked === true })}
          />
          <Label htmlFor="phone" className="text-sm">Phone</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="website" 
            checked={options.includeWebsite}
            onCheckedChange={(checked) => onChange({ ...options, includeWebsite: checked === true })}
          />
          <Label htmlFor="website" className="text-sm">Website</Label>
        </div>
      </div>
      {(options.includeLogo || options.includeEmail || options.includePhone || options.includeWebsite) && (
        <div className="text-xs text-slate-500 mt-2">
          {options.includeLogo && options.logoUrl && <span className="block">Logo: ✓ Configured</span>}
          {options.includeEmail && options.email && <span className="block">Email: {options.email}</span>}
          {options.includePhone && options.phone && <span className="block">Phone: {options.phone}</span>}
          {options.includeWebsite && options.website && <span className="block">Website: {options.website}</span>}
        </div>
      )}
    </div>
  );
}

function useBrandingDefaults(businessPhone?: string, businessWebsite?: string) {
  const [branding, setBranding] = useState<BrandingOptions>({
    includeLogo: false,
    includeEmail: false,
    includePhone: false,
    includeWebsite: false
  });

  useEffect(() => {
    // Load defaults from settings (matches settings page BrandingConfig structure)
    const storedBranding = localStorage.getItem('localseo-branding');
    if (storedBranding) {
      try {
        const config = JSON.parse(storedBranding);
        setBranding({
          includeLogo: config.defaults?.includeLogo || false,
          includeEmail: config.defaults?.includeEmail || false,
          includePhone: config.defaults?.includePhone || false,
          includeWebsite: config.defaults?.includeWebsite || false,
          logoUrl: config.logo || undefined,
          email: config.email || undefined,
          phone: config.phone || businessPhone,
          website: config.website || businessWebsite
        });
      } catch {
        // Use business defaults if no settings
        setBranding(prev => ({
          ...prev,
          phone: businessPhone,
          website: businessWebsite
        }));
      }
    } else {
      setBranding(prev => ({
        ...prev,
        phone: businessPhone,
        website: businessWebsite
      }));
    }
  }, [businessPhone, businessWebsite]);

  return [branding, setBranding] as const;
}

// Description Edit Dialog
function DescriptionDialog({ 
  open, 
  mode, 
  onOpenChange, 
  businessName,
  currentDescription,
  businessId
}: { 
  open: boolean; 
  mode: 'manual' | 'ai'; 
  onOpenChange: (open: boolean) => void;
  businessName: string;
  currentDescription: string;
  businessId: string;
}) {
  const [description, setDescription] = useState(currentDescription);
  const [generating, setGenerating] = useState(false);
  const [posting, setPosting] = useState(false);
  const [branding, setBranding] = useBrandingDefaults();

  useEffect(() => {
    setDescription(currentDescription);
  }, [currentDescription, open]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const storedAI = localStorage.getItem('localseo-ai');
      if (!storedAI) throw new Error('AI not configured');
      const aiConfig = JSON.parse(storedAI);

      const brandingContext = [];
      if (branding.includePhone && branding.phone) brandingContext.push(`Phone: ${branding.phone}`);
      if (branding.includeEmail && branding.email) brandingContext.push(`Email: ${branding.email}`);
      if (branding.includeWebsite && branding.website) brandingContext.push(`Website: ${branding.website}`);

      const response = await fetch('/api/ai/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'business',
          businessName,
          currentContent: currentDescription,
          brandingInfo: brandingContext.length > 0 ? brandingContext.join(', ') : undefined,
          aiConfig
        })
      });

      if (!response.ok) throw new Error('Failed to generate');
      const data = await response.json();
      setDescription(data.content);
    } catch (error) {
      console.error('Generation error:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handlePost = async () => {
    setPosting(true);
    try {
      // In a real implementation, this would call the GBP API to update the description
      alert('Description update would be posted to Google Business Profile. (API integration pending)');
      onOpenChange(false);
    } catch (error) {
      console.error('Post error:', error);
    } finally {
      setPosting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'ai' ? <Sparkles className="w-5 h-5 text-purple-500" /> : <FileText className="w-5 h-5 text-blue-500" />}
            {mode === 'ai' ? 'Edit Description with AI' : 'Edit Description'}
          </DialogTitle>
          <DialogDescription>
            Update your business description to improve local SEO. A good description should be 250-750 characters.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter your business description..."
            className="min-h-[150px]"
          />
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{description.length} characters</span>
            <span className={description.length >= 250 && description.length <= 750 ? 'text-emerald-600' : 'text-amber-600'}>
              {description.length < 250 ? `${250 - description.length} more needed` : description.length > 750 ? `${description.length - 750} too many` : '✓ Good length'}
            </span>
          </div>

          {mode === 'ai' && (
            <>
              <BrandingOptionsPanel options={branding} onChange={setBranding} />
              <Button onClick={handleGenerate} disabled={generating} variant="outline" className="w-full">
                {generating ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> Generate with AI</>
                )}
              </Button>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handlePost} disabled={posting || !description.trim()}>
            {posting ? 'Posting...' : 'Save & Post to Google'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Review Reply Dialog
function ReviewReplyDialog({ 
  open, 
  mode, 
  review,
  onOpenChange, 
  businessName,
  businessId
}: { 
  open: boolean; 
  mode: 'manual' | 'ai'; 
  review: GBPReview | null;
  onOpenChange: (open: boolean) => void;
  businessName: string;
  businessId: string;
}) {
  const [reply, setReply] = useState('');
  const [generating, setGenerating] = useState(false);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    setReply('');
  }, [open, review]);

  const handleGenerate = async () => {
    if (!review) return;
    setGenerating(true);
    try {
      const storedAI = localStorage.getItem('localseo-ai');
      if (!storedAI) throw new Error('AI not configured');
      const aiConfig = JSON.parse(storedAI);

      const response = await fetch('/api/ai/generate-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          reviewerName: review.reviewer?.displayName || 'Customer',
          rating: review.starRating,
          reviewText: review.comment,
          aiConfig
        })
      });

      if (!response.ok) throw new Error('Failed to generate');
      const data = await response.json();
      setReply(data.response);
    } catch (error) {
      console.error('Generation error:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handlePost = async () => {
    setPosting(true);
    try {
      // In a real implementation, this would call the GBP API to post the reply
      alert('Review reply would be posted to Google Business Profile. (API integration pending)');
      onOpenChange(false);
    } catch (error) {
      console.error('Post error:', error);
    } finally {
      setPosting(false);
    }
  };

  if (!review) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'ai' ? <Sparkles className="w-5 h-5 text-purple-500" /> : <MessageSquare className="w-5 h-5 text-blue-500" />}
            {mode === 'ai' ? 'Reply with AI' : 'Reply to Review'}
          </DialogTitle>
        </DialogHeader>

        {/* Original Review */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center text-sm font-medium">
              {review.reviewer?.displayName?.charAt(0) || '?'}
            </div>
            <div>
              <p className="font-medium text-sm">{review.reviewer?.displayName || 'Anonymous'}</p>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-3 h-3 ${i < ratingToNumber(review.starRating) ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
                ))}
              </div>
            </div>
          </div>
          {review.comment && <p className="text-sm text-slate-600 dark:text-slate-300">{review.comment}</p>}
        </div>

        <div className="space-y-4">
          <Textarea 
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Write your reply..."
            className="min-h-[120px]"
          />

          {mode === 'ai' && (
            <Button onClick={handleGenerate} disabled={generating} variant="outline" className="w-full">
              {generating ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Generate Reply with AI</>
              )}
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handlePost} disabled={posting || !reply.trim()}>
            {posting ? 'Posting...' : 'Post Reply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Create Post Dialog
function CreatePostDialog({ 
  open, 
  mode, 
  onOpenChange, 
  businessName,
  businessId,
  aiConfigured,
  imageModelConfigured
}: { 
  open: boolean; 
  mode: 'text' | 'image' | 'both';
  onOpenChange: (open: boolean) => void;
  businessName: string;
  businessId: string;
  aiConfigured: boolean;
  imageModelConfigured: boolean;
}) {
  const [postText, setPostText] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [generatingText, setGeneratingText] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [posting, setPosting] = useState(false);
  const [branding, setBranding] = useBrandingDefaults();

  useEffect(() => {
    setPostText('');
    setImageUrl(null);
  }, [open]);

  const handleGenerateText = async () => {
    setGeneratingText(true);
    try {
      const storedAI = localStorage.getItem('localseo-ai');
      if (!storedAI) throw new Error('AI not configured');
      const aiConfig = JSON.parse(storedAI);

      const brandingContext = [];
      if (branding.includePhone && branding.phone) brandingContext.push(`Phone: ${branding.phone}`);
      if (branding.includeEmail && branding.email) brandingContext.push(`Email: ${branding.email}`);
      if (branding.includeWebsite && branding.website) brandingContext.push(`Website: ${branding.website}`);

      const response = await fetch('/api/ai/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          postType: 'UPDATE',
          brandingInfo: brandingContext.length > 0 ? brandingContext.join(', ') : undefined,
          aiConfig
        })
      });

      if (!response.ok) throw new Error('Failed to generate');
      const data = await response.json();
      setPostText(data.content);
    } catch (error) {
      console.error('Generation error:', error);
    } finally {
      setGeneratingText(false);
    }
  };

  const handleGenerateImage = async () => {
    setGeneratingImage(true);
    try {
      const storedImageAI = localStorage.getItem('localseo-ai-image');
      if (!storedImageAI) throw new Error('Image AI not configured. Please configure image generation model in Settings.');
      const parsed = JSON.parse(storedImageAI);
      
      // Handle both new multi-provider format and old single-provider format
      let imageConfig;
      if (parsed.providers && parsed.active) {
        // New multi-provider format
        imageConfig = parsed.providers[parsed.active];
        if (!imageConfig) throw new Error('No active image model selected. Please select an image model in Settings.');
      } else {
        // Old single-provider format
        imageConfig = parsed;
      }
      
      // Handle useSameAsText case - get API key from text config
      let apiKey = imageConfig.apiKey;
      if (imageConfig.useSameAsText || !apiKey) {
        // Try new format first (localseo-ai-configs)
        const storedConfigs = localStorage.getItem('localseo-ai-configs');
        if (storedConfigs) {
          const configs = JSON.parse(storedConfigs);
          // Check provider-specific text model for API key
          if (imageConfig.provider === 'gemini') {
            const geminiConfig = configs.providers?.['gemini'];
            if (geminiConfig?.apiKey) {
              apiKey = geminiConfig.apiKey;
            }
          } else {
            // Default to OpenAI
            const openaiConfig = configs.providers?.['openai'];
            if (openaiConfig?.apiKey) {
              apiKey = openaiConfig.apiKey;
            }
          }
        }
        // Fall back to old format (OpenAI only)
        if (!apiKey && imageConfig.provider !== 'gemini') {
          const storedTextAI = localStorage.getItem('localseo-ai');
          if (storedTextAI) {
            const textConfig = JSON.parse(storedTextAI);
            apiKey = textConfig.apiKey;
          }
        }
      }

      if (!apiKey) {
        throw new Error(`No API key found. Please configure ${imageConfig.provider === 'gemini' ? 'Gemini' : 'OpenAI'} API key in Settings for image generation.`);
      }

      const response = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Professional business image for ${businessName}. Modern, high-quality, suitable for Google Business Profile.`,
          businessName,
          includeLogo: branding.includeLogo,
          logoUrl: branding.logoUrl,
          includeContactInfo: branding.includePhone || branding.includeEmail || branding.includeWebsite,
          contactInfo: {
            phone: branding.includePhone ? branding.phone : undefined,
            email: branding.includeEmail ? branding.email : undefined,
            website: branding.includeWebsite ? branding.website : undefined
          },
          aiConfig: { ...imageConfig, apiKey }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate image');
      }
      const data = await response.json();
      setImageUrl(data.imageUrl);
    } catch (error) {
      console.error('Image generation error:', error);
      alert(error instanceof Error ? error.message : 'Failed to generate image');
    } finally {
      setGeneratingImage(false);
    }
  };

  const handlePost = async () => {
    setPosting(true);
    try {
      alert('Post would be published to Google Business Profile. (API integration pending)');
      onOpenChange(false);
    } catch (error) {
      console.error('Post error:', error);
    } finally {
      setPosting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            Create New Post
            {mode === 'both' && <Badge variant="secondary">Text + Image</Badge>}
            {mode === 'image' && <Badge variant="secondary">Image</Badge>}
          </DialogTitle>
          <DialogDescription>
            Create a post to share updates, offers, or events with your customers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {(mode === 'text' || mode === 'both') && (
            <div className="space-y-2">
              <Label>Post Text</Label>
              <Textarea 
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder="What would you like to share?"
                className="min-h-[100px]"
              />
              {aiConfigured && (
                <Button onClick={handleGenerateText} disabled={generatingText} variant="outline" size="sm">
                  {generatingText ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" /> Generate with AI</>
                  )}
                </Button>
              )}
            </div>
          )}

          {(mode === 'image' || mode === 'both') && (
            <div className="space-y-2">
              <Label>Post Image</Label>
              {imageUrl ? (
                <div className="relative">
                  <img src={imageUrl} alt="Generated" className="w-full h-48 object-cover rounded-lg" />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="absolute top-2 right-2"
                    onClick={() => setImageUrl(null)}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  {imageModelConfigured ? (
                    <Button onClick={handleGenerateImage} disabled={generatingImage} variant="outline">
                      {generatingImage ? (
                        <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                      ) : (
                        <><ImageIcon className="w-4 h-4 mr-2" /> Generate Image with AI</>
                      )}
                    </Button>
                  ) : (
                    <p className="text-sm text-slate-400">
                      <Link href="/settings" className="underline">Configure Image AI</Link> to generate images
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <BrandingOptionsPanel options={branding} onChange={setBranding} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={handlePost} 
            disabled={posting || ((mode === 'text' || mode === 'both') && !postText.trim()) || ((mode === 'image' || mode === 'both') && !imageUrl)}
          >
            {posting ? 'Posting...' : 'Publish Post'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Generate Image Dialog
function GenerateImageDialog({ 
  open, 
  onOpenChange, 
  businessName,
  businessId
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  businessName: string;
  businessId: string;
}) {
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [branding, setBranding] = useBrandingDefaults();

  useEffect(() => {
    setPrompt('');
    setImageUrl(null);
  }, [open]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const storedImageAI = localStorage.getItem('localseo-ai-image');
      if (!storedImageAI) throw new Error('Image AI not configured. Please configure image generation model in Settings.');
      const parsed = JSON.parse(storedImageAI);
      
      // Handle both new multi-provider format and old single-provider format
      let imageConfig;
      if (parsed.providers && parsed.active) {
        // New multi-provider format
        imageConfig = parsed.providers[parsed.active];
        if (!imageConfig) throw new Error('No active image model selected. Please select an image model in Settings.');
      } else {
        // Old single-provider format
        imageConfig = parsed;
      }
      
      // Handle useSameAsText case - get API key from text config
      let apiKey = imageConfig.apiKey;
      if (imageConfig.useSameAsText || !apiKey) {
        // Try new format first (localseo-ai-configs)
        const storedConfigs = localStorage.getItem('localseo-ai-configs');
        if (storedConfigs) {
          const configs = JSON.parse(storedConfigs);
          // Check provider-specific text model for API key
          if (imageConfig.provider === 'gemini') {
            const geminiConfig = configs.providers?.['gemini'];
            if (geminiConfig?.apiKey) {
              apiKey = geminiConfig.apiKey;
            }
          } else {
            // Default to OpenAI
            const openaiConfig = configs.providers?.['openai'];
            if (openaiConfig?.apiKey) {
              apiKey = openaiConfig.apiKey;
            }
          }
        }
        // Fall back to old format (OpenAI only)
        if (!apiKey && imageConfig.provider !== 'gemini') {
          const storedTextAI = localStorage.getItem('localseo-ai');
          if (storedTextAI) {
            const textConfig = JSON.parse(storedTextAI);
            apiKey = textConfig.apiKey;
          }
        }
      }

      if (!apiKey) {
        throw new Error(`No API key found. Please configure ${imageConfig.provider === 'gemini' ? 'Gemini' : 'OpenAI'} API key in Settings for image generation.`);
      }

      const response = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt || `Professional business image for ${businessName}`,
          businessName,
          includeLogo: branding.includeLogo,
          logoUrl: branding.logoUrl,
          includeContactInfo: branding.includePhone || branding.includeEmail || branding.includeWebsite,
          contactInfo: {
            phone: branding.includePhone ? branding.phone : undefined,
            email: branding.includeEmail ? branding.email : undefined,
            website: branding.includeWebsite ? branding.website : undefined
          },
          aiConfig: { ...imageConfig, apiKey }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate image');
      }
      const data = await response.json();
      setImageUrl(data.imageUrl);
    } catch (error) {
      console.error('Image generation error:', error);
      alert(error instanceof Error ? error.message : 'Failed to generate image');
    } finally {
      setGenerating(false);
    }
  };

  const handleUpload = async () => {
    setUploading(true);
    try {
      alert('Image would be uploaded to Google Business Profile. (API integration pending)');
      onOpenChange(false);
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-emerald-500" />
            Generate Business Image
          </DialogTitle>
          <DialogDescription>
            Create professional images for your Google Business Profile using AI.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Image Description</Label>
            <Textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={`E.g., "Modern storefront with welcoming entrance" or "Team members providing excellent service"`}
              className="min-h-[80px]"
            />
          </div>

          <BrandingOptionsPanel options={branding} onChange={setBranding} />

          {imageUrl ? (
            <div className="space-y-2">
              <img src={imageUrl} alt="Generated" className="w-full h-64 object-cover rounded-lg" />
              <Button onClick={handleGenerate} disabled={generating} variant="outline" className="w-full">
                {generating ? 'Regenerating...' : 'Regenerate'}
              </Button>
            </div>
          ) : (
            <Button onClick={handleGenerate} disabled={generating} className="w-full">
              {generating ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Generate Image</>
              )}
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleUpload} disabled={uploading || !imageUrl}>
            {uploading ? 'Uploading...' : 'Upload to Profile'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Service Edit Dialog
function ServiceEditDialog({ 
  open, 
  mode, 
  service,
  onOpenChange, 
  businessName,
  businessId
}: { 
  open: boolean; 
  mode: 'manual' | 'ai';
  service: GBPService | null;
  onOpenChange: (open: boolean) => void;
  businessName: string;
  businessId: string;
}) {
  const [description, setDescription] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [branding, setBranding] = useBrandingDefaults();

  useEffect(() => {
    setDescription(service?.description || '');
  }, [service, open]);

  const handleGenerate = async () => {
    if (!service) return;
    setGenerating(true);
    try {
      const storedAI = localStorage.getItem('localseo-ai');
      if (!storedAI) throw new Error('AI not configured');
      const aiConfig = JSON.parse(storedAI);

      const brandingContext = [];
      if (branding.includePhone && branding.phone) brandingContext.push(`Phone: ${branding.phone}`);
      if (branding.includeWebsite && branding.website) brandingContext.push(`Website: ${branding.website}`);

      const response = await fetch('/api/ai/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'service',
          businessName,
          serviceName: service.serviceName,
          currentContent: service.description,
          brandingInfo: brandingContext.length > 0 ? brandingContext.join(', ') : undefined,
          aiConfig
        })
      });

      if (!response.ok) throw new Error('Failed to generate');
      const data = await response.json();
      setDescription(data.content);
    } catch (error) {
      console.error('Generation error:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      alert('Service description would be updated in Google Business Profile. (API integration pending)');
      onOpenChange(false);
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!service) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'ai' ? <Sparkles className="w-5 h-5 text-purple-500" /> : <Briefcase className="w-5 h-5 text-blue-500" />}
            Edit Service: {service.serviceName || 'Service'}
          </DialogTitle>
          <DialogDescription>
            Add a description to help customers understand what this service includes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe this service..."
            className="min-h-[120px]"
          />

          {mode === 'ai' && (
            <>
              <BrandingOptionsPanel options={branding} onChange={setBranding} />
              <Button onClick={handleGenerate} disabled={generating} variant="outline" className="w-full">
                {generating ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> Generate Description with AI</>
                )}
              </Button>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !description.trim()}>
            {saving ? 'Saving...' : 'Save to Google'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [gbpData, setGbpData] = useState<GBPData | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [reviewAnalytics, setReviewAnalytics] = useState<ReviewAnalytics | null>(null);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [imageModelConfigured, setImageModelConfigured] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [scoreBreakdown, setScoreBreakdown] = useState<{ overallScore: number; breakdown: GBPScoreBreakdown; status: string } | null>(null);
  // Dialog states for contextual AI actions
  const [descriptionDialog, setDescriptionDialog] = useState<{ open: boolean; mode: 'manual' | 'ai' }>({ open: false, mode: 'manual' });
  const [reviewReplyDialog, setReviewReplyDialog] = useState<{ open: boolean; review: GBPReview | null; mode: 'manual' | 'ai' }>({ open: false, review: null, mode: 'manual' });
  const [postDialog, setPostDialog] = useState<{ open: boolean; mode: 'text' | 'image' | 'both' }>({ open: false, mode: 'text' });
  const [serviceDialog, setServiceDialog] = useState<{ open: boolean; service: GBPService | null; mode: 'manual' | 'ai' }>({ open: false, service: null, mode: 'manual' });
  const [imageDialog, setImageDialog] = useState<{ open: boolean }>({ open: false });

  useEffect(() => {
    const fetchBusiness = async () => {
      const { url, anonKey } = getSupabaseCredentials();
      if (!url || !anonKey) {
        setLoading(false);
        return;
      }

      const supabase = createBrowserClient(url, anonKey);
      const { data } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', id)
        .single();

      if (data) {
        setBusiness(data);
        if (data.gbp_data && Object.keys(data.gbp_data).length > 0) {
          const storedGbpData = data.gbp_data as GBPData;
          setGbpData(storedGbpData);
          
          if (storedGbpData.reviewAnalytics) {
            setReviewAnalytics(storedGbpData.reviewAnalytics);
          }
          
          // Calculate score
          const score = calculateGBPScore({
            ...storedGbpData,
            name: data.name,
            phone: data.phone,
            website: data.website,
            address: data.address,
          });
          setScoreBreakdown(score);
        }
      }
      setLoading(false);
    };

    fetchBusiness();

    // Check if AI is configured (text model)
    const storedAI = localStorage.getItem('localseo-ai');
    if (storedAI) {
      try {
        const config = JSON.parse(storedAI);
        setAiConfigured(!!(config.apiKey && config.model && config.provider));
      } catch {
        setAiConfigured(false);
      }
    }
    
    // Check if image model is configured
    const storedImageAI = localStorage.getItem('localseo-ai-image');
    if (storedImageAI) {
      try {
        const parsed = JSON.parse(storedImageAI);
        // Handle both new multi-provider format and old single-provider format
        let hasConfig = false;
        if (parsed.providers && parsed.active) {
          // New multi-provider format
          const activeConfig = parsed.providers[parsed.active];
          hasConfig = activeConfig && activeConfig.provider && activeConfig.model && (activeConfig.apiKey || activeConfig.useSameAsText);
        } else {
          // Old single-provider format
          hasConfig = parsed.provider && parsed.model && (parsed.apiKey || parsed.useSameAsText);
        }
        setImageModelConfigured(hasConfig);
      } catch {
        setImageModelConfigured(false);
      }
    }
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    const { url, anonKey } = getSupabaseCredentials();
    if (!url || !anonKey) return;

    const supabase = createBrowserClient(url, anonKey);
    await supabase.from('businesses').delete().eq('id', id);
    router.push('/businesses');
  };

  const handleSyncGBP = async () => {
    if (!business) return;
    
    setSyncing(true);
    setSyncError(null);
    
    try {
      const { url, anonKey } = getSupabaseCredentials();
      if (url && anonKey) {
        document.cookie = `supabase-config=${encodeURIComponent(JSON.stringify({ url, anonKey }))};path=/;max-age=300`;
      }

      const response = await fetch('/api/gbp/sync-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: id }),
      });

      const data = await response.json();

      if (!response.ok) {
        setSyncError(data.error || 'Failed to sync GBP data');
      } else if (data.data) {
        setGbpData(data.data);
        setReviewAnalytics(null);
        
        // Recalculate score
        const score = calculateGBPScore({
          ...data.data,
          name: business.name,
          phone: business.phone,
          website: business.website,
          address: business.address,
        });
        setScoreBreakdown(score);
      }
    } catch (error) {
      setSyncError('Failed to connect to GBP. Please try again.');
    }
    
    setSyncing(false);
  };

  const handleAnalyzeReviews = async () => {
    if (!gbpData?.reviews || gbpData.reviews.length === 0) return;
    
    setAnalyzing(true);
    setAiError(null);
    
    try {
      let aiConfig = { provider: 'openai', model: 'gpt-4-turbo-preview', apiKey: '' };
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('localseo-ai');
        if (stored) {
          aiConfig = JSON.parse(stored);
        }
      }

      if (!aiConfig.apiKey || !aiConfig.model) {
        setAiError('AI is not configured. Please go to Settings → AI Provider to set up your AI model.');
        setAnalyzing(false);
        return;
      }

      const response = await fetch('/api/ai/analyze-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviews: gbpData.reviews,
          businessName: business?.name,
          ai_config: aiConfig,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setAiError(data.error || 'Failed to analyze reviews. Please check your AI configuration.');
      } else if (data.analytics) {
        setReviewAnalytics(data.analytics);
        
        const { url, anonKey } = getSupabaseCredentials();
        if (url && anonKey) {
          const supabase = createBrowserClient(url, anonKey);
          const updatedGbpData = { ...gbpData, reviewAnalytics: data.analytics, analyticsGeneratedAt: new Date().toISOString() };
          await supabase
            .from('businesses')
            .update({ gbp_data: updatedGbpData })
            .eq('id', id);
          setGbpData(updatedGbpData);
        }
      }
    } catch (error) {
      console.error('Failed to analyze reviews:', error);
      setAiError('Failed to connect to AI service. Please try again.');
    }
    
    setAnalyzing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Business not found</h2>
        <Link href="/businesses">
          <Button variant="link">Go back to businesses</Button>
        </Link>
      </div>
    );
  }

  const isGBPConnected = (business as Business & { gbp_connected?: boolean })?.gbp_connected;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/businesses">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{business.name}</h1>
              {isGBPConnected && (
                <Badge variant="outline" className="border-emerald-300 text-emerald-600">
                  <LinkIcon className="w-3 h-3 mr-1" />
                  GBP Connected
                </Badge>
              )}
            </div>
            {business.categories && business.categories.length > 0 && (
              <div className="flex gap-2 mt-2">
                {business.categories.map((cat) => (
                  <Badge key={cat} variant="secondary">{cat}</Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isGBPConnected && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSyncGBP}
              disabled={syncing}
            >
              {syncing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Sync GBP Data
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Business</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete {business.name}? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                  {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Sync Error */}
      {syncError && (
        <Alert variant="destructive">
          <AlertTitle>Sync Failed</AlertTitle>
          <AlertDescription>{syncError}</AlertDescription>
        </Alert>
      )}

      {/* Overall Score Card */}
      {scoreBreakdown && (
        <Card className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
          <CardContent className="py-6">
            <div className="flex flex-col lg:flex-row items-start justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className={`text-5xl font-bold ${getScoreColor(scoreBreakdown.overallScore)}`}>
                    {scoreBreakdown.overallScore}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">GBP Score</p>
                </div>
                <div className="h-20 w-px bg-slate-200 dark:bg-slate-700" />
                <div>
                  <Badge className={`${
                    scoreBreakdown.status === 'excellent' ? 'bg-emerald-500' :
                    scoreBreakdown.status === 'good' ? 'bg-blue-500' :
                    scoreBreakdown.status === 'needs_work' ? 'bg-amber-500' : 'bg-red-500'
                  } text-white`}>
                    {scoreBreakdown.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                    {gbpData?.syncedAt ? `Last synced: ${new Date(gbpData.syncedAt).toLocaleString()}` : 'Not synced yet'}
                  </p>
                </div>
              </div>
              
              {/* Score Calculation Breakdown */}
              <div className="flex-1 max-w-lg">
                <p className="text-xs text-slate-500 mb-2 font-medium">Score Calculation:</p>
                <div className="grid grid-cols-4 gap-1 text-[10px]">
                  {Object.entries(SCORE_WEIGHTS).map(([key, { weight, label }]) => {
                    const section = scoreBreakdown.breakdown[key as keyof GBPScoreBreakdown];
                    const sectionPercent = section.maxScore > 0 ? Math.round((section.score / section.maxScore) * 100) : 0;
                    const contribution = Math.round((sectionPercent * weight) / 100);
                    return (
                      <div key={key} className="bg-white dark:bg-slate-800 p-1.5 rounded text-center border">
                        <p className="font-medium text-slate-700 dark:text-slate-300 truncate">{label}</p>
                        <p className="text-slate-400">{sectionPercent}% × {weight}%</p>
                        <p className={`font-bold ${contribution >= weight * 0.7 ? 'text-emerald-600' : contribution >= weight * 0.4 ? 'text-amber-600' : 'text-red-600'}`}>
                          +{contribution}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-400 mt-1 text-right">
                  Total: {Object.entries(SCORE_WEIGHTS).reduce((sum, [key, { weight }]) => {
                    const section = scoreBreakdown.breakdown[key as keyof GBPScoreBreakdown];
                    const sectionPercent = section.maxScore > 0 ? Math.round((section.score / section.maxScore) * 100) : 0;
                    return sum + Math.round((sectionPercent * weight) / 100);
                  }, 0)} / 100
                </p>
              </div>
              
              {/* Quick Stats */}
              <div className="flex items-center gap-6">
                {gbpData?.averageRating && (
                  <div className="text-center">
                    <div className="flex items-center gap-1 justify-center">
                      <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                      <span className="text-2xl font-bold">{gbpData.averageRating.toFixed(1)}</span>
                    </div>
                    <p className="text-xs text-slate-500">Rating</p>
                  </div>
                )}
                <div className="text-center">
                  <p className="text-2xl font-bold">{gbpData?.totalReviews || 0}</p>
                  <p className="text-xs text-slate-500">Reviews</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{gbpData?.totalPhotos || 0}</p>
                  <p className="text-xs text-slate-500">Photos</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Not Connected Message */}
      {!isGBPConnected && (
        <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-300">Not Connected to GBP</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            Connect your Google Business Profile to sync data, get scores, and receive AI-powered recommendations.{' '}
            <Link href="/settings" className="font-medium underline">
              Connect in Settings
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="overview" className="flex items-center gap-1">
            <BarChart3 className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex items-center gap-1">
            <Settings className="w-4 h-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="reviews" className="flex items-center gap-1">
            <MessageSquare className="w-4 h-4" />
            Reviews
          </TabsTrigger>
          <TabsTrigger value="photos" className="flex items-center gap-1">
            <ImageIcon className="w-4 h-4" />
            Photos
          </TabsTrigger>
          <TabsTrigger value="posts" className="flex items-center gap-1">
            <FileText className="w-4 h-4" />
            Posts
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-1">
            <Package className="w-4 h-4" />
            Products
          </TabsTrigger>
          <TabsTrigger value="services" className="flex items-center gap-1">
            <Briefcase className="w-4 h-4" />
            Services
          </TabsTrigger>
          <TabsTrigger value="qanda" className="flex items-center gap-1">
            <HelpCircle className="w-4 h-4" />
            Q&A
          </TabsTrigger>
          <TabsTrigger value="attributes" className="flex items-center gap-1">
            <Settings className="w-4 h-4" />
            Attributes
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-1">
            <TrendingUp className="w-4 h-4" />
            Performance
          </TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {scoreBreakdown ? (
            <>
              {/* Score Breakdown Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <ScoreSectionCard
                  title="Profile Info"
                  sectionKey="profileInfo"
                  icon={Settings}
                  score={scoreBreakdown.breakdown.profileInfo.score}
                  maxScore={scoreBreakdown.breakdown.profileInfo.maxScore}
                  issues={scoreBreakdown.breakdown.profileInfo.issues}
                  recommendations={scoreBreakdown.breakdown.profileInfo.recommendations}
                  details={scoreBreakdown.breakdown.profileInfo.details}
                  showDetails
                />
                <ScoreSectionCard
                  title="Reviews"
                  sectionKey="reviews"
                  icon={MessageSquare}
                  score={scoreBreakdown.breakdown.reviews.score}
                  maxScore={scoreBreakdown.breakdown.reviews.maxScore}
                  issues={scoreBreakdown.breakdown.reviews.issues}
                  recommendations={scoreBreakdown.breakdown.reviews.recommendations}
                  details={scoreBreakdown.breakdown.reviews.details}
                  showDetails
                />
                <ScoreSectionCard
                  title="Photos"
                  sectionKey="photos"
                  icon={ImageIcon}
                  score={scoreBreakdown.breakdown.photos.score}
                  maxScore={scoreBreakdown.breakdown.photos.maxScore}
                  issues={scoreBreakdown.breakdown.photos.issues}
                  recommendations={scoreBreakdown.breakdown.photos.recommendations}
                  details={scoreBreakdown.breakdown.photos.details}
                  showDetails
                />
                <ScoreSectionCard
                  title="Posts"
                  sectionKey="posts"
                  icon={FileText}
                  score={scoreBreakdown.breakdown.posts.score}
                  maxScore={scoreBreakdown.breakdown.posts.maxScore}
                  issues={scoreBreakdown.breakdown.posts.issues}
                  recommendations={scoreBreakdown.breakdown.posts.recommendations}
                  details={scoreBreakdown.breakdown.posts.details}
                  showDetails
                />
                <ScoreSectionCard
                  title="Products"
                  sectionKey="products"
                  icon={Package}
                  score={scoreBreakdown.breakdown.products.score}
                  maxScore={scoreBreakdown.breakdown.products.maxScore}
                  issues={scoreBreakdown.breakdown.products.issues}
                  recommendations={scoreBreakdown.breakdown.products.recommendations}
                  details={scoreBreakdown.breakdown.products.details}
                  showDetails
                />
                <ScoreSectionCard
                  title="Services"
                  sectionKey="services"
                  icon={Briefcase}
                  score={scoreBreakdown.breakdown.services.score}
                  maxScore={scoreBreakdown.breakdown.services.maxScore}
                  issues={scoreBreakdown.breakdown.services.issues}
                  recommendations={scoreBreakdown.breakdown.services.recommendations}
                  details={scoreBreakdown.breakdown.services.details}
                  showDetails
                />
                <ScoreSectionCard
                  title="Q&A"
                  sectionKey="qAndA"
                  icon={HelpCircle}
                  score={scoreBreakdown.breakdown.qAndA.score}
                  maxScore={scoreBreakdown.breakdown.qAndA.maxScore}
                  issues={scoreBreakdown.breakdown.qAndA.issues}
                  recommendations={scoreBreakdown.breakdown.qAndA.recommendations}
                  details={scoreBreakdown.breakdown.qAndA.details}
                  showDetails
                />
                <ScoreSectionCard
                  title="Attributes"
                  sectionKey="attributes"
                  icon={Settings}
                  score={scoreBreakdown.breakdown.attributes.score}
                  maxScore={scoreBreakdown.breakdown.attributes.maxScore}
                  issues={scoreBreakdown.breakdown.attributes.issues}
                  recommendations={scoreBreakdown.breakdown.attributes.recommendations}
                  details={scoreBreakdown.breakdown.attributes.details}
                  showDetails
                />
              </div>

              {/* All Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-500" />
                    Top Recommendations
                  </CardTitle>
                  <CardDescription>Actions to improve your GBP score</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.values(scoreBreakdown.breakdown)
                      .flatMap(section => section.recommendations)
                      .slice(0, 8)
                      .map((rec, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <p className="text-sm">{rec}</p>
                        </div>
                      ))
                    }
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">
                  {isGBPConnected 
                    ? 'Sync your GBP data to see your score breakdown'
                    : 'Connect your Google Business Profile to see your score'}
                </p>
                {isGBPConnected && (
                  <Button variant="outline" className="mt-4" onClick={handleSyncGBP}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync GBP Data
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile" className="mt-6 space-y-6">
          {/* Business Description with Edit Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                Business Description
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg min-h-[100px]">
                {gbpData?.description || gbpData?.attributes?.profile?.description ? (
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    {gbpData.description || gbpData.attributes?.profile?.description}
                  </p>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-slate-400">No business description set</p>
                    <p className="text-xs text-slate-400 mt-1">
                      A good description helps customers find and choose your business
                    </p>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setDescriptionDialog({ open: true, mode: 'manual' })}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Edit Manually
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setDescriptionDialog({ open: true, mode: 'ai' })}
                  disabled={!aiConfigured}
                  className={aiConfigured ? 'border-purple-200 text-purple-700 hover:bg-purple-50' : ''}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Edit with AI
                </Button>
                {!aiConfigured && (
                  <span className="text-xs text-slate-400 self-center ml-2">
                    <Link href="/settings" className="underline">Configure AI</Link> to use AI features
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Basic Info Grid */}
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Website
                </CardTitle>
              </CardHeader>
              <CardContent>
                {business.website || gbpData?.website ? (
                  <a href={business.website || gbpData?.website} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline break-all">
                    {business.website || gbpData?.website}
                  </a>
                ) : (
                  <span className="text-slate-400">Not set</span>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone
                </CardTitle>
              </CardHeader>
              <CardContent>
                {business.phone || gbpData?.phone || <span className="text-slate-400">Not set</span>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Location
                </CardTitle>
              </CardHeader>
              <CardContent>
                {gbpData?.address ? (
                  <div className="text-sm">
                    {(gbpData.address as { addressLines?: string[] })?.addressLines?.join(', ') || 
                     `${(gbpData.address as { locality?: string })?.locality || ''}, ${(gbpData.address as { administrativeArea?: string })?.administrativeArea || ''}`}
                  </div>
                ) : business.address?.city ? (
                  <span>{business.address.city}, {business.address.state}</span>
                ) : (
                  <span className="text-slate-400">Not set</span>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Categories */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Categories</CardTitle>
              <CardDescription>Business categories help customers find you</CardDescription>
            </CardHeader>
            <CardContent>
              {gbpData?.categories ? (
                <div className="flex flex-wrap gap-2">
                  {gbpData.categories.primaryCategory?.displayName && (
                    <Badge className="bg-emerald-500">
                      <Star className="w-3 h-3 mr-1" />
                      {gbpData.categories.primaryCategory.displayName}
                      <span className="ml-1 text-[10px] opacity-70">(Primary)</span>
                    </Badge>
                  )}
                  {gbpData.categories.additionalCategories?.map((cat, i) => (
                    <Badge key={i} variant="secondary">
                      {cat.displayName}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400">No categories available</p>
              )}
            </CardContent>
          </Card>

          {/* Business Hours */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-500" />
                Business Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              {gbpData?.hours?.periods && gbpData.hours.periods.length > 0 ? (
                <div className="grid gap-2 max-w-md">
                  {gbpData.hours.periods.map((period, i) => (
                    <div key={i} className="flex justify-between py-2 border-b last:border-0">
                      <span className="font-medium">{period.openDay}</span>
                      <span className="text-slate-600">
                        {formatTime(period.openTime)} - {formatTime(period.closeTime)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-center py-8">Business hours not available</p>
              )}
            </CardContent>
          </Card>

          {/* Profile Score Details */}
          {scoreBreakdown && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-amber-500" />
                  Profile Scoring Criteria
                </CardTitle>
                <CardDescription>How your profile score is calculated</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(scoreBreakdown.breakdown.profileInfo.details).map(([key, value]) => (
                    <div key={key} className={`flex items-center gap-3 p-3 rounded-lg ${value ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                      {value ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                      <div>
                        <p className={`text-sm font-medium ${value ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-800 dark:text-red-300'}`}>
                          {key.replace(/([A-Z])/g, ' $1').replace(/^has\s*/i, '').trim()}
                        </p>
                        <p className="text-xs text-slate-500">
                          {value ? '+1 point' : '0 points'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-slate-500 mt-4">
                  Profile Score: <span className="font-bold">{scoreBreakdown.breakdown.profileInfo.score}/{scoreBreakdown.breakdown.profileInfo.maxScore}</span> points
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Reviews Tab */}
        <TabsContent value="reviews" className="mt-6 space-y-6">
          {/* Reviews Scoring Criteria */}
          {scoreBreakdown && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-amber-500" />
                  Reviews Scoring Criteria
                </CardTitle>
                <CardDescription>How your reviews score is calculated (max 10 points)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className={`p-3 rounded-lg ${scoreBreakdown.breakdown.reviews.details.averageRating >= 4.5 ? 'bg-emerald-50 dark:bg-emerald-900/20' : scoreBreakdown.breakdown.reviews.details.averageRating >= 4 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                    <p className="text-2xl font-bold">{scoreBreakdown.breakdown.reviews.details.averageRating.toFixed(1)}★</p>
                    <p className="text-xs text-slate-500">Avg Rating (4.5+: 3pts, 4+: 2pts)</p>
                  </div>
                  <div className={`p-3 rounded-lg ${scoreBreakdown.breakdown.reviews.details.totalReviews >= 50 ? 'bg-emerald-50 dark:bg-emerald-900/20' : scoreBreakdown.breakdown.reviews.details.totalReviews >= 20 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                    <p className="text-2xl font-bold">{scoreBreakdown.breakdown.reviews.details.totalReviews}</p>
                    <p className="text-xs text-slate-500">Total Reviews (50+: 3pts, 20+: 2pts)</p>
                  </div>
                  <div className={`p-3 rounded-lg ${scoreBreakdown.breakdown.reviews.details.responseRate >= 90 ? 'bg-emerald-50 dark:bg-emerald-900/20' : scoreBreakdown.breakdown.reviews.details.responseRate >= 70 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                    <p className="text-2xl font-bold">{scoreBreakdown.breakdown.reviews.details.responseRate}%</p>
                    <p className="text-xs text-slate-500">Response Rate (90%+: 2pts, 70%+: 1pt)</p>
                  </div>
                  <div className={`p-3 rounded-lg ${scoreBreakdown.breakdown.reviews.details.recentReviews >= 5 ? 'bg-emerald-50 dark:bg-emerald-900/20' : scoreBreakdown.breakdown.reviews.details.recentReviews >= 2 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                    <p className="text-2xl font-bold">{scoreBreakdown.breakdown.reviews.details.recentReviews}</p>
                    <p className="text-xs text-slate-500">Recent (30 days) (5+: 2pts, 2+: 1pt)</p>
                  </div>
                </div>
                <p className="text-sm text-slate-500 mt-4">
                  Reviews Score: <span className="font-bold">{scoreBreakdown.breakdown.reviews.score}/{scoreBreakdown.breakdown.reviews.maxScore}</span> points
                </p>
              </CardContent>
            </Card>
          )}

          {gbpData?.reviews && gbpData.reviews.length > 0 ? (
            <>
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Rating Distribution */}
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="text-base">Rating Distribution</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {['FIVE', 'FOUR', 'THREE', 'TWO', 'ONE'].map((rating, idx) => {
                      const count = gbpData.ratingDistribution?.[rating] || 0;
                      const total = gbpData.totalReviews || 1;
                      const percent = Math.round((count / total) * 100);
                      return (
                        <div key={rating} className="flex items-center gap-3">
                          <span className="w-8 text-sm font-medium">{5 - idx}★</span>
                          <Progress value={percent} className="flex-1 h-2" />
                          <span className="w-12 text-sm text-slate-500 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* All Reviews */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">All Reviews ({gbpData.reviews.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px] pr-4">
                      <div className="space-y-4">
                        {gbpData.reviews.map((review, i) => (
                          <div key={i} className="border rounded-lg p-4 space-y-2">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-medium">
                                  {review.reviewer?.displayName?.charAt(0) || '?'}
                                </div>
                                <div>
                                  <p className="font-medium">{review.reviewer?.displayName || 'Anonymous'}</p>
                                  <StarRating rating={ratingToNumber(review.starRating)} />
                                </div>
                              </div>
                              {review.createTime && (
                                <span className="text-xs text-slate-400">
                                  {new Date(review.createTime).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            {review.comment && (
                              <p className="text-slate-600 dark:text-slate-300 text-sm">{review.comment}</p>
                            )}
                            {review.reviewReply?.comment ? (
                              <div className="mt-3 pl-4 border-l-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded">
                                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">Owner Response</p>
                                <p className="text-sm text-slate-600 dark:text-slate-300">{review.reviewReply.comment}</p>
                              </div>
                            ) : (
                              <div className="flex gap-2 pt-2 border-t mt-3">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => setReviewReplyDialog({ open: true, review, mode: 'manual' })}
                                  className="h-7 text-xs"
                                >
                                  <MessageSquare className="w-3 h-3 mr-1" />
                                  Reply
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => setReviewReplyDialog({ open: true, review, mode: 'ai' })}
                                  disabled={!aiConfigured}
                                  className={`h-7 text-xs ${aiConfigured ? 'text-purple-600 hover:text-purple-700' : ''}`}
                                >
                                  <Sparkles className="w-3 h-3 mr-1" />
                                  Reply with AI
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* AI Review Analytics */}
              <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-500" />
                        AI-Powered Review Analytics
                      </CardTitle>
                      <CardDescription>
                        Analyze your reviews to extract insights, keywords, and sentiment
                      </CardDescription>
                    </div>
                    <Button 
                      onClick={handleAnalyzeReviews} 
                      disabled={analyzing || !gbpData?.reviews?.length}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {analyzing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          {reviewAnalytics ? 'Re-analyze' : 'Analyze Reviews'}
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {!aiConfigured && (
                    <Alert className="mb-4 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertTitle className="text-amber-800 dark:text-amber-300">AI Not Configured</AlertTitle>
                      <AlertDescription className="text-amber-700 dark:text-amber-400">
                        Configure your AI provider in{' '}
                        <Link href="/settings" className="font-medium underline hover:text-amber-900">
                          Settings
                        </Link>
                      </AlertDescription>
                    </Alert>
                  )}

                  {aiError && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Analysis Failed</AlertTitle>
                      <AlertDescription>{aiError}</AlertDescription>
                    </Alert>
                  )}

                  {!reviewAnalytics ? (
                    <div className="text-center py-6 text-slate-500">
                      <TrendingUp className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                      <p className="text-sm">Click &quot;Analyze Reviews&quot; to get AI-powered insights</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      <Card className="bg-white dark:bg-slate-800">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Sentiment Analysis</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <ThumbsUp className="w-5 h-5 text-green-500" />
                              <span className="w-20">Positive</span>
                              <Progress value={reviewAnalytics.sentimentSummary.positive} className="flex-1 h-2" />
                              <span className="w-12 text-right text-sm">{reviewAnalytics.sentimentSummary.positive}%</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <Minus className="w-5 h-5 text-gray-500" />
                              <span className="w-20">Neutral</span>
                              <Progress value={reviewAnalytics.sentimentSummary.neutral} className="flex-1 h-2" />
                              <span className="w-12 text-right text-sm">{reviewAnalytics.sentimentSummary.neutral}%</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <ThumbsDown className="w-5 h-5 text-red-500" />
                              <span className="w-20">Negative</span>
                              <Progress value={reviewAnalytics.sentimentSummary.negative} className="flex-1 h-2" />
                              <span className="w-12 text-right text-sm">{reviewAnalytics.sentimentSummary.negative}%</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-white dark:bg-slate-800">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Top Keywords</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            {reviewAnalytics.keywords.slice(0, 15).map((kw, i) => (
                              <Badge 
                                key={i} 
                                variant={kw.sentiment === 'positive' ? 'default' : kw.sentiment === 'negative' ? 'destructive' : 'secondary'}
                              >
                                {kw.word} ({kw.count})
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-white dark:bg-slate-800">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Common Themes</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {reviewAnalytics.commonThemes.map((theme, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <span className="text-emerald-500">•</span>
                                {theme}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>

                      <Card className="bg-white dark:bg-slate-800">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">AI Suggestions</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {reviewAnalytics.suggestions.map((suggestion, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <Sparkles className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                                {suggestion}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No reviews available</p>
                {isGBPConnected && !gbpData && (
                  <Button variant="outline" className="mt-4" onClick={handleSyncGBP}>
                    Sync GBP Data to see reviews
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Photos Tab */}
        <TabsContent value="photos" className="mt-6 space-y-6">
          {/* Generate Image Action */}
          <Card className="bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-900/20 dark:to-blue-900/20 border-emerald-200 dark:border-emerald-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-emerald-500" />
                Generate New Photos
              </CardTitle>
              <CardDescription>
                Create professional images for your business profile using AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setImageDialog({ open: true })}
                  disabled={!imageModelConfigured}
                  className="bg-white dark:bg-slate-800"
                >
                  <Sparkles className="w-4 h-4 mr-2 text-emerald-500" />
                  Generate with AI
                </Button>
              </div>
              {!imageModelConfigured && (
                <p className="text-xs text-slate-400 mt-3">
                  <Link href="/settings" className="underline">Configure Image AI model</Link> (DALL-E, Nano Banana) to generate images
                </p>
              )}
            </CardContent>
          </Card>

          {gbpData?.photos && gbpData.photos.length > 0 ? (
            <>
              {/* Photo Score Summary */}
              {scoreBreakdown && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-amber-500" />
                      Photo Scoring Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-4">
                      <div className={`p-3 rounded-lg ${scoreBreakdown.breakdown.photos.details.totalPhotos >= 25 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                        <p className="text-2xl font-bold">{scoreBreakdown.breakdown.photos.details.totalPhotos}</p>
                        <p className="text-xs text-slate-500">Total Photos (25+ recommended)</p>
                      </div>
                      <div className={`p-3 rounded-lg ${scoreBreakdown.breakdown.photos.details.hasCoverPhoto ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                        <p className="text-2xl font-bold">{scoreBreakdown.breakdown.photos.details.hasCoverPhoto ? '✓' : '✗'}</p>
                        <p className="text-xs text-slate-500">Cover Photo</p>
                      </div>
                      <div className={`p-3 rounded-lg ${scoreBreakdown.breakdown.photos.details.hasLogoPhoto ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                        <p className="text-2xl font-bold">{scoreBreakdown.breakdown.photos.details.hasLogoPhoto ? '✓' : '✗'}</p>
                        <p className="text-xs text-slate-500">Logo/Profile Photo</p>
                      </div>
                      <div className={`p-3 rounded-lg ${scoreBreakdown.breakdown.photos.details.photoCategories.length >= 4 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                        <p className="text-2xl font-bold">{scoreBreakdown.breakdown.photos.details.photoCategories.length}</p>
                        <p className="text-xs text-slate-500">Categories (4+ recommended)</p>
                      </div>
                    </div>
                    {scoreBreakdown.breakdown.photos.details.photoCategories.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="text-xs text-slate-500">Detected categories:</span>
                        {scoreBreakdown.breakdown.photos.details.photoCategories.map((cat, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{cat}</Badge>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-slate-400 mt-3">
                      💡 To set a Logo photo, go to your Google Business Profile → Photos → Logo tab and upload your logo there.
                    </p>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">All Photos ({gbpData.photos.length})</CardTitle>
                  <CardDescription>Photos from your Google Business Profile</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {gbpData.photos.map((photo, i) => (
                      <div
                        key={i}
                        className="aspect-square rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden relative group"
                      >
                        {photo.googleUrl || photo.sourceUrl ? (
                          <img
                            src={photo.googleUrl || photo.sourceUrl}
                            alt={`Business photo ${i + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-8 h-8 text-slate-400" />
                          </div>
                        )}
                        {photo.category && (
                          <Badge className={`absolute bottom-2 left-2 text-xs ${
                            photo.category === 'COVER' ? 'bg-blue-500' :
                            photo.category === 'LOGO' || photo.category === 'PROFILE' ? 'bg-purple-500' :
                            'bg-slate-500'
                          }`}>
                            {photo.category}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No photos available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Posts Tab */}
        <TabsContent value="posts" className="mt-6 space-y-6">
          {/* Create Post Actions */}
          <Card className="bg-gradient-to-r from-blue-50 to-emerald-50 dark:from-blue-900/20 dark:to-emerald-900/20 border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-500" />
                Create New Post
              </CardTitle>
              <CardDescription>
                Post updates, offers, events, or products to engage with customers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setPostDialog({ open: true, mode: 'text' })}
                  className="bg-white dark:bg-slate-800"
                >
                  <FileText className="w-4 h-4 mr-2 text-blue-500" />
                  Text Post
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setPostDialog({ open: true, mode: 'image' })}
                  disabled={!imageModelConfigured}
                  className="bg-white dark:bg-slate-800"
                >
                  <ImageIcon className="w-4 h-4 mr-2 text-emerald-500" />
                  Image Post
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setPostDialog({ open: true, mode: 'both' })}
                  disabled={!aiConfigured || !imageModelConfigured}
                  className="bg-white dark:bg-slate-800"
                >
                  <Sparkles className="w-4 h-4 mr-2 text-purple-500" />
                  Text + Image Post
                </Button>
              </div>
              {(!aiConfigured || !imageModelConfigured) && (
                <p className="text-xs text-slate-400 mt-3">
                  {!aiConfigured && !imageModelConfigured ? (
                    <><Link href="/settings" className="underline">Configure Text & Image AI models</Link> for full functionality</>
                  ) : !aiConfigured ? (
                    <><Link href="/settings" className="underline">Configure Text AI model</Link> for AI-generated text</>
                  ) : (
                    <><Link href="/settings" className="underline">Configure Image AI model</Link> for image generation</>
                  )}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Posts Scoring Criteria */}
          {scoreBreakdown && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-amber-500" />
                  Posts Scoring Criteria
                </CardTitle>
                <CardDescription>How your posts score is calculated (max 5 points)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className={`p-3 rounded-lg ${scoreBreakdown.breakdown.posts.details.postsLast30Days >= 8 ? 'bg-emerald-50 dark:bg-emerald-900/20' : scoreBreakdown.breakdown.posts.details.postsLast30Days >= 4 ? 'bg-blue-50 dark:bg-blue-900/20' : scoreBreakdown.breakdown.posts.details.postsLast30Days >= 1 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                    <p className="text-2xl font-bold">{scoreBreakdown.breakdown.posts.details.postsLast30Days}</p>
                    <p className="text-xs text-slate-500">Posts in Last 30 Days (8+: 3pts, 4+: 2pts)</p>
                  </div>
                  <div className={`p-3 rounded-lg ${scoreBreakdown.breakdown.posts.details.totalPosts >= 20 ? 'bg-emerald-50 dark:bg-emerald-900/20' : scoreBreakdown.breakdown.posts.details.totalPosts >= 5 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                    <p className="text-2xl font-bold">{scoreBreakdown.breakdown.posts.details.totalPosts}</p>
                    <p className="text-xs text-slate-500">Total Posts (20+: 2pts, 5+: 1pt)</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                    <p className="text-sm font-medium">{scoreBreakdown.breakdown.posts.details.lastPostDate ? new Date(scoreBreakdown.breakdown.posts.details.lastPostDate).toLocaleDateString() : 'Never'}</p>
                    <p className="text-xs text-slate-500">Last Post Date</p>
                  </div>
                </div>
                <p className="text-sm text-slate-500 mt-4">
                  Posts Score: <span className="font-bold">{scoreBreakdown.breakdown.posts.score}/{scoreBreakdown.breakdown.posts.maxScore}</span> points
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  💡 Tip: Post at least 2x per week for best results. Google favors active businesses!
                </p>
              </CardContent>
            </Card>
          )}

          {gbpData?.posts && gbpData.posts.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {gbpData.posts.map((post, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">{post.topicType || 'Update'}</Badge>
                      {post.createTime && (
                        <span className="text-xs text-slate-400">
                          {new Date(post.createTime).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {post.media?.[0]?.googleUrl && (
                      <img
                        src={post.media[0].googleUrl}
                        alt="Post image"
                        className="w-full h-32 object-cover rounded-lg mb-3"
                      />
                    )}
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {post.summary || 'No description'}
                    </p>
                    {post.callToAction && (
                      <Button variant="link" size="sm" className="p-0 mt-2">
                        {post.callToAction.actionType}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No posts yet</p>
                <p className="text-sm text-slate-400 mt-2">
                  Create posts to engage customers and improve your local SEO
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="mt-6 space-y-6">
          {/* Products Scoring Criteria */}
          {scoreBreakdown && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-amber-500" />
                  Products Scoring Criteria
                </CardTitle>
                <CardDescription>How your products score is calculated (max 4 points)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className={`p-3 rounded-lg ${scoreBreakdown.breakdown.products.details.totalProducts >= 10 ? 'bg-emerald-50 dark:bg-emerald-900/20' : scoreBreakdown.breakdown.products.details.totalProducts >= 3 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                    <p className="text-2xl font-bold">{scoreBreakdown.breakdown.products.details.totalProducts}</p>
                    <p className="text-xs text-slate-500">Total Products (10+: 2pts, 3+: 1pt)</p>
                  </div>
                  <div className={`p-3 rounded-lg ${scoreBreakdown.breakdown.products.details.productsWithPhotos === scoreBreakdown.breakdown.products.details.totalProducts && scoreBreakdown.breakdown.products.details.totalProducts > 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                    <p className="text-2xl font-bold">{scoreBreakdown.breakdown.products.details.productsWithPhotos}/{scoreBreakdown.breakdown.products.details.totalProducts}</p>
                    <p className="text-xs text-slate-500">Products with Photos (+1pt if all)</p>
                  </div>
                  <div className={`p-3 rounded-lg ${scoreBreakdown.breakdown.products.details.productsWithDescriptions === scoreBreakdown.breakdown.products.details.totalProducts && scoreBreakdown.breakdown.products.details.totalProducts > 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                    <p className="text-2xl font-bold">{scoreBreakdown.breakdown.products.details.productsWithDescriptions}/{scoreBreakdown.breakdown.products.details.totalProducts}</p>
                    <p className="text-xs text-slate-500">Products with Descriptions (+1pt if all)</p>
                  </div>
                </div>
                <p className="text-sm text-slate-500 mt-4">
                  Products Score: <span className="font-bold">{scoreBreakdown.breakdown.products.score}/{scoreBreakdown.breakdown.products.maxScore}</span> points
                </p>
                <Alert className="mt-3 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-xs text-blue-700 dark:text-blue-300">
                    <strong>Note:</strong> Products are managed in Google Business Profile → Products tab. 
                    Some business types may also need Google Merchant Center for full product management.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {gbpData?.products && gbpData.products.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {gbpData.products.map((product, i) => (
                <Card key={i}>
                  {product.media?.[0] && (
                    <img
                      src={(product.media[0] as { googleUrl?: string }).googleUrl}
                      alt={product.name}
                      className="w-full h-32 object-cover"
                    />
                  )}
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{product.name || `Product ${i + 1}`}</CardTitle>
                    {product.price && (
                      <Badge variant="secondary">
                        {product.price.currencyCode} {product.price.units}
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {product.productDescription || 'No description'}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">Products Not Available via API</p>
                  <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
                    Google has moved product management to Google Merchant Center for most business types.
                    Products added in GBP may not be accessible via the API.
                  </p>
                </CardContent>
              </Card>
              
              {/* Google Merchant Center Info */}
              <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="w-5 h-5 text-amber-600" />
                    About Product Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 bg-white dark:bg-slate-800 rounded-lg">
                      <p className="font-medium text-sm mb-2">📍 GBP Product Editor</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                        For service-based businesses with simple product catalogs.
                      </p>
                      <a 
                        href="https://business.google.com" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Globe className="w-3 h-3" />
                        Open Google Business Profile
                      </a>
                    </div>
                    
                    <div className="p-4 bg-white dark:bg-slate-800 rounded-lg">
                      <p className="font-medium text-sm mb-2">🛒 Google Merchant Center</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                        For retail businesses with large product catalogs (required for Shopping ads).
                      </p>
                      <a 
                        href="https://merchants.google.com" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Globe className="w-3 h-3" />
                        Open Merchant Center
                      </a>
                    </div>
                  </div>
                  
                  <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-xs text-blue-700 dark:text-blue-300">
                      <strong>Why products aren&apos;t showing:</strong> Google deprecated direct product access in the GBP API.
                      Products are visible in your Google Business Profile dashboard but cannot be fetched programmatically.
                      Consider linking your Google Merchant Center account for advanced product management and analytics.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="text-center pt-2">
                    <p className="text-xs text-slate-500 mb-3">
                      Want Merchant Center integration? This would enable:
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Badge variant="outline" className="text-xs">Product Sync</Badge>
                      <Badge variant="outline" className="text-xs">Inventory Management</Badge>
                      <Badge variant="outline" className="text-xs">Shopping Ads</Badge>
                      <Badge variant="outline" className="text-xs">Price Updates</Badge>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-3">
                      Merchant Center integration coming in a future update
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="mt-6 space-y-6">
          {/* Services Missing Descriptions Alert */}
          {gbpData?.services && gbpData.services.some(s => !s.description) && (
            <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700 dark:text-amber-400">
                {gbpData.services.filter(s => !s.description).length} of {gbpData.services.length} services are missing descriptions.
                {aiConfigured ? ' Use "Edit with AI" on each service to generate descriptions.' : ' Configure AI in Settings to auto-generate descriptions.'}
              </AlertDescription>
            </Alert>
          )}

          {/* Services Scoring Criteria */}
          {scoreBreakdown && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-amber-500" />
                  Services Scoring Criteria
                </CardTitle>
                <CardDescription>How your services score is calculated (max 3 points)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className={`p-3 rounded-lg ${scoreBreakdown.breakdown.services.details.totalServices >= 5 ? 'bg-emerald-50 dark:bg-emerald-900/20' : scoreBreakdown.breakdown.services.details.totalServices >= 1 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                    <p className="text-2xl font-bold">{scoreBreakdown.breakdown.services.details.totalServices}</p>
                    <p className="text-xs text-slate-500">Total Services (5+: 2pts, 1+: 1pt)</p>
                  </div>
                  <div className={`p-3 rounded-lg ${scoreBreakdown.breakdown.services.details.servicesWithDescriptions === scoreBreakdown.breakdown.services.details.totalServices && scoreBreakdown.breakdown.services.details.totalServices > 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                    <p className="text-2xl font-bold">{scoreBreakdown.breakdown.services.details.servicesWithDescriptions}/{scoreBreakdown.breakdown.services.details.totalServices}</p>
                    <p className="text-xs text-slate-500">Services with Descriptions (+1pt if all)</p>
                  </div>
                </div>
                <p className="text-sm text-slate-500 mt-4">
                  Services Score: <span className="font-bold">{scoreBreakdown.breakdown.services.score}/{scoreBreakdown.breakdown.services.maxScore}</span> points
                </p>
                <Alert className="mt-3 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-xs text-blue-700 dark:text-blue-300">
                    <strong>How to add services:</strong> Go to Google Business Profile → Services → Add services.
                    Choose from predefined services for your category or add custom services.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {gbpData?.services && gbpData.services.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {gbpData.services.map((service, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-blue-500" />
                      {service.serviceName || `Service ${i + 1}`}
                    </CardTitle>
                    {service.price && (
                      <Badge variant="secondary">
                        {service.price.currencyCode} {service.price.units}
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {service.description || <span className="italic text-slate-400">No description</span>}
                    </p>
                    <div className="flex gap-2 pt-2 border-t">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setServiceDialog({ open: true, service, mode: 'manual' })}
                        className="h-7 text-xs"
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setServiceDialog({ open: true, service, mode: 'ai' })}
                        disabled={!aiConfigured}
                        className={`h-7 text-xs ${aiConfigured ? 'text-purple-600 hover:text-purple-700' : ''}`}
                      >
                        <Sparkles className="w-3 h-3 mr-1" />
                        AI Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No services listed</p>
                <p className="text-sm text-slate-400 mt-2">
                  List your services in Google Business Profile to help customers understand what you provide
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Go to: Google Business Profile → Services → Add services
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Q&A Tab */}
        <TabsContent value="qanda" className="mt-6 space-y-6">
          {/* Q&A Explanation & Scoring */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-500" />
                What is Q&A?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                <strong>Q&A (Questions & Answers)</strong> is a feature on your Google Business Profile where customers can ask questions about your business, 
                and you (or other users) can answer them. It appears on Google Maps and Search when people view your business.
              </p>
              <div className="grid gap-2 md:grid-cols-2 text-sm">
                <div className="p-2 bg-white dark:bg-slate-800 rounded">
                  <p className="font-medium text-emerald-700 dark:text-emerald-400">✓ Best Practice</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Proactively add common FAQs yourself</p>
                </div>
                <div className="p-2 bg-white dark:bg-slate-800 rounded">
                  <p className="font-medium text-blue-700 dark:text-blue-400">📍 Where to find</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Google Maps → Your Business → Questions & Answers</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Q&A Scoring Criteria */}
          {scoreBreakdown && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-amber-500" />
                  Q&A Scoring Criteria
                </CardTitle>
                <CardDescription>How your Q&A score is calculated (max 4 points)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className={`p-3 rounded-lg ${scoreBreakdown.breakdown.qAndA.details.totalQuestions >= 10 ? 'bg-emerald-50 dark:bg-emerald-900/20' : scoreBreakdown.breakdown.qAndA.details.totalQuestions >= 3 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                    <p className="text-2xl font-bold">{scoreBreakdown.breakdown.qAndA.details.totalQuestions}</p>
                    <p className="text-xs text-slate-500">Total Questions (10+: 1pt, 3+: 0.5pt)</p>
                  </div>
                  <div className={`p-3 rounded-lg ${scoreBreakdown.breakdown.qAndA.details.answeredQuestions === scoreBreakdown.breakdown.qAndA.details.totalQuestions && scoreBreakdown.breakdown.qAndA.details.totalQuestions > 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                    <p className="text-2xl font-bold">{scoreBreakdown.breakdown.qAndA.details.answeredQuestions}/{scoreBreakdown.breakdown.qAndA.details.totalQuestions}</p>
                    <p className="text-xs text-slate-500">Questions Answered (+1pt if 90%+)</p>
                  </div>
                  <div className={`p-3 rounded-lg ${scoreBreakdown.breakdown.qAndA.details.ownerAnswers >= scoreBreakdown.breakdown.qAndA.details.totalQuestions * 0.8 && scoreBreakdown.breakdown.qAndA.details.totalQuestions > 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                    <p className="text-2xl font-bold">{scoreBreakdown.breakdown.qAndA.details.ownerAnswers}</p>
                    <p className="text-xs text-slate-500">Owner Answers (80%+: 2pts, 50%+: 1pt)</p>
                  </div>
                </div>
                <p className="text-sm text-slate-500 mt-4">
                  Q&A Score: <span className="font-bold">{scoreBreakdown.breakdown.qAndA.score}/{scoreBreakdown.breakdown.qAndA.maxScore}</span> points
                </p>
              </CardContent>
            </Card>
          )}

          {gbpData?.questions && gbpData.questions.length > 0 ? (
            <div className="space-y-4">
              {gbpData.questions.map((question, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start gap-3">
                      <HelpCircle className="w-5 h-5 text-blue-500 mt-0.5" />
                      <div>
                        <p className="font-medium">{question.text}</p>
                        {question.createTime && (
                          <p className="text-xs text-slate-400 mt-1">
                            {new Date(question.createTime).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {question.topAnswers && question.topAnswers.length > 0 ? (
                      <div className="space-y-3">
                        {question.topAnswers.map((answer, j) => (
                          <div key={j} className={`pl-4 border-l-2 p-3 rounded ${
                            answer.author?.type === 'MERCHANT' 
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' 
                              : 'border-slate-200 bg-slate-50 dark:bg-slate-800'
                          }`}>
                            {answer.author?.type === 'MERCHANT' && (
                              <Badge className="mb-2 text-xs" variant="outline">Owner Response</Badge>
                            )}
                            <p className="text-sm">{answer.text}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">No answers yet</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <HelpCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No questions yet</p>
                <p className="text-sm text-slate-400 mt-2">
                  💡 Pro Tip: Add common FAQs yourself! Go to Google Maps → Your Business → Ask a question
                </p>
                <div className="mt-4 text-xs text-slate-400">
                  <p>Example questions to add:</p>
                  <p>&quot;What are your payment options?&quot;</p>
                  <p>&quot;Do you offer consultations?&quot;</p>
                  <p>&quot;What services do you specialize in?&quot;</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Attributes Tab */}
        <TabsContent value="attributes" className="mt-6 space-y-6">
          {/* Attributes Explanation */}
          <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-500" />
                What are Attributes?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                <strong>Attributes</strong> are specific features and characteristics of your business that help customers know what to expect. 
                They appear on your Google Business Profile and help with local search rankings.
              </p>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4 text-xs">
                <div className="p-2 bg-white dark:bg-slate-800 rounded">
                  <p className="font-medium text-purple-700 dark:text-purple-400">💳 Payment Methods</p>
                  <p className="text-slate-500">Credit cards, cash, UPI, etc.</p>
                </div>
                <div className="p-2 bg-white dark:bg-slate-800 rounded">
                  <p className="font-medium text-blue-700 dark:text-blue-400">♿ Accessibility</p>
                  <p className="text-slate-500">Wheelchair access, parking, etc.</p>
                </div>
                <div className="p-2 bg-white dark:bg-slate-800 rounded">
                  <p className="font-medium text-emerald-700 dark:text-emerald-400">🏢 Amenities</p>
                  <p className="text-slate-500">Wi-Fi, restrooms, parking, etc.</p>
                </div>
                <div className="p-2 bg-white dark:bg-slate-800 rounded">
                  <p className="font-medium text-amber-700 dark:text-amber-400">🛎️ Service Options</p>
                  <p className="text-slate-500">Delivery, dine-in, takeout, etc.</p>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                <strong>Where to set:</strong> Google Business Profile → Info → Scroll down to see attribute options for your business type.
              </p>
            </CardContent>
          </Card>

          {/* Attributes Scoring Criteria */}
          {scoreBreakdown && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-amber-500" />
                  Attributes Scoring Criteria
                </CardTitle>
                <CardDescription>How your attributes score is calculated (max 4 points)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <div className={`p-3 rounded-lg ${scoreBreakdown.breakdown.attributes.details.hasHours ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                    <p className="text-2xl font-bold">{scoreBreakdown.breakdown.attributes.details.hasHours ? '✓' : '✗'}</p>
                    <p className="text-xs text-slate-500">Business Hours Set (+1pt)</p>
                  </div>
                  <div className={`p-3 rounded-lg ${scoreBreakdown.breakdown.attributes.details.totalAttributes >= 10 ? 'bg-emerald-50 dark:bg-emerald-900/20' : scoreBreakdown.breakdown.attributes.details.totalAttributes >= 5 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                    <p className="text-2xl font-bold">{scoreBreakdown.breakdown.attributes.details.totalAttributes}</p>
                    <p className="text-xs text-slate-500">Total Attributes (10+: 2pts, 5+: 1pt)</p>
                  </div>
                  <div className={`p-3 rounded-lg ${scoreBreakdown.breakdown.attributes.details.hasPaymentMethods ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-slate-50 dark:bg-slate-800'}`}>
                    <p className="text-2xl font-bold">{scoreBreakdown.breakdown.attributes.details.hasPaymentMethods ? '✓' : '—'}</p>
                    <p className="text-xs text-slate-500">Payment Methods</p>
                  </div>
                  <div className={`p-3 rounded-lg ${scoreBreakdown.breakdown.attributes.details.hasAccessibility ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-slate-50 dark:bg-slate-800'}`}>
                    <p className="text-2xl font-bold">{scoreBreakdown.breakdown.attributes.details.hasAccessibility ? '✓' : '—'}</p>
                    <p className="text-xs text-slate-500">Accessibility Info</p>
                  </div>
                </div>
                <p className="text-sm text-slate-500 mt-4">
                  Attributes Score: <span className="font-bold">{scoreBreakdown.breakdown.attributes.score}/{scoreBreakdown.breakdown.attributes.maxScore}</span> points
                </p>
              </CardContent>
            </Card>
          )}

          {/* Current Attributes Display */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your Business Attributes</CardTitle>
              <CardDescription>Attributes currently set on your Google Business Profile</CardDescription>
            </CardHeader>
            <CardContent>
              {gbpData?.attributes && Object.keys(gbpData.attributes).length > 0 ? (
                <div className="space-y-4">
                  {gbpData.attributes.openInfo && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <p className="font-medium text-sm mb-2">Business Status</p>
                      <Badge variant="secondary">
                        {(gbpData.attributes.openInfo as { status?: string })?.status || 'Open'}
                      </Badge>
                    </div>
                  )}
                  {gbpData.attributes.profile && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <p className="font-medium text-sm mb-2">Profile Info</p>
                      <p className="text-xs text-slate-500">
                        {(gbpData.attributes.profile as { description?: string })?.description ? 'Description set ✓' : 'Description not set'}
                      </p>
                    </div>
                  )}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="font-medium text-sm mb-2">Other Attributes</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(gbpData.attributes)
                        .filter(key => !['profile', 'openInfo', 'serviceItems'].includes(key))
                        .map((key, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </Badge>
                        ))
                      }
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Settings className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No attributes data available</p>
                  <p className="text-sm text-slate-400 mt-2">
                    Set attributes in Google Business Profile to improve your local SEO
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="mt-6 space-y-6">
          <PerformanceSection gbpData={gbpData} />
        </TabsContent>

      </Tabs>

      {/* Description Edit Dialog */}
      <DescriptionDialog 
        open={descriptionDialog.open}
        mode={descriptionDialog.mode}
        onOpenChange={(open) => setDescriptionDialog({ ...descriptionDialog, open })}
        businessName={business.name}
        currentDescription={gbpData?.description || gbpData?.attributes?.profile?.description || ''}
        businessId={business.id}
      />

      {/* Review Reply Dialog */}
      <ReviewReplyDialog 
        open={reviewReplyDialog.open}
        mode={reviewReplyDialog.mode}
        review={reviewReplyDialog.review}
        onOpenChange={(open) => setReviewReplyDialog({ ...reviewReplyDialog, open })}
        businessName={business.name}
        businessId={business.id}
      />

      {/* Create Post Dialog */}
      <CreatePostDialog 
        open={postDialog.open}
        mode={postDialog.mode}
        onOpenChange={(open) => setPostDialog({ ...postDialog, open })}
        businessName={business.name}
        businessId={business.id}
        aiConfigured={aiConfigured}
        imageModelConfigured={imageModelConfigured}
      />

      {/* Generate Image Dialog */}
      <GenerateImageDialog 
        open={imageDialog.open}
        onOpenChange={(open) => setImageDialog({ open })}
        businessName={business.name}
        businessId={business.id}
      />

      {/* Edit Service Dialog */}
      <ServiceEditDialog 
        open={serviceDialog.open}
        mode={serviceDialog.mode}
        service={serviceDialog.service}
        onOpenChange={(open) => setServiceDialog({ ...serviceDialog, open })}
        businessName={business.name}
        businessId={business.id}
      />
    </div>
  );
}
