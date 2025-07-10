import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface Message {
  id: string;
  content: string;
  sender_id: string;
  chat_id: string;
  created_at: string;
  is_read: boolean;
  message_type: 'text' | 'image' | 'file';
  read_by: Record<string, string>;
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

  const channelsRef = useRef<RealtimeChannel[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingRef = useRef<number>(0);

  // Load initial messages
  const loadMessages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  // Load other user's presence
  const loadUserPresence = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, is_online, last_seen')
        .eq('id', otherParticipantId)
        .single();

      if (error) throw error;
      
      if (data) {
        setOtherUserPresence({
          user_id: data.id,
          is_online: data.is_online || false,
          last_seen: data.last_seen || new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error loading user presence:', error);
    }
  }, [otherParticipantId]);

  // Load unread count
  const loadUnreadCount = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_unread_count', {
          p_chat_id: chatId,
          p_user_id: currentUserId,
        });

      if (error) throw error;
      setUnreadCount(data || 0);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  }, [chatId, currentUserId]);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: currentUserId,
          content: content.trim(),
          message_type: 'text',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }, [chatId, currentUserId]);

  // Send typing indicator
  const sendTypingIndicator = useCallback(async (isTyping: boolean) => {
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
  }, [chatId, currentUserId]);

  // Mark message as read
  const markMessageAsRead = useCallback(async (messageId: string) => {
    try {
      await supabase.rpc('mark_message_read', {
        p_message_id: messageId,
        p_user_id: currentUserId,
      });
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }, [currentUserId]);

  // Mark all messages in chat as read
  const markChatAsRead = useCallback(async () => {
    try {
      // Get all unread messages from other user
      const { data: unreadMessages } = await supabase
        .from('messages')
        .select('id')
        .eq('chat_id', chatId)
        .neq('sender_id', currentUserId)
        .not('read_by', 'cs', `{"${currentUserId}": ""}`);

      if (unreadMessages && unreadMessages.length > 0) {
        // Mark all as read
        for (const message of unreadMessages) {
          await markMessageAsRead(message.id);
        }
      }
    } catch (error) {
      console.error('Error marking chat as read:', error);
    }
  }, [chatId, currentUserId, markMessageAsRead]);

  // Update user presence
  const updatePresence = useCallback(async (isOnline: boolean) => {
    try {
      await supabase
        .from('user_profiles')
        .update({
          is_online: isOnline,
          last_seen: new Date().toISOString(),
        })
        .eq('id', currentUserId);
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  }, [currentUserId]);

  // Setup real-time subscriptions
  useEffect(() => {
    // Messages subscription
    const messagesChannel = supabase
      .channel(`chat:${chatId}:messages`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages(prev => [...prev, newMessage]);
          
          // Auto-mark as read if message is from other user and chat is active
          if (newMessage.sender_id !== currentUserId) {
            setTimeout(() => markMessageAsRead(newMessage.id), 1000);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const updatedMessage = payload.new as Message;
          setMessages(prev => 
            prev.map(msg => 
              msg.id === updatedMessage.id ? updatedMessage : msg
            )
          );
        }
      )
      .subscribe();

    // Typing indicators subscription
    const typingChannel = supabase
      .channel(`chat:${chatId}:typing`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `chat_id=eq.${chatId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const typingData = payload.new;
            if (typingData.user_id !== currentUserId) {
              // Get username for typing indicator
              const { data: userProfile } = await supabase
                .from('user_profiles')
                .select('username')
                .eq('id', typingData.user_id)
                .single();

              setTypingUsers(prev => {
                const filtered = prev.filter(u => u.user_id !== typingData.user_id);
                if (typingData.is_typing) {
                  return [...filtered, {
                    user_id: typingData.user_id,
                    username: userProfile?.username || 'User',
                    is_typing: true,
                    updated_at: typingData.updated_at,
                  }];
                }
                return filtered;
              });
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedData = payload.old;
            setTypingUsers(prev => 
              prev.filter(u => u.user_id !== deletedData.user_id)
            );
          }
        }
      )
      .subscribe();

    // User presence subscription
    const presenceChannel = supabase
      .channel(`user:${otherParticipantId}:presence`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${otherParticipantId}`,
        },
        (payload) => {
          const updatedProfile = payload.new;
          setOtherUserPresence({
            user_id: updatedProfile.id,
            is_online: updatedProfile.is_online || false,
            last_seen: updatedProfile.last_seen || new Date().toISOString(),
          });
        }
      )
      .subscribe();

    channelsRef.current = [messagesChannel, typingChannel, presenceChannel];

    // Cleanup function
    return () => {
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel);
      });
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
  }, [loadMessages, loadUserPresence, loadUnreadCount]);

  // Update presence on mount/unmount
  useEffect(() => {
    updatePresence(true);

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
  }, [updatePresence]);

  // Clean up typing indicator on unmount
  useEffect(() => {
    return () => {
      sendTypingIndicator(false);
    };
  }, [sendTypingIndicator]);

  return {
    messages,
    typingUsers,
    otherUserPresence,
    unreadCount,
    loading,
    sendMessage,
    sendTypingIndicator,
    markMessageAsRead,
    markChatAsRead,
    updatePresence,
  };
}