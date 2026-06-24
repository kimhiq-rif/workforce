// Copyright © 2026 Workforce. All rights reserved.
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

type MiddlewareCookieToSet = {
  name: string;
  value: string;
  options: Parameters<NextResponse["cookies"]["set"]>[2];
};

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: MiddlewareCookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname.startsWith("/login");
  const isPwaAsset =
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    /^\/(?:worker|workbox)-.*\.js$/.test(pathname);
  const isPublicPath =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/icons") ||
    isPwaAsset;

  if (isPublicPath) return supabaseResponse;

  if (!user && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Session timeout: role-based inactivity check via last_seen_at
  if (user && !isAuthPage) {
    const { data: profile } = await supabase
      .from("users")
      .select("role, last_seen_at")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (profile) {
      const timeoutHours = profile.role === "owner" ? 1 : 8;
      const lastSeenMs = profile.last_seen_at ? new Date(profile.last_seen_at).getTime() : 0;
      const lastSignInMs = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0;
      const lastActivity = Math.max(lastSeenMs, lastSignInMs);
      const inactiveHours = lastActivity > 0
        ? (Date.now() - lastActivity) / (1000 * 3600)
        : 0;

      if (inactiveHours > timeoutHours) {
        await supabase.auth.signOut();
        const redirect = NextResponse.redirect(new URL("/login?reason=timeout", request.url));
        supabaseResponse.cookies.getAll().forEach((c) => {
          redirect.cookies.set(c.name, c.value);
        });
        return redirect;
      }

      // Update last_seen_at — fire-and-forget
      supabase
        .from("users")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("auth_id", user.id)
        .then(() => {}, () => {});
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
