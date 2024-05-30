const redis = require('redis');
const dotenv = require('dotenv');

dotenv.config();

class RedisClient {
  constructor() {
    this.client = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
    });

    this.client.on('error', (err) => console.error('Redis client not connected to the server:', err));
  }

  isAlive() {
    return this.client.connected;
  }

  async get(key) {
    return this.get(key);
  }

  async set(key, value, duration) {
    await this.set(key, value);
    this.client.expire(key, duration);
  }

  async del(key) {
    return this.del(key);
  }
}

const redisClient = new RedisClient();
module.exports = redisClient;
