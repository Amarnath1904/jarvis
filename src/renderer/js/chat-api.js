/**
 * API module for Chat functionality
 * Handles all communication with the main process via Electron API
 */
export class ChatAPI {
    constructor() {
        this.api = window.electronAPI;
    }

    isAvailable() {
        return !!this.api;
    }

    async getSessions() {
        if (!this.isAvailable() || !this.api.chatSessions) return [];
        try {
            return await this.api.chatSessions() || [];
        } catch (error) {
            console.error('Error loading sessions:', error);
            throw error;
        }
    }

    async createNewChat() {
        if (!this.isAvailable() || !this.api.chatNew) {
            throw new Error('Chat API not available');
        }
        try {
            return await this.api.chatNew();
        } catch (error) {
            console.error('Error creating new chat:', error);
            throw error;
        }
    }

    async setSession(sessionId) {
        if (!this.isAvailable() || !this.api.chatSetSession) return;
        await this.api.chatSetSession(sessionId);
    }

    async getHistory(sessionId) {
        if (!this.isAvailable() || !this.api.chatHistory) return [];
        try {
            return await this.api.chatHistory(sessionId) || [];
        } catch (error) {
            console.error('Error loading chat history:', error);
            throw error;
        }
    }

    async sendMessage(message, sessionId) {
        if (!this.isAvailable() || !this.api.chatSend) {
            throw new Error('Chat API not available');
        }
        return await this.api.chatSend(message, sessionId);
    }

    async deleteSession(sessionId) {
        if (!this.isAvailable() || !this.api.chatDelete) return;
        await this.api.chatDelete(sessionId);
    }
}
