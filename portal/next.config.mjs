/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Scan/generate/send routes call external APIs (Firecrawl, Serper, Places,
  // Anthropic, SMTP). Keep them on the Node.js runtime so we get real DNS
  // resolution for the SSRF guard and can use nodemailer.
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
