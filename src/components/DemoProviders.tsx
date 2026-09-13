"use client";

import { App, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { AutoDispatchProvider } from "./AutoDispatchProvider";

export default function DemoProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#2a73ca",
          colorText: "#394657",
          colorBorder: "#d7e1ec",
          borderRadius: 2,
          fontSize: 13,
          controlHeight: 30,
          fontFamily: '"Microsoft YaHei", "PingFang SC", Arial, sans-serif',
        },
        components: {
          Button: { borderRadius: 0, controlHeight: 30, paddingInline: 13 },
          Input: { borderRadius: 0 },
          Select: { borderRadius: 0 },
          Modal: { borderRadiusLG: 2 },
        },
      }}
    >
      <App><AutoDispatchProvider>{children}</AutoDispatchProvider></App>
    </ConfigProvider>
  );
}
