import orders from "@/data/work-orders.json";
import { getAutoDispatchScenarioOrder } from "@/lib/autoDispatchScenario";
import type { WorkOrderDetail } from "@/types/order";

const typedOrders = orders as WorkOrderDetail[];

export function getOrders(): WorkOrderDetail[] {
  return typedOrders;
}

export function getOrderById(id: string): WorkOrderDetail | undefined {
  return typedOrders.find((order) => order.id === id) ?? getAutoDispatchScenarioOrder(id)?.order;
}
