const path = require('path');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { HumanMessage, AIMessage, SystemMessage, ToolMessage } = require('@langchain/core/messages');
const database = require('../database');
const config = require('../config');
const sessionRepository = require('../repositories/SessionRepository');
const messageRepository = require('../repositories/MessageRepository');
const taskRepository = require('../repositories/TaskRepository');

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

        const tools = [
            {
                name: "google_search",
                description: "Search Google for information. Use this when you need to answer questions about current events, facts, or topics you don't know.",
                schema: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "The search query to execute"
                        }
                    },
                    required: ["query"]
                }
            },
            {
                name: "add_task",
                description: "Add a new task to the task manager. IMPORTANT: If the task seems important or time-sensitive and NO deadline is provided, DO NOT use this tool yet. Ask the user for a deadline first. Only use this tool once you have the deadline or if the task is not time-sensitive.",
                schema: {
                    type: "object",
                    properties: {
                        title: { type: "string", description: "The title of the task" },
                        description: { type: "string", description: "Additional details about the task" },
                        deadline: { type: "string", description: "ISO date string or description of deadline" }
                    },
                    required: ["title"]
                }
            },
            {
                name: "list_tasks",
                description: "List all tasks or filter by status.",
                schema: {
                    type: "object",
                    properties: {
                        status: { type: "string", enum: ["pending", "in_progress", "completed"], description: "Filter by status" },
                        limit: { type: "number", description: "Limit the number of results" }
                    }
                }
            },
            {
                name: "update_task",
                description: "Update an existing task's status or details.",
                schema: {
                    type: "object",
                    properties: {
                        taskId: { type: "string", description: "The ID of the task to update" },
                        updates: {
                            type: "object",
                            properties: {
                                title: { type: "string" },
                                status: { type: "string", enum: ["pending", "in_progress", "completed"] },
                                deadline: { type: "string" }
                            }
                        }
                    },
                    required: ["taskId", "updates"]
                }
            },
            {
                name: "delete_task",
                description: "Delete a task by ID.",
                schema: {
                    type: "object",
                    properties: {
                        taskId: { type: "string", description: "The ID of the task to delete" }
                    },
                    required: ["taskId"]
                }
            },
            {
                name: "get_daily_plan",
                description: "Get the user's daily schedule/plan for a specific date or today. Use this to answer questions about what the user has planned.",
                schema: {
                    type: "object",
                    properties: {
                        date: {
                            type: "string",
                            description: "ISO date string (YYYY-MM-DD). Defaults to today if not specified."
                        }
                    }
                }
            }
        ];

        try {
            // Try with 'model' property first (for gemini-3-pro-preview)
            this.model = new ChatGoogleGenerativeAI({
                model: config.chat.modelName,
                temperature: config.chat.temperature,
                apiKey: apiKey.trim(),
            }).bindTools(tools);

            this.initialized = true;
            console.log('Chat service initialized with Gemini 3 Pro Preview model');
        } catch (error) {
            console.error('Error initializing with "model" property:', error.message);
            // Try with 'modelName' property
            try {
                this.model = new ChatGoogleGenerativeAI({
                    modelName: config.chat.modelName,
                    temperature: config.chat.temperature,
                    apiKey: apiKey.trim(),
                }).bindTools(tools);
                this.initialized = true;
                console.log('Chat service initialized with Gemini 3 Pro Preview (using modelName)');
            } catch (err2) {
                console.error('Error initializing with "modelName" property:', err2.message);
                // Fallback to gemini-1.5-pro if gemini-3-pro-preview doesn't work
                try {
                    this.model = new ChatGoogleGenerativeAI({
                        model: config.chat.fallbackModelName,
                        temperature: config.chat.temperature,
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
            const messages = await messageRepository.getBySessionId(sessionId);

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
                    } else if (data.type === 'tool') {
                        return new ToolMessage({
                            content: data.content,
                            tool_call_id: data.tool_call_id,
                            name: data.name
                        });
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
            return await messageRepository.getHistory(sessionId);
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

            if (langchainMessage instanceof ToolMessage) {
                messageData.langchainData.tool_call_id = langchainMessage.tool_call_id;
                messageData.langchainData.name = langchainMessage.name;
            }

            await messageRepository.save(messageData);

            // Update session's updatedAt timestamp
            await sessionRepository.updateTimestamp(sessionId);
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
        const maxLength = config.chat.titleMaxLength;
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
                await sessionRepository.create({
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
            const sessions = await sessionRepository.getAll();
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
            // Delete session and all its messages
            await Promise.all([
                sessionRepository.delete(sessionId),
                messageRepository.deleteAllForSession(sessionId)
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
     * Perform a Google Search
     * @param {string} query - Search query
     * @returns {Promise<string>} Search results
     */
    async performSearch(query) {
        try {
            const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
            const cx = process.env.GOOGLE_SEARCH_CX;

            if (!apiKey || !cx) {
                return "Error: Google Search API key or CX not configured.";
            }

            const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.error) {
                return `Search Error: ${data.error.message}`;
            }

            if (!data.items || data.items.length === 0) {
                return "No results found.";
            }

            const results = data.items.slice(0, config.chat.search.maxResults).map(item => {
                return `Title: ${item.title}\nLink: ${item.link}\nSnippet: ${item.snippet}\n`;
            }).join('\n---\n');

            return results;
        } catch (error) {
            console.error('Search error:', error);
            return `Error performing search: ${error.message}`;
        }
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
            await sessionRepository.updateTitle(sessionId, title);
        } catch (error) {
            console.error('Error updating session title:', error);
        }
    }

    /**
     * Send a message and get response
     * @param {string} message - User message
     * @param {string} sessionId - Session identifier
     * @param {Function} onProgress - Callback for progress updates
     * @returns {Promise<string>} AI response
     */
    async sendMessage(message, sessionId, onProgress = null) {
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
                const session = await sessionRepository.getById(sessionId);
                if (session && session.title === 'New Chat') {
                    await this.updateSessionTitle(sessionId, this.generateSessionTitle(message));
                }
            }

            // Get memory for this session
            const memory = await this.getMemory(sessionId);

            // Prepare messages array
            const currentTime = new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true });
            const systemMessageContent = `${config.chat.systemMessage}\n\nCurrent Date and Time: ${currentTime}`;

            const messages = [
                new SystemMessage(systemMessageContent)
            ];

            // Get chat history from memory and add to messages
            if (memory.messages && Array.isArray(memory.messages)) {
                messages.push(...memory.messages);
            }

            // Add current user message
            messages.push(userMsg);

            // Invoke model with messages
            let response = await this.model.invoke(messages);

            // Handle tool calls
            while (response.tool_calls && response.tool_calls.length > 0) {
                // Save the assistant's message with tool calls (optional, but good for history)
                // For simplicity in this implementation, we might skip saving the intermediate tool call request 
                // unless we want to show it in UI. Let's just process it.
                // Actually, LangChain expects the history to contain the AIMessage with tool_calls.
                messages.push(response);

                // Execute tools
                for (const toolCall of response.tool_calls) {
                    if (toolCall.name === 'google_search') {
                        console.log(`Executing search for: ${toolCall.args.query}`);

                        if (onProgress) {
                            onProgress({
                                type: 'tool_start',
                                tool: 'google_search',
                                message: `Searching for: ${toolCall.args.query}`
                            });
                        }

                        const searchResults = await this.performSearch(toolCall.args.query);

                        const toolMessage = new ToolMessage({
                            tool_call_id: toolCall.id,
                            name: toolCall.name,
                            content: searchResults
                        });

                        messages.push(toolMessage);

                        // Save tool execution to DB (optional, but good for context)
                        // We need a way to store this. For now, we'll skip DB persistence of intermediate steps 
                        // to avoid complicating the schema too much, or we can store it as a special system message?
                        // The current schema might not support it fully without changes.
                        // Let's proceed with just in-memory context for the final answer.
                    } else if (toolCall.name === 'add_task') {
                        console.log(`Adding task: ${toolCall.args.title}`);
                        if (onProgress) onProgress({ type: 'tool_start', tool: 'add_task', message: `Adding task: ${toolCall.args.title}` });

                        const taskId = await taskRepository.create(toolCall.args);
                        const result = `Task created with ID: ${taskId}`;

                        messages.push(new ToolMessage({ tool_call_id: toolCall.id, name: toolCall.name, content: result }));

                    } else if (toolCall.name === 'list_tasks') {
                        console.log(`Listing tasks`);
                        if (onProgress) onProgress({ type: 'tool_start', tool: 'list_tasks', message: `Fetching tasks...` });

                        const filter = toolCall.args.status ? { status: toolCall.args.status } : {};
                        const tasks = await taskRepository.getAll(filter);
                        const result = tasks.length > 0
                            ? JSON.stringify(tasks.slice(0, toolCall.args.limit || 10))
                            : "No tasks found.";

                        messages.push(new ToolMessage({ tool_call_id: toolCall.id, name: toolCall.name, content: result }));

                    } else if (toolCall.name === 'update_task') {
                        console.log(`Updating task: ${toolCall.args.taskId}`);
                        if (onProgress) onProgress({ type: 'tool_start', tool: 'update_task', message: `Updating task...` });

                        const success = await taskRepository.update(toolCall.args.taskId, toolCall.args.updates);
                        const result = success ? "Task updated successfully." : "Failed to update task. Task not found.";

                        messages.push(new ToolMessage({ tool_call_id: toolCall.id, name: toolCall.name, content: result }));

                    } else if (toolCall.name === 'delete_task') {
                        console.log(`Deleting task: ${toolCall.args.taskId}`);
                        if (onProgress) onProgress({ type: 'tool_start', tool: 'delete_task', message: `Deleting task...` });

                        const success = await taskRepository.delete(toolCall.args.taskId);
                        const result = success ? "Task deleted successfully." : "Failed to delete task. Task not found.";

                        messages.push(new ToolMessage({ tool_call_id: toolCall.id, name: toolCall.name, content: result }));
                    } else if (toolCall.name === 'get_daily_plan') {
                        console.log(`Getting daily plan`);
                        if (onProgress) onProgress({ type: 'tool_start', tool: 'get_daily_plan', message: `Checking schedule...` });

                        const DailyPlan = require('../models/DailyPlan');
                        const dailyPlan = new DailyPlan(database.getDb());

                        let date = toolCall.args.date;
                        if (!date) {
                            date = new Date().toISOString().split('T')[0];
                        }

                        const events = await dailyPlan.getEventsForDate(date);
                        const result = events.length > 0
                            ? JSON.stringify(events)
                            : `No events found for ${date}.`;

                        messages.push(new ToolMessage({ tool_call_id: toolCall.id, name: toolCall.name, content: result }));
                    }
                }

                // Get next response
                response = await this.model.invoke(messages);
            }

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
            await messageRepository.deleteAllForSession(sessionId);
        } catch (error) {
            console.error('Error clearing history from MongoDB:', error);
        }
    }
}

module.exports = new ChatService();
