const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { SystemMessage, HumanMessage, AIMessage } = require('@langchain/core/messages');
const config = require('../config');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * Service for analyzing planning requests using LLM
 */
class PlanningService {
    constructor() {
        this.model = null;
        this.initialized = false;
        this.init();
    }

    init() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.warn('GEMINI_API_KEY not found. Planning service will not work.');
            return;
        }

        try {
            this.model = new ChatGoogleGenerativeAI({
                model: config.chat.modelName || 'gemini-1.5-pro',
                temperature: 0.1, // Low temperature for deterministic JSON output
                apiKey: apiKey,
                modelKwargs: {
                    response_format: { type: "json_object" }
                }
            });
            this.initialized = true;
            console.log('PlanningService initialized');
        } catch (error) {
            console.error('Failed to initialize PlanningService:', error);
        }
    }

    /**
     * Analyze text to extract schedule event details
     * @param {string} text - User input text
     * @param {Array} history - Chat history
     * @param {Array} currentEvents - Existing events for the day
     * @returns {Promise<Object|null>} Extracted event object or null
     */
    async analyzeSchedule(text, history = [], currentEvents = []) {
        if (!this.initialized || !this.model) {
            throw new Error('PlanningService not initialized');
        }

        const today = new Date();
        const dateString = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        const systemPrompt = `
You are a smart scheduling assistant. Your goal is to help the user plan their day.
Current Date: ${dateString}

Context:
- Existing Schedule: ${JSON.stringify(currentEvents)}
- You have access to the chat history to resolve context (e.g., "after that").

Instructions:
1. Analyze the user's request and the existing schedule.
2. If the user asks to find a time (e.g., "find time for basketball"), look for a gap in the existing schedule and propose it.
3. Extract ALL events mentioned in the user's input.
4. If the user refers to a previous event (e.g., "after that"), use the chat history or the last created event to determine the start time.
5. Default duration is 1 hour if not specified.

Output MUST be a valid JSON object with the following structure:
{
    "events": [
        {
            "title": "Event Title",
            "start": "HH:mm" (24-hour format),
            "end": "HH:mm" (24-hour format),
            "description": "Optional description",
            "color": "blue" | "red" | "green" | "yellow"
        }
    ],
    "message": "A short, friendly confirmation message. If you picked a time for them, mention it."
}

Rules:
- If no clear intent, return empty "events" array and a helpful "message".
- Strictly follow the JSON format.
`;

        try {
            // Convert history to LangChain format if needed, or just pass as strings if simple
            // For now, let's just pass the system prompt and the user text, 
            // but ideally we should pass the history messages.
            // Let's assume history is an array of { role: 'user'|'assistant', content: '...' }

            const messages = [
                new SystemMessage(systemPrompt)
            ];

            if (Array.isArray(history)) {
                history.forEach(msg => {
                    if (msg.role === 'user') {
                        messages.push(new HumanMessage(msg.content));
                    } else {
                        messages.push(new AIMessage(msg.content));
                    }
                });
            }

            messages.push(new HumanMessage(text));

            const response = await this.model.invoke(messages);

            const content = response.content;
            // Clean up code blocks if present
            const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();

            return JSON.parse(jsonStr);
        } catch (error) {
            console.error('Error analyzing schedule:', error);
            return {
                events: [],
                message: "Sorry, I couldn't understand that request."
            };
        }
    }
}

module.exports = new PlanningService();
