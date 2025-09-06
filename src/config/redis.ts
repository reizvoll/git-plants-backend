import { createClient } from 'redis';
import dotenv from 'dotenv';

// load environment variables
dotenv.config();

// environment variable validation functions
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable missing: ${key}`);
  }
  return value;
}

function requireEnvNumber(key: string): number {
  const value = requireEnv(key);
  const parsed = parseInt(value);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number, got: ${value}`);
  }
  return parsed;
}

// Redis and cache settings
const REDIS_CONFIG = {
  // Redis connection settings
  URL: process.env.REDIS_URL || `redis://${requireEnv('REDIS_HOST')}:${requireEnvNumber('REDIS_PORT')}`,
  RECONNECT_DELAY_MS: requireEnvNumber('REDIS_RECONNECT_DELAY_MS'),
  
  // cache settings
  CACHE_TTL_SECONDS: requireEnvNumber('CACHE_TTL_SECONDS'),
  CACHE_PREFIX: requireEnv('CACHE_PREFIX'),
  
  // GitHub sync settings
  GITHUB_SYNC_INTERVAL_MS: requireEnvNumber('GITHUB_SYNC_INTERVAL_MS')
};

// cache key functions
export const CACHE_KEYS = {
  MONTHLY_CONTRIBUTION: (userId: string, year: number, month: number) => 
    `${REDIS_CONFIG.CACHE_PREFIX}:monthly:${userId}:${year}:${month}`,
  
  USER_YEAR: (userId: string, year: number) => 
    `${REDIS_CONFIG.CACHE_PREFIX}:year:${userId}:${year}`,
    
  USER_ALL: (userId: string) => 
    `${REDIS_CONFIG.CACHE_PREFIX}:all:${userId}`
};

// export settings
export { REDIS_CONFIG };

// Redis client settings
const redisClient = createClient({
  url: REDIS_CONFIG.URL,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, REDIS_CONFIG.RECONNECT_DELAY_MS)
  }
});

// Redis event handlers
redisClient.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redisClient.on('connect', () => {
  console.log('Redis connected successfully');
});

redisClient.on('reconnecting', () => {
  console.log('Redis reconnecting...');
});

redisClient.on('ready', () => {
  console.log('Redis ready for operations');
});

// Redis connection initialization
let isConnected = false;

export const initRedis = async (): Promise<void> => {
  try {
    if (!isConnected) {
      await redisClient.connect();
      isConnected = true;
      console.log('Redis initialized');
    }
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    // Redis connection failure does not affect the app (graceful degradation)
  }
};

// Redis connection close
export const closeRedis = async (): Promise<void> => {
  try {
    if (isConnected) {
      await redisClient.quit();
      isConnected = false;
      console.log('Redis connection closed');
    }
  } catch (error) {
    console.error('Error closing Redis connection:', error);
  }
};

// check Redis connection status
export const isRedisConnected = (): boolean => {
  return isConnected && redisClient.isReady;
};

export default redisClient;