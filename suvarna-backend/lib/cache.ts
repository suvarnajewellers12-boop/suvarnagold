type CacheData = {
  data: any;
  timestamp: number;
};

let cache: CacheData | null = null;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function getCache() {
  if (!cache) return null;

  const now = Date.now();

  if (now - cache.timestamp < CACHE_DURATION) {
    return cache.data;
  }

  return null;
}

export function setCache(data: any) {
  cache = {
    data,
    timestamp: Date.now(),
  };
}