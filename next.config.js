/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.MISE_NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
    tsconfigPath: process.env.MISE_NEXT_TSCONFIG || 'tsconfig.json',
  },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    outputFileTracingExcludes: {
      '*': ['**/@swc/**', '**/node_modules/**'],
    },
  },
  // Standalone-Output für minimale Docker-Images (deaktiviert wegen EMFILE in CI)
  // output: 'standalone',
  // Bereits installierte Native-App lädt /pos/terminal → leite zur neuen Auswahl
  async redirects() {
    return [
      { source: '/pos/terminal', destination: '/apps', permanent: false },
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
