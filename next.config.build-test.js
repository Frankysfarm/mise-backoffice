module.exports = {
  "reactStrictMode": true,
  "typescript": {
    "ignoreBuildErrors": true
  },
  "eslint": {
    "ignoreDuringBuilds": true
  },
  "experimental": {
    "outputFileTracingExcludes": {
      "*": [
        "**/@swc/**",
        "**/node_modules/**"
      ]
    }
  },
  "images": {
    "remotePatterns": [
      {
        "protocol": "https",
        "hostname": "images.unsplash.com"
      },
      {
        "protocol": "https",
        "hostname": "*.supabase.co"
      },
      {
        "protocol": "https",
        "hostname": "*.supabase.in"
      }
    ]
  }
}