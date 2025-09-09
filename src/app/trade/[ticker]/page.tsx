import { TradeClient } from "@/components/stockwatch/TradeClient";
import { getStockData } from "@/app/actions";
import { Suspense } from "react";

function LoadingFallback() {
    return <div>Loading...</div>;
}

export default async function TradePage({ params }: { params: { ticker: string } }) {
  const { ticker } = params;
  // URL decode the ticker
  const decodedTicker = decodeURIComponent(ticker);
  
  // Although TradeClient fetches fresh data, we can fetch initial data here
  // to pass down, potentially reducing initial client-side loading.
  const initialStockData = await getStockData([decodedTicker]);

  return (
    <Suspense fallback={<LoadingFallback />}>
      <TradeClient ticker={decodedTicker} initialStock={initialStockData[0]} />
    </Suspense>
  );
}
