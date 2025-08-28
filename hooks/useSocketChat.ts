import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { socketService } from '@/lib/socket';
import { FirebaseService, COLLECTIONS } from '@/lib/firebase';
import { collection, doc, onSnapshot, query, orderBy, limit, serverTimestamp, addDoc, updateDoc, arrayUnion, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface Message {
  id: string;
  chatId: string;
  content: string;
  senderId: string;
  receiverId: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'seen';
  type: 'text' | 'image' | 'file';
}

export interface TypingUser {
  userId: string;
  username: string;
  isTyping: boolean;
  updatedAt: string;
}

export interface UserPresence {
  userId: string;
  isOnline: boolean;
  lastSeen: string;
}

interface UseSocketChatProps {
  chatId: string;
  currentUserId: string;
  otherParticipantId: string;
  currentUsername: string;
}

export function useSocketChat({ 
  chatId, 
  currentUserId, 
  otherParticipantId, 
  currentUsername 
}: UseSocketChatProps) {
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [otherUserPresence, setOtherUserPresence] = useState<UserPresence | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Initialize Socket.IO connection
  useEffect(() => {
    if (currentUserId && currentUsername) {
      FirebaseService.initializeSocket(currentUserId, currentUsername);
    }

    return () => {
      FirebaseService.cleanupSocket();
    };
  }, [currentUserId, currentUsername]);

  // Join chat room when component mounts
  useEffect(() => {
    if (chatId && currentUserId) {
      FirebaseService.joinChatRoom(chatId);
      
      // Setup Socket.IO event listeners for this chat
      setupSocketListeners();
    }

    return () => {
      if (chatId) {
        FirebaseService.leaveChatRoom(chatId);
        cleanupSocketListeners();
      }
    };
  }, [chatId, currentUserId]);

  // Subscribe to other user's presence via Firestore profile as a fallback for socket presence
  useEffect(() => {
    if (!otherParticipantId) return;
    try {
      const unsub = onSnapshot(doc(db, COLLECTIONS.USER_PROFILES, otherParticipantId), (snap) => {
        const d: any = snap.data();
        if (!d) return;
        const last = d.lastSeen || d.last_seen || null;
        const lastSeenIso = last?.toDate ? last.toDate().toISOString() : (typeof last === 'string' ? last : '');
        setOtherUserPresence({
          userId: otherParticipantId,
          isOnline: !!(d.isOnline ?? d.is_online),
          lastSeen: lastSeenIso || ''
        });
      });
      return () => unsub();
    } catch {}
  }, [otherParticipantId]);

  // Setup Socket.IO event listeners
  const setupSocketListeners = useCallback(() => {
    // Listen for new messages
    socketService.onNewMessage((data) => {
      console.log('New message received via Socket.IO:', data);
      const newMessage: Message = {
        id: data.id,
        chatId: data.chatId,
        content: data.content,
        senderId: data.senderId,
        receiverId: data.receiverId,
        timestamp: data.timestamp,
        status: data.status,
        type: data.type
      };

      setMessages(prev => {
        // Check if message already exists
        if (prev.some(m => m.id === newMessage.id)) {
          return prev;
        }
        return [...prev, newMessage];
      });

      // Mark message as delivered if we're the receiver
      if (data.receiverId === currentUserId) {
        FirebaseService.updateMessageStatus(data.id, 'delivered', currentUserId);
      }
    });

    // Listen for typing indicators
    socketService.onTyping((data) => {
      if (data.chatId === chatId && data.userId !== currentUserId) {
        setTypingUsers(prev => {
          const filtered = prev.filter(u => u.userId !== data.userId);
          return [...filtered, {
            userId: data.userId,
            username: data.username,
            isTyping: true,
            updatedAt: new Date().toISOString()
          }];
        });
      }
    });

    // Listen for stop typing
    socketService.onStopTyping((data) => {
      if (data.chatId === chatId && data.userId !== currentUserId) {
        setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
      }
    });

    // Listen for online status
    socketService.onOnline((data) => {
      if (data.userId === otherParticipantId) {
        setOtherUserPresence(prev => prev ? { ...prev, isOnline: true } : null);
      }
    });

    // Listen for offline status
    socketService.onOffline((data) => {
      if (data.userId === otherParticipantId) {
        setOtherUserPresence(prev => prev ? { 
          ...prev, 
          isOnline: false, 
          lastSeen: data.lastSeen 
        } : null);
      }
    });

    // Listen for message delivered status
    socketService.onMessageDelivered((data) => {
      if (data.receiverId === currentUserId) {
        setMessages(prev => prev.map(msg => 
          msg.id === data.messageId ? { ...msg, status: 'delivered' } : msg
        ));
      }
    });

    // Listen for message seen status
    socketService.onMessageSeen((data) => {
      if (data.receiverId === currentUserId) {
        setMessages(prev => prev.map(msg => 
          msg.id === data.messageId ? { ...msg, status: 'seen' } : msg
        ));
      }
    });

    // Listen for connection status
    const checkConnection = () => {
      const connected = socketService.getConnectionStatus();
      setIsConnected(connected);
    };

    // Check connection status periodically
    const connectionInterval = setInterval(checkConnection, 5000);
    checkConnection(); // Check immediately

    return () => {
      clearInterval(connectionInterval);
    };
  }, [chatId, currentUserId, otherParticipantId]);

  // Cleanup Socket.IO listeners
  const cleanupSocketListeners = useCallback(() => {
    socketService.off('newMessage');
    socketService.off('typing');
    socketService.off('stopTyping');
    socketService.off('online');
    socketService.off('offline');
    socketService.off('messageDelivered');
    socketService.off('messageSeen');
  }, []);

  // Load messages from Firebase
  useEffect(() => {
    if (!chatId) {
      setLoading(false);
      return;
    }

    try {
      const messagesRef = collection(db, COLLECTIONS.MESSAGES);
      const q = query(
        messagesRef,
        where('chatId', '==', chatId),
        orderBy('timestamp', 'asc'),
        limit(200)
      );

      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const firebaseMessages: Message[] = snapshot.docs.map((d) => {
          const data: any = d.data();
          return {
            id: d.id,
            chatId: data.chatId,
            content: data.content,
            senderId: data.senderId,
            receiverId: data.receiverId,
            timestamp: data.timestamp?.toDate?.()?.toISOString() || (typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString()),
            status: data.status || 'sent',
            type: data.type || 'text'
          } as Message;
        });

        setMessages(firebaseMessages);
        setLoading(false);

        // Auto-mark as delivered for any messages addressed to me that are still 'sent'
        const toDeliver = firebaseMessages.filter(m => m.receiverId === currentUserId && m.status === 'sent');
        for (const m of toDeliver) {
          try { await FirebaseService.updateMessageStatus(m.id, 'delivered', currentUserId); } catch {}
        }
      });

      unsubscribeRef.current = unsubscribe;

      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
        }
      };
    } catch (error) {
      console.error('Error loading messages:', error);
      setLoading(false);
    }
  }, [chatId]);

  // Send message via Socket.IO and Firebase
  const sendMessage = useCallback(async (content: string): Promise<string> => {
    if (!chatId || !currentUserId || !otherParticipantId) {
      throw new Error('Missing required parameters');
    }

    try {
      // Create message data
      const messageData = {
        chatId,
        content: content.trim(),
        senderId: currentUserId,
        receiverId: otherParticipantId,
        type: 'text' as const,
        timestamp: serverTimestamp(),
        status: 'sent' as const
      };

      // Save to Firebase first
      const docRef = await addDoc(collection(db, COLLECTIONS.MESSAGES), messageData);
      const messageId = docRef.id;

      // Send via Socket.IO for real-time delivery
      if (socketService.getConnectionStatus()) {
        socketService.sendMessage(chatId, content.trim(), otherParticipantId, messageId);
      }

      // Add to local state optimistically
      const newMessage: Message = {
        id: messageId,
        chatId,
        content: content.trim(),
        senderId: currentUserId,
        receiverId: otherParticipantId,
        timestamp: new Date().toISOString(),
        status: 'sent',
        type: 'text'
      };

      setMessages(prev => [...prev, newMessage]);

      return messageId;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }, [chatId, currentUserId, otherParticipantId]);

  // Send typing indicator
  const sendTypingIndicator = useCallback(async (isTyping: boolean) => {
    if (!chatId || !currentUserId) return;

    try {
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      if (isTyping) {
        // Send typing indicator via Socket.IO
        FirebaseService.sendTypingIndicator(chatId, true);

        // Auto-stop typing after 3 seconds
        typingTimeoutRef.current = setTimeout(() => {
          FirebaseService.sendTypingIndicator(chatId, false);
        }, 3000);
      } else {
        FirebaseService.sendTypingIndicator(chatId, false);
      }
    } catch (error) {
      console.error('Error sending typing indicator:', error);
    }
  }, [chatId, currentUserId]);

  // Mark message as read
  const markMessageAsRead = useCallback(async (messageId: string) => {
    if (!currentUserId || !chatId) return;

    try {
      const messageRef = doc(db, COLLECTIONS.MESSAGES, messageId);
      await updateDoc(messageRef, { 
        status: 'seen',
        readBy: arrayUnion(currentUserId)
      });

      // Emit seen status via Socket.IO
      if (socketService.getConnectionStatus()) {
        socketService.markMessageSeen(messageId, currentUserId);
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }, [currentUserId, chatId]);

  // Mark all messages in chat as read
  const markChatAsRead = useCallback(async () => {
    if (!chatId || !currentUserId) return;

    try {
      // Mark all unread messages from other user as seen
      const unreadMessages = messages.filter(msg => 
        msg.senderId !== currentUserId && msg.status !== 'seen'
      );

      for (const message of unreadMessages) {
        await markMessageAsRead(message.id);
      }
    } catch (error) {
      console.error('Error marking chat as read:', error);
    }
  }, [chatId, currentUserId, messages, markMessageAsRead]);

  // Update user presence
  const updatePresence = useCallback(async (isOnline: boolean) => {
    if (!currentUserId) return;

    try {
      await FirebaseService.updateOnlineStatus(currentUserId, isOnline);
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  }, [currentUserId]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        updatePresence(true);
      } else if (nextAppState === 'background') {
        updatePresence(false);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      updatePresence(false);
    };
  }, [updatePresence]);

  // Cleanup typing indicator on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (chatId && currentUserId) {
        FirebaseService.sendTypingIndicator(chatId, false);
      }
    };
  }, [chatId, currentUserId]);

  return {
    messages,
    typingUsers,
    otherUserPresence,
    loading,
    isConnected,
    unreadCount,
    sendMessage,
    sendTypingIndicator,
    markMessageAsRead,
    markChatAsRead,
    updatePresence
  };
}
