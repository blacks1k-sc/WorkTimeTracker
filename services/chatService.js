import { DataService } from './dataService';
import { AIService } from './aiService';

/**
 * Chat Service
 * Orchestrates the chat flow between user, data, and AI
 */
export const ChatService = {
  /**
   * Process a user message and get AI response
   * @param {string} userMessage - The user's message
   * @param {Array} conversationHistory - Previous messages in the conversation for context
   */
  async processMessage(userMessage, conversationHistory = []) {
    try {
      // Get user ID
      const userId = await DataService.getUserId();
      if (!userId) {
        return {
          success: false,
          message: 'Please log in to use the chat assistant.',
        };
      }

      // Check if AI is configured
      if (!AIService.isConfigured()) {
        return {
          success: false,
          message: 'AI assistant is not configured. Please set up your Gemini API key in app.json or environment variables.',
        };
      }

      // Build context from user data
      const context = await DataService.buildContext(userId, userMessage);

      // Get AI response with conversation history for context
      const aiResponse = await AIService.sendMessage(userMessage, context, conversationHistory);

      return {
        success: true,
        message: aiResponse,
      };
    } catch (error) {
      console.error('Error processing message:', error);
      return {
        success: false,
        message: error.message || 'An error occurred while processing your message. Please try again.',
      };
    }
  },

  /**
   * Get quick stats for display
   */
  async getQuickStats() {
    try {
      const userId = await DataService.getUserId();
      if (!userId) return null;

      const [recentShifts, payments] = await Promise.all([
        DataService.getRecentShifts(userId),
        DataService.getPayments(),
      ]);

      return {
        totalHours: DataService.calculateTotalHours(recentShifts),
        totalShifts: recentShifts.length,
        totalPayments: payments.length,
      };
    } catch (error) {
      console.error('Error getting quick stats:', error);
      return null;
    }
  },
};

