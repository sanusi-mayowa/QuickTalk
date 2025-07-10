import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Pressable,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { Feather } from '@expo/vector-icons';
import { RealtimeChannel } from '@supabase/supabase-js';
// ADDED: Import for typing indicators
import { TypingUser } from '@/hooks/useRealtimeChat';

interface Chat {
  id: string;
  participant: {
    id: string;
    username: string;
    about: string;
    profile_picture_url: string | null;
    phone: string;
    is_online?: boolean;
    last_seen?: string;
  };
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  hasUnreadMessages?: boolean;
  // ADDED: Contact information for display names
  contactInfo?: {
    first_name: string;
    last_name?: string;
    is_saved: boolean;
  };
}

interface UserProfile {
  id: string;
  username: string;
  about: string;
  profile_picture_url: string | null;
  phone: string;
  email: string;
}

export default function ChatsScreen() {
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null);
  // ADDED: State for tracking typing users across all chats
  const [typingUsers, setTypingUsers] = useState<Record<string, TypingUser[]>>({});
  // ADDED: State for tracking message subscriptions per chat
  const [messageChannels, setMessageChannels] = useState<Record<string, RealtimeChannel>>({});

  // Load chats when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadCurrentUser();
      loadChats();
      setupRealtimeSubscription();
      
      return () => {
        // Cleanup subscription when screen loses focus
        if (realtimeChannel) {
          supabase.removeChannel(realtimeChannel);
          setRealtimeChannel(null);
        }
        // ADDED: Cleanup message channels
        Object.values(messageChannels).forEach(channel => {
          supabase.removeChannel(channel);
        });
        setMessageChannels({});
      };
    }, [])
  );

  const loadCurrentUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('auth_user_id', session.user.id)
        .single();

      if (profile) {
        setCurrentUser(profile);
      }
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  // ADDED: Function to setup message subscriptions for each chat
  const setupMessageSubscriptions = useCallback(async (chatList: Chat[]) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Get current user profile
      let userProfile = currentUser;
      if (!userProfile) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('auth_user_id', session.user.id)
          .single();
        userProfile = profile;
        if (!profile) return;
      }

      // Clean up existing message channels
      Object.values(messageChannels).forEach(channel => {
        supabase.removeChannel(channel);
      });

      const newMessageChannels: Record<string, RealtimeChannel> = {};

      // Create message subscription for each chat
      chatList.forEach(chat => {
        const messageChannel = supabase
          .channel(`chat-messages-${chat.id}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `chat_id=eq.${chat.id}`,
            },
            async (payload) => {
              // ADDED: Handle new message in real-time
              const newMessage = payload.new;
              console.log('New message received:', newMessage);
              
              // Update chat list with new message
              setChats(prevChats => {
                return prevChats.map(prevChat => {
                  if (prevChat.id === chat.id) {
                    return {
                      ...prevChat,
                      lastMessage: newMessage.content,
                      lastMessageTime: formatMessageTime(newMessage.created_at),
                      // ADDED: Update unread count if message is from other user
                      unreadCount: newMessage.sender_id !== userProfile.id 
                        ? prevChat.unreadCount + 1 
                        : prevChat.unreadCount,
                      hasUnreadMessages: newMessage.sender_id !== userProfile.id 
                        ? true 
                        : prevChat.hasUnreadMessages,
                    };
                  }
                  return prevChat;
                });
              });
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'messages',
              filter: `chat_id=eq.${chat.id}`,
            },
            async (payload) => {
              // ADDED: Handle message updates (like read receipts)
              const updatedMessage = payload.new;
              
              // If message was marked as read by current user, update unread count
              if (updatedMessage.read_by && updatedMessage.read_by[userProfile.id]) {
                setChats(prevChats => {
                  return prevChats.map(prevChat => {
                    if (prevChat.id === chat.id) {
                      // Recalculate unread count
                      loadUnreadCountForChat(chat.id, userProfile.id).then(count => {
                        setChats(currentChats => 
                          currentChats.map(c => 
                            c.id === chat.id 
                              ? { ...c, unreadCount: count, hasUnreadMessages: count > 0 }
                              : c
                          )
                        );
                      });
                    }
                    return prevChat;
                  });
                });
              }
            }
          )
          .subscribe();

        newMessageChannels[chat.id] = messageChannel;
      });

      setMessageChannels(newMessageChannels);
    } catch (error) {
      console.error('Error setting up message subscriptions:', error);
    }
  }, [currentUser, messageChannels]);

  // ADDED: Function to load unread count for a specific chat
  const loadUnreadCountForChat = async (chatId: string, userId: string): Promise<number> => {
    try {
      const { data, error } = await supabase
        .rpc('get_unread_count', {
          p_chat_id: chatId,
          p_user_id: userId,
        });

      if (error) throw error;
      return data || 0;
    } catch (error) {
      console.error('Error loading unread count:', error);
      return 0;
    }
  };
  const setupRealtimeSubscription = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // MODIFIED: Get current user profile if not available
      let userProfile = currentUser;
      if (!userProfile) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('auth_user_id', session.user.id)
          .single();
        userProfile = profile;
        if (!profile) return;
      }

      // Remove existing subscription
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }

      // Create new subscription for chats
      const channel = supabase
        .channel('chats-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chats',
            filter: `or(participant_1.eq.${userProfile.id},participant_2.eq.${userProfile.id})`,
          },
          (payload) => {
            // ADDED: Comment for chat updates
            // Reload chats when there's any change (new chat created, updated, etc.)
            loadChats();
          }
        )
        // ADDED: Typing indicators subscription for all chats
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'typing_indicators',
          },
          async (payload) => {
            // ADDED: Handle typing indicators in real-time
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const typingData = payload.new;
              if (typingData.user_id !== userProfile.id && typingData.is_typing) {
                // Get username for typing indicator
                const { data: userProfileData } = await supabase
                  .from('user_profiles')
                  .select('username')
                  .eq('id', typingData.user_id)
                  .single();

                if (userProfileData) {
                  setTypingUsers(prev => ({
                    ...prev,
                    [typingData.chat_id]: [{
                      user_id: typingData.user_id,
                      username: userProfileData.username,
                      is_typing: true,
                      updated_at: typingData.updated_at,
                    }]
                  }));
                }
              }
            } else if (payload.eventType === 'DELETE') {
              const deletedData = payload.old;
              // ADDED: Remove typing indicator when user stops typing
              setTypingUsers(prev => {
                const updated = { ...prev };
                delete updated[deletedData.chat_id];
                return updated;
              });
            }
          }
        )
        .subscribe();

      setRealtimeChannel(channel);
    } catch (error) {
      console.error('Error setting up realtime subscription:', error);
    }
  };

  // MODIFIED: Setup realtime subscription when currentUser is loaded
  useEffect(() => {
    setupRealtimeSubscription();
  }, [currentUser]);

  // ADDED: Auto-cleanup typing indicators after 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTypingUsers(prev => {
        const now = new Date().getTime();
        const updated = { ...prev };
        let hasChanges = false;

        Object.keys(updated).forEach(chatId => {
          const typingList = updated[chatId];
          const filtered = typingList.filter(user => {
            const userTime = new Date(user.updated_at).getTime();
            return now - userTime < 5000; // Remove if older than 5 seconds
          });

          if (filtered.length !== typingList.length) {
            hasChanges = true;
            if (filtered.length === 0) {
              delete updated[chatId];
            } else {
              updated[chatId] = filtered;
            }
          }
        });

        return hasChanges ? updated : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const loadChats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Get current user's profile
      const { data: currentUserProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', session.user.id)
        .single();

      if (!currentUserProfile) return;

      // Load chats with participant details and last message
      const { data: chatsData, error } = await supabase
        .from('chats')
        .select(`
          id,
          participant_1,
          participant_2,
          created_at,
          updated_at,
          last_message_id,
          messages:last_message_id(
            id,
            content,
            created_at,
            sender_id
          )
        `)
        .or(`participant_1.eq.${currentUserProfile.id},participant_2.eq.${currentUserProfile.id}`)
        .order('updated_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Transform chats data to include participant info
      const transformedChats: Chat[] = [];

      for (const chat of chatsData || []) {
        // Determine the other participant
        const otherParticipantId = chat.participant_1 === currentUserProfile.id 
          ? chat.participant_2 
          : chat.participant_1;

        // Get participant details
        const { data: participantData } = await supabase
          .from('user_profiles')
          .select('id, username, about, profile_picture_url, phone, is_online, last_seen')
          .eq('id', otherParticipantId)
          .single();

        if (participantData) {
          // ADDED: Load contact information for display names
          const { data: contactData } = await supabase
            .from('contacts')
            .select('first_name, last_name')
            .eq('owner_id', currentUserProfile.id)
            .eq('contact_user_id', otherParticipantId)
            .single();

          // Get unread count for this chat
          let unreadCount = 0;
          try {
            const { data: unreadData } = await supabase
              .rpc('get_unread_count', {
                p_chat_id: chat.id,
                p_user_id: currentUserProfile.id,
              });
            unreadCount = unreadData || 0;
          } catch (error) {
            console.log('Error getting unread count:', error);
            // Fallback: count unread messages manually
            const { data: unreadMessages } = await supabase
              .from('messages')
              .select('id')
              .eq('chat_id', chat.id)
              .neq('sender_id', currentUserProfile.id)
              .eq('is_read', false);
            unreadCount = unreadMessages?.length || 0;
          }

          const lastMessage = chat.messages;
          const transformedChat: Chat = {
            id: chat.id,
            participant: participantData,
            // ADDED: Include contact information
            contactInfo: contactData ? {
              first_name: contactData.first_name,
              last_name: contactData.last_name,
              is_saved: true,
            } : {
              first_name: '',
              last_name: '',
              is_saved: false,
            },
            lastMessage: lastMessage?.content || 'No messages yet',
            lastMessageTime: lastMessage?.created_at 
              ? formatMessageTime(lastMessage.created_at)
              : formatMessageTime(chat.created_at),
            unreadCount: unreadCount,
            hasUnreadMessages: unreadCount > 0,
          };
          transformedChats.push(transformedChat);
        }
      }

      setChats(transformedChats);
      // ADDED: Setup message subscriptions for all chats
      setupMessageSubscriptions(transformedChats);
    } catch (error: any) {
      console.error('Error loading chats:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load chats',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} min ago`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      if (days === 1) {
        return 'Yesterday';
      } else if (days < 7) {
        return `${days} days ago`;
      } else {
        return date.toLocaleDateString();
      }
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadChats();
  };

  const handleNewMessage = () => {
    router.push('/select-contact');
  };

  const handleChatPress = (chat: Chat) => {
    router.push(`/chat/${chat.id}`);
  };

  const toggleMenu = () => setMenuVisible(!menuVisible);
  const toggleSearch = () => setShowSearchBar(!showSearchBar);

  const handleMenuItemPress = (path: string) => {
    setMenuVisible(false);
    router.push(path);
  };

  // ADDED: Function to get display name for chat
  const getDisplayName = (chat: Chat) => {
    if (chat.contactInfo?.is_saved && chat.contactInfo.first_name) {
      return `${chat.contactInfo.first_name}${chat.contactInfo.last_name ? ` ${chat.contactInfo.last_name}` : ''}`;
    }
    return chat.participant.phone;
  };
  const filteredChats = chats.filter(chat =>
    getDisplayName(chat).toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.participant.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderChatItem = ({ item }: { item: Chat }) => (
    <TouchableOpacity style={styles.chatItem} onPress={() => handleChatPress(item)}>
      <View style={styles.avatarContainer}>
        {item.participant.profile_picture_url ? (
          <Image source={{ uri: item.participant.profile_picture_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Feather name="user" size={24} color="#666" />
          </View>
        )}
        {item.participant.is_online && <View style={styles.onlineIndicator} />}
      </View>

      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          {/* MODIFIED: Show contact name or phone number */}
          <Text style={styles.username}>{getDisplayName(item)}</Text>
          <View style={styles.chatMeta}>
            {item.hasUnreadMessages && <View style={styles.unreadDot} />}
            <Text style={styles.timestamp}>{item.lastMessageTime}</Text>
          </View>
        </View>
        
        {/* ADDED: Show typing indicator if user is typing in this chat */}
        {typingUsers[item.id] && typingUsers[item.id].length > 0 ? (
          <Text style={styles.typingIndicator}>
            {typingUsers[item.id][0].username} is typing...
          </Text>
        ) : (
          <View style={styles.messageRow}>
            <Text 
              style={[
                styles.lastMessage,
                item.hasUnreadMessages && styles.unreadMessage
              ]} 
              numberOfLines={1}
            >
              {item.lastMessage}
            </Text>
            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCount}>
                  {item.unreadCount > 99 ? '99+' : item.unreadCount}
                </Text>
              </View>
            )}
          </View>
        )}
        
        {/* REMOVED: Last seen display from tabs screen */}
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name='message-circle' size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Chats Yet</Text>
      <Text style={styles.emptySubtitle}>
        Start a conversation by tapping the message button below
      </Text>
    </View>
  );

  // Cleanup subscription on unmount
  useEffect(() => {
    return () => {
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
      // ADDED: Cleanup message channels on unmount
      Object.values(messageChannels).forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  }, [realtimeChannel, messageChannels]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3A805B" />
        <Text style={styles.loadingText}>Loading chats...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>QuickTalk</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerButton} onPress={toggleSearch}>
            <Feather name="search" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={toggleMenu}>
            <Feather name="more-vertical" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Dropdown Menu */}
      {menuVisible && (
        <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menu}>
            <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuItemPress("/linked-devices")}>
              <Text style={styles.menuItemText}>Linked Devices</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuItemPress("/new-group")}>
              <Text style={styles.menuItemText}>New Group</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuItemPress("/settings")}>
              <Text style={styles.menuItemText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      )}

      {/* Search Bar */}
      {showSearchBar && (
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Feather name='search' size={20} color="#666" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search conversations..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#999"
            />
          </View>
        </View>
      )}

      {/* Chat List */}
      <FlatList
        data={filteredChats}
        renderItem={renderChatItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3A805B']}
            tintColor="#3A805B"
          />
        }
        ListEmptyComponent={renderEmptyState}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={handleNewMessage}>
        <Feather name='message-circle' size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', position: 'relative' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#3A805B',
  },
  title: {
    fontSize: 25,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 4,
  },
  searchContainer: {
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  listContainer: { paddingVertical: 8 },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatarContainer: { position: 'relative', marginRight: 16 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#fff',
  },
  chatContent: { flex: 1 },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    gap: 6,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3A805B',
  },
  username: { fontSize: 16, fontWeight: '600', color: '#333' },
  timestamp: { fontSize: 12, color: '#999' },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lastMessage: { flex: 1, fontSize: 14, color: '#666' },
  unreadMessage: {
    fontWeight: '600',
    color: '#333',
  },
  unreadBadge: {
    backgroundColor: '#3A805B',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 'auto',
  },
  unreadCount: { 
    color: '#fff', 
    fontSize: 11, 
    fontWeight: '700',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3A805B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  menuOverlay: {
    position: 'absolute',
    top: 80,
    right: 0,
    left: 0,
    bottom: 0,
    zIndex: 10,
  },
  menu: {
    position: 'absolute',
    top: 0,
    right: 10,
    backgroundColor: '#fff',
    borderRadius: 6,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    width: 160,
    zIndex: 11,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  menuItemText: {
    fontSize: 16,
  },
  // ADDED: Styling for typing indicator
  typingIndicator: {
    fontSize: 14,
    color: '#3A805B',
    fontStyle: 'italic',
    marginBottom: 2,
  },
});