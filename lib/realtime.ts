import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export class RealtimeService {
  private static channels: Map<string, RealtimeChannel> = new Map();

  static subscribeToChat(
    chatId: string,
    onNewMessage: (message: any) => void,
    onMessageUpdate: (message: any) => void,
    onMessageDelete: (messageId: string) => void
  ): RealtimeChannel {
    const channelName = `chat-${chatId}`;
    
    // Remove existing channel if it exists
    if (this.channels.has(channelName)) {
      this.channels.get(channelName)?.unsubscribe();
      this.channels.delete(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          onNewMessage(payload.new);
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
          onMessageUpdate(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          onMessageDelete(payload.old.id);
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  static subscribeToUserStatus(
    userId: string,
    onStatusChange: (user: any) => void
  ): RealtimeChannel {
    const channelName = `user-status-${userId}`;
    
    if (this.channels.has(channelName)) {
      this.channels.get(channelName)?.unsubscribe();
      this.channels.delete(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          onStatusChange(payload.new);
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  static subscribeToStatusUpdates(
    onNewStatus: (status: any) => void,
    onStatusUpdate: (status: any) => void,
    onStatusDelete: (statusId: string) => void
  ): RealtimeChannel {
    const channelName = 'status-updates';
    
    if (this.channels.has(channelName)) {
      this.channels.get(channelName)?.unsubscribe();
      this.channels.delete(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'status_updates',
        },
        (payload) => {
          onNewStatus(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'status_updates',
        },
        (payload) => {
          onStatusUpdate(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'status_updates',
        },
        (payload) => {
          onStatusDelete(payload.old.id);
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  static subscribeToTyping(
    chatId: string,
    onTypingStart: (userId: string) => void,
    onTypingStop: (userId: string) => void
  ): RealtimeChannel {
    const channelName = `typing-${chatId}`;
    
    if (this.channels.has(channelName)) {
      this.channels.get(channelName)?.unsubscribe();
      this.channels.delete(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'typing_start' }, (payload) => {
        onTypingStart(payload.payload.userId);
      })
      .on('broadcast', { event: 'typing_stop' }, (payload) => {
        onTypingStop(payload.payload.userId);
      })
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  static sendTypingIndicator(chatId: string, userId: string, isTyping: boolean) {
    const channelName = `typing-${chatId}`;
    const channel = this.channels.get(channelName);
    
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: isTyping ? 'typing_start' : 'typing_stop',
        payload: { userId }
      });
    }
  }

  static unsubscribeFromChannel(channelName: string) {
    const channel = this.channels.get(channelName);
    if (channel) {
      channel.unsubscribe();
      this.channels.delete(channelName);
    }
  }

  static unsubscribeAll() {
    this.channels.forEach((channel) => {
      channel.unsubscribe();
    });
    this.channels.clear();
  }

  static async updateUserOnlineStatus(userId: string, isOnline: boolean) {
    await supabase
      .from('users')
      .update({
        is_online: isOnline,
        last_seen: new Date().toISOString(),
      })
      .eq('id', userId);
  }
}