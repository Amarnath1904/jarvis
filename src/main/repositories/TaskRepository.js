const database = require('../database');
const { ObjectId } = require('mongodb');

/**
 * Repository for Task data access
 */
class TaskRepository {
    /**
     * Create a new task
     * @param {Object} taskData 
     * @returns {Promise<string>} Created task ID
     */
    async create(taskData) {
        const db = database.getDb();
        const task = {
            ...taskData,
            status: taskData.status || 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const result = await db.collection('tasks').insertOne(task);
        return result.insertedId.toString();
    }

    /**
     * Get all tasks, optionally filtered
     * @param {Object} filter 
     * @returns {Promise<Array>} List of tasks
     */
    async getAll(filter = {}) {
        const db = database.getDb();
        return db.collection('tasks')
            .find(filter)
            .sort({ createdAt: -1 })
            .toArray();
    }

    /**
     * Get task by ID
     * @param {string} id 
     * @returns {Promise<Object|null>}
     */
    async getById(id) {
        const db = database.getDb();
        try {
            return await db.collection('tasks').findOne({ _id: new ObjectId(id) });
        } catch (error) {
            return null;
        }
    }

    /**
     * Update a task
     * @param {string} id 
     * @param {Object} updates 
     * @returns {Promise<boolean>} Success status
     */
    async update(id, updates) {
        const db = database.getDb();
        try {
            const result = await db.collection('tasks').updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        ...updates,
                        updatedAt: new Date()
                    }
                }
            );
            return result.modifiedCount > 0;
        } catch (error) {
            return false;
        }
    }

    /**
     * Delete a task
     * @param {string} id 
     * @returns {Promise<boolean>} Success status
     */
    async delete(id) {
        const db = database.getDb();
        try {
            const result = await db.collection('tasks').deleteOne({ _id: new ObjectId(id) });
            return result.deletedCount > 0;
        } catch (error) {
            return false;
        }
    }
}

module.exports = new TaskRepository();
