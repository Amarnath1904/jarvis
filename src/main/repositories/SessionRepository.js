const database = require('../database');

/**
 * Repository for Session data access
 */
class SessionRepository {
    /**
     * Create a new session
     * @param {Object} sessionData - Session data
     * @returns {Promise<void>}
     */
    async create(sessionData) {
        const db = database.getDb();
        await db.collection('sessions').insertOne(sessionData);
    }

    /**
     * Get all sessions
     * @returns {Promise<Array>} List of sessions
     */
    async getAll() {
        const db = database.getDb();
        return db.collection('sessions')
            .find({})
            .sort({ updatedAt: -1 })
            .project({ sessionId: 1, title: 1, createdAt: 1, updatedAt: 1, _id: 0 })
            .toArray();
    }

    /**
     * Get session by ID
     * @param {string} sessionId 
     * @returns {Promise<Object>} Session object
     */
    async getById(sessionId) {
        const db = database.getDb();
        return db.collection('sessions').findOne({ sessionId });
    }

    /**
     * Update session title
     * @param {string} sessionId 
     * @param {string} title 
     * @returns {Promise<void>}
     */
    async updateTitle(sessionId, title) {
        const db = database.getDb();
        await db.collection('sessions').updateOne(
            { sessionId },
            { $set: { title, updatedAt: new Date() } }
        );
    }

    /**
     * Update session timestamp
     * @param {string} sessionId 
     * @returns {Promise<void>}
     */
    async updateTimestamp(sessionId) {
        const db = database.getDb();
        await db.collection('sessions').updateOne(
            { sessionId },
            { $set: { updatedAt: new Date() } }
        );
    }

    /**
     * Delete session
     * @param {string} sessionId 
     * @returns {Promise<void>}
     */
    async delete(sessionId) {
        const db = database.getDb();
        await db.collection('sessions').deleteOne({ sessionId });
    }
}

module.exports = new SessionRepository();
