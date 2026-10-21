import { Suspense } from "react";
import OrderDetailRoute from "@/components/OrderDetailRoute";
import { getAIRecommendationsByOrderId } from "@/lib/aiRecommendations";
import { getOrderById, getOrders } from "@/lib/orders";
import { autoDispatchScenario } from "@/lib/autoDispatchScenario";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return [...new Set([...getOrders().map(order => order.id), ...autoDispatchScenario.items.map(item => item.order.id)])].map(id => ({ id }));
}

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = getOrderById(id);
  const recommendations = getAIRecommendationsByOrderId(id);
  if (!order || !recommendations) notFound();
  const mapConfig = {
    key: process.env.NEXT_PUBLIC_AMAP_KEY ?? "",
    securityCode: process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE ?? "",
  };
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>正在加载工单详情…</p>}><OrderDetailRoute
      order={order}
      recommendations={recommendations}
      mapConfig={mapConfig}
    /></Suspense>
  );
}
