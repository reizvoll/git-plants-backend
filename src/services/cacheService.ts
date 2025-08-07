import redisClient, { isRedisConnected, REDIS_CONFIG, CACHE_KEYS } from '@/config/redis';
import { CachedContribution } from '@/types/redis';

export class GitHubCacheService {
  
  /**
   * get monthly contribution (cache first)
   */
  static async getMonthlyContribution(
    userId: string, 
    year: number, 
    month: number
  ): Promise<number | null> {
    // check Redis connection
    if (!isRedisConnected()) {
      console.log('Redis not connected, skipping cache read');
      return null;
    }

    const cacheKey = CACHE_KEYS.MONTHLY_CONTRIBUTION(userId, year, month);
    
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        const data: CachedContribution = JSON.parse(cached);
        console.log(`Cache HIT: ${year}-${String(month).padStart(2, '0')} = ${data.count}`);
        return data.count;
      }
      
      console.log(`Cache MISS: ${year}-${String(month).padStart(2, '0')}`);
      return null;
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  }

  /**
   * save monthly contribution (cache strategy)
   */
  static async setMonthlyContribution(
    userId: string,
    year: number, 
    month: number,
    count: number
  ): Promise<void> {
    // check Redis connection
    if (!isRedisConnected()) {
      console.log('Redis not connected, skipping cache write');
      return;
    }

    const cacheKey = CACHE_KEYS.MONTHLY_CONTRIBUTION(userId, year, month);
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    const data: CachedContribution = {
      userId,
      month,
      year,
      count,
      cachedAt: new Date().toISOString()
    };

    try {
      // cache strategy
      if (year < currentYear || (year === currentYear && month < currentMonth)) {
        // past month: permanent cache (no TTL)
        await redisClient.set(cacheKey, JSON.stringify(data));
        console.log(`PERMANENT cache: ${year}-${String(month).padStart(2, '0')} = ${count}`);
        
      } else if (year === currentYear && month === currentMonth) {
        // current month: 12h TTL
        await redisClient.setEx(cacheKey, REDIS_CONFIG.CACHE_TTL_SECONDS, JSON.stringify(data));
        console.log(`TTL cache (12h): ${year}-${String(month).padStart(2, '0')} = ${count}`);
        
      } else {
        // future month: no cache
        console.log(`Skipping future month cache: ${year}-${String(month).padStart(2, '0')}`);
      }
      
    } catch (error) {
      console.error('Cache write error:', error);
    }
  }

  /**
   * invalidate current month cache (GitHub sync)
   */
  static async invalidateCurrentMonth(userId: string): Promise<void> {
    if (!isRedisConnected()) {
      return;
    }

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    const cacheKey = CACHE_KEYS.MONTHLY_CONTRIBUTION(userId, currentYear, currentMonth);
    
    try {
      const result = await redisClient.del(cacheKey);
      if (result > 0) {
        console.log(`Invalidated current month cache: ${currentYear}-${String(currentMonth).padStart(2, '0')}`);
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  /**
   * get year data (pipeline)
   */
  static async getYearData(userId: string, year: number): Promise<CachedContribution[]> {
    if (!isRedisConnected()) {
      return [];
    }

    const pipeline = redisClient.multi();
    
    // get 12 months data in parallel
    for (let month = 1; month <= 12; month++) {
      const cacheKey = CACHE_KEYS.MONTHLY_CONTRIBUTION(userId, year, month);
      pipeline.get(cacheKey);
    }
    
    try {
      const results = await pipeline.exec();
      const yearData: CachedContribution[] = [];
      
      results?.forEach((result, index) => {
        if (Array.isArray(result) && result.length > 1 && result[1]) {  
          try {
            const data: CachedContribution = JSON.parse(result[1] as string);
            yearData.push(data);
          } catch (parseError) {
            console.error(`Parse error for month ${index + 1}:`, parseError);
          }
        }
      });
      
      console.log(`Year ${year} cache hits: ${yearData.length}/12`);
      return yearData;
      
    } catch (error) {
      console.error('Year data cache error:', error);
      return [];
    }
  }

  /**
   * clear all cache data for a user (for development)
   */
  static async clearUserCache(userId: string): Promise<void> {
    if (!isRedisConnected()) {
      return;
    }

    try {
      // find all cache keys for the user
      const keys = await redisClient.keys(`${REDIS_CONFIG.CACHE_PREFIX}:*:${userId}:*`);
      
      if (keys.length > 0) {
        await redisClient.del(keys);
        console.log(`Cleared ${keys.length} cache entries for user: ${userId}`);
      }
    } catch (error) {
      console.error('Clear cache error:', error);
    }
  }

  /**
   * get cache stats (for monitoring)
   */
  static async getCacheStats(): Promise<{ totalKeys: number; memoryUsage: string }> {
    if (!isRedisConnected()) {
      return { totalKeys: 0, memoryUsage: '0B' };
    }

    try {
      const info = await redisClient.info('memory');
      const totalKeys = await redisClient.dbSize();
      
      // extract memory usage
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : '0B';
      
      return { totalKeys, memoryUsage };
    } catch (error) {
      console.error('Cache stats error:', error);
      return { totalKeys: 0, memoryUsage: '0B' };
    }
  }
}