import type { Watchlist, NewsArticle } from './types';

// This file now contains the default/initial structure for watchlists.
// Stock data is fetched dynamically.
// User-specific watchlists will be stored in localStorage.

interface InitialWatchlistData {
  IN: Watchlist[];
  US: Watchlist[];
  GB: Watchlist[];
  DE: Watchlist[];
  JP: Watchlist[];
  HK: Watchlist[];
  CA: Watchlist[];
}

export const watchlists: InitialWatchlistData = {
  IN: [
    { id: 'watchlist-in-1', name: 'Nifty 50', stocks: ['RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS'] },
    { id: 'watchlist-in-2', name: 'IT Sector', stocks: ['TCS.NS', 'INFY.NS', 'WIPRO.NS', 'HCLTECH.NS'] },
  ],
  US: [
    { id: 'watchlist-us-1', name: 'Tech Giants', stocks: ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'META'] },
    { id: 'watchlist-us-2', name: 'EV Stocks', stocks: ['TSLA', 'RIVN', 'LCID'] },
  ],
  GB: [
    { id: 'watchlist-gb-1', name: 'FTSE 100', stocks: ['SHEL.L', 'AZN.L', 'HSBA.L', 'ULVR.L'] },
  ],
  DE: [
    { id: 'watchlist-de-1', name: 'DAX Leaders', stocks: ['SAP.DE', 'SIE.DE', 'VOW3.DE', 'MBG.DE'] },
  ],
  JP: [
    { id: 'watchlist-jp-1', name: 'Nikkei 225', stocks: ['7203.T', '6758.T', '9984.T', '9432.T'] },
  ],
  HK: [
    { id: 'watchlist-hk-1', name: 'Hang Seng', stocks: ['0700.HK', '9988.HK', '1299.HK', '0005.HK'] },
  ],
  CA: [
    { id: 'watchlist-ca-1', name: 'TSX Composite', stocks: ['SHOP.TO', 'RY.TO', 'ENB.TO', 'BNS.TO'] },
  ],
};


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
