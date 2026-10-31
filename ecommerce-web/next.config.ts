import type { NextConfig } from 'next'
import bundleAnalyzer from '@next/bundle-analyzer'

const supabaseImageHostname = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname
  } catch {
    return null
  }
})()

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() { return [
    { source: '/customer/returns', destination: '/customer/orders', permanent: false },
    { source: '/customer/return', destination: '/customer/orders', permanent: false },
  ] },
  compress: true,
  experimental: {
    optimizePackageImports: ['lucide-react'],
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'lmhome.com.au' },
      { protocol: 'https', hostname: 'artisanchemist.com.au' },
      { protocol: 'https', hostname: 'cdn.shopify.com' },
      { protocol: 'https', hostname: 'images.gastronom.ru' },
      { protocol: 'https', hostname: 'images.philips.com' },
      { protocol: 'https', hostname: 'www.ikea.is' },
      { protocol: 'https', hostname: 'encrypted-tbn0.gstatic.com' },
      { protocol: 'https', hostname: 'assets.adidas.com' },
      ...(supabaseImageHostname ? [{ protocol: 'https' as const, hostname: supabaseImageHostname, pathname: '/storage/v1/object/public/product-media/**' }] : []),
    ],
  },
  async headers() {
    return [{ source: '/(.*)', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
    ] }]
  },
}

export default withBundleAnalyzer(nextConfig)
