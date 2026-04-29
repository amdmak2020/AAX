import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { createCsrfToken, csrfCookieName } from "@/lib/csrf";
import { isSupabaseConfigured } from "@/lib/env";
import { hardenSupabaseCookieOptions } from "@/lib/supabase/cookies";

const protectedPrefixes = ["/dashboard", "/create", "/jobs", "/billing", "/settings", "/admin", "/app"];

const scriptSource = process.env.NODE_ENV === "production" ? "script-src 'self' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
const firstPartyFormOrigins = ["'self'", "https://www.autoagentx.com", "https://autoagentx.com"];
const externalFormOrigins = [
  "https://gumroad.com",
  "https://app.gumroad.com",
  "https://*.gumroad.com",
  "https://*.supabase.co",
  "https://accounts.google.com",
  "https://*.google.com"
];

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  scriptSource,
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://api.gumroad.com https://gumroad.com https://app.gumroad.com https://*.upstash.io https://*.upstash.com https://n8n.autoagentx.com",
  "media-src 'self' blob: https:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://drive.google.com https://docs.google.com https://gumroad.com https://app.gumroad.com https://*.gumroad.com",
  `form-action ${firstPartyFormOrigins.join(" ")} ${externalFormOrigins.join(" ")}`,
  "upgrade-insecure-requests"
].join("; ");

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const forwardedHost = request.headers.get("x-forwarded-host") ?? host;
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");

  if (process.env.NODE_ENV === "production" && /^autoagentx\.com$/i.test(forwardedHost)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.protocol = `${forwardedProto}:`;
    redirectUrl.host = "www.autoagentx.com";
    return NextResponse.redirect(redirectUrl, { status: 308 });
  }

  if (
    process.env.NODE_ENV === "production" &&
    request.headers.get("x-forwarded-proto") === "http" &&
    !/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.protocol = "https:";
    return NextResponse.redirect(redirectUrl, { status: 308 });
  }

  const isProtected = protectedPrefixes.some((prefix) => request.nextUrl.pathname.startsWith(prefix));
  let response = NextResponse.next({
    request
  });

  if ((request.method === "GET" || request.method === "HEAD") && !request.nextUrl.pathname.startsWith("/api")) {
    const existingCsrf = request.cookies.get(csrfCookieName)?.value;
    if (!existingCsrf) {
      response.cookies.set(csrfCookieName, createCsrfToken(), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/"
      });
    }
  }

  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-site");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none");
  response.headers.set("Origin-Agent-Cluster", "?1");
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);

  if (!isProtected || !isSupabaseConfigured()) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, hardenSupabaseCookieOptions(options)));
        }
      }
    }
  );

  return supabase.auth.getUser().then(({ data }) => {
    if (!data.user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }

    return response;
  });
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|apple-icon.svg|opengraph-image|twitter-image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml)$).*)"
  ]
};
