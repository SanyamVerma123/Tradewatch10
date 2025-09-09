
export interface Stock {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: string | number;
  open: number;
  dayHigh: number;
  dayLow: number;
  previousClose: number;
  volume: number;
  avgVolume: number;
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
  triggerPrice?: number;
  status: 'Pending' | 'Executed' | 'Cancelled';
  timestamp: string;
  exchange: string;
  orderType: string;
  ltp: number;
}

export interface Holding {
  id: string;
  ticker: string;
  quantity: number;
  avgPrice: number;
  investedValue: number;
  currentValue?: number;
  pnl: number;
  pnlPercent: number;
  ltp: number;
  dayChange: number;
  dayChangePercent: number;
}

export interface Portfolio {
    investedValue: number;
    currentValue: number;
    totalPnl: number;
    totalPnlPercent: number;
    holdings: Holding[];
}

export interface User {
    id: string;
    name: string;
    email: string;
    password?: string;
}

    