const redis = require('redis');
const { promisify } = require('util');
const dotenv = require('dotenv');

dotenv.config();

class RedisClient {
  constructor() {
    this.client = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
    });

    this.client.on('error', (err) => console.error('Redis client not connected to the server:', err));
    this.client.on('connect', () => console.log('Redis client connected to the server'));

    this.get = promisify(this.client.get).bind(this);
    this.set = promisify(this.client.set).bind(this);
    this.del = promisify(this.client.del).bind(this);
    this.exists = promisify(this.client.exists).bind(this);
  }

  isAlive() {
    return this.client.connected;
  }

  async getValue(key) {
    return this.get(key);
  }

  async setValue(key, value, duration) {
    await this.set(key, value);
    this.client.expire(key, duration);
  }

  async delKey(key) {
    return this.del(key);
  }
}

const redisClient = new RedisClient();
module.exports = redisClient;
