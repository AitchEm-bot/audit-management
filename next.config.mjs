/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize PDFKit and its dependencies for server-side only
      config.externals = config.externals || []
      config.externals.push('pdfkit')
    }
    return config
  },
}

export default nextConfig
