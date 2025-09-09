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
