const database = require('../database');

/**
 * Repository for Message data access
 */
class MessageRepository {
    /**
     * Save a message
     * @param {Object} messageData 
     * @returns {Promise<void>}
     */
    async save(messageData) {
        const db = database.getDb();
        await db.collection('messages').insertOne(messageData);
    }

    /**
     * Get messages by session ID
     * @param {string} sessionId 
     * @returns {Promise<Array>} List of messages
     */
    async getBySessionId(sessionId) {
        const db = database.getDb();
        return db.collection('messages')
            .find({ sessionId })
            .sort({ timestamp: 1 })
            .toArray();
    }

    /**
     * Get message history for display
     * @param {string} sessionId 
     * @returns {Promise<Array>} Formatted history
     */
    async getHistory(sessionId) {
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
    }

    /**
     * Delete all messages for a session
     * @param {string} sessionId 
     * @returns {Promise<void>}
     */
    async deleteAllForSession(sessionId) {
        const db = database.getDb();
        await db.collection('messages').deleteMany({ sessionId });
    }
}

module.exports = new MessageRepository();
