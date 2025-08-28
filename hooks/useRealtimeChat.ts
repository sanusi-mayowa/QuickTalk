import { useState, useEffect, useCallback, useRef } from 'react';
import { auth, db } from '@/lib/firebase';
import { addDoc, arrayUnion, collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
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
  // Firestore persists arrays; normalize to arrays in state
  read_by: string[] | Record<string, string>;
  delivered_to?: string[] | Record<string, string>;
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
  const usernameCacheRef = useRef<Record<string, string>>({});

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
    if (!chatId) {
      setLoading(false);
      return;
    }

    try {
      const qMsg = query(collection(db, 'messages'), where('chat_id', '==', chatId), orderBy('created_at', 'asc'));
      const snap = await getDocs(qMsg);
      const serverMessages = snap.docs.map(d => {
        const data: any = d.data();
        const created = (data.created_at && typeof (data.created_at as any).toDate === 'function')
          ? (data.created_at as any).toDate().toISOString()
          : (data.created_at || new Date().toISOString());
        return {
          id: d.id,
          ...data,
          created_at: created,
        } as Message;
      });
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
  }, [chatId, saveMessagesToCache, loadMessagesFromCache, getQueuedMessages]);

  // Load other user's presence via direct document ref; guard missing docs
  const loadUserPresence = useCallback(async () => {
    if (!otherParticipantId || otherParticipantId.trim() === '') {
      return;
    }
    try {
      const otherRef = doc(db, 'user_profiles', otherParticipantId);
      const otherSnap = await getDoc(otherRef);
      if (!otherSnap.exists()) {
        setOtherUserPresence(null);
        return;
      }
      const data: any = otherSnap.data();
      const normalizedLastSeen = (data.last_seen && typeof (data.last_seen as any).toDate === 'function')
        ? (data.last_seen as any).toDate().toISOString()
        : (data.last_seen || new Date().toISOString());
      setOtherUserPresence({ user_id: otherParticipantId, is_online: !!data.is_online, last_seen: normalizedLastSeen });
      // Seed username cache for typing indicators
      if (data && (data.username || data.phone)) {
        usernameCacheRef.current[otherParticipantId] = data.username || data.phone;
      }
    } catch (error) {
      console.error('Error loading user presence:', error);
    }
  }, [otherParticipantId]);

  // Load unread count
  const loadUnreadCount = useCallback(async () => {
    if (!chatId || chatId.trim() === '' || !currentUserId || currentUserId.trim() === '' || !otherParticipantId) {
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
        created_at: serverTimestamp(),
        read_by: [],
        delivered_to: [],
      });
      const data: any = { id: added.id, ...messageData, created_at: localCreatedAt, read_by: [], delivered_to: [] };
      
      console.log('Message inserted successfully:', data);
      
      // Replace local queued message with server message and mark as sent
      setMessages(prev => {
        const next = prev.map(m => m.client_id === clientId ? { ...data, client_id: clientId, status: 'sent' } as Message : m);
        saveMessagesToCache(next);
        return next;
      });
      const updatedSnap = await getDocs(query(collection(db, 'messages'), where('chat_id', '==', chatId), orderBy('created_at', 'asc')));
      const fresh = updatedSnap.docs.map(d => {
        const dataAny: any = d.data();
        const created = (dataAny.created_at && typeof (dataAny.created_at as any).toDate === 'function')
          ? (dataAny.created_at as any).toDate().toISOString()
          : (dataAny.created_at || new Date().toISOString());
        return { id: d.id, ...dataAny, created_at: created } as Message;
      });
      saveMessagesToCache(fresh);
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
      return;
    }
    
    try {
      // Throttle typing indicators to avoid spam
      const now = Date.now();
      if (isTyping) {
        if (now - lastTypingRef.current < 1000) return;
        lastTypingRef.current = now;
      }

      const typingDocId = `${chatId}_${currentUserId}`;
      if (isTyping) {
        await setDoc(doc(db, 'typing_indicators', typingDocId), {
          chat_id: chatId,
          user_id: currentUserId,
          is_typing: true,
          updated_at: serverTimestamp(),
        }, { merge: true });

        // Auto-stop typing after 3 seconds
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          sendTypingIndicator(false);
        }, 3000);
      } else {
        await setDoc(doc(db, 'typing_indicators', typingDocId), {
          chat_id: chatId,
          user_id: currentUserId,
          is_typing: false,
          updated_at: serverTimestamp(),
        }, { merge: true });

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

  // Update user presence using direct doc and server timestamps
  const updatePresence = useCallback(async (isOnline: boolean) => {
    if (!currentUserId || currentUserId.trim() === '') {
      return;
    }
    try {
      const meRef = doc(db, 'user_profiles', currentUserId);
      await setDoc(meRef, { is_online: isOnline, last_seen: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  }, [currentUserId]);

  // Setup real-time subscriptions
  useEffect(() => {
    if (!chatId) { return; }

    const unsubMessages = onSnapshot(
      query(collection(db, 'messages'), where('chat_id', '==', chatId), orderBy('created_at', 'asc')),
      (snapshot) => {
        snapshot.docChanges().forEach(change => {
          const raw: any = change.doc.data();
          const created = (raw.created_at && typeof (raw.created_at as any).toDate === 'function')
            ? (raw.created_at as any).toDate().toISOString()
            : (raw.created_at || new Date().toISOString());
          const msg = { id: change.doc.id, ...raw, created_at: created } as unknown as Message;
          if (change.type === 'added') {
            setMessages(prev => {
              if (prev.some(m => m.id === msg.id)) return prev;
              const next = [...prev, msg];
              saveMessagesToCache(next);
              return next;
            });
            if (currentUserId && otherParticipantId && msg.sender_id !== currentUserId) {
              // Mark delivered immediately
              updateDoc(doc(db, 'messages', msg.id), { delivered_to: arrayUnion(currentUserId) }).catch(() => {});
              // Mark read after short delay (active chat behavior)
              setTimeout(() => markMessageAsRead(msg.id), 800);
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

    // Typing indicators subscription using direct username from profile doc
    const unsubTyping = onSnapshot(
      query(collection(db, 'typing_indicators'), where('chat_id', '==', chatId)),
      async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          const typingData: any = change.doc.data();
          if (typingData.user_id === currentUserId) continue;
          let username = usernameCacheRef.current[typingData.user_id];
          if (!username) {
            try {
              const profileDoc = await getDoc(doc(db, 'user_profiles', typingData.user_id));
              if (profileDoc.exists()) {
                const pdata: any = profileDoc.data();
                username = pdata.username || pdata.phone || 'User';
                usernameCacheRef.current[typingData.user_id] = username;
              }
            } catch {}
          }
          if (!username) username = 'User';
          setTypingUsers(prev => {
            const filtered = prev.filter(u => u.user_id !== typingData.user_id);
            if (typingData.is_typing) {
              const updatedAt = (typingData.updated_at && typeof (typingData.updated_at as any).toDate === 'function')
                ? (typingData.updated_at as any).toDate().toISOString()
                : (typingData.updated_at || new Date().toISOString());
              return [...filtered, { user_id: typingData.user_id, username, is_typing: true, updated_at: updatedAt }];
            }
            return filtered;
          });
        }
      }
    );

    // User presence subscription (guard otherParticipantId)
    let unsubPresence: (() => void) | undefined;
    if (otherParticipantId && otherParticipantId.trim() !== '') {
      unsubPresence = onSnapshot(
        doc(db, 'user_profiles', otherParticipantId),
        (docSnap) => {
          const updatedProfile: any = docSnap.exists() ? docSnap.data() : null;
          if (updatedProfile) {
            const normalizedLastSeen = (updatedProfile.last_seen && typeof (updatedProfile.last_seen as any).toDate === 'function')
              ? (updatedProfile.last_seen as any).toDate().toISOString()
              : (updatedProfile.last_seen || new Date().toISOString());
            setOtherUserPresence({ user_id: otherParticipantId, is_online: !!updatedProfile.is_online, last_seen: normalizedLastSeen });
          }
        }
      );
    }

    channelsRef.current = [unsubMessages, unsubTyping, unsubPresence as any].filter(Boolean) as any;

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
    if (currentUserId && otherParticipantId) {
      loadUserPresence();
      loadUnreadCount();
    }
    // Try flushing queued messages for this chat in the background
    (async () => {
      const queued = await getQueuedMessages();
      for (const q of queued.filter(q => q.chat_id === chatId)) {
        try {
          await addDoc(collection(db, 'messages'), {
            chat_id: q.chat_id,
            sender_id: q.sender_id,
            content: q.content,
            message_type: q.message_type,
            created_at: serverTimestamp(),
            read_by: [],
            delivered_to: [],
          });
          await removeFromQueueByClientId(q.client_id || q.id);
        } catch {}
      }
    })();
  }, [loadMessages, loadUserPresence, loadUnreadCount]);

  // ADDED: 1-second polling fallback to ensure near-real-time updates
  // Removed Supabase polling fallback

  // ADDED: Periodic queue flush
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!chatId || !currentUserId) return;
      const queued = await getQueuedMessages();
      for (const q of queued.filter(q => q.chat_id === chatId)) {
        try {
          const added = await addDoc(collection(db, 'messages'), {
            chat_id: q.chat_id,
            sender_id: q.sender_id,
            content: q.content,
            message_type: q.message_type,
            created_at: serverTimestamp(),
            read_by: [],
            delivered_to: [],
          });
          setMessages(prev => prev.map(m => (m.client_id && (m.client_id === (q.client_id || q.id))) ? { ...m, id: added.id, status: 'sent' } as Message : m));
          await removeFromQueueByClientId(q.client_id || q.id);
          // Refresh cache
          const snap = await getDocs(query(collection(db, 'messages'), where('chat_id', '==', chatId), orderBy('created_at', 'asc')));
          const fresh = snap.docs.map(d => {
            const data: any = d.data();
            const created = (data.created_at && typeof (data.created_at as any).toDate === 'function')
              ? (data.created_at as any).toDate().toISOString()
              : (data.created_at || new Date().toISOString());
            return { id: d.id, ...data, created_at: created } as Message;
          });
          if (fresh) saveMessagesToCache(fresh);
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
  if (!chatId) {
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