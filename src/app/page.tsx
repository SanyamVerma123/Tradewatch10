import { stocks, watchlists, news } from "@/lib/data";
import { WatchlistDashboard } from "@/components/stockwatch/WatchlistDashboard";

export default function Home() {
  // In a real app, you would fetch this data from an API.
  const initialStocks = stocks;
  const initialWatchlists = watchlists;
  const initialNews = news;

  return (
    <WatchlistDashboard
      initialStocks={initialStocks}
      initialWatchlists={initialWatchlists}
      initialNews={initialNews}
    />
  );
}
