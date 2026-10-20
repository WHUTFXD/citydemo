import AIWorkbench from "@/components/AIWorkbench";

export default function Page() {
  return <AIWorkbench mapConfig={{
    key: process.env.NEXT_PUBLIC_AMAP_KEY ?? "",
    securityCode: process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE ?? "",
  }} />;
}
