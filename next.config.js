/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'assetliftlending.com' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  serverExternalPackages: ['twilio', '@sendgrid/mail'],
}

module.exports = nextConfig
