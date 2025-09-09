import type { Stock, Watchlist, NewsArticle } from './types';

export const stocks: Stock[] = [
  { ticker: 'AAPL', name: 'Apple Inc.', price: 172.25, change: 1.50, changePercent: 0.88, marketCap: '2.8T' },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', price: 139.74, change: -0.50, changePercent: -0.36, marketCap: '1.7T' },
  { ticker: 'MSFT', name: 'Microsoft Corp.', price: 370.95, change: 2.30, changePercent: 0.62, marketCap: '2.7T' },
  { ticker: 'AMZN', name: 'Amazon.com, Inc.', price: 146.88, change: -1.20, changePercent: -0.81, marketCap: '1.5T' },
  { ticker: 'TSLA', name: 'Tesla, Inc.', price: 234.30, change: 5.60, changePercent: 2.45, marketCap: '750B' },
  { ticker: 'NVDA', name: 'NVIDIA Corp.', price: 479.22, change: -3.40, changePercent: -0.71, marketCap: '1.2T' },
];

export const watchlists: Watchlist[] = [
  { id: 'watchlist-1', name: 'Tech Giants', stocks: ['AAPL', 'GOOGL', 'MSFT', 'AMZN'] },
  { id: 'watchlist-2', name: 'EV & Chips', stocks: ['TSLA', 'NVDA'] },
  { id: 'watchlist-3', name: 'My Favorites', stocks: ['AAPL', 'TSLA'] },
];

export const news: NewsArticle[] = [
  { id: 'news-1', ticker: 'AAPL', headline: "Apple's Vision Pro: A New Era of Computing or a Costly Experiment?", source: 'TechCrunch', time: '2h ago', image: 'https://picsum.photos/400/200?random=1' },
  { id: 'news-2', ticker: 'TSLA', headline: 'Tesla Hits Production Milestone for Cybertruck', source: 'Reuters', time: '5h ago', image: 'https://picsum.photos/400/200?random=2' },
  { id: 'news-3', ticker: 'NVDA', headline: 'NVIDIA Unveils New AI Chips, Stock Soars', source: 'Bloomberg', time: '1d ago', image: 'https://picsum.photos/400/200?random=3' },
];
