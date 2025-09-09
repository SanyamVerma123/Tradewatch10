import type { Watchlist, NewsArticle } from './types';

// This file now contains the default/initial structure for watchlists.
// Stock data is fetched dynamically.
// User-specific watchlists will be stored in localStorage.

export const watchlists: Watchlist[] = [
  { id: 'watchlist-1', name: 'Nifty 50', stocks: ['RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS'] },
  { id: 'watchlist-2', name: 'IT Sector', stocks: ['TCS.NS', 'INFY.NS', 'WIPRO.NS', 'HCLTECH.NS'] },
  { id: 'watchlist-3', name: 'My Favorites', stocks: ['ITC.NS', 'TATAMOTORS.NS'] },
];

export const news: NewsArticle[] = [
  { id: 'news-1', ticker: 'RELIANCE.NS', headline: "Reliance Industries shares climb after positive quarterly earnings report.", source: 'LiveMint', time: '2h ago', image: 'https://picsum.photos/400/200?random=1' },
  { id: 'news-2', ticker: 'TATAMOTORS.NS', headline: 'Tata Motors announces new EV model, stock jumps 5%.', source: 'Economic Times', time: '5h ago', image: 'https://picsum.photos/400/200?random=2' },
  { id: 'news-3', ticker: 'INFY.NS', headline: 'Infosys bags major deal in the European market.', source: 'Reuters', time: '1d ago', image: 'https://picsum.photos/400/200?random=3' },
];
