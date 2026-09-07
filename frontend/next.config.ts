import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@saywide/contracts"],
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "www.saywide.com",
          },
        ],
        destination: "https://saywide.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
