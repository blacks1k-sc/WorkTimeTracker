import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ChatService } from '../services/chatService';
import Colors from '../theme/colors';

export default function ChatScreen({ navigation }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef(null);

  useEffect(() => {
    // Add welcome message
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: "Hi! I'm your work time tracking assistant. I can help you with questions about your work hours, payments, and shifts. What would you like to know?",
        timestamp: new Date(),
      },
    ]);
  }, []);

  useEffect(() => {
    // Scroll to bottom when new message is added
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage = inputText.trim();
    setInputText('');
    
    // Add user message to chat
    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Get AI response with conversation history for context
      // Pass last 10 messages for context (excluding the current one we just added)
      const conversationHistory = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content,
      }));
      const response = await ChatService.processMessage(userMessage, conversationHistory);

      const assistantMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        error: !response.success,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (!response.success && response.message.includes('API key')) {
        // Show alert for configuration issues
        Alert.alert(
          'Configuration Required',
          'To use the AI chat assistant, you need to configure a Gemini API key.\n\nAdd it to your app.json:\n\n"extra": {\n  "geminiApiKey": "your-key-here"\n}\n\nOr set it as an environment variable: GEMINI_API_KEY',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
        error: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = (message) => {
    const isUser = message.role === 'user';
    const isError = message.error;

    return (
      <View
        key={message.id}
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userMessageBubble : styles.assistantMessageBubble,
            isError && styles.errorMessageBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isUser ? styles.userMessageText : styles.assistantMessageText,
            ]}
          >
            {message.content}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Assistant</Text>
        <Text style={styles.headerSubtitle}>Ask me about your work hours</Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map(renderMessage)}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.loadingText}>Thinking...</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask me anything about your work..."
          placeholderTextColor={Colors.textTertiary}
          multiline
          maxLength={500}
          editable={!isLoading}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={Colors.buttonText} />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 15,
    paddingBottom: 20,
  },
  messageContainer: {
    marginBottom: 15,
    flexDirection: 'row',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  assistantMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  userMessageBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  assistantMessageBubble: {
    backgroundColor: Colors.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  errorMessageBubble: {
    backgroundColor: Colors.error + '20',
    borderColor: Colors.error,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: Colors.buttonText,
  },
  assistantMessageText: {
    color: Colors.textPrimary,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginTop: 10,
  },
  loadingText: {
    color: Colors.textSecondary,
    marginLeft: 10,
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 15,
    paddingBottom: Platform.OS === 'ios' ? 30 : 15,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: Colors.card,
    color: Colors.textPrimary,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.textTertiary,
    opacity: 0.5,
  },
  sendButtonText: {
    color: Colors.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
});

