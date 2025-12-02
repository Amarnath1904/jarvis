const { ObjectId } = require('mongodb');

class AppState {
    constructor(db) {
        this.collection = db.collection('app_state');
    }

    async getState() {
        const state = await this.collection.findOne({});
        if (!state) {
            const newState = {
                lastLaunchDate: null,
                snoozeCount: 0,
                isPlanningDone: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            await this.collection.insertOne(newState);
            return newState;
        }
        return state;
    }

    async updateState(updates) {
        const state = await this.getState();
        await this.collection.updateOne(
            { _id: state._id },
            {
                $set: {
                    ...updates,
                    updatedAt: new Date()
                }
            }
        );
        return this.getState();
    }

    async resetDailyState(dateString) {
        const state = await this.getState();
        await this.collection.updateOne(
            { _id: state._id },
            {
                $set: {
                    lastLaunchDate: dateString,
                    snoozeCount: 0,
                    isPlanningDone: false,
                    updatedAt: new Date()
                }
            }
        );
        return this.getState();
    }

    async incrementSnooze() {
        const state = await this.getState();
        await this.collection.updateOne(
            { _id: state._id },
            {
                $inc: { snoozeCount: 1 },
                $set: { updatedAt: new Date() }
            }
        );
        return (state.snoozeCount || 0) + 1;
    }
}

module.exports = AppState;
