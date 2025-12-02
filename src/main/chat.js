const path = require('path');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { HumanMessage, AIMessage, SystemMessage } = require('@langchain/core/messages');
const database = require('./database');

// Load .env file from project root
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * Chat service with MongoDB persistence
 */
class ChatService {
  constructor() {
    this.model = null;
    this.currentSessionId = null;
    this.initialized = false;
    this.dbConnected = false;
    this.init();
  }

  /**
   * Initialize database and model
   */
  async init() {
    // Connect to MongoDB
    this.dbConnected = await database.connect();
    
    // Initialize model
    this.initializeModel();
  }

  /**
   * Initialize the Gemini model
   */
  initializeModel() {
    if (this.initialized && this.model) {
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      console.warn('GEMINI_API_KEY not found in environment variables. Chat will not work until API key is set.');
      return;
    }

    try {
      // Try with 'model' property first (for gemini-3-pro-preview)
      this.model = new ChatGoogleGenerativeAI({
        model: 'gemini-3-pro-preview',
        temperature: 0.7,
        apiKey: apiKey.trim(),
      });

      this.initialized = true;
      console.log('Chat service initialized with Gemini 3 Pro Preview model');
    } catch (error) {
      console.error('Error initializing with "model" property:', error.message);
      // Try with 'modelName' property
      try {
        this.model = new ChatGoogleGenerativeAI({
          modelName: 'gemini-3-pro-preview',
          temperature: 0.7,
          apiKey: apiKey.trim(),
        });
        this.initialized = true;
        console.log('Chat service initialized with Gemini 3 Pro Preview (using modelName)');
      } catch (err2) {
        console.error('Error initializing with "modelName" property:', err2.message);
        // Fallback to gemini-1.5-pro if gemini-3-pro-preview doesn't work
        try {
          this.model = new ChatGoogleGenerativeAI({
            model: 'gemini-1.5-pro',
            temperature: 0.7,
            apiKey: apiKey.trim(),
          });
          this.initialized = true;
          console.log('Chat service initialized with Gemini 1.5 Pro (fallback)');
        } catch (err3) {
          console.error('Failed to initialize chat model:', err3.message);
        }
      }
    }
  }

  /**
   * Get or create memory for a session (loads from MongoDB)
   * @param {string} sessionId - Session identifier
   * @returns {Promise<Object>} Memory object with chat history
   */
  async getMemory(sessionId) {
    if (!this.dbConnected) {
      return { messages: [] };
    }

    try {
      const db = database.getDb();
      const messages = await db.collection('messages')
        .find({ sessionId })
        .sort({ timestamp: 1 })
        .toArray();

      // Convert stored messages back to LangChain message objects
      const langchainMessages = messages
        .filter(msg => msg.langchainData)
        .map(msg => {
          const data = msg.langchainData;
          if (data.type === 'human') {
            return new HumanMessage(data.content);
          } else if (data.type === 'ai') {
            return new AIMessage(data.content);
          } else if (data.type === 'system') {
            return new SystemMessage(data.content);
          }
          return null;
        })
        .filter(msg => msg !== null);

      return { messages: langchainMessages };
    } catch (error) {
      console.error('Error loading memory from MongoDB:', error);
      return { messages: [] };
    }
  }

  /**
   * Get chat history for a session
   * @param {string} sessionId - Session identifier
   * @returns {Promise<Array>} Chat history
   */
  async getHistory(sessionId) {
    if (!this.dbConnected) {
      return [];
    }

    try {
      const db = database.getDb();
      const messages = await db.collection('messages')
        .find({ sessionId })
        .sort({ timestamp: 1 })
        .project({ role: 1, content: 1, timestamp: 1, _id: 0 })
        .toArray();

      return messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString()
      }));
    } catch (error) {
      console.error('Error loading history from MongoDB:', error);
      return [];
    }
  }

  /**
   * Save message to MongoDB
   * @param {string} sessionId - Session identifier
   * @param {string} role - 'user' or 'assistant'
   * @param {string} content - Message content
   * @param {Object} langchainMessage - LangChain message object (optional)
   */
  async saveMessage(sessionId, role, content, langchainMessage = null) {
    if (!this.dbConnected) {
      return;
    }

    try {
      const db = database.getDb();
      const messageData = {
        sessionId,
        role,
        content,
        timestamp: new Date()
      };

      // Store LangChain message data if provided
      if (langchainMessage) {
        messageData.langchainData = {
          type: langchainMessage.constructor.name.replace('Message', '').toLowerCase(),
          content: langchainMessage.content
        };
      }

      await db.collection('messages').insertOne(messageData);

      // Update session's updatedAt timestamp
      await db.collection('sessions').updateOne(
        { sessionId },
        { $set: { updatedAt: new Date() } }
      );
    } catch (error) {
      console.error('Error saving message to MongoDB:', error);
    }
  }

  /**
   * Generate a title from message content
   * @param {string} content - Message content
   * @returns {string} Generated title
   */
  generateSessionTitle(content) {
    const maxLength = 50;
    const trimmed = content.trim();
    if (trimmed.length <= maxLength) {
      return trimmed;
    }
    return trimmed.substring(0, maxLength) + '...';
  }

  /**
   * Create a new chat session
   * @returns {Promise<string>} New session ID
   */
  async createNewSession() {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    if (this.dbConnected) {
      try {
        const db = database.getDb();
        await db.collection('sessions').insertOne({
          sessionId,
          title: 'New Chat',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      } catch (error) {
        console.error('Error creating session in MongoDB:', error);
      }
    }

    this.currentSessionId = sessionId;
    return sessionId;
  }

  /**
   * Get all chat sessions
   * @returns {Promise<Array>} Array of session metadata
   */
  async getAllSessions() {
    if (!this.dbConnected) {
      return [];
    }

    try {
      const db = database.getDb();
      const sessions = await db.collection('sessions')
        .find({})
        .sort({ updatedAt: -1 })
        .project({ sessionId: 1, title: 1, createdAt: 1, updatedAt: 1, _id: 0 })
        .toArray();

      return sessions.map(session => ({
        id: session.sessionId,
        title: session.title,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString()
      }));
    } catch (error) {
      console.error('Error loading sessions from MongoDB:', error);
      return [];
    }
  }

  /**
   * Delete a session
   * @param {string} sessionId - Session identifier
   */
  async deleteSession(sessionId) {
    if (!this.dbConnected) {
      return;
    }

    try {
      const db = database.getDb();
      // Delete session and all its messages
      await Promise.all([
        db.collection('sessions').deleteOne({ sessionId }),
        db.collection('messages').deleteMany({ sessionId })
      ]);
    } catch (error) {
      console.error('Error deleting session from MongoDB:', error);
    }
  }

  /**
   * Set current session
   * @param {string} sessionId - Session identifier
   */
  setCurrentSession(sessionId) {
    this.currentSessionId = sessionId;
  }

  /**
   * Update session title
   * @param {string} sessionId - Session identifier
   * @param {string} title - New title
   */
  async updateSessionTitle(sessionId, title) {
    if (!this.dbConnected) {
      return;
    }

    try {
      const db = database.getDb();
      await db.collection('sessions').updateOne(
        { sessionId },
        { $set: { title, updatedAt: new Date() } }
      );
    } catch (error) {
      console.error('Error updating session title:', error);
    }
  }

  /**
   * Send a message and get response
   * @param {string} message - User message
   * @param {string} sessionId - Session identifier
   * @returns {Promise<string>} AI response
   */
  async sendMessage(message, sessionId) {
    // Initialize model if not already done
    if (!this.initialized) {
      this.initializeModel();
    }

    if (!this.model) {
      throw new Error('Chat model not initialized. Check GEMINI_API_KEY in .env file');
    }

    try {
      // Save user message to database
      const userMsg = new HumanMessage(message);
      await this.saveMessage(sessionId, 'user', message, userMsg);

      // Update session title from first user message
      if (this.dbConnected) {
        const db = database.getDb();
        const session = await db.collection('sessions').findOne({ sessionId });
        if (session && session.title === 'New Chat') {
          await this.updateSessionTitle(sessionId, this.generateSessionTitle(message));
        }
      }

      // Get memory for this session
      const memory = await this.getMemory(sessionId);
      
      // Prepare messages array
      const messages = [
        new SystemMessage('You are JARVIS, a helpful AI assistant. Be concise and helpful.')
      ];

      // Get chat history from memory and add to messages
      if (memory.messages && Array.isArray(memory.messages)) {
        messages.push(...memory.messages);
      }

      // Add current user message
      messages.push(userMsg);

      // Invoke model with messages
      const response = await this.model.invoke(messages);
      const aiResponse = response.content;

      // Save assistant response to database
      const aiMsg = new AIMessage(aiResponse);
      await this.saveMessage(sessionId, 'assistant', aiResponse, aiMsg);

      return aiResponse;
    } catch (error) {
      console.error('Error in chat service:', error);
      throw error;
    }
  }

  /**
   * Clear chat history for a session
   * @param {string} sessionId - Session identifier
   */
  async clearHistory(sessionId) {
    if (!this.dbConnected) {
      return;
    }

    try {
      const db = database.getDb();
      await db.collection('messages').deleteMany({ sessionId });
    } catch (error) {
      console.error('Error clearing history from MongoDB:', error);
    }
  }
}

module.exports = new ChatService();
