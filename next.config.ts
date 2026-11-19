import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // このアプリはほぼ全ページが認証必須・DB依存の動的ページのため、
  // Cache Components(静的事前レンダリング前提)は無効化し、従来の動的レンダリングモデルを使う。
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
