/** @type {import('next').NextConfig} */

// モバイル(Capacitor)ビルド時だけ静的書き出しにする。
// 通常のVercelデプロイ(ウェブ版)は今まで通りのNext.jsアプリとして動く。
//   ウェブ:   next build
//   モバイル: BUILD_TARGET=mobile next build  （out/ を生成 → cap sync）
const isMobile = process.env.BUILD_TARGET === "mobile";

const nextConfig = {
  reactStrictMode: true,
  ...(isMobile ? { output: "export", images: { unoptimized: true } } : {}),
};

export default nextConfig;
