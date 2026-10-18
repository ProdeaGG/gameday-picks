/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ['@libsql/client'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'a.espncdn.com',
      },
      {
        protocol: 'https',
        hostname: 's.espncdn.com',
      },
    ],
  },
};

export default nextConfig;
