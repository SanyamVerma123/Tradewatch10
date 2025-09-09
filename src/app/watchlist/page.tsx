import { watchlists, news } from "@/lib/data";
import { WatchlistDashboard } from "@/components/stockwatch/WatchlistDashboard";

export default function WatchlistPage() {
  // In a real app, you would fetch this data from an API.
  const initialWatchlists = watchlists;
  const initialNews = news;

  return (
    <WatchlistDashboard
      initialWatchlists={initialWatchlists}
      initialNews={initialNews}
    />
  );
}
