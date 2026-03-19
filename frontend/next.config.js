/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'toy.pequla.com',
        port: '',
        pathname: '/img/**',
      },
    ],
  },
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://backend:8080';
    return [
      {
        source: '/api/:path*',
        destination: apiUrl + '/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
