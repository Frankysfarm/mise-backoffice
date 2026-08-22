/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { typedRoutes: false },
  // Allows CI/local release builds to avoid colliding with a running dev
  // server that owns .next. Production keeps Next's default directory.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // Standalone-Output für minimale Docker-Images
  output: 'standalone',
  // Bereits installierte Native-App lädt /pos/terminal → leite zur neuen Auswahl
  async redirects() {
    return [
      { source: '/pos/terminal', destination: '/apps', permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/fahrer/' },
        ],
      },
      {
        source: '/fahrer.webmanifest',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ];
  },
  // Images von Unsplash (Demo-Menü) + Supabase-Storage erlauben
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
    ],
  },
};
module.exports = nextConfig;
