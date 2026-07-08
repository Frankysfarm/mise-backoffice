/** @type {import('next').NextConfig} */
const path = require('path');
const nextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  experimental: { typedRoutes: false },
  turbopack: {
    root: require('path').resolve(__dirname),
  },
  // Standalone-Output für minimale Docker-Images
  output: 'standalone',
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
