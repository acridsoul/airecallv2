/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize canvas and pdfjs-dist for server-side rendering
      config.externals = config.externals || []
      config.externals.push('canvas')

      // Handle pdfjs-dist worker
      config.resolve.alias = {
        ...config.resolve.alias,
        'pdfjs-dist/build/pdf.worker.min.mjs': false,
      }
    }

    return config
  },
}

export default nextConfig
