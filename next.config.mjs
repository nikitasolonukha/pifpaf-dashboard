/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.cdninstagram.com' },
      { protocol: 'https', hostname: '**.scontent.instagram.com' },
      { protocol: 'https', hostname: '**.fbcdn.net' },
      { protocol: 'https', hostname: '**.instagram.com' },
      { protocol: 'https', hostname: 'instagram.**.fna.fbcdn.net' },
      { protocol: 'http', hostname: '127.0.0.1', port: '54321' },
      { protocol: 'http', hostname: 'localhost', port: '54321' },
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
};

export default nextConfig;
