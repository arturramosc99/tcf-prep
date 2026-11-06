import type { NextConfig } from 'next';

const dev = process.env.NODE_ENV !== 'production';

// CSP: the site itself, plus OpenAI (the browser negotiates the voice connection).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' https://api.openai.com${dev ? ' ws: wss:' : ''}`,
  "media-src 'self' blob: mediastream:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const nextConfig: NextConfig = {
  // e2e tests build into a separate folder so they don't disturb `next dev`
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // the method .md files are read at runtime by the correction routes
  outputFileTracingIncludes: { '/**': ['./data/*.md'] },
  serverExternalPackages: ['@electric-sql/pglite'],
  poweredByHeader: false,
  // the app's routes used to be in Portuguese/French; keep old bookmarks working
  async redirects() {
    return [
      ['/ecrite', '/written'], ['/orale', '/oral'], ['/cartes/treino', '/flashcards/practice'], ['/cartes', '/flashcards'],
      ['/historique', '/history'], ['/erreurs', '/errors'], ['/config', '/settings'],
    ].map(([source, destination]) => ({ source, destination, permanent: true }));
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'microphone=(self), camera=(), geolocation=(), payment=()' },
      ],
    }];
  },
};

export default nextConfig;
