import OrderDetailPage from "@/components/OrderDetailPage";
import { getAIRecommendationsByOrderId } from "@/lib/aiRecommendations";
import { getOrderById } from "@/lib/orders";
import { notFound } from "next/navigation";

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ focus?: string; source?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const order = getOrderById(id);
  const recommendations = getAIRecommendationsByOrderId(id);
  if (!order || !recommendations) notFound();
  const mapConfig = {
    key: process.env.NEXT_PUBLIC_AMAP_KEY ?? "",
    securityCode: process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE ?? "",
  };
  return (
    <OrderDetailPage
      order={order}
      recommendations={recommendations}
      mapConfig={mapConfig}
      autoDispatchIntervention={query.source === "auto-dispatch"}
      initialAddressRecommendationOpen={query.focus === "address"}
    />
  );
}
