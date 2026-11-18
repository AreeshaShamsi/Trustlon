import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';
import { backendUrl } from './src/lib/api-url';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: backendUrl('/:path*') }];
  },
};

export default (phase: string): NextConfig => ({
  ...nextConfig,
  // Keep builds from replacing chunks served by a running development server.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
});
