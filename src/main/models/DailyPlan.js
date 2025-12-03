const { ObjectId } = require('mongodb');

class DailyPlan {
    constructor(db) {
        this.collection = db.collection('daily_plans');
    }

    async createEvent(event) {
        const newEvent = {
            ...event,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const result = await this.collection.insertOne(newEvent);
        return { ...newEvent, _id: result.insertedId };
    }

    async getEventsForDate(dateString) {
        return await this.collection.find({ date: dateString }).sort({ startTime: 1 }).toArray();
    }

    async updateEvent(id, updates) {
        await this.collection.updateOne(
            { _id: new ObjectId(String(id)) },
            {
                $set: {
                    ...updates,
                    updatedAt: new Date()
                }
            }
        );
        return await this.collection.findOne({ _id: new ObjectId(String(id)) });
    }

    async deleteEvent(id) {
        console.log(`Deleting event with ID: ${id} (Type: ${typeof id})`);
        try {
            await this.collection.deleteOne({ _id: new ObjectId(String(id)) });
            return true;
        } catch (error) {
            console.error(`Failed to delete event ${id}:`, error);
            throw error;
        }
    }

    async deleteEventsForDate(dateString) {
        await this.collection.deleteMany({ date: dateString });
        return true;
    }
}

module.exports = DailyPlan;
