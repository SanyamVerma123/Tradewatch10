export interface Stock {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: string;
}

export interface Watchlist {
  id: string;
  name: string;
  stocks: string[]; // array of tickers
}

export interface NewsArticle {
  id: string;
  ticker: string;
  headline: string;
  source: string;
  time: string;
  image: string;
}

export interface Order {
  id: string;
  type: 'BUY' | 'SELL';
  ticker: string;
  quantity: number;
  filledQuantity: number;
  limitPrice: number;
  status: 'Pending' | 'Executed' | 'Cancelled';
  timestamp: string;
  exchange: string;
  orderType: string;
  ltp: number;
}
