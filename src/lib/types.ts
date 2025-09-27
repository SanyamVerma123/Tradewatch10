

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
  exchange?: string;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  bid?: number;
  ask?: number;
  product?: 'MIS' | 'CNC';
}

export interface Watchlist {
  id: string;
  name: string;
  stocks: string[]; // array of tickers
}

export interface NewsArticle {
  id: string;
  ticker?: string;
  headline: string;
  source: string;
  time: string;
  image: string;
  url?: string;
}

export interface Order {
  id: string;
  type: 'BUY' | 'SELL';
  ticker: string;
  quantity: number;
  filled_quantity: number;
  limit_price: number;
  trigger_price?: number;
  status: 'Pending' | 'Executed' | 'Cancelled';
  timestamp: string; // ISO date string
  exchange: string;
  order_type: string;
  ltp: number;
  is_amo?: boolean;
  product?: string;
  order_method?: string;
  is_short_sell?: boolean;
  is_exit?: boolean;
  is_adding?: boolean;
  executed_at?: string; // ISO date string
  realized_pnl?: number;
  stop_loss_value?: number;
  target_value?: number;
  market?: string;
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

export interface Position {
    id: string;
    ticker: string;
    product: string;
    quantity: number;
    avgPrice: number;
    ltp: number;
    pnl: number;
    investedValue: number; // This can represent margin for positions
    dayChange: number;
    dayChangePercent: number;
    pnlPercent: number;
    type: 'BUY' | 'SELL' | 'CLOSED';
}

export interface Portfolio {
    investedValue: number;
    currentValue: number;
    totalPnl: number;
    totalPnlPercent: number;
    dayPnl: number;
    dayPnlPercent: number;
    holdings: Holding[];
    positions: Position[];
}

export interface User {
    id: string;
    name: string;
    email: string;
    referralCode?: string;
    usedReferralCode?: boolean;
    referredByNames?: string[];
}
