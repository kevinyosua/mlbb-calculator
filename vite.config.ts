import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// Injects the Google Search Console verification meta tag at build time.
// The value comes from the environment (GitHub Actions variable or a local
// shell export), so it never needs to be committed to the repository.
// Without the variable the tag is simply omitted.
function googleSiteVerification(): Plugin {
  return {
    name: 'google-site-verification',
    transformIndexHtml(html) {
      const token = process.env.GOOGLE_SITE_VERIFICATION;
      if (!token) return html;
      return html.replace('</head>', `    <meta name="google-site-verification" content="${token}">\n  </head>`);
    },
  };
}

// Injects the Cloudflare Web Analytics beacon at build time.
// The token comes from the environment (GitHub Actions variable or a local
// shell export), so it never needs to be committed to the repository.
// Without the variable the beacon is simply omitted (local dev, PR previews
// without analytics). Mirrors the googleSiteVerification pattern above.
function cloudflareAnalytics(): Plugin {
  return {
    name: 'cloudflare-analytics',
    transformIndexHtml(html) {
      const token = process.env.CF_ANALYTICS_TOKEN;
      if (!token) return html;
      return html.replace(
        '</body>',
        `    <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${token}"}'></script><!-- Cloudflare Web Analytics -->\n  </body>`,
      );
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), googleSiteVerification(), cloudflareAnalytics()],
});
