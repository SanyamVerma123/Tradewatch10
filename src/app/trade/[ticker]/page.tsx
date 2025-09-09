import { TradeClient } from "@/components/stockwatch/TradeClient";
import { getStockData } from "@/app/actions";
import { Suspense } from "react";

function LoadingFallback() {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
}

export default async function TradePage({ params }: { params: { ticker: string } }) {
  const { ticker } = params;
  const decodedTicker = decodeURIComponent(ticker);
  
  const initialStockData = await getStockData([decodedTicker]);

  return (
    <Suspense fallback={<LoadingFallback />}>
      <TradeClient ticker={decodedTicker} initialStock={initialStockData[0]} />
    </Suspense>
  );
}
