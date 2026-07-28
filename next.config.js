/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['assetliftlending.com', 'localhost'],
  },
  experimental: {
    serverComponentsExternalPackages: ['twilio', '@sendgrid/mail'],
  },
}

module.exports = nextConfig
