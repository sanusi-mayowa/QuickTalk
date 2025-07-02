import { useState, useEffect } from 'react';
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
import { useRouter } from 'expo-router';
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
  };
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
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

  useEffect(() => {
    loadCurrentUser();
    loadChats();
  }, []);

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
      const sampleChats: Chat[] = [
        {
          id: '1',
          participant: {
            id: '1',
            username: 'john_doe',
            about: 'Love to travel ✈️',
            profile_picture_url: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
            phone: '+1234567890',
          },
          lastMessage: 'Hey! How are you doing?',
          lastMessageTime: '2 min ago',
          unreadCount: 2,
        },
        {
          id: '2',
          participant: {
            id: '2',
            username: 'sarah_wilson',
            about: 'Coffee enthusiast ☕📚',
            profile_picture_url: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
            phone: '+1234567891',
          },
          lastMessage: 'Thanks for the recommendation!',
          lastMessageTime: '1 hour ago',
          unreadCount: 0,
        },
        {
          id: '3',
          participant: {
            id: '3',
            username: 'mike_tech',
            about: 'Tech geek 💻',
            profile_picture_url: null,
            phone: '+1234567892',
          },
          lastMessage: 'Let\'s catch up soon',
          lastMessageTime: 'Yesterday',
          unreadCount: 1,
        },
      ];
      setChats(sampleChats);
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
            <Feather name='users' size={24} color="#666" />
          </View>
        )}
        {item.unreadCount > 0 && <View style={styles.onlineIndicator} />}
      </View>

      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={styles.username}>@{item.participant.username}</Text>
          <Text style={styles.timestamp}>{item.lastMessageTime}</Text>
        </View>
        <View style={styles.messageRow}>
          <Text style={styles.lastMessage} numberOfLines={1}>{item.lastMessage}</Text>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
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
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  username: { fontSize: 16, fontWeight: '600', color: '#3A805B' },
  timestamp: { fontSize: 12, color: '#999' },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  lastMessage: { flex: 1, fontSize: 14, color: '#666' },
  unreadBadge: {
    backgroundColor: '#3A805B',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: { color: '#fff', fontSize: 12, fontWeight: '600' },
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
