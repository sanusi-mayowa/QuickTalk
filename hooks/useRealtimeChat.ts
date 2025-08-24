import { useState, useEffect, useCallback, useRef } from 'react';
import { auth, db } from '@/lib/firebase';
import { addDoc, arrayUnion, collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Message {
  id: string;
  content: string;
  sender_id: string;
  chat_id: string;
  created_at: string;
  is_read: boolean;
  message_type: 'text' | 'image' | 'file';
  read_by: Record<string, string>;
  delivered_to?: Record<string, string>;
  reactions?: Record<string, string>; // user_id -> reaction emoji
  // ADDED: Offline support fields
  client_id?: string; // Stable client-generated id for queued messages
  status?: 'queued' | 'sent' | 'failed';
}

export interface TypingUser {
  user_id: string;
  username: string;
  is_typing: boolean;
  updated_at: string;
}

export interface UserPresence {
  user_id: string;
  is_online: boolean;
  last_seen: string;
}

interface UseRealtimeChatProps {
  chatId: string;
  currentUserId: string;
  otherParticipantId: string;
}

export function useRealtimeChat({ chatId, currentUserId, otherParticipantId }: UseRealtimeChatProps) {
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [otherUserPresence, setOtherUserPresence] = useState<UserPresence | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOffline, setIsOffline] = useState(false);

  const channelsRef = useRef<(() => void)[]>([]);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingRef = useRef<number>(0);
  const lastFetchedAtRef = useRef<string>('');

  // ADDED: Storage keys helpers
  const getMessagesCacheKey = useCallback(() => `cache:chat:${chatId}:messages`, [chatId]);
  const getQueueKey = useCallback(() => `queue:messages:${currentUserId}`, [currentUserId]);

  // ADDED: Cache helpers
  const saveMessagesToCache = useCallback(async (msgs: Message[]) => {
    try {
      await AsyncStorage.setItem(getMessagesCacheKey(), JSON.stringify(msgs));
    } catch (e) {
      console.log('Failed to cache messages', e);
    }
  }, [getMessagesCacheKey]);

  const loadMessagesFromCache = useCallback(async (): Promise<Message[] | null> => {
    try {
      const raw = await AsyncStorage.getItem(getMessagesCacheKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch (e) {
      console.log('Failed to load cached messages', e);
      return null;
    }
  }, [getMessagesCacheKey]);

  // ADDED: Queue helpers
  const enqueueMessage = useCallback(async (queued: Omit<Message, 'is_read' | 'read_by'> & { read_by?: Record<string, string>; is_read?: boolean }) => {
    try {
      const key = getQueueKey();
      const existingRaw = await AsyncStorage.getItem(key);
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      existing.push(queued);
      await AsyncStorage.setItem(key, JSON.stringify(existing));
    } catch (e) {
      console.log('Failed to enqueue message', e);
    }
  }, [getQueueKey]);

  const getQueuedMessages = useCallback(async (): Promise<Message[]> => {
    try {
      const raw = await AsyncStorage.getItem(getQueueKey());
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch {
      return [];
    }
  }, [getQueueKey]);

  const clearQueue = useCallback(async () => {
    try {
      await AsyncStorage.setItem(getQueueKey(), JSON.stringify([]));
    } catch {}
  }, [getQueueKey]);

  const removeFromQueueByClientId = useCallback(async (clientId: string) => {
    try {
      const key = getQueueKey();
      const raw = await AsyncStorage.getItem(key);
      const parsed: Message[] = raw ? JSON.parse(raw) : [];
      const filtered = parsed.filter(m => m.client_id !== clientId);
      await AsyncStorage.setItem(key, JSON.stringify(filtered));
    } catch {}
  }, [getQueueKey]);

  // Load initial messages
  const loadMessages = useCallback(async () => {
    if (!chatId || !currentUserId || !otherParticipantId) {
      setLoading(false);
      return;
    }

    try {
      const qMsg = query(collection(db, 'messages'), where('chat_id', '==', chatId), orderBy('created_at', 'asc'));
      const snap = await getDocs(qMsg);
      const serverMessages = snap.docs.map(d => d.data()) as Message[];
      setMessages(serverMessages);
      // Cache server messages
      saveMessagesToCache(serverMessages);
      setIsOffline(false);
      // Merge queued messages for this chat into view
      const queued = await getQueuedMessages();
      const queuedForThisChat = queued.filter(q => q.chat_id === chatId);
      if (queuedForThisChat.length > 0) {
        setMessages(prev => [...prev, ...queuedForThisChat]);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setIsOffline(true);
      // Load from cache when offline
      const cached = await loadMessagesFromCache();
      if (cached) {
        setMessages(cached);
        // Also overlay any queued messages
        const queued = await getQueuedMessages();
        const queuedForThisChat = queued.filter(q => q.chat_id === chatId);
        if (queuedForThisChat.length > 0) {
          setMessages(prev => [...prev, ...queuedForThisChat]);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [chatId, currentUserId, otherParticipantId, saveMessagesToCache, loadMessagesFromCache, getQueuedMessages]);

  // Load other user's presence
  const loadUserPresence = useCallback(async () => {
    if (!otherParticipantId || otherParticipantId.trim() === '' || !chatId || !currentUserId) {
      console.warn('otherParticipantId is empty, skipping presence load');
      return;
    }
    
    try {
      const qUser = query(collection(db, 'user_profiles'), where('id', '==', otherParticipantId));
      const snap = await getDocs(qUser);
      const data: any = snap.docs[0]?.data();
      if (data) {
        setOtherUserPresence({ user_id: data.id, is_online: !!data.is_online, last_seen: data.last_seen || new Date().toISOString() });
      }
    } catch (error) {
      console.error('Error loading user presence:', error);
    }
  }, [otherParticipantId, chatId, currentUserId]);

  // Load unread count
  const loadUnreadCount = useCallback(async () => {
    if (!chatId || chatId.trim() === '' || !currentUserId || currentUserId.trim() === '' || !otherParticipantId) {
      console.warn('chatId or currentUserId is empty, skipping unread count load');
      return;
    }
    
    try {
      const qUnread = query(collection(db, 'messages'), where('chat_id', '==', chatId));
      const snap = await getDocs(qUnread);
      const count = snap.docs.reduce((acc, d) => {
        const m: any = d.data();
        if (m.sender_id !== currentUserId && (!Array.isArray(m.read_by) || !m.read_by.includes(currentUserId))) return acc + 1;
        return acc;
      }, 0);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  }, [chatId, currentUserId, otherParticipantId]);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    console.log('sendMessage called with:', { content, chatId, currentUserId, otherParticipantId });
    
    if (!chatId || !currentUserId || !otherParticipantId) {
      console.error('Invalid parameters for sendMessage:', { chatId, currentUserId, otherParticipantId });
      throw new Error('Invalid parameters');
    }

    // Prepare optimistic local message context outside try/catch for reuse on failure
    const clientId = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const localCreatedAt = new Date().toISOString();

    try {
      // Optimistically add local message (queued -> sending -> sent)
      const localMessage: Message = {
        id: clientId,
        client_id: clientId,
        chat_id: chatId,
        sender_id: currentUserId,
        content: content.trim(),
        message_type: 'text',
        created_at: localCreatedAt,
        is_read: false,
        read_by: {},
        delivered_to: {},
        status: 'queued',
      };
      setMessages(prev => [...prev, localMessage]);

      const messageData = {
        chat_id: chatId,
        sender_id: currentUserId,
        content: content.trim(),
        message_type: 'text',
        // Let server set created_at; we keep local client time for UI
      };
      
      console.log('Inserting message with data:', messageData);
      
      const added = await addDoc(collection(db, 'messages'), {
        ...messageData,
        created_at: new Date().toISOString(),
        read_by: [],
        delivered_to: [],
      });
      const data: any = { id: added.id, ...messageData, created_at: localCreatedAt, read_by: [], delivered_to: [] };

      if (error) {
        console.error('Supabase error inserting message:', error);
        throw error;
      }
      
      console.log('Message inserted successfully:', data);
      
      // Replace local queued message with server message
      setMessages(prev => {
        const next = prev.map(m => m.client_id === clientId ? { ...data, client_id: clientId, status: 'sent' } as Message : m);
        saveMessagesToCache(next);
        return next;
      });
      const updatedSnap = await getDocs(query(collection(db, 'messages'), where('chat_id', '==', chatId), orderBy('created_at', 'asc')));
      saveMessagesToCache(updatedSnap.docs.map(d => d.data()) as Message[]);
      // Remove from offline queue if present
      await removeFromQueueByClientId(clientId);
      
      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      // On error, ensure the optimistically added local message remains queued and enqueue it
      const queuedLocal = await getQueuedMessages();
      const alreadyQueued = queuedLocal.find(m => m.client_id === clientId);
      if (!alreadyQueued) {
        const toQueue = {
          chat_id: chatId,
          sender_id: currentUserId,
          content: content.trim(),
          message_type: 'text',
          created_at: localCreatedAt,
          id: clientId,
          client_id: clientId,
          is_read: false,
          read_by: {},
          delivered_to: {},
          status: 'queued' as const,
        } as Message;
        await enqueueMessage(toQueue);
      }
      // Ensure UI shows it as queued
      setMessages(prev => prev.map(m => m.client_id === clientId ? { ...m, status: 'queued' } : m));
      return { id: clientId } as any;
    }
  }, [chatId, currentUserId, otherParticipantId, enqueueMessage, getQueuedMessages, saveMessagesToCache]);

  // Send typing indicator
  const sendTypingIndicator = useCallback(async (isTyping: boolean) => {
    if (!chatId || chatId.trim() === '' || !currentUserId || currentUserId.trim() === '' || !otherParticipantId) {
      console.warn('chatId or currentUserId is empty, skipping typing indicator');
      return;
    }
    
    try {
      if (isTyping) {
        // Throttle typing indicators to avoid spam
        const now = Date.now();
        if (now - lastTypingRef.current < 1000) return;
        lastTypingRef.current = now;

        await supabase
          .from('typing_indicators')
          .upsert({
            chat_id: chatId,
            user_id: currentUserId,
            is_typing: true,
          });

        // Auto-stop typing after 3 seconds
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
          sendTypingIndicator(false);
        }, 3000);
      } else {
        await supabase
          .from('typing_indicators')
          .delete()
          .eq('chat_id', chatId)
          .eq('user_id', currentUserId);

        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
      }
    } catch (error) {
      console.error('Error sending typing indicator:', error);
    }
  }, [chatId, currentUserId, otherParticipantId]);

  // Mark message as read
  const markMessageAsRead = useCallback(async (messageId: string) => {
    if (!currentUserId || !chatId || !otherParticipantId) return;

    try {
      const ref = doc(db, 'messages', messageId);
      await updateDoc(ref, { read_by: arrayUnion(currentUserId) });
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }, [currentUserId, chatId, otherParticipantId]);

  // Mark message as delivered
  const markMessageAsDelivered = useCallback(async (messageId: string) => {
    if (!currentUserId || !chatId || !otherParticipantId) return;

    try {
      const ref = doc(db, 'messages', messageId);
      await updateDoc(ref, { delivered_to: arrayUnion(currentUserId) });
    } catch (error) {
      console.error('Error marking message as delivered:', error);
    }
  }, [currentUserId, chatId, otherParticipantId]);

  // Mark all messages in chat as read
  const markChatAsRead = useCallback(async () => {
    if (!chatId || !currentUserId || !otherParticipantId) return;

    try {
      // Get all unread messages from other user
      const qUnread = query(collection(db, 'messages'), where('chat_id', '==', chatId));
      const snap = await getDocs(qUnread);
      const toRead: string[] = [];
      snap.docs.forEach(d => {
        const m: any = d.data();
        if (m.sender_id !== currentUserId && (!Array.isArray(m.read_by) || !m.read_by.includes(currentUserId))) toRead.push(d.id);
      });
      for (const id of toRead) await markMessageAsRead(id);
    } catch (error) {
      console.error('Error marking chat as read:', error);
    }
  }, [chatId, currentUserId, otherParticipantId, markMessageAsRead]);

  // Update user presence
  const updatePresence = useCallback(async (isOnline: boolean) => {
    if (!currentUserId || currentUserId.trim() === '' || !chatId || !otherParticipantId) {
      console.warn('currentUserId is empty, skipping presence update');
      return;
    }
    
    try {
      const qUser = query(collection(db, 'user_profiles'), where('id', '==', currentUserId));
      const snap = await getDocs(qUser);
      const docId = snap.docs[0]?.id;
      if (docId) await updateDoc(doc(db, 'user_profiles', docId), { is_online: isOnline, last_seen: new Date().toISOString() });
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  }, [currentUserId, chatId, otherParticipantId]);

  // Setup real-time subscriptions
  useEffect(() => {
    if (!chatId || !currentUserId || !otherParticipantId) {
      return;
    }

    const unsubMessages = onSnapshot(
      query(collection(db, 'messages'), where('chat_id', '==', chatId), orderBy('created_at', 'asc')),
      (snapshot) => {
        snapshot.docChanges().forEach(change => {
          const msg = { id: change.doc.id, ...change.doc.data() } as unknown as Message;
          if (change.type === 'added') {
            setMessages(prev => {
              if (prev.some(m => m.id === msg.id)) return prev;
              const next = [...prev, msg];
              saveMessagesToCache(next);
              return next;
            });
            if (msg.sender_id !== currentUserId) {
              setTimeout(() => markMessageAsRead(msg.id), 1000);
              updateDoc(doc(db, 'messages', msg.id), { delivered_to: arrayUnion(currentUserId) }).catch(() => {});
            }
          } else if (change.type === 'modified') {
            setMessages(prev => {
              const next = prev.map(m => m.id === msg.id ? msg : m);
              saveMessagesToCache(next);
              return next;
            });
          }
        });
      }
    );

    // Typing indicators subscription
    const unsubTyping = onSnapshot(
      query(collection(db, 'typing_indicators'), where('chat_id', '==', chatId)),
      async (snapshot) => {
        snapshot.docChanges().forEach(async change => {
          const typingData: any = change.doc.data();
          if (typingData.user_id === currentUserId) return;
          const profileSnap = await getDocs(query(collection(db, 'user_profiles'), where('id', '==', typingData.user_id)));
          const username = profileSnap.docs[0]?.data()?.username || 'User';
          setTypingUsers(prev => {
            const filtered = prev.filter(u => u.user_id !== typingData.user_id);
            if (typingData.is_typing) {
              return [...filtered, { user_id: typingData.user_id, username, is_typing: true, updated_at: typingData.updated_at }];
            }
            return filtered;
          });
        });
      }
    );

    // User presence subscription
    const unsubPresence = onSnapshot(
      query(collection(db, 'user_profiles'), where('id', '==', otherParticipantId)),
      (snapshot) => {
        snapshot.forEach(docSnap => {
          const updatedProfile: any = docSnap.data();
          setOtherUserPresence({ user_id: updatedProfile.id, is_online: !!updatedProfile.is_online, last_seen: updatedProfile.last_seen || new Date().toISOString() });
        });
      }
    );

    channelsRef.current = [unsubMessages, unsubTyping, unsubPresence];

    // Cleanup function
    return () => {
      channelsRef.current.forEach(unsub => { if (typeof unsub === 'function') unsub(); });
      channelsRef.current = [];
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [chatId, currentUserId, otherParticipantId, markMessageAsRead]);

  // Load initial data
  useEffect(() => {
    loadMessages();
    loadUserPresence();
    loadUnreadCount();
    // Try flushing queued messages for this chat in the background
    (async () => {
      const queued = await getQueuedMessages();
      for (const q of queued.filter(q => q.chat_id === chatId)) {
        try {
          await supabase.from('messages').insert({
            chat_id: q.chat_id,
            sender_id: q.sender_id,
            content: q.content,
            message_type: q.message_type,
          });
          await removeFromQueueByClientId(q.client_id || q.id);
        } catch {}
      }
    })();
  }, [loadMessages, loadUserPresence, loadUnreadCount]);

  // ADDED: 1-second polling fallback to ensure near-real-time updates
  useEffect(() => {
    if (!chatId) return;
    const interval = setInterval(async () => {
      try {
        // Determine last known message timestamp
        const lastLocal = messages.length > 0
          ? messages[messages.length - 1].created_at
          : lastFetchedAtRef.current || '1970-01-01T00:00:00.000Z';

        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_id', chatId)
          .gt('created_at', lastLocal)
          .order('created_at', { ascending: true });

        if (!error && data && data.length > 0) {
          setMessages(prev => {
            const merged = [...prev];
            for (const msg of data as Message[]) {
              if (!merged.some(m => m.id === msg.id)) {
                merged.push(msg);
              }
            }
            saveMessagesToCache(merged);
            return merged;
          });
          lastFetchedAtRef.current = (data as Message[])[(data as Message[]).length - 1].created_at;
        }
      } catch {}
    }, 1000);
    return () => clearInterval(interval);
  }, [chatId, messages, saveMessagesToCache]);

  // ADDED: Periodic queue flush
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!chatId || !currentUserId) return;
      const queued = await getQueuedMessages();
      for (const q of queued.filter(q => q.chat_id === chatId)) {
        try {
          const { data, error } = await supabase.from('messages').insert({
            chat_id: q.chat_id,
            sender_id: q.sender_id,
            content: q.content,
            message_type: q.message_type,
          }).select().single();
          if (!error && data) {
            // Replace local queued message with server one
            setMessages(prev => prev.map(m => (m.client_id && (m.client_id === (q.client_id || q.id))) ? { ...data, client_id: m.client_id, status: 'sent' } as Message : m));
            await removeFromQueueByClientId(q.client_id || q.id);
            // Refresh cache
            const { data: fresh } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
            if (fresh) saveMessagesToCache(fresh as Message[]);
          }
        } catch {}
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [chatId, currentUserId, getQueuedMessages, removeFromQueueByClientId, saveMessagesToCache]);

  // Update presence on mount/unmount (web vs native)
  useEffect(() => {
    if (!chatId || !currentUserId || !otherParticipantId) {
      return;
    }

    updatePresence(true);

    if (Platform.OS === 'web' && typeof document !== 'undefined' && typeof window !== 'undefined') {
      const handleVisibilityChange = () => {
        updatePresence(!document.hidden);
      };

      const handleBeforeUnload = () => {
        updatePresence(false);
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        updatePresence(false);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    } else {
      const subscription = AppState.addEventListener('change', (state) => {
        updatePresence(state === 'active');
      });

      return () => {
        updatePresence(false);
        subscription.remove();
      };
    }
  }, [updatePresence, chatId, currentUserId, otherParticipantId]);

  // Clean up typing indicator on unmount
  useEffect(() => {
    return () => {
      if (chatId && currentUserId && otherParticipantId) {
        sendTypingIndicator(false);
      }
    };
  }, [sendTypingIndicator, chatId, currentUserId, otherParticipantId]);

  // Return early if parameters are invalid (after all hooks are declared)
  if (!chatId || !currentUserId || !otherParticipantId) {
    return {
      messages: [],
      typingUsers: [],
      otherUserPresence: null,
      loading: false,
      unreadCount: 0,
      sendMessage: async () => { throw new Error('Invalid parameters'); },
      sendTypingIndicator: async () => {},
      markMessageAsRead: async () => {},
      markMessageAsDelivered: async () => {},
      markChatAsRead: async () => {},
      updatePresence: async () => {},
    };
  }

  return {
    messages,
    typingUsers,
    otherUserPresence,
    unreadCount,
    loading,
    isOffline,
    sendMessage,
    sendTypingIndicator,
    markMessageAsRead,
    markMessageAsDelivered,
    markChatAsRead,
    updatePresence,
  };
}