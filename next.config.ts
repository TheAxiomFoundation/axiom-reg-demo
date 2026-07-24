import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/reg-demo',
  images: { unoptimized: true },
};

export default nextConfig;
