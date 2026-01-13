const nextConfig = {
  // Cache control headers to prevent stale HTML causing JS mismatches
  async headers() {
    return [
      {
        // HTML pages - always revalidate to prevent stale cache issues
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        // Static assets with hashes - cache forever
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['*']
    },
    // Allow importing & transpiling code from outside this app dir
    externalDir: true,
  },
  // Ensure our workspace packages get transpiled
  transpilePackages: ['@curtain-wizard/core', '@curtain-wizard/shared'],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  productionBrowserSourceMaps: true,
  // Polyfills for canvas rendering compatibility
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        // Ensure canvas polyfills are available if needed
      };
    }
    return config;
  },
};

export default nextConfig;
