import { io, Socket } from 'socket.io-client';
import { auth } from './firebase';

// Socket.IO event types
export interface SocketEvents {
  // Message events
  sendMessage: (data: {
    chatId: string;
    content: string;
    receiverId: string;
    messageId: string;
  }) => void;
  
  newMessage: (data: {
    id: string;
    chatId: string;
    content: string;
    senderId: string;
    receiverId: string;
    timestamp: string;
    status: 'sent' | 'delivered' | 'seen';
  }) => void;
  
  // Typing events
  typing: (data: { chatId: string; userId: string; username: string }) => void;
  stopTyping: (data: { chatId: string; userId: string }) => void;
  
  // Presence events
  online: (data: { userId: string; username: string }) => void;
  offline: (data: { userId: string; lastSeen: string }) => void;
  
  // Message status events
  messageDelivered: (data: { messageId: string; receiverId: string }) => void;
  messageSeen: (data: { messageId: string; receiverId: string }) => void;
  
  // Connection events
  connect: () => void;
  disconnect: () => void;
  connect_error: (error: any) => void;
}

// Socket service class
export class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  // Initialize socket connection
  async initialize(userId: string, username: string): Promise<void> {
    try {
      // Replace with your Socket.IO server URL
      const serverUrl = 'https://quicktalk-server-p9rh.onrender.com/'; // Change this to your server URL
      
      this.socket = io(serverUrl, {
        auth: {
          userId,
          username
        },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay
      });

      this.setupEventListeners();
      this.setupConnectionHandlers();
      
      console.log('Socket.IO client initialized');
    } catch (error) {
      console.error('Failed to initialize Socket.IO:', error);
      throw error;
    }
  }

  // Setup event listeners
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('Connected to Socket.IO server');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from Socket.IO server');
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
      this.isConnected = false;
    });

    // Reconnection events
    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`Reconnected to Socket.IO server after ${attemptNumber} attempts`);
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`Socket.IO reconnection attempt ${attemptNumber}`);
      this.reconnectAttempts = attemptNumber;
    });

    this.socket.on('reconnect_failed', () => {
      console.error('Socket.IO reconnection failed');
      this.isConnected = false;
    });
  }

  // Setup connection handlers
  private setupConnectionHandlers(): void {
    if (!this.socket) return;

    // Handle app state changes
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && this.socket && !this.isConnected) {
        this.socket.connect();
      } else if (nextAppState === 'background' && this.socket && this.isConnected) {
        this.socket.disconnect();
      }
    };

    // You can integrate this with React Native's AppState
    // AppState.addEventListener('change', handleAppStateChange);
  }

  // Join a chat room
  joinChat(chatId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('joinChat', { chatId });
      console.log(`Joined chat room: ${chatId}`);
    }
  }

  // Leave a chat room
  leaveChat(chatId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('leaveChat', { chatId });
      console.log(`Left chat room: ${chatId}`);
    }
  }

  // Send a message
  sendMessage(chatId: string, content: string, receiverId: string, messageId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('sendMessage', {
        chatId,
        content,
        receiverId,
        messageId
      });
      console.log(`Sent message: ${messageId} to chat: ${chatId}`);
    } else {
      console.warn('Socket not connected, message will be queued');
    }
  }

  // Send typing indicator
  sendTypingIndicator(chatId: string, isTyping: boolean): void {
    if (this.socket && this.isConnected) {
      if (isTyping) {
        this.socket.emit('typing', { chatId });
      } else {
        this.socket.emit('stopTyping', { chatId });
      }
    }
  }

  // Mark message as delivered
  markMessageDelivered(messageId: string, receiverId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('messageDelivered', { messageId, receiverId });
    }
  }

  // Mark message as seen
  markMessageSeen(messageId: string, receiverId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('messageSeen', { messageId, receiverId });
    }
  }

  // Update online status
  updateOnlineStatus(isOnline: boolean): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('updateStatus', { isOnline });
    }
  }

  // Listen for new messages
  onNewMessage(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on('newMessage', callback);
    }
  }

  // Listen for typing indicators
  onTyping(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on('typing', callback);
    }
  }

  // Listen for stop typing
  onStopTyping(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on('stopTyping', callback);
    }
  }

  // Listen for online status
  onOnline(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on('online', callback);
    }
  }

  // Listen for offline status
  onOffline(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on('offline', callback);
    }
  }

  // Listen for message delivered
  onMessageDelivered(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on('messageDelivered', callback);
    }
  }

  // Listen for message seen
  onMessageSeen(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on('messageSeen', callback);
    }
  }

  // Remove event listeners
  off(event: string, callback?: Function): void {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
  }

  // Get connection status
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  // Disconnect socket
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Cleanup
  cleanup(): void {
    this.disconnect();
  }
}

// Export singleton instance
export const socketService = new SocketService();
export default socketService;
