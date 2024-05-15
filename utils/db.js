const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';

    const url = `mongodb://${host}:${port}`;
    this.client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true });
    this.dbName = database;
    this.connect();
  }

  async connect() {
    try {
      await this.client.connect();
      this.connected = true;
    } catch (err) {
      console.error('Failed to connect to MongoDB', err);
      this.connected = false;
    }
  }

  isAlive() {
    return this.connected;
  }

  async nbUsers() {
    if (!this.connected) return 0;
    const db = this.client.db(this.dbName);
    return db.collection('users').countDocuments();
  }

  async nbFiles() {
    if (!this.connected) return 0;
    const db = this.client.db(this.dbName);
    return db.collection('files').countDocuments();
  }
}

const dbClient = new DBClient();
module.exports = dbClient;
