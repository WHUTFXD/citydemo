import type { NextConfig } from "next";

const githubPages = process.env.GITHUB_PAGES === "true";
const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  reactCompiler: true,
  ...(githubPages ? {
    output: "export",
    trailingSlash: true,
    basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "/citydemo",
    images: { unoptimized: true },
  } : {}),
};

export default nextConfig;
