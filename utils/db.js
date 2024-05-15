const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

class DBClient {
  constructor () {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';

    const url = `mongodb://${host}:${port}`;
    this.client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true });
    this.dbName = database;
    this.client.connect().catch(console.error);
  }

  isAlive () {
    return this.client.isConnected();
  }

  async nbUsers () {
    const db = this.client.db(this.dbName);
    return db.collection('users').countDocuments();
  }

  async nbFiles () {
    const db = this.client.db(this.dbName);
    return db.collection('files').countDocuments();
  }
}

const dbClient = new DBClient();
module.exports = dbClient;
