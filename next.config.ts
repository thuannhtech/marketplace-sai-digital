import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    pageExtensions: ['ts', 'tsx', 'js', 'jsx'],
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**.sitecorecloud.io',
            },
            {
                protocol: 'https',
                hostname: 'sitecorecloud.io',
            },
            {
                protocol: 'https',
                hostname: '**.sitecore.com',
            },
            {
                protocol: 'https',
                hostname: '**.sitecore.net',
            },
            {
                protocol: 'http',
                hostname: 'localhost',
            },
            {
                protocol: 'https',
                hostname: 'localhost',
            },
        ],
    },
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'Content-Security-Policy',
                        // Cho phép chính nó và các domain của Sitecore nhúng Iframe
                        value: "frame-ancestors 'self' https://*.sitecorecloud.io https://*.sitecore.com https://*.sitecore.net;",
                    },
                    {
                        // Bổ sung thêm header này để đảm bảo các trình duyệt cũ không chặn
                        key: 'X-Frame-Options',
                        value: 'ALLOW-FROM https://*.sitecorecloud.io',
                    },
                ],
            },
        ];
    },
};

export default nextConfig;
