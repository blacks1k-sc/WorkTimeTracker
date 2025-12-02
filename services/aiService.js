import Constants from 'expo-constants';
import { format } from 'date-fns';

/**
 * AI Service for Chat Assistant
 * Handles communication with Google Gemini API
 */
export const AIService = {
  /**
   * Get Gemini API key from environment or constants
   */
  getApiKey() {
    // Try to get from Expo Constants first
    const apiKey = Constants.expoConfig?.extra?.geminiApiKey || 
                   Constants.manifest?.extra?.geminiApiKey ||
                   process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error('Gemini API key not found. Please set GEMINI_API_KEY in your environment or app.json.');
    }
    
    return apiKey;
  },

  /**
   * Build system prompt for the AI assistant
   */
  buildSystemPrompt(currentDate) {
    const dateStr = currentDate ? format(currentDate, 'EEEE, MMMM d, yyyy') : 'today';
    
    return `You are a helpful and friendly AI assistant for a work time tracking app. Your role is to help users understand their work hours, earnings, and payment history.

IMPORTANT DATE CONTEXT:
- Today's date: ${dateStr}
- "Last week" means the most recent complete week (Sunday to Saturday) that has passed
- "This week" means the current week (Sunday to Saturday) that includes today
- Always use the current date as reference for relative dates like "last week", "this month", etc.

You can answer questions about:
- Work shifts (hours worked, dates, times)
- Payment records
- Work statistics and summaries
- Time periods (today, this week, last week, this month, etc.)

CONVERSATION STYLE:
- Be natural, friendly, and conversational
- Format numbers clearly (e.g., "40.5 hours" not "40.5")
- When discussing dates, use clear formats like "November 24, 2025" or "Nov 24-30, 2025"
- After answering a question, naturally suggest helpful follow-ups:
  * If asked about hours: "Would you like me to calculate your estimated pay for this period?"
  * If asked about hours without dates: "Would you like me to show you the dates and hours for each day?"
  * If asked about pay: "Would you like to see a breakdown by date or shift?"
  * If asked about a period: "Would you like to see the breakdown by day?"
- Keep follow-up suggestions brief and natural, like you're having a conversation
- Don't be overly formal - be helpful and friendly

If you don't have enough information to answer a question, let the user know what information is missing.`;
  },

  /**
   * Build user prompt with context
   */
  buildUserPrompt(userQuery, context, currentDate, conversationHistory = []) {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const dayOfWeek = format(currentDate, 'EEEE');
    
    let prompt = `Current Date Context:
- Today is: ${format(currentDate, 'EEEE, MMMM d, yyyy')}
- Date: ${dateStr}
- Day of week: ${dayOfWeek}

`;

    // Add conversation history for context (last 5 messages to keep it focused)
    if (conversationHistory.length > 0) {
      prompt += `Recent Conversation History (for context):
`;
      const recentHistory = conversationHistory.slice(-5); // Last 5 messages
      recentHistory.forEach((msg) => {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        prompt += `${role}: ${msg.content}\n`;
      });
      prompt += `\n`;
    }

    prompt += `Current User question: ${userQuery}\n\n`;

    if (context.recentShifts) {
      prompt += `Work Shifts Data:\n${context.recentShifts}\n\n`;
    }

    if (context.payments) {
      prompt += `Payment Records:\n${context.payments}\n\n`;
    }

    if (context.settings?.hourlyRate) {
      prompt += `User Settings:\n- Hourly Rate: $${context.settings.hourlyRate}\n`;
      if (context.settings.workLocation) {
        prompt += `- Work Location: ${context.settings.workLocation}\n`;
      }
      prompt += '\n';
    }

    prompt += `Instructions:
1. Answer the user's question accurately using the data provided above
2. IMPORTANT: If the user's question is a follow-up (like "sure", "yes", "okay", "calculate it", etc.), refer to the conversation history to understand what they're responding to
3. Maintain context from previous messages - if you mentioned a specific period (like "last week, Nov 24-30") and the user says "sure" or "yes", they're agreeing to that specific period
4. Use the current date (${format(currentDate, 'MMMM d, yyyy')}) to calculate relative dates correctly
5. For "last week", calculate the most recent complete Sunday-Saturday week that has passed
6. After your answer, naturally suggest a helpful follow-up question (keep it brief and conversational)
7. Be friendly and natural in your response
8. If the user asks about pay/earnings in response to a previous question about hours, use the SAME time period and hours from your previous answer`;

    return prompt;
  },

  /**
   * Send message to Google Gemini API
   * @param {string} userQuery - Current user message
   * @param {object} context - Data context (shifts, payments, etc.)
   * @param {Array} conversationHistory - Previous messages for context
   */
  async sendMessage(userQuery, context, conversationHistory = []) {
    try {
      const apiKey = this.getApiKey();
      
      // Include current date for accurate date calculations
      const currentDate = new Date();
      const systemPrompt = this.buildSystemPrompt(currentDate);
      const userPrompt = this.buildUserPrompt(userQuery, context, currentDate, conversationHistory);

      // Combine system prompt and user prompt for Gemini
      const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

      // Use only v1 (stable API) - Google AI Studio keys work with v1
      // Use the newer models that are actually available (based on the API response)
      const modelConfigs = [
        { model: 'gemini-2.5-flash', version: 'v1' },
        { model: 'gemini-2.5-pro', version: 'v1' },
        { model: 'gemini-2.0-flash', version: 'v1' },
        { model: 'gemini-2.0-flash-001', version: 'v1' },
        { model: 'gemini-2.0-flash-lite', version: 'v1' },
        { model: 'gemini-2.5-flash-lite', version: 'v1' },
        // Fallback to older models
        { model: 'gemini-1.5-flash', version: 'v1' },
        { model: 'gemini-1.5-pro', version: 'v1' },
      ];

      let lastError = null;
      let triedModels = [];
      
      for (const config of modelConfigs) {
        triedModels.push(`${config.model} (${config.version})`);
        try {
          // For Google AI Studio keys, use header method (more reliable)
          // Format: /v1/models/{model-name}:generateContent
          // Note: The API returns model names with "models/" prefix, but we use it without in the URL
          const url = `https://generativelanguage.googleapis.com/${config.version}/models/${config.model}:generateContent`;
          
          console.log(`Trying model: ${config.model} with ${config.version}`);
          console.log(`URL: ${url}`);

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey, // Use header for Google AI Studio keys
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: fullPrompt,
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 500,
                topP: 0.8,
                topK: 40,
              },
            }),
          });

          if (response.ok) {
            const data = await response.json();
            console.log('Gemini API response structure:', JSON.stringify(data, null, 2));
            
            // Extract text from Gemini response - try multiple possible structures
            let text = null;
            
            // Try standard structure
            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
              text = data.candidates[0].content.parts[0].text;
            }
            // Try alternative structure
            else if (data.candidates?.[0]?.text) {
              text = data.candidates[0].text;
            }
            // Try direct text
            else if (data.text) {
              text = data.text;
            }
            // Try content structure
            else if (data.content?.parts?.[0]?.text) {
              text = data.content.parts[0].text;
            }
            
            if (!text) {
              console.error('Could not extract text from response:', data);
              throw new Error('No response text from Gemini API. Response structure: ' + JSON.stringify(data));
            }

            return text;
          } else {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.error?.message || `API error: ${response.status}`;
            const errorDetails = errorData.error?.details || [];
            console.log(`Model ${config.model} (${config.version}) failed: ${errorMsg}`, errorDetails);
            
            // If it's a 404, try next model; if it's auth/permission, throw immediately
            if (response.status === 401 || response.status === 403) {
              throw new Error(`Authentication error: ${errorMsg}. Please check your API key.`);
            }
            
            lastError = new Error(errorMsg);
            // Continue to next model if this one fails
            continue;
          }
        } catch (error) {
          lastError = error;
          // Continue to next model
          continue;
        }
      }

      // If all models failed, try to list available models for debugging
      console.error('All models failed. Attempted:', triedModels);
      try {
        const availableModels = await this.listAvailableModels();
        if (availableModels.length > 0) {
          const modelNames = availableModels.map(m => m.name).join(', ');
          throw new Error(`None of the tried models worked. Available models: ${modelNames}. Please check your API key permissions.`);
        }
      } catch (listError) {
        console.error('Could not list available models:', listError);
      }
      
      // If all models failed, throw the last error
      throw lastError || new Error('All Gemini models failed. Please check your API key and ensure the Generative Language API is enabled.');

    } catch (error) {
      console.error('Error calling Gemini API:', error);
      
      // Provide helpful error messages
      if (error.message.includes('API key') || error.message.includes('API_KEY_INVALID')) {
        throw new Error('Gemini API key is missing or invalid. Please configure it in your app settings.');
      } else if (error.message.includes('rate limit') || error.message.includes('RESOURCE_EXHAUSTED')) {
        throw new Error('API rate limit exceeded. Please try again in a moment.');
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      } else {
        throw new Error(`Failed to get AI response: ${error.message}`);
      }
    }
  },

  /**
   * List available models (for debugging)
   * Call this to see what models are available with your API key
   */
  async listAvailableModels() {
    try {
      const apiKey = this.getApiKey();
      const url = `https://generativelanguage.googleapis.com/v1/models`;
      
      const response = await fetch(url, {
        headers: {
          'x-goog-api-key': apiKey, // Use header for Google AI Studio keys
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const models = data.models || [];
        console.log('Available Gemini models:', models.map(m => m.name));
        return models;
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error listing models:', errorData);
        return [];
      }
    } catch (error) {
      console.error('Error listing models:', error);
      return [];
    }
  },

  /**
   * Check if API key is configured
   */
  isConfigured() {
    try {
      this.getApiKey();
      return true;
    } catch {
      return false;
    }
  },
};

