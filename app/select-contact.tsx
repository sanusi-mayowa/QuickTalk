import { useState, useEffect, useCallback } from 'react';
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
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import Toast from 'react-native-toast-message';

interface Contact {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string;
  is_quicktalk_user: boolean;
  contact_user_id: string | null;
  contact_user?: {
    id: string;
    username: string;
    about: string;
    profile_picture_url: string | null;
  } | null;
  created_at: string;
}

interface UserProfile {
  id: string;
  username: string;
  about: string;
  profile_picture_url: string | null;
  phone: string;
  email: string;
}

type ContactOptionType = 'action' | 'contact' | 'section';

interface ContactOption {
  id: string;
  type: ContactOptionType;
  title: string;
  subtitle?: string;
  icon?: any;
  color?: string;
  action?: () => void;
  contact?: Contact;
  user?: UserProfile;
}

export default function ContactsScreen() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<ContactOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load contacts when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadContacts();
      loadUsers();
    }, [])
  );

  useEffect(() => {
    filterContacts();
  }, [searchQuery, contacts, users]);

  // Helper function to sort contacts alphabetically
  const sortContactsAlphabetically = (contactsList: Contact[]) => {
    return contactsList.sort((a, b) => {
      const nameA = `${a.first_name} ${a.last_name || ''}`.trim().toLowerCase();
      const nameB = `${b.first_name} ${b.last_name || ''}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  };

  // Helper function to sort users alphabetically
  const sortUsersAlphabetically = (usersList: UserProfile[]) => {
    return usersList.sort((a, b) => {
      return a.username.toLowerCase().localeCompare(b.username.toLowerCase());
    });
  };

  const loadContacts = async () => {
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

      // Load contacts with user information
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          *,
          contact_user:contact_user_id(
            id,
            username,
            about,
            profile_picture_url
          )
        `)
        .eq('owner_id', currentUserProfile.id);

      if (error) {
        throw error;
      }

      // Sort contacts alphabetically by name
      const sortedContacts = sortContactsAlphabetically(data || []);
      setContacts(sortedContacts);
    } catch (error: any) {
      console.error('Error loading contacts:', error);
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

  const loadUsers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('is_profile_complete', true)
        .neq('auth_user_id', session.user.id);

      if (error) throw error;

      // Sort users alphabetically by username
      const sortedUsers = sortUsersAlphabetically(data || []);
      setUsers(sortedUsers);
    } catch (error: any) {
      console.error('Error loading users:', error);
    }
  };

  const filterContacts = () => {
    const actionOptions: ContactOption[] = [
      {
        id: 'new-group',
        type: 'action',
        title: 'New group',
        icon: 'users',
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
        icon: 'user-plus',
        color: '#3A805B',
        action: () => router.push('/new-contact'),
      },
      {
        id: 'new-community',
        type: 'action',
        title: 'New community',
        icon: 'users',
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

    let filteredContactsList = contacts;
    let filteredUsersList = users;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      
      filteredContactsList = contacts.filter(contact => {
        const fullName = `${contact.first_name} ${contact.last_name || ''}`.toLowerCase();
        const phone = contact.phone.toLowerCase();
        const username = contact.contact_user?.username?.toLowerCase() || '';
        const about = contact.contact_user?.about?.toLowerCase() || '';

        return fullName.includes(query) || phone.includes(query) || username.includes(query) || about.includes(query);
      });

      filteredUsersList = users.filter(user =>
        user.username.toLowerCase().includes(query) ||
        user.about.toLowerCase().includes(query) ||
        user.phone.includes(query)
      );

      // Sort filtered results alphabetically
      filteredContactsList = sortContactsAlphabetically(filteredContactsList);
      filteredUsersList = sortUsersAlphabetically(filteredUsersList);
    }

    const contactOptions: ContactOption[] = filteredContactsList.map(contact => ({
      id: contact.id,
      type: 'contact',
      title: `${contact.first_name} ${contact.last_name || ''}`,
      subtitle: contact.contact_user ? `@${contact.contact_user.username}` : contact.phone,
      icon: 'user',
      color: '#666',
      contact,
    }));

    const userOptions: ContactOption[] = filteredUsersList
      .filter(user => !contacts.some(contact => contact.contact_user_id === user.id))
      .map(user => ({
        id: `user-${user.id}`,
        type: 'contact',
        title: `@${user.username}`,
        subtitle: user.about,
        icon: 'user',
        color: '#666',
        user,
      }));

    const allContacts: ContactOption[] = searchQuery.trim()
      ? [...contactOptions, ...userOptions]
      : [
          { id: 'section-actions', type: 'section', title: 'Quick Actions' },
          ...actionOptions,
          { id: 'section-contacts', type: 'section', title: 'Your Contacts' },
          ...contactOptions,
          ...(userOptions.length > 0 ? [
            { id: 'section-users', type: 'section', title: 'Other QuickTalk Users' },
            ...userOptions
          ] : [])
        ];

    setFilteredContacts(allContacts);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadContacts();
    loadUsers();
  };

  const handleStartChat = async (contact: Contact) => {
    if (!contact.is_quicktalk_user || !contact.contact_user_id) {
      Toast.show({
        type: 'info',
        text1: 'Not on QuickTalk',
        text2: `${contact.first_name} is not using QuickTalk yet`,
      });
      return;
    }

    try {
      // Get current user's profile
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: currentUserProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', session.user.id)
        .single();

      if (!currentUserProfile) return;

      // Check if chat already exists
      const { data: existingChat } = await supabase
        .from('chats')
        .select('id')
        .or(`and(participant_1.eq.${currentUserProfile.id},participant_2.eq.${contact.contact_user_id}),and(participant_1.eq.${contact.contact_user_id},participant_2.eq.${currentUserProfile.id})`)
        .single();

      if (existingChat) {
        // Navigate to existing chat
        router.push(`/chat/${existingChat.id}`);
        return;
      }

      // Create new chat
      const { data: newChat, error } = await supabase
        .from('chats')
        .insert({
          created_by: currentUserProfile.id,
          participant_1: currentUserProfile.id,
          participant_2: contact.contact_user_id,
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      Toast.show({
        type: 'success',
        text1: 'Chat Started',
        text2: `Started conversation with ${contact.first_name}`,
      });

      // Navigate to new chat
      router.push(`/chat/${newChat.id}`);
    } catch (error: any) {
      console.error('Error starting chat:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to start chat',
      });
    }
  };

  const handleUserChat = async (user: UserProfile) => {
    try {
      // Get current user's profile
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: currentUserProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', session.user.id)
        .single();

      if (!currentUserProfile) return;

      // Check if chat already exists
      const { data: existingChat } = await supabase
        .from('chats')
        .select('id')
        .or(`and(participant_1.eq.${currentUserProfile.id},participant_2.eq.${user.id}),and(participant_1.eq.${user.id},participant_2.eq.${currentUserProfile.id})`)
        .single();

      if (existingChat) {
        // Navigate to existing chat
        router.push(`/chat/${existingChat.id}`);
        return;
      }

      // Create new chat
      const { data: newChat, error } = await supabase
        .from('chats')
        .insert({
          created_by: currentUserProfile.id,
          participant_1: currentUserProfile.id,
          participant_2: user.id,
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      Toast.show({
        type: 'success',
        text1: 'Chat Started',
        text2: `Started conversation with @${user.username}`,
      });

      // Navigate to new chat
      router.push(`/chat/${newChat.id}`);
    } catch (error: any) {
      console.error('Error starting chat:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to start chat',
      });
    }
  };

  const handleContactPress = (contactOption: ContactOption) => {
    if (contactOption.type === 'action' && contactOption.action) {
      contactOption.action();
    } else if (contactOption.type === 'contact') {
      if (contactOption.contact) {
        handleStartChat(contactOption.contact);
      } else if (contactOption.user) {
        handleUserChat(contactOption.user);
      }
    }
  };

  const handleAddContact = () => {
    router.push('/new-contact');
  };

  const renderContactItem = ({ item }: { item: ContactOption }) => {
    if (item.type === 'section') {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{item.title}</Text>
        </View>
      );
    }

    const isQuickTalkUser = item.contact?.is_quicktalk_user || !!item.user;
    const profilePicture = item.contact?.contact_user?.profile_picture_url || item.user?.profile_picture_url;

    return (
      <TouchableOpacity style={styles.contactItem} onPress={() => handleContactPress(item)}>
        <View style={[
          styles.iconContainer, 
          { backgroundColor: item.type === 'action' ? item.color : '#e9ecef' }
        ]}>
          {item.type === 'contact' && profilePicture ? (
            <Image source={{ uri: profilePicture }} style={styles.avatar} />
          ) : (
            <Feather 
              name={item.icon} 
              size={24} 
              color={item.type === 'action' ? '#fff' : item.color} 
            />
          )}
        </View>
        
        <View style={styles.contactContent}>
          <Text style={[
            styles.contactTitle,
            item.type === 'contact' && isQuickTalkUser && { color: '#3A805B' }
          ]}>
            {item.title}
          </Text>
          {item.subtitle && (
            <Text style={styles.contactSubtitle} numberOfLines={1}>
              {item.subtitle}
            </Text>
          )}
          {item.contact && !item.contact.is_quicktalk_user && (
            <Text style={styles.notOnQuicktalk}>Not on QuickTalk</Text>
          )}
        </View>

        {/* QuickTalk Badge */}
        {isQuickTalkUser && item.type === 'contact' && (
          <View style={styles.quicktalkBadge}>
            <Text style={styles.quicktalkBadgeText}>Q</Text>
          </View>
        )}

        {/* Action Buttons */}
        {item.type === 'contact' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[
                styles.actionButton,
                !isQuickTalkUser && styles.disabledButton
              ]}
            >
              <Feather 
                name="message-circle" 
                size={18} 
                color={isQuickTalkUser ? "#3A805B" : "#999"} 
              />
            </TouchableOpacity>
          </View>
        )}

        {item.id === 'new-contact' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton}>
              <Feather name="activity" size={18} color="#3A805B" />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="users" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Contacts Found</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery ? 'Try adjusting your search' : 'Add your first contact to get started'}
      </Text>
      {!searchQuery && (
        <TouchableOpacity style={styles.addContactButton} onPress={handleAddContact}>
          <Feather name='user-plus' size={20} color="#fff" />
          <Text style={styles.addContactButtonText}>Add Contact</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderHeader = () => {
    const totalContacts = contacts.length;
    const quicktalkUsers = contacts.filter(c => c.is_quicktalk_user).length;
    const otherUsers = users.filter(user => !contacts.some(contact => contact.contact_user_id === user.id)).length;

    return (
      <View style={styles.headerStats}>
        <Text style={styles.statsText}>
          {totalContacts} saved contacts • {quicktalkUsers} on QuickTalk • {otherUsers} other users
        </Text>
      </View>
    );
  };

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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push('/(tabs)')}>
          <Feather name='arrow-left' size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerLeft}>
          <Text style={styles.title}> Select Contacts</Text>
        </View>
        
        {/* <TouchableOpacity style={styles.addButton} onPress={handleAddContact}>
          <Feather name='user-plus' size={24} color="#fff" />
        </TouchableOpacity> */}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Feather name='search' size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Contact List */}
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
        ListHeaderComponent={(contacts.length > 0 || users.length > 0) ? renderHeader : null}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#3A805B',
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
   backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  headerStats: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  statsText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
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
    paddingVertical: 8,
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
  notOnQuicktalk: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 2,
  },
  quicktalkBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#3A805B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  quicktalkBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
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
  disabledButton: {
    backgroundColor: '#f5f5f5',
    borderColor: '#ddd',
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
    marginBottom: 24,
  },
  addContactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3A805B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  addContactButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});