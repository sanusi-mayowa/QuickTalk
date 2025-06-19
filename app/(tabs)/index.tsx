import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { RealtimeService } from '@/lib/realtime';
import { Chat, Message, User } from '@/types/chat';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GroupChatCreator from '@/components/GroupChatCreator';

interface ChatWithLastMessage extends Chat {
  last_message?: Message & { sender?: User };
  unread_count?: number;
}

export default function ChatsScreen() {
  const router = useRouter();
  const [chats, setChats] = useState<ChatWithLastMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [showGroupCreator, setShowGroupCreator] = useState(false);

  useEffect(() => {
    getCurrentUser();
    fetchChats();
    
    // Update user online status
    updateOnlineStatus(true);
    
    // Handle app state changes
    const handleAppStateChange = (nextAppState: string) => {
      updateOnlineStatus(nextAppState === 'active');
    };

    return () => {
      updateOnlineStatus(false);
      RealtimeService.unsubscribeAll();
    };
  }, []);

  const getCurrentUser = async () => {
    const userId = await AsyncStorage.getItem('userID');
    if (userId) {
      setCurrentUserId(userId);
    }
  };

  const updateOnlineStatus = async (isOnline: boolean) => {
    if (currentUserId) {
      await RealtimeService.updateUserOnlineStatus(currentUserId, isOnline);
    }
  };

  const fetchChats = async () => {
    try {
      const userId = await AsyncStorage.getItem('userID');
      if (!userId) return;

      // Fetch chats with last message and unread count
      const { data: chatsData, error } = await supabase
        .from('chat_participants')
        .select(`
          chat:chats (
            id,
            name,
            is_group,
            avatar_url,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', userId);

      if (error) throw error;

      const chatIds = chatsData?.map(item => item.chat.id) || [];
      
      // Fetch last messages for each chat
      const { data: messagesData } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users (
            id,
            display_name,
            email
          )
        `)
        .in('chat_id', chatIds)
        .order('created_at', { ascending: false });

      // Group messages by chat_id and get the latest one
      const lastMessages: { [key: string]: Message & { sender?: User } } = {};
      messagesData?.forEach(message => {
        if (!lastMessages[message.chat_id]) {
          lastMessages[message.chat_id] = message;
        }
      });

      // Combine chats with last messages
      const chatsWithMessages: ChatWithLastMessage[] = chatsData?.map(item => ({
        ...item.chat,
        last_message: lastMessages[item.chat.id],
        unread_count: 0, // TODO: Implement unread count
      })) || [];

      // Sort by last message time
      chatsWithMessages.sort((a, b) => {
        const aTime = a.last_message?.created_at || a.created_at;
        const bTime = b.last_message?.created_at || b.created_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      setChats(chatsWithMessages);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchChats();
  };

  const handleGroupCreated = (chatId: string) => {
    fetchChats(); // Refresh the chat list
    router.push(`/chat/${chatId}`);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const renderChatItem = ({ item }: { item: ChatWithLastMessage }) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() => router.push(`/chat/${item.id}`)}
    >
      <View style={styles.avatarContainer}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.defaultAvatar]}>
            {item.is_group ? (
              <Feather name="users" size={20} color="#FFFFFF" />
            ) : (
              <Text style={styles.avatarText}>
                {item.name ? item.name.charAt(0).toUpperCase() : 'C'}
              </Text>
            )}
          </View>
        )}
        {item.unread_count && item.unread_count > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>
              {item.unread_count > 99 ? '99+' : item.unread_count}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatName} numberOfLines={1}>
            {item.name || 'Unknown Chat'}
          </Text>
          <Text style={styles.chatTime}>
            {item.last_message
              ? formatTime(item.last_message.created_at)
              : formatTime(item.created_at)}
          </Text>
        </View>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.last_message?.content || 'No messages yet'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>QuickTalk</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton}>
            <Feather name="search" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Feather name="more-vertical" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Chat List */}
      <FlatList
        data={chats}
        renderItem={renderChatItem}
        keyExtractor={(item) => item.id}
        style={styles.chatList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Floating Action Buttons */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={styles.fabSecondary}
          onPress={() => setShowGroupCreator(true)}
        >
          <Feather name="users" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/new-chat')}
        >
          <Feather name="plus" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Group Creator Modal */}
      <GroupChatCreator
        visible={showGroupCreator}
        onClose={() => setShowGroupCreator(false)}
        onGroupCreated={handleGroupCreated}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#3A805B'
  },
  headerTitle: {
    fontSize: 25,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  headerButton: {
    padding: 4,
  },
  chatList: {
    flex: 1,
  },
  chatItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  defaultAvatar: {
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#25D366',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  chatTime: {
    fontSize: 12,
    color: '#8E8E93',
  },
  lastMessage: {
    fontSize: 14,
    color: '#8E8E93',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    alignItems: 'flex-end',
  },
  fabSecondary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3A805B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3A805B',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
});