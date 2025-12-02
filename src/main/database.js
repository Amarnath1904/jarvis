const { MongoClient } = require('mongodb');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * Database connection manager
 */
class Database {
  constructor() {
    this.client = null;
    this.db = null;
    this.connected = false;
  }

  /**
   * Connect to MongoDB
   */
  async connect() {
    if (this.connected && this.db) {
      return true;
    }

    const mongoUrl = process.env.MONGODB_URL;
    if (!mongoUrl) {
      console.warn('MONGODB_URL not found in environment variables. Using in-memory storage.');
      return false;
    }

    try {
      this.client = new MongoClient(mongoUrl);
      await this.client.connect();
      this.db = this.client.db();
      this.connected = true;
      console.log('Connected to MongoDB successfully');
      return true;
    } catch (error) {
      console.error('MongoDB connection error:', error.message);
      return false;
    }
  }

  /**
   * Get database instance
   */
  getDb() {
    return this.db;
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.connected = false;
      console.log('Disconnected from MongoDB');
    }
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.connected && this.client !== null;
  }
}

module.exports = new Database();
