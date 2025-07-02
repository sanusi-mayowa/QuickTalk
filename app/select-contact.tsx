import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import Toast from 'react-native-toast-message';

type ContactOptionType = 'action' | 'user' | 'section';

interface UserProfile {
  id: string;
  username: string;
  about: string;
  profile_picture_url: string | null;
  phone: string;
  email: string;
}

interface ContactOption {
  id: string;
  type: ContactOptionType;
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<any> | ((props: any) => JSX.Element);
  color?: string;
  action?: () => void;
  user?: UserProfile;
}

export default function SelectContactScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<ContactOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterContacts();
  }, [searchQuery, users]);

  const loadUsers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('is_profile_complete', true)
        .neq('auth_user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setUsers(data || []);
    } catch (error: any) {
      console.error('Error loading users:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load contacts',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterContacts = () => {
    const actionOptions: ContactOption[] = [
      {
        id: 'new-group',
        type: 'action',
        title: 'New group',
        icon: (props) => <Feather name="users" {...props} />,
        color: '#3A805B',
        action: () => {
          Toast.show({
            type: 'info',
            text1: 'Coming Soon',
            text2: 'Group creation feature will be available soon',
          });
        },
      },
      {
        id: 'new-contact',
        type: 'action',
        title: 'New contact',
        icon: (props) => <Feather name="user-plus" {...props} />,
        color: '#3A805B',
        action: () => router.push('/new-contact'),
      },
      {
        id: 'new-community',
        type: 'action',
        title: 'New community',
        icon: (props) => <Feather name="users" {...props} />,
        color: '#3A805B',
        action: () => {
          Toast.show({
            type: 'info',
            text1: 'Coming Soon',
            text2: 'Community feature will be available soon',
          });
        },
      },
    ];

    let filteredUsers = users;
    if (searchQuery.trim()) {
      filteredUsers = users.filter(user =>
        user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.about.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.phone.includes(searchQuery)
      );
    }

    const userOptions: ContactOption[] = filteredUsers.map(user => ({
      id: user.id,
      type: 'user',
      title: `@${user.username}`,
      subtitle: user.about,
      icon: (props) => <Feather name="user" {...props} />,
      color: '#666',
      user,
    }));

    const allContacts: ContactOption[] = searchQuery.trim()
      ? userOptions
      : [
          { id: 'section-new', type: 'section', title: 'New' },
          ...actionOptions,
          { id: 'section-users', type: 'section', title: 'Contacts on QuickTalk' },
          ...userOptions,
        ];

    setFilteredContacts(allContacts);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadUsers();
  };

  const handleContactPress = (contact: ContactOption) => {
    if (contact.type === 'action' && contact.action) {
      contact.action();
    } else if (contact.type === 'user' && contact.user) {
      Toast.show({
        type: 'success',
        text1: 'Chat Started',
        text2: `Starting conversation with @${contact.user.username}`,
      });
      router.back();
    }
  };

  const renderContactItem = ({ item }: { item: ContactOption }) => {
    if (item.type === 'section') {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{item.title}</Text>
        </View>
      );
    }

    return (
      <TouchableOpacity style={styles.contactItem} onPress={() => handleContactPress(item)}>
        <View style={[styles.iconContainer, { backgroundColor: item.type === 'action' ? item.color : '#e9ecef' }]}>
          {item.type === 'user' && item.user?.profile_picture_url ? (
            <Image source={{ uri: item.user.profile_picture_url }} style={styles.avatar} />
          ) : (
            typeof item.icon === 'function' &&
            item.icon({
              size: 24,
              color: item.type === 'action' ? '#fff' : item.color,
            })
          )}
        </View>

        <View style={styles.contactContent}>
          <Text
            style={[styles.contactTitle, item.type === 'user' && { color: '#3A805B' }]}
          >
            {item.title}
          </Text>
          {item.subtitle && (
            <Text style={styles.contactSubtitle} numberOfLines={1}>
              {item.subtitle}
            </Text>
          )}
        </View>

        {item.type === 'user' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton}>
              <Feather name='message-circle' size={18} color="#3A805B" />
            </TouchableOpacity>
          </View>
        )}

        {item.id === 'new-contact' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton}>
              <Feather name='activity' size={18} color="#3A805B" />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name='users' size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Contacts Found</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery ? 'Try adjusting your search' : 'No users have joined QuickTalk yet'}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3A805B" />
        <Text style={styles.loadingText}>Loading contacts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name='arrow-left' size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Select contact</Text>
          <Text style={styles.headerSubtitle}>
            {filteredContacts.filter(c => c.type === 'user').length} contacts
          </Text>
        </View>

        <TouchableOpacity style={styles.headerButton}>
          <Feather name='search' size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Feather name='search' size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
        </View>
      </View>

      <FlatList
        data={filteredContacts}
        renderItem={renderContactItem}
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
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#3A805B',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#f8f9fa',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listContainer: {
    paddingBottom: 20,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  contactContent: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  contactSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8fffe',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A805B',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});