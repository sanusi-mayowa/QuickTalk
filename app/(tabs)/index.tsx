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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, where, limit } from 'firebase/firestore';
import Toast from 'react-native-toast-message';
import { Feather } from '@expo/vector-icons';
import { TypingUser } from '@/hooks/useRealtimeChat';


interface Chat {
  id: string;
  participant: {
    id: string;
    username: string;
    about: string;
    profile_picture_data: string | null;
    phone: string;
    is_online?: boolean;
    last_seen?: string;
  };
  lastMessage: string;
  lastMessageTime: string;
  lastMessageId: string;
  lastMessageSenderId: string;
  lastMessageStatus?: {
    isRead: boolean;
    isDelivered: boolean;
    isSent: boolean;
  };
  lastMessageReactions?: Record<string, string>;
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
  profile_picture_data: string | null;
  phone: string;
  email: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [realtimeChannel, setRealtimeChannel] = useState<any>(null);
  // ADDED: State for tracking typing users across all chats
  const [typingUsers, setTypingUsers] = useState<Record<string, TypingUser[]>>({});
  // ADDED: State for tracking message subscriptions per chat
  const [messageChannels, setMessageChannels] = useState<Record<string, any>>({});
  // ADDED: Offline flag for UI presence indicators
  const [isOffline, setIsOffline] = useState(false);

  // Load chats when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadCurrentUser();
      // Try to show cached chats immediately while loading fresh data
      (async () => {
        try {
          const user = auth.currentUser;
          if (user) {
            const q = query(collection(db, 'user_profiles'), where('auth_user_id', '==', user.uid));
            const snap = await getDocs(q);
            const currentUserProfile = snap.docs[0]?.data() as any | undefined;
            if (currentUserProfile) {
              const cached = await AsyncStorage.getItem(`cache:chats:${currentUserProfile.id}`);
              if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed)) setChats(parsed);
              }
            }
          }
        } catch {}
      })();
      loadChats();
      setupRealtimeSubscription();
      
      return () => {
        // Cleanup subscription when screen loses focus
        if (realtimeChannel && typeof realtimeChannel === 'function') {
          realtimeChannel();
          setRealtimeChannel(null);
        }
        Object.values(messageChannels).forEach(unsub => {
          if (typeof unsub === 'function') unsub();
        });
        setMessageChannels({});
      };
    }, [])
  );

  const loadCurrentUser = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const q = query(collection(db, 'user_profiles'), where('auth_user_id', '==', user.uid));
      const snap = await getDocs(q);
      const profile = snap.docs[0]?.data() as any | undefined;
      if (profile) setCurrentUser(profile as any);
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  // ADDED: Function to setup message subscriptions for each chat
  const setupMessageSubscriptions = useCallback(async (chatList: Chat[]) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      let userProfile = currentUser;
      if (!userProfile) {
        const qUser = query(collection(db, 'user_profiles'), where('auth_user_id', '==', user.uid));
        const snapUser = await getDocs(qUser);
        userProfile = snapUser.docs[0]?.data() as any;
        if (!userProfile) return;
      }

      Object.values(messageChannels).forEach(unsub => { if (typeof unsub === 'function') unsub(); });

      const newMessageChannels: Record<string, any> = {};

      chatList.forEach(chat => {
        const qMsg = query(
          collection(db, 'messages'),
          where('chat_id', '==', chat.id),
          orderBy('created_at', 'asc')
        );
        const unsub = onSnapshot(qMsg, (snapshot: any) => {
          const docs = snapshot.docChanges();
          docs.forEach((change: any) => {
            const newMessage: any = change.doc.data();
            if (change.type === 'added') {
              setChats(prevChats => prevChats.map(prevChat => {
                if (prevChat.id !== chat.id) return prevChat;
                const isMyMessage = userProfile && newMessage.sender_id === (userProfile as any).id;
                const messageStatus = isMyMessage ? { isRead: false, isDelivered: false, isSent: true } : undefined;
                return {
                  ...prevChat,
                  lastMessage: newMessage.content,
                  lastMessageTime: formatMessageTime(newMessage.created_at),
                  lastMessageId: newMessage.id,
                  lastMessageSenderId: newMessage.sender_id,
                  lastMessageStatus: messageStatus,
                  unreadCount: userProfile && newMessage.sender_id !== (userProfile as any).id ? prevChat.unreadCount + 1 : prevChat.unreadCount,
                  hasUnreadMessages: userProfile && newMessage.sender_id !== (userProfile as any).id ? true : prevChat.hasUnreadMessages,
                } as any;
              }));
            } else if (change.type === 'modified') {
              const updatedMessage: any = change.doc.data();
              setChats(prevChats => prevChats.map(prevChat => {
                if (prevChat.id !== chat.id) return prevChat;
                if (prevChat.lastMessageId === updatedMessage.id && userProfile) {
                  const isMyMessage = updatedMessage.sender_id === (userProfile as any).id;
                  let newStatus = prevChat.lastMessageStatus;
                  if (isMyMessage) {
                    const isRead = Array.isArray(updatedMessage.read_by) && updatedMessage.read_by.includes(prevChat.participant.id);
                    const isDelivered = Array.isArray(updatedMessage.delivered_to) && updatedMessage.delivered_to.includes(prevChat.participant.id);
                    newStatus = { isRead, isDelivered, isSent: true };
                  }
                  return { ...prevChat, lastMessageStatus: newStatus, lastMessageReactions: updatedMessage.reactions || prevChat.lastMessageReactions } as any;
                }
                return prevChat;
              }));
            }
          });
        });
        newMessageChannels[chat.id] = unsub;
      });

      setMessageChannels(newMessageChannels);
    } catch (error) {
      console.error('Error setting up message subscriptions:', error);
    }
  }, [currentUser, messageChannels]);

  // ADDED: Function to load unread count for a specific chat
  const loadUnreadCountForChat = async (chatId: string, userId: string): Promise<number> => {
    try {
      const qUnread = query(
        collection(db, 'messages'),
        where('chat_id', '==', chatId),
        where('sender_id', '!=', userId)
      );
      const snap = await getDocs(qUnread);
      const count = snap.docs.filter((d: any) => {
        const data = d.data() as any;
        return !Array.isArray(data.read_by) || !data.read_by.includes(userId);
      }).length;
      return count;
    } catch (error) {
      console.error('Error loading unread count:', error);
      return 0;
    }
  };
  const setupRealtimeSubscription = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      let userProfile = currentUser;
      if (!userProfile) {
        const qUser = query(collection(db, 'user_profiles'), where('auth_user_id', '==', user.uid));
        const snapUser = await getDocs(qUser);
        userProfile = snapUser.docs[0]?.data() as any;
        if (!userProfile) return;
      }

      if (realtimeChannel && typeof realtimeChannel === 'function') {
        realtimeChannel();
      }

      const userId = (userProfile as any).id;
      const qChats = query(collection(db, 'chats'), where('participants', 'array-contains', userId));
      const unsub = onSnapshot(qChats, () => {
        loadChats();
      });

      setRealtimeChannel(() => unsub);
    } catch (error) {
      console.error('Error setting up realtime subscription:', error);
    }
  };

  // MODIFIED: Setup realtime subscription when currentUser is loaded
  useEffect(() => {
    setupRealtimeSubscription();
  }, [currentUser]);

  // ADDED: 1-second polling fallback to refresh chat list (throttled)
  useEffect(() => {
    let isFetching = false;
    const interval = setInterval(async () => {
      if (isFetching) return;
      isFetching = true;
      try {
        await loadChats();
      } finally {
        isFetching = false;
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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
      const user = auth.currentUser;
      if (!user) return;

      const qUser = query(collection(db, 'user_profiles'), where('auth_user_id', '==', user.uid));
      const userSnap = await getDocs(qUser);
      const currentUserProfile = userSnap.docs[0]?.data() as any | undefined;
      
      if (!currentUserProfile) {
        console.error('No user profile found');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Add the document ID to the profile
      const currentUserProfileWithId = {
        id: userSnap.docs[0].id,
        ...currentUserProfile
      };

      const qChats = query(collection(db, 'chats'), where('participants', 'array-contains', currentUserProfileWithId.id));
      const chatsSnap = await getDocs(qChats);

      const transformedChats: Chat[] = [];
      for (const chatDoc of chatsSnap.docs) {
        const chat = chatDoc.data() as any;
        const otherParticipantId = (chat.participants as string[]).find((pid: string) => pid !== currentUserProfileWithId.id);
        if (!otherParticipantId) continue;

        // Query by document ID instead of field
        const otherProfileDoc = await getDoc(doc(db, 'user_profiles', otherParticipantId));
        if (!otherProfileDoc.exists()) continue;
        
        const participantData = {
          id: otherProfileDoc.id,
          ...otherProfileDoc.data()
        } as any;

        const contactSnap = await getDocs(query(
          collection(db, 'contacts'),
          where('owner_id', '==', currentUserProfileWithId.id),
          where('contact_user_id', '==', otherParticipantId)
        ));
        const contactData = contactSnap.docs[0]?.data() as any | undefined;

        // Get last message by query
        const lastMsgSnap = await getDocs(query(
          collection(db, 'messages'),
          where('chat_id', '==', chatDoc.id),
          orderBy('created_at', 'desc'),
          limit(1)
        ));
        const lastMessage = lastMsgSnap.docs[0]?.data() as any | undefined;

        let messageStatus = { isRead: false, isDelivered: false, isSent: false };
        if (lastMessage && lastMessage.sender_id === currentUserProfileWithId.id) {
          const isRead = Array.isArray(lastMessage.read_by) && lastMessage.read_by.includes(otherParticipantId);
          const isDelivered = Array.isArray(lastMessage.delivered_to) && lastMessage.delivered_to.includes(otherParticipantId);
          messageStatus = { isRead, isDelivered, isSent: true };
        }

        // Unread count
        const unreadSnap = await getDocs(query(
          collection(db, 'messages'),
          where('chat_id', '==', chatDoc.id)
        ));
        let unreadCount = 0;
        unreadSnap.docs.forEach((d: any) => {
          const m = d.data() as any;
          if (m.sender_id !== currentUserProfileWithId.id && (!Array.isArray(m.read_by) || !m.read_by.includes(currentUserProfileWithId.id))) unreadCount += 1;
        });

        transformedChats.push({
          id: chatDoc.id,
          participant: participantData,
          contactInfo: contactData ? { first_name: contactData.first_name, last_name: contactData.last_name, is_saved: true } : { first_name: '', last_name: '', is_saved: false },
          lastMessage: lastMessage?.content || 'No messages yet',
          lastMessageTime: lastMessage?.created_at ? formatMessageTime(lastMessage.created_at) : formatMessageTime(chat.created_at || new Date().toISOString()),
          lastMessageId: lastMessage?.id || '',
          lastMessageSenderId: lastMessage?.sender_id || '',
          lastMessageStatus: messageStatus,
          lastMessageReactions: lastMessage?.reactions || undefined,
          unreadCount,
          hasUnreadMessages: unreadCount > 0,
        } as any);
      }

      setChats(transformedChats);
      setIsOffline(false);
      // Cache chats for offline usage
      try {
        await AsyncStorage.setItem(`cache:chats:${currentUserProfileWithId.id}`, JSON.stringify(transformedChats));
      } catch {}
      // ADDED: Setup message subscriptions for all chats
      setupMessageSubscriptions(transformedChats);
    } catch (error: any) {
      console.error('Error loading chats:', error);
      // Fallback: try load cached chats
      try {
        const user = auth.currentUser; let ownerId = 'unknown';
        if (user) {
          const q = query(collection(db, 'user_profiles'), where('auth_user_id', '==', user.uid));
          const snap = await getDocs(q);
          const profile = snap.docs[0]?.data() as any | undefined;
          if (profile) ownerId = snap.docs[0].id;
        }
        const cached = await AsyncStorage.getItem(`cache:chats:${ownerId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) setChats(parsed);
        }
      } catch {}
      setIsOffline(true);
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

  const handleMenuItemPress = (path: any) => {
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

  // ADDED: Function to render message status icon
  const renderMessageStatus = (chat: Chat) => {
    if (!chat.lastMessageStatus || chat.lastMessageSenderId !== currentUser?.id) {
      return null;
    }

    const { isRead, isDelivered, isSent } = chat.lastMessageStatus;

    if (isRead) {
      // Double check (read) - green
      return (
        <View style={styles.doubleCheckContainer}>
          <Feather name='check' size={10} color="#4CAF50" style={styles.firstCheck} />
          <Feather name='check' size={10} color="#4CAF50" style={styles.secondCheck} />
        </View>
      );
    }
    if (isDelivered) {
      // Double check (delivered) - blue
      return (
        <View style={styles.doubleCheckContainer}>
          <Feather name='check' size={10} color="#2196F3" style={styles.firstCheck} />
          <Feather name='check' size={10} color="#2196F3" style={styles.secondCheck} />
        </View>
      );
    }
    if (isSent) {
      // Single check (sent) - gray
      return <Feather name='check' size={12} color="#999" />;
    }
    
    return null;
  };

  // ADDED: Function to render reaction indicator
  const renderReactionIndicator = (chat: Chat) => {
    // This would show if the last message has reactions
    // For now, we'll just show a heart icon if there are reactions
    if (chat.lastMessageReactions && Object.keys(chat.lastMessageReactions).length > 0) {
      return (
        <View style={styles.reactionIndicator}>
          <Text style={styles.reactionEmoji}>❤️</Text>
        </View>
      );
    }
    return null;
  };
  const filteredChats = chats.filter(chat =>
    getDisplayName(chat).toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.participant.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderChatItem = ({ item }: { item: Chat }) => (
    <TouchableOpacity style={styles.chatItem} onPress={() => handleChatPress(item)}>
      <View style={styles.avatarContainer}>
        {item.participant.profile_picture_data ? (
          <Image source={{ uri: item.participant.profile_picture_data }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Feather name="user" size={24} color="#666" />
          </View>
        )}
        {/* Hide online indicator when offline (no network) */}
        {(!isOffline && item.participant.is_online) && <View style={styles.onlineIndicator} />}
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
      if (realtimeChannel && typeof realtimeChannel === 'function') realtimeChannel();
      Object.values(messageChannels).forEach(unsub => { if (typeof unsub === 'function') unsub(); });
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
      <View style={
        styles.header
      }>
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
    // paddingHorizontal: 12,
    backgroundColor: '#3A805B',
    paddingHorizontal: 16,
    paddingVertical: 18,
    paddingTop: 40,
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
  // ADDED: Styling for message status
  messageStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  doubleCheckContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 14,
    height: 8,
  },
  firstCheck: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  secondCheck: {
    position: 'absolute',
    top: 0,
    left: 3,
  },
  reactionIndicator: {
    marginLeft: 4,
  },
  reactionEmoji: {
    fontSize: 12,
  },
});