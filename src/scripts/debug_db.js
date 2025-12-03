const database = require('../main/database');
const DailyPlan = require('../main/models/DailyPlan');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function run() {
    try {
        await database.connect();
        const db = database.getDb();
        const collection = db.collection('daily_plans');

        const events = await collection.find({}).toArray();
        console.log('All Events in DB:');
        console.log(JSON.stringify(events, null, 2));

        await database.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
}

run();
