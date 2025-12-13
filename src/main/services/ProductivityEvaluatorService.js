const path = require('path');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { HumanMessage, AIMessage, SystemMessage } = require('@langchain/core/messages');
const config = require('../config');
const { loadEnv } = require('../utils/envLoader');

// Load .env file with correct path resolution for dev and production
loadEnv();

/**
 * Productivity Evaluator Service
 * Uses LangGraph/LangChain to evaluate productivity journal responses
 */
class ProductivityEvaluatorService {
    constructor() {
        this.model = null;
        this.initialized = false;
    }

    /**
     * Initialize the AI model
     */
    initializeModel() {
        if (this.initialized) {
            return;
        }

        try {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey || apiKey.trim() === '') {
                console.error('[ProductivityEvaluator] GEMINI_API_KEY not found in environment');
                return;
            }

            // Try with 'model' property first (matching ChatService pattern)
            try {
                this.model = new ChatGoogleGenerativeAI({
                    model: config.chat.modelName,
                    temperature: 0.7,
                    apiKey: apiKey.trim()
                });
                this.initialized = true;
                console.log('[ProductivityEvaluator] Model initialized with Gemini 3 Pro Preview');
            } catch (error) {
                console.error('[ProductivityEvaluator] Error with "model" property:', error.message);
                // Fallback to using 'modelName' property
                try {
                    this.model = new ChatGoogleGenerativeAI({
                        modelName: config.chat.modelName,
                        temperature: 0.7,
                        apiKey: apiKey.trim()
                    });
                    this.initialized = true;
                    console.log('[ProductivityEvaluator] Model initialized with Gemini 3 Pro Preview (using modelName)');
                } catch (err2) {
                    console.error('[ProductivityEvaluator] Error with "modelName" property:', err2.message);
                    // Final fallback to gemini-1.5-pro
                    this.model = new ChatGoogleGenerativeAI({
                        model: config.chat.fallbackModelName,
                        temperature: 0.7,
                        apiKey: apiKey.trim()
                    });
                    this.initialized = true;
                    console.log('[ProductivityEvaluator] Model initialized with Gemini 1.5 Pro (fallback)');
                }
            }

            this.initialized = true;
            console.log('[ProductivityEvaluator] Model initialized');
        } catch (error) {
            console.error('[ProductivityEvaluator] Error initializing model:', error);
        }
    }

    /**
     * Evaluate productivity journal response
     * @param {Object} journalData - Journal data with responses
     * @returns {Promise<Object>} Evaluation result
     */
    async evaluateJournal(journalData) {
        if (!this.initialized) {
            this.initializeModel();
        }

        if (!this.model) {
            throw new Error('Productivity evaluator model not initialized');
        }

        try {
            const { workProperly, wastingTime, whyHappened, howPrevent, retryCount, previousResponses } = journalData;

            // Build context from previous responses
            let previousContext = '';
            if (previousResponses && previousResponses.length > 0) {
                previousContext = '\n\nPrevious attempts:\n';
                previousResponses.forEach((prev, index) => {
                    previousContext += `\nAttempt ${index + 1}:\n`;
                    previousContext += `Why: ${prev.whyHappened}\n`;
                    previousContext += `How to prevent: ${prev.howPrevent}\n`;
                });
            }

            const systemPrompt = `You are a strict but fair productivity coach evaluating a user's reflection journal. Your role is to assess whether their responses show genuine self-reflection and actionable plans.

CRITICAL: You must be strict about quality. Do NOT accept:
- Gibberish, random characters, or nonsensical text
- Single words or extremely short responses (less than 15 words total)
- Responses that show no effort or thought
- Just "I won't do it again" without any explanation
- Copy-pasted generic responses

Guidelines:
1. Accept responses that show:
   - Honest self-reflection (even if brief, but at least 15-20 words per answer)
   - Specific reasons or circumstances (what actually happened)
   - Concrete plans or commitments (how they'll prevent it)
   - Personal accountability and understanding
   - Minimum 15 words per question (30 words total minimum)

2. Reject responses that are:
   - Too vague (e.g., just "I don't know", "Nothing", "Stuff happened")
   - Completely dismissive (e.g., "I won't do it again" without context)
   - Gibberish, random text, or nonsensical content
   - Copy-pasted or generic without personalization
   - Less than 15 words per answer (30 words total minimum)
   - Show no genuine reflection or effort

3. Be reasonable but strict:
   - Don't expect essays (50-200 words per answer is fine)
   - Accept simple but honest and specific answers
   - Focus on whether they show understanding, accountability, and a real plan
   - Consider this is attempt ${retryCount + 1} of 5
   - If this is attempt 3+, be slightly more lenient but still require quality

4. Provide constructive feedback if rejecting:
   - Point out what's missing (specificity, explanation, plan, etc.)
   - Suggest what would make it better
   - Be encouraging but firm
   - If gibberish, clearly state that the response is not acceptable

IMPORTANT: If the response is gibberish, random characters, or shows no effort, you MUST reject it (satisfied: false) and provide clear feedback.

Respond ONLY in valid JSON format:
{
    "satisfied": true/false,
    "message": "Your feedback message to the user"
}`;

            const userPrompt = `User's situation:
- Doing work properly: ${workProperly ? 'Yes' : 'No'}
- Wasting time: ${wastingTime ? 'Yes' : 'No'}

User's reflection:
Why did it happen?
${whyHappened}

How will you make sure it doesn't happen again?
${howPrevent}
${previousContext}

Evaluate this response and provide feedback.`;

            const messages = [
                new SystemMessage(systemPrompt),
                new HumanMessage(userPrompt)
            ];

            const response = await this.model.invoke(messages);
            const content = response.content;

            // Parse JSON response
            let result;
            try {
                // Clean up code blocks if present
                const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
                result = JSON.parse(jsonStr);
            } catch (parseError) {
                console.error('[ProductivityEvaluator] JSON parse error:', parseError);
                console.error('[ProductivityEvaluator] Response content:', content);
                // If JSON parsing fails, try to extract JSON from text
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        result = JSON.parse(jsonMatch[0]);
                    } catch (e) {
                        // If still can't parse, reject the response
                        result = {
                            satisfied: false,
                            message: 'I had trouble processing your response. Please provide a clear, thoughtful answer explaining what happened and how you\'ll prevent it in the future.'
                        };
                    }
                } else {
                    // No JSON found - reject the response
                    result = {
                        satisfied: false,
                        message: 'I had trouble processing your response. Please provide a clear, thoughtful answer explaining what happened and how you\'ll prevent it in the future.'
                    };
                }
            }

            // Validate response quality before accepting
            const totalWords = (whyHappened + ' ' + howPrevent).split(/\s+/).filter(w => w.length > 0).length;
            
            // Check for gibberish patterns
            const hasGibberish = /[^a-zA-Z0-9\s.,!?;:'"-]/.test(whyHappened + howPrevent) && 
                                 (whyHappened + howPrevent).split(/\s+/).filter(w => w.length > 10).length < 2;
            
            // If AI says satisfied but response is clearly bad, override
            if (result.satisfied && (totalWords < 20 || hasGibberish)) {
                console.log('[ProductivityEvaluator] Overriding AI decision - response quality too low');
                result = {
                    satisfied: false,
                    message: 'Your response seems too brief or unclear. Please provide more specific details about what happened and a concrete plan to prevent it. Aim for at least 15-20 words per question.'
                };
            }

            // Ensure result has required fields
            if (result.satisfied === undefined) {
                result.satisfied = false;
            }
            if (!result.message) {
                result.message = 'Please provide more specific details about what happened and your plan to prevent it.';
            }

            console.log('[ProductivityEvaluator] Evaluation result:', result);
            return result;
        } catch (error) {
            console.error('[ProductivityEvaluator] Error evaluating journal:', error);
            // Fallback: accept the response to avoid blocking the user
            return {
                satisfied: true,
                message: 'Thank you for your response. Keep up the good work!',
                error: true
            };
        }
    }
}

module.exports = new ProductivityEvaluatorService();

