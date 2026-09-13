import OrderListPage from "@/components/OrderListPage";
import { getOrders } from "@/lib/orders";

export default function Home() {
  return <OrderListPage initialOrders={getOrders()} />;
}
