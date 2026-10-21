"use client";

import { useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";
import OrderDetailPage from "./OrderDetailPage";

// URL query flags belong to the browser, so every demo detail can be exported as HTML.
export default function OrderDetailRoute(props: Omit<ComponentProps<typeof OrderDetailPage>, "autoDispatchIntervention" | "initialAddressRecommendationOpen">) {
  const query = useSearchParams();
  const intervention = query.get("source") === "auto-dispatch";
  const addressOpen = query.get("focus") === "address";
  return <OrderDetailPage key={`${props.order.id}/${intervention}/${addressOpen}`} {...props} autoDispatchIntervention={intervention} initialAddressRecommendationOpen={addressOpen} />;
}
