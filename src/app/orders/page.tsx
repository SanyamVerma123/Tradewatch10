import { OrdersClient } from "@/components/stockwatch/OrdersClient";
import { orders } from "@/lib/orders";

export default function OrdersPage() {
  const initialOrders = orders;
  return <OrdersClient initialOrders={initialOrders} />;
}
