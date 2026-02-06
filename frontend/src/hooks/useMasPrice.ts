import { useState, useEffect } from 'react';

const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price?ids=massa&vs_currencies=usd';
const CACHE_DURATION = 60000; // 60 секунд

let cachedPrice: number | null = null;
let cacheTime: number = 0;

export function useMasPrice() {
  const [price, setPrice] = useState<number | null>(cachedPrice);
  const [loading, setLoading] = useState(!cachedPrice);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(cacheTime ? new Date(cacheTime) : null);

  const fetchPrice = async () => {
    // Используем кэш если свежий
    if (cachedPrice && Date.now() - cacheTime < CACHE_DURATION) {
      setPrice(cachedPrice);
      setLastUpdate(new Date(cacheTime));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(COINGECKO_API);
      const data = await res.json();
      const newPrice = data.massa?.usd || 0.05; // fallback
      
      cachedPrice = newPrice;
      cacheTime = Date.now();
      
      setPrice(newPrice);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError('Failed to fetch price');
      // Используем fallback цену
      if (!price) setPrice(0.05);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrice();
    const interval = setInterval(fetchPrice, CACHE_DURATION);
    return () => clearInterval(interval);
  }, []);

  const usdToMas = (usd: number): number => {
    if (!price || price === 0) return 0;
    return usd / price;
  };

  const masToUsd = (mas: number): number => {
    if (!price) return 0;
    return mas * price;
  };

  return { price, loading, error, lastUpdate, usdToMas, masToUsd, refresh: fetchPrice };
}
