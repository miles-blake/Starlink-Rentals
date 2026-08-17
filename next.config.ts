import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// No nonce/proxy-based CSP: a nonce requires every page to opt into dynamic
// rendering, which is disproportionate here. script-src needs 'unsafe-inline'
// because the App Router streams RSC payloads via inline `self.__next_f.push`
// script tags (confirmed in dev: a strict script-src breaks hydration). This
// app has no dangerouslySetInnerHTML and no third-party script tags (Google
// Places autocomplete is server-proxied), so the residual risk is limited to
// injected content actually reaching the DOM, which doesn't happen today.
// style-src needs 'unsafe-inline' because Base UI portals (popovers, dialogs)
// set inline positioning styles.
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https:;
  font-src 'self';
  connect-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  ${isDev ? "" : "upgrade-insecure-requests;"}
`
  .replace(/\s{2,}/g, " ")
  .trim();

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspHeader },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
