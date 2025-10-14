import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/db';
import { ObjectId } from 'mongodb';

// Conversation schema
interface Conversation {
  _id?: ObjectId;
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
  userId?: string; // Optional for future user authentication
}

// GET /api/conversations - Get all conversations
export async function GET(request: NextRequest) {
  try {
    const db = await connectToDatabase();
    const conversations = await db.collection('conversations').find({}).sort({ updatedAt: -1 }).toArray();
    
    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}

// POST /api/conversations - Create or update a conversation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { threadId, title, messages } = body;

    if (!threadId || !messages) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = await connectToDatabase();
    const conversations = db.collection('conversations');

    // Check if conversation exists
    const existingConversation = await conversations.findOne({ threadId });

    const conversationData: Conversation = {
      threadId,
      title: title || 'New Conversation',
      messages: messages.map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp || Date.now())
      })),
      updatedAt: new Date(),
      ...(existingConversation ? {} : { createdAt: new Date() })
    };

    if (existingConversation) {
      // Update existing conversation
      await conversations.updateOne(
        { threadId },
        { 
          $set: {
            title: conversationData.title,
            messages: conversationData.messages,
            updatedAt: conversationData.updatedAt
          }
        }
      );
    } else {
      // Create new conversation
      await conversations.insertOne(conversationData);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving conversation:', error);
    return NextResponse.json({ error: 'Failed to save conversation' }, { status: 500 });
  }
}
