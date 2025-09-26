
"use client";

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

export type Market = 'IN' | 'US' | 'GB' | 'DE' | 'JP' | 'HK' | 'CA';
export type Currency = 'INR' | 'USD' | 'GBP' | 'EUR' | 'JPY' | 'HKD' | 'CAD';

export const marketDetails: Record<Market, { name: string, currency: Currency, symbol: string }> = {
  IN: { name: 'India', currency: 'INR', symbol: '₹' },
  US: { name: 'United States', currency: 'USD', symbol: '$' },
  GB: { name: 'United Kingdom', currency: 'GBP', symbol: '£' },
  DE: { name: 'Germany', currency: 'EUR', symbol: '€' },
  JP: { name: 'Japan', currency: 'JPY', symbol: '¥' },
  HK: { name: 'Hong Kong', currency: 'HKD', symbol: 'HK$' },
  CA: { name: 'Canada', currency: 'CAD', symbol: '$' },
};

interface MarketContextType {
  market: Market;
  setMarket: (market: Market) => void;
  currency: Currency;
  currencySymbol: string;
}

const MarketContext = createContext<MarketContextType | undefined>(undefined);

export const MarketProvider = ({ children }: { children: ReactNode }) => {
  const [market, setMarketState] = useState<Market>('IN');
  const [currency, setCurrencyState] = useState<Currency>('INR');
  const [currencySymbol, setCurrencySymbolState] = useState('₹');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const storedMarket = localStorage.getItem('market') as Market | null;
    if (storedMarket && marketDetails[storedMarket]) {
      setMarketState(storedMarket);
      const details = marketDetails[storedMarket];
      setCurrencyState(details.currency);
      setCurrencySymbolState(details.symbol);
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('market', market);
      const details = marketDetails[market];
      setCurrencyState(details.currency);
      setCurrencySymbolState(details.symbol);
    }
  }, [market, isInitialized]);

  const setMarket = (newMarket: Market) => {
    if (marketDetails[newMarket]) {
      setMarketState(newMarket);
    }
  };

  return (
    <MarketContext.Provider value={{ market, setMarket, currency, currencySymbol }}>
      {children}
    </MarketContext.Provider>
  );
};

export const useMarket = () => {
  const context = useContext(MarketContext);
  if (context === undefined) {
    throw new Error('useMarket must be used within a MarketProvider');
  }
  return context;
};
