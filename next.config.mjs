/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 静的書き出し（Capacitor / App Store 向け & コールドスタート解消）
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
