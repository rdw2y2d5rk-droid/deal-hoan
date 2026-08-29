import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Shopee affiliate offer images
      { protocol: "https", hostname: "down-vn.img.susercontent.com" },
      { protocol: "https", hostname: "cf.shopee.vn" },
      // Lazada product images — served from several *.slatic.net subdomains,
      // Lazada's own CDN subdomains, and alicdn.com for cross-border listings.
      { protocol: "https", hostname: "*.slatic.net" },
      { protocol: "https", hostname: "*.lazada.vn" },
      { protocol: "https", hostname: "*.alicdn.com" },
    ],
  },
};

export default nextConfig;
