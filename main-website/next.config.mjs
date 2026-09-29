/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // The brand site ships a single static artwork plate; no image pipeline
    // dependency is needed.
    unoptimized: true,
  },
};

export default nextConfig;
