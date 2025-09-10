import { TradeClient } from "@/components/stockwatch/TradeClient";
import { getStockData } from "@/app/actions";
import { Suspense } from "react";
import type { Order } from "@/lib/types";

function LoadingFallback() {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
}

export default async function TradePage({ params, searchParams }: { params: { ticker: string }, searchParams: { [key: string]: string | string[] | undefined } }) {
  const { ticker } = params;
  const decodedTicker = decodeURIComponent(ticker);
  
  const initialStockData = await getStockData([decodedTicker]);
  
  // Logic to handle editing a pending order or creating a new sell order from portfolio
  const orderToEditString = searchParams.order ? decodeURIComponent(searchParams.order as string) : undefined;
  let orderToEdit: Order | undefined = undefined;
  if(orderToEditString) {
    try {
        orderToEdit = JSON.parse(orderToEditString);
    } catch (e) {
        console.error("Failed to parse order to edit", e);
    }
  }


  return (
    <Suspense fallback={<LoadingFallback />}>
      <TradeClient ticker={decodedTicker} initialStock={initialStockData[0]} orderToEdit={orderToEdit} />
    </Suspense>
  );
}

    