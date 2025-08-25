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
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { auth, db } from '@/lib/firebase';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';

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
    profile_picture_data: string | null;
  } | null;
  created_at: string;
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
}

export default function ContactsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<ContactOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadContacts();
    }, [])
  );

  useEffect(() => {
    filterContacts();
  }, [searchQuery, contacts]);

  const sortContactsAlphabetically = (contactsList: Contact[]) => {
    return contactsList.sort((a, b) => {
      const nameA = `${a.first_name} ${a.last_name || ''}`.trim().toLowerCase();
      const nameB = `${b.first_name} ${b.last_name || ''}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  };

  // Utility: Capitalize first letters
  const capitalizeName = (name: string | null | undefined) => {
    if (!name) return '';
    return name
      .split(' ')
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const loadContacts = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      //  Get current user's profile
      const userSnap = await getDocs(
        query(collection(db, 'user_profiles'), where('auth_user_id', '==', user.uid))
      );

      if (userSnap.empty) {
        console.warn('No user profile found for this user.');
        return;
      }

      const currentUserProfile = {
        id: userSnap.docs[0].id,
        ...userSnap.docs[0].data(),
      };

      //  Load contacts
      let contactsSnap = await getDocs(
        query(collection(db, 'contacts'), where('owner_id', '==', currentUserProfile.id))
      );

      //  Fallback if using auth.uid instead of profile.id
      if (contactsSnap.empty) {
        contactsSnap = await getDocs(
          query(collection(db, 'contacts'), where('owner_id', '==', user.uid))
        );
      }

      const rawContacts = contactsSnap.docs.map(d => ({
        id: d.id,
        ...(d.data() as any),
      }));

      let sortedContacts = sortContactsAlphabetically(rawContacts as any);

      //  Enrich contacts with QuickTalk user profile if available
      const enrichedContacts: Contact[] = [];

      for (const c of sortedContacts) {
        const phone = (c as any).phone || '';
        let linked: any = null;

        if (c.contact_user_id) {
          // Already linked
          const linkedSnap = await getDocs(
            query(collection(db, 'user_profiles'), where('__name__', '==', c.contact_user_id))
          );
          if (!linkedSnap.empty) {
            linked = { id: linkedSnap.docs[0].id, ...linkedSnap.docs[0].data() };
          }
        } else {
          // Try linking by phone
          const exactSnap = await getDocs(
            query(collection(db, 'user_profiles'), where('phone', '==', phone))
          );
          linked = exactSnap.docs[0]
            ? { id: exactSnap.docs[0].id, ...exactSnap.docs[0].data() }
            : null;

          if (linked) {
            await setDoc(
              doc(db, 'contacts', c.id),
              { is_quicktalk_user: true, contact_user_id: linked.id },
              { merge: true }
            );
          }
        }

        enrichedContacts.push({
          ...(c as any),
          first_name: capitalizeName(c.first_name),
          last_name: capitalizeName(c.last_name),
          is_quicktalk_user: !!linked,
          contact_user_id: linked?.id || c.contact_user_id,
          contact_user: linked
            ? {
              id: linked.id,
              username: linked.username,
              about: linked.about,
              profile_picture_data: linked.profile_picture_data,
            }
            : null,
        });
      }

      setContacts(enrichedContacts);
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

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();

      filteredContactsList = contacts.filter(contact => {
        const fullName = `${contact.first_name} ${contact.last_name || ''}`.toLowerCase();
        const phone = contact.phone.toLowerCase();
        const username = contact.contact_user?.username?.toLowerCase() || '';
        const about = contact.contact_user?.about?.toLowerCase() || '';

        return fullName.includes(query) || phone.includes(query) || username.includes(query) || about.includes(query);
      });

      // Sort filtered results alphabetically
      filteredContactsList = sortContactsAlphabetically(filteredContactsList);
    }

    const contactOptions: ContactOption[] = filteredContactsList.map(contact => ({
      id: contact.id,
      type: 'contact',
      title: `${contact.first_name} ${contact.last_name || ''}`,
      subtitle: contact.contact_user ? `${contact.contact_user.username}` : contact.phone,
      icon: 'user',
      color: '#666',
      contact,
    }));

    const onlyContacts: ContactOption[] = searchQuery.trim()
      ? [...contactOptions]
      : [
        { id: 'section-actions', type: 'section', title: 'Quick Actions' },
        ...actionOptions,
        { id: 'section-contacts', type: 'section', title: 'Your Contacts' },
        ...contactOptions,
      ];

    setFilteredContacts(onlyContacts);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadContacts();
  };


  const handleStartChat = async (contact: Contact) => {
    try {
      console.log("Starting chat with contact:", contact);

      let otherParticipantId = contact.contact_user_id;

      // If not already linked, try by phone
      if (!otherParticipantId) {
        const linkedSnap = await getDocs(
          query(collection(db, "user_profiles"), where("phone", "==", contact.phone))
        );

        if (!linkedSnap.empty) {
          const linkedDoc = linkedSnap.docs[0];
          otherParticipantId = linkedDoc.id; // ✅ use Firestore doc id
          await setDoc(
            doc(db, "contacts", contact.id),
            { is_quicktalk_user: true, contact_user_id: linkedDoc.id },
            { merge: true }
          );
        }
      }

      if (!otherParticipantId) {
        Toast.show({
          type: "info",
          text1: "Not on QuickTalk",
          text2: `${contact.first_name} is not using QuickTalk yet`,
        });
        return;
      }

      // Get current user's profile (doc id)
      const user = auth.currentUser;
      if (!user) return;
      const profileSnap = await getDocs(
        query(collection(db, "user_profiles"), where("auth_user_id", "==", user.uid))
      );
      if (profileSnap.empty) return;
      const currentUserDoc = profileSnap.docs[0];
      const currentUserProfile = { id: currentUserDoc.id, ...currentUserDoc.data() };

      // Check if chat already exists (pair_key of profile doc IDs)
      const pairKey = [currentUserProfile.id, otherParticipantId].sort().join("_");
      const existingSnap = await getDocs(
        query(collection(db, "chats"), where("pair_key", "==", pairKey))
      );

      if (!existingSnap.empty) {
        const chatId = existingSnap.docs[0].id;
        router.push(`/chat/${chatId}`);
        return;
      }

      // Create new chat
      const newRef = await addDoc(collection(db, "chats"), {
        participant_1: currentUserProfile.id,
        participant_2: otherParticipantId,
        participants: [currentUserProfile.id, otherParticipantId],
        pair_key: pairKey,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      Toast.show({
        type: "success",
        text1: "Chat Started",
        text2: `Started conversation with ${contact.first_name}`,
      });
      router.push(`/chat/${newRef.id}`);
    } catch (error: any) {
      console.error("Error starting chat:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error?.message || "Failed to start chat",
      });
    }
  };
  
  const handleContactPress = (contactOption: ContactOption) => {
    if (contactOption.type === "action" && contactOption.action) {
      contactOption.action();
    } else if (contactOption.type === "contact" && contactOption.contact) {
      const quicktalkId = contactOption.contact.contact_user_id;
      if (quicktalkId) {
        // ✅ Use the QuickTalk user profile ID, not contact doc id
        router.push({
          pathname: "/user-profile",
          params: { id: quicktalkId },
        });
      } else {
        Toast.show({
          type: "info",
          text1: "Not on QuickTalk",
          text2: `${contactOption.contact.first_name} is not using QuickTalk yet`,
        });
      }
    }
  };


  const handleAddContact = () => {
    router.push('/new-contact');
  };

const renderContactItem = ({ item }: { item: ContactOption }) => {
    if (item.type === "section") {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{item.title}</Text>
        </View>
      );
    }


    const isQuickTalkUser = !!item.contact?.is_quicktalk_user || !!item.contact?.contact_user;
    const profilePicture = item.contact?.contact_user?.profile_picture_data;

    return (
      <TouchableOpacity
        style={[
          styles.contactItem,
          item.type === 'contact' && !isQuickTalkUser && { opacity: 0.5 } //  Dim non-QuickTalk contacts
        ]}
        onPress={() => {
          if (item.type === "action" && item.action) {
            item.action();
          } else if (item.type === "contact" && item.contact && isQuickTalkUser) {
            const quicktalkId = item.contact.contact_user_id;
            if (quicktalkId) {
              
            // ✅ Use QuickTalk profile ID for /user-profile
              router.push({
                pathname: "/user-profile",
                params: { id: quicktalkId },
              });
            }
          }
        }}
        disabled={item.type === 'contact' && !isQuickTalkUser} //  disable press for non-QuickTalk contacts
      >
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: item.type === 'action' ? item.color : '#e9ecef' },
          ]}
        >
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
          <Text
            style={[
              styles.contactTitle,
              item.type === 'contact' && isQuickTalkUser && { color: '#3A805B' },
            ]}
          >
            {item.title}
          </Text>
          {item.subtitle && (
            <Text style={styles.contactSubtitle} numberOfLines={1}>
              {item.subtitle}
            </Text>
          )}
          {!isQuickTalkUser && item.type === "contact" && (
            <Text style={styles.notOnQuicktalk}>Not on QuickTalk</Text> // 🔹 small note
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
          <TouchableOpacity
            style={[
              styles.actionButton,
              !isQuickTalkUser && styles.disabledButton,
            ]}
            disabled={!isQuickTalkUser}
            onPress={() => {
              if (item.contact) {
                handleStartChat(item.contact);
              }
            }}
          >
            <Feather
              name="message-circle"
              size={18}
              color={isQuickTalkUser ? '#3A805B' : '#999'}
            />
          </TouchableOpacity>
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

    return (
      <View style={styles.headerStats}>
        <Text style={styles.statsText}>
          {totalContacts} saved contacts • {quicktalkUsers} on QuickTalk
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          {/* Header */}
          <View style={[styles.header, { paddingTop: Math.max(insets.top, 12), paddingBottom: 12 }]}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.push('/(tabs)')}>
              <Feather name='chevron-left' size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerLeft}>
              <Text style={styles.title}> Select Contacts</Text>
            </View>
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
            ListHeaderComponent={contacts.length > 0 ? renderHeader : null}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
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
    letterSpacing: 0.5,
  },
  backButton: {
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