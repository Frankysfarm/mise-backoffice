/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { typedRoutes: false },
  typescript: { ignoreBuildErrors: true },
  turbopack: {},
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
