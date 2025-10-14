// MongoDB sync service for conversations
import { Thread, ThreadItem } from '@repo/shared/types';

interface ConversationData {
  threadId: string;
  title: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

class MongoDBConversationService {
  private isEnabled: boolean = false;

  constructor() {
    // Check if MongoDB is available (only in production or when MONGODB_URI is set)
    this.isEnabled = typeof window === 'undefined' && !!process.env.MONGODB_URI;
  }

  async saveConversation(thread: Thread, threadItems: ThreadItem[]): Promise<void> {
    if (!this.isEnabled) {
      console.log('MongoDB sync disabled - skipping save');
      return;
    }

    try {
      const messages = threadItems
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map(item => ({
          id: item.id,
          role: item.query ? 'user' : 'assistant', // Determine role based on whether it has a query
          content: item.query || item.answer?.text || '',
          timestamp: item.createdAt
        }));

      const conversationData: ConversationData = {
        threadId: thread.id,
        title: thread.title,
        messages,
        createdAt: thread.createdAt,
        updatedAt: new Date()
      };

      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(conversationData),
      });

      if (!response.ok) {
        throw new Error(`Failed to save conversation: ${response.statusText}`);
      }

      console.log('Conversation saved to MongoDB:', thread.id);
    } catch (error) {
      console.error('Error saving conversation to MongoDB:', error);
      // Don't throw - this should be a background operation that doesn't break the UI
    }
  }

  async loadConversations(): Promise<ConversationData[]> {
    if (!this.isEnabled) {
      return [];
    }

    try {
      const response = await fetch('/api/conversations');
      if (!response.ok) {
        throw new Error(`Failed to load conversations: ${response.statusText}`);
      }

      const data = await response.json();
      return data.conversations || [];
    } catch (error) {
      console.error('Error loading conversations from MongoDB:', error);
      return [];
    }
  }

  async deleteConversation(threadId: string): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    try {
      const response = await fetch(`/api/conversations/${threadId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete conversation: ${response.statusText}`);
      }

      console.log('Conversation deleted from MongoDB:', threadId);
    } catch (error) {
      console.error('Error deleting conversation from MongoDB:', error);
    }
  }

  // Convert MongoDB conversation data back to Thread and ThreadItem format
  convertToThreadFormat(conversation: ConversationData): { thread: Thread; threadItems: ThreadItem[] } {
    const thread: Thread = {
      id: conversation.threadId,
      title: conversation.title,
      createdAt: conversation.createdAt,
      pinned: false,
      pinnedAt: null,
    };

    const threadItems: ThreadItem[] = conversation.messages.map((message, index) => ({
      id: message.id,
      threadId: conversation.threadId,
      role: message.role,
      content: message.content,
      createdAt: message.timestamp,
      parentId: index > 0 ? conversation.messages[index - 1].id : null,
    }));

    return { thread, threadItems };
  }
}

export const mongoDBService = new MongoDBConversationService();
