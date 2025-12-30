import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Always allow static assets and API routes
  const staticPaths = ['/_next', '/favicon.ico', '/api'];
  const isStaticPath = staticPaths.some(path => request.nextUrl.pathname.startsWith(path));
  if (isStaticPath) {
    return supabaseResponse;
  }

  // Public pages - always accessible
  const publicPaths = ['/', '/setup', '/login', '/register'];
  const isPublicPath = publicPaths.includes(request.nextUrl.pathname);
  
  if (isPublicPath) {
    return supabaseResponse;
  }

  // If Supabase is NOT configured via env vars, allow all access
  // Client-side will handle config from localStorage
  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  // Supabase IS configured via env - handle auth flow
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  // Protected pages require authentication
  const protectedPaths = ['/dashboard', '/businesses', '/gbp-audit', '/citations', '/rank-tracker', '/keywords', '/on-page', '/content', '/settings'];
  const isProtectedPath = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path));

  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}





