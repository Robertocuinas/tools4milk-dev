import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
      },
    ],
  },
  // NOTE: NEXT_PUBLIC_* variables are injected at build time via Dockerfile ARG.
  // Do not add them to the env section here; they are handled by the build process.
}

export default nextConfig
