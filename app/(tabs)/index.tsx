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

  // Load chats when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadCurrentUser();
      loadChats();
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
          // Get unread count for this chat
          const { data: unreadCount } = await supabase
            .rpc('get_unread_count', {
              p_chat_id: chat.id,
              p_user_id: currentUserProfile.id,
            });

          const lastMessage = chat.messages;
          const transformedChat: Chat = {
            id: chat.id,
            participant: participantData,
            lastMessage: lastMessage?.content || 'No messages yet',
            lastMessageTime: lastMessage?.created_at 
              ? formatMessageTime(lastMessage.created_at)
              : formatMessageTime(chat.created_at),
            unreadCount: unreadCount || 0,
            hasUnreadMessages: (unreadCount || 0) > 0,
          };
          transformedChats.push(transformedChat);
        }
      }

      setChats(transformedChats);
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

  const filteredChats = chats.filter(chat =>
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
          <Text style={styles.username}>@{item.participant.username}</Text>
          <View style={styles.chatMeta}>
            {item.hasUnreadMessages && <View style={styles.unreadDot} />}
            <Text style={styles.timestamp}>{item.lastMessageTime}</Text>
          </View>
        </View>
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
        
        {/* Last seen indicator for offline users */}
        {!item.participant.is_online && item.participant.last_seen && (
          <Text style={styles.lastSeen}>
            Last seen {formatMessageTime(item.participant.last_seen)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  // const renderChatItem = ({ item }: { item: Chat }) => (
  //   <TouchableOpacity style={styles.chatItem} onPress={() => handleChatPress(item)}>
  //     <View style={styles.avatarContainer}>
  //       {item.participant.profile_picture_url ? (
  //         <Image source={{ uri: item.participant.profile_picture_url }} style={styles.avatar} />
  //       ) : (
  //         <View style={styles.avatarPlaceholder}>
  //           <Feather name="user" size={24} color="#666" />
  //         </View>
  //       )}
  //       {item.participant.is_online && <View style={styles.onlineIndicator} />}
  //     </View>

  //     <View style={styles.chatContent}>
  //       <View style={styles.chatHeader}>
  //         <Text style={styles.username}>@{item.participant.username}</Text>
  //         <View style={styles.chatMeta}>
  //           {item.hasUnreadMessages && <View style={styles.unreadDot} />}
  //         <Text style={styles.timestamp}>{item.lastMessageTime}</Text>
  //         </View>
  //       </View>
  //       <View style={styles.messageRow}>
  //         <Text 
  //           style={[
  //             styles.lastMessage,
  //             item.hasUnreadMessages && styles.unreadMessage
  //           ]} 
  //           numberOfLines={1}
  //         >
  //           {item.lastMessage}
  //         </Text>
  //         {item.unreadCount > 0 && (
  //           <View style={styles.unreadBadge}>
  //             <Text style={styles.unreadCount}>
  //               {item.unreadCount > 99 ? '99+' : item.unreadCount}
  //             </Text>
  //           </View>
  //         )}
  //       </View>
        
  //       {/* Last seen indicator for offline users */}
  //       {!item.participant.is_online && item.participant.last_seen && (
  //         <Text style={styles.lastSeen}>
  //           Last seen {formatMessageTime(item.participant.last_seen)}
  //         </Text>
  //       )}
  //     </View>
  //   </TouchableOpacity>
  // );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name='message-circle' size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Chats Yet</Text>
      <Text style={styles.emptySubtitle}>
        Start a conversation by tapping the message button below
      </Text>
    </View>
  );

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
  username: { fontSize: 16, fontWeight: '600', color: '#3A805B' },
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
  lastSeen: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
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
});