import type { Metadata } from "next";
import DemoProviders from "@/components/DemoProviders";
import "./globals.css";

export const metadata: Metadata = {
  title: "闵行区城市运行业务协同平台",
  description: "城市运行工单核验派单演示系统",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body><DemoProviders>{children}</DemoProviders></body>
    </html>
  );
}
