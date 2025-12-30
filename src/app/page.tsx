'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  MapPin,
  Search,
  BarChart3,
  FileText,
  Globe,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Settings,
} from 'lucide-react';

export default function Home() {
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if Supabase is configured via env or localStorage
    const hasEnvConfig = !!(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    if (hasEnvConfig) {
      setIsConfigured(true);
      return;
    }

    // Check localStorage
    try {
      const stored = localStorage.getItem('localseo-supabase');
      if (stored) {
        const config = JSON.parse(stored);
        setIsConfigured(!!(config.url && config.anonKey));
      } else {
        setIsConfigured(false);
      }
    } catch {
      setIsConfigured(false);
    }
  }, []);

  const features = [
    {
      icon: MapPin,
      title: 'GBP Audit & Optimization',
      description: 'Comprehensive Google Business Profile analysis with AI-powered recommendations',
    },
    {
      icon: Globe,
      title: 'Citation Management',
      description: 'Discover and manage citations across geo-targeted directories worldwide',
    },
    {
      icon: BarChart3,
      title: 'Rank Tracking',
      description: 'Monitor local pack and organic rankings across multiple locations',
    },
    {
      icon: Search,
      title: 'Keyword Research',
      description: 'AI-powered local keyword discovery with search volume and difficulty',
    },
    {
      icon: FileText,
      title: 'On-Page SEO Audit',
      description: 'Technical audits with local schema generation and optimization tips',
    },
    {
      icon: Sparkles,
      title: 'AI Content Generation',
      description: 'Generate GBP posts, local content, and optimized descriptions',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Ambient background */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-transparent to-transparent pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent pointer-events-none" />
      
      {/* Grid pattern */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25">
                <MapPin className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight">
                LocalSEO <span className="text-emerald-400">Pro</span>
              </span>
            </div>
            <nav className="flex items-center gap-3">
              {isConfigured === null ? (
                <div className="w-20 h-10 bg-white/5 rounded-lg animate-pulse" />
              ) : isConfigured ? (
                <>
                  <Link href="/login">
                    <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-white/10">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button className="bg-emerald-600 hover:bg-emerald-500 text-white">
                      Get Started
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </Link>
                </>
              ) : (
                <Link href="/setup">
                  <Button className="bg-emerald-600 hover:bg-emerald-500 text-white">
                    <Settings className="mr-2 w-4 h-4" />
                    Admin Setup
                  </Button>
                </Link>
              )}
            </nav>
          </div>
        </header>

        {/* Hero */}
        <section className="container mx-auto px-4 py-24 text-center">
          <Badge className="mb-6 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20">
            AI-Powered Local SEO Platform
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 tracking-tight">
            Dominate Local Search
            <br />
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              with AI Automation
            </span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Comprehensive local SEO toolkit for agencies and businesses. 
            Audit, optimize, track, and grow your local presence with intelligent automation.
          </p>
          <div className="flex items-center justify-center gap-4">
            {isConfigured ? (
              <>
                <Link href="/register">
                  <Button size="lg" className="bg-emerald-600 hover:bg-emerald-500 text-white h-12 px-8 text-lg">
                    Start Free Trial
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 h-12 px-8 text-lg">
                    Sign In
                  </Button>
                </Link>
              </>
            ) : (
              <Link href="/setup">
                <Button size="lg" className="bg-emerald-600 hover:bg-emerald-500 text-white h-12 px-8 text-lg">
                  <Settings className="mr-2 w-5 h-5" />
                  Configure Instance
                </Button>
              </Link>
            )}
          </div>
        </section>

        {/* Features */}
        <section className="container mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Everything You Need for Local SEO</h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              A complete suite of tools to analyze, optimize, and track your local search performance
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card 
                key={feature.title} 
                className="bg-white/5 border-white/10 hover:bg-white/[0.07] hover:border-emerald-500/30 transition-all duration-300 group"
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                      <feature.icon className="w-5 h-5" />
                    </div>
                    <CardTitle className="text-white text-lg">{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-slate-400 leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Benefits */}
        <section className="container mx-auto px-4 py-16">
          <Card className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border-emerald-500/20">
            <CardContent className="p-8 md:p-12">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-4">
                    Why LocalSEO Pro?
                  </h2>
                  <p className="text-slate-300 mb-6 leading-relaxed">
                    Built for agencies and businesses who want to scale their local SEO efforts 
                    without scaling their team. Self-hosted, customizable, and powered by your choice of AI.
                  </p>
                  <ul className="space-y-3">
                    {[
                      'Self-hosted for complete data control',
                      'Configure any AI provider (OpenAI, Anthropic, Ollama)',
                      'Geo-targeted citation directories',
                      'White-label ready for agencies',
                    ].map((benefit) => (
                      <li key={benefit} className="flex items-center gap-3 text-slate-300">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="relative">
                  <div className="aspect-video rounded-xl bg-slate-900/50 border border-white/10 flex items-center justify-center">
                    <div className="text-center">
                      <BarChart3 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                      <p className="text-slate-400">Dashboard Preview</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/5 mt-16">
          <div className="container mx-auto px-4 py-8">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-500" />
                <span>LocalSEO Pro</span>
              </div>
              <p>© 2024 All rights reserved</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
