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
  { id: 'news-1', ticker: 'RELIANCE.NS', headline: "Reliance Industries shares climb after positive quarterly earnings report.", source: 'LiveMint', time: '2h ago', image: 'https://picsum.photos/seed/news1/400/200' },
  { id: 'news-2', ticker: 'TATAMOTORS.NS', headline: 'Tata Motors announces new EV model, stock jumps 5%.', source: 'Economic Times', time: '5h ago', image: 'https://picsum.photos/seed/news2/400/200' },
  { id: 'news-3', ticker: 'INFY.NS', headline: 'Infosys bags major deal in the European market.', source: 'Reuters', time: '1d ago', image: 'https://picsum.photos/seed/news3/400/200' },
  { id: 'news-4', ticker: 'ITC.NS', headline: 'ITC expands its FMCG portfolio with new product launches.', source: 'Business Standard', time: '3h ago', image: 'https://picsum.photos/seed/news4/400/200' },
  { id: 'news-5', ticker: 'HDFCBANK.NS', headline: 'HDFC Bank posts strong credit growth in Q2.', source: 'Financial Express', time: '8h ago', image: 'https://picsum.photos/seed/news5/400/200' },
  { id: 'news-6', ticker: 'WIPRO.NS', headline: 'Wipro to focus on AI and cloud services for future growth.', source: 'The Hindu', time: '1d ago', image: 'https://picsum.photos/seed/news6/400/200' },
  { id: 'news-7', ticker: 'ICICIBANK.NS', headline: 'ICICI Bank\'s digital banking platform sees record user engagement.', source: 'LiveMint', time: '4h ago', image: 'https://picsum.photos/seed/news7/400/200' },
  { id: 'news-8', ticker: 'TCS.NS', headline: 'TCS partners with a leading US retailer for digital transformation.', source: 'Economic Times', time: '6h ago', image: 'https://picsum.photos/seed/news8/400/200' },
  { id: 'news-9', ticker: 'NIFTYBEES.NS', headline: 'Market analysts predict bullish trend for the upcoming week.', source: 'Reuters', time: '9h ago', image: 'https://picsum.photos/seed/news9/400/200' },
];
