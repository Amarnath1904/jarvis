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
            { _id: new ObjectId(id) },
            {
                $set: {
                    ...updates,
                    updatedAt: new Date()
                }
            }
        );
        return await this.collection.findOne({ _id: new ObjectId(id) });
    }

    async deleteEvent(id) {
        await this.collection.deleteOne({ _id: new ObjectId(id) });
        return true;
    }
}

module.exports = DailyPlan;
