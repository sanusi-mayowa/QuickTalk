import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import NetInfo from '@react-native-community/netinfo';

// 🔹 Firestore imports
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // make sure path is correct

export default function UserProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  // navigation params (some are still needed)
  const userId = params.userId as string;
  const isSaved = params.isSaved === 'true';
  const contactId = params.contactId as string;
  const contactName = params.contactName as string;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [aboutUpdatedAt, setAboutUpdatedAt] = useState<string>('');
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    if (!userId) return;

    // Watch network status
    const unsubscribeNetInfo = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
    });

    // Try cached profile first
    const loadCache = async () => {
      try {
        const cached = await AsyncStorage.getItem(`user_profile:${userId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          setProfile(parsed);
          if (parsed.updated_at) setAboutUpdatedAt(parsed.updated_at);
          setLoading(false);
        }
      } catch (e) {
        console.error('Error reading cache', e);
      }
    };
    loadCache();

    // Firestore real-time subscription
    const unsubscribe = onSnapshot(
      doc(db, 'user_profiles', userId),
      async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setProfile(data);
          setLoading(false);

          if (data.updated_at) setAboutUpdatedAt(data.updated_at);

          // update cache
          try {
            await AsyncStorage.setItem(
              `user_profile:${userId}`,
              JSON.stringify(data)
            );
          } catch {}
        } else {
          Toast.show({ type: 'error', text1: 'User not found' });
          setLoading(false);
        }
      },
      (error) => {
        console.error('Firestore error:', error);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
      unsubscribeNetInfo();
    };
  }, [userId]);

  const handleEditContact = () => {
    if (!isSaved || !contactId) return;
    router.push(`/edit-contact?contactId=${contactId}`);
  };

  const handleSaveContact = () => {
    if (!profile) return;
    router.push({
      pathname: '/new-contact',
      params: {
        prefillPhone: profile.phone,
        prefillFirstName: profile.username,
        prefillUsername: profile.username,
        fromProfile: 'true',
      },
    });
  };

  const formatLastSeen = (lastSeenTime: string) => {
    if (!lastSeenTime) return '';
    const date = new Date(lastSeenTime);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    const days = Math.floor(diffInMinutes / 1440);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const formatAboutUpdated = (updatedTime: string) => {
    if (!updatedTime) return '';
    const date = new Date(updatedTime);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return date.toLocaleDateString();
  };

  const getDisplayName = () => {
    if (!profile) return '';
    return isSaved && contactName ? contactName : profile.phone;
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3A805B" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text>User not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12), paddingBottom: 12 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name='chevron-left' size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            {profile.profilePicture ? (
              <Image source={{ uri: profile.profilePicture }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Feather name='user' size={40} color="#666" />
              </View>
            )}
          </View>
          <Text style={styles.displayName}>{getDisplayName()}</Text>
          {isSaved && <Text style={styles.username}>{profile.username}</Text>}
          <Text style={styles.phoneNumber}>{profile.phone}</Text>
        </View>

        {/* Status Section */}
        <View style={styles.statusSection}>
          <View style={styles.statusItem}>
            <View
              style={[
                styles.statusIndicator,
                profile.isOnline ? styles.onlineIndicator : styles.offlineIndicator,
              ]}
            />
            <Text style={styles.statusText}>
              {profile.isOnline
                ? 'Online'
                : `Last seen ${formatLastSeen(profile.lastSeen)}`}
            </Text>
          </View>
          {!isConnected && (
            <Text style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
              Offline mode (showing cached data)
            </Text>
          )}
        </View>

        {/* About Section */}
        <View style={styles.aboutSection}>
          <View style={styles.aboutHeader}>
            <Feather name='info' size={20} color="#666" />
            <Text style={styles.aboutTitle}>About</Text>
          </View>
          <Text style={styles.aboutText}>{profile.about}</Text>
          {aboutUpdatedAt && (
            <View style={styles.aboutFooter}>
              <Feather name='clock' size={14} color="#999" />
              <Text style={styles.aboutUpdated}>
                Updated {formatAboutUpdated(aboutUpdatedAt)}
              </Text>
            </View>
          )}
        </View>

        {/* Actions Section */}
        {!isSaved ? (
          <View style={styles.actionsSection}>
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveContact}>
              <Feather name='user-plus' size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Save Contact</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.actionsSection}>
            <TouchableOpacity style={styles.saveButton} onPress={handleEditContact}>
              <Feather name='edit-3' size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Edit Contact</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Contact Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Contact Information</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{profile.phone}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Username</Text>
            <Text style={styles.infoValue}>{profile.username}</Text>
          </View>
          {isSaved && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Saved as</Text>
              <Text style={styles.infoValue}>{contactName}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#3A805B',
  },
  headerTitle: { fontSize: 20, fontWeight: '600', color: '#fff' },
  placeholder: { width: 40 },
  content: { flex: 1 },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  avatarContainer: { marginBottom: 20 },
  avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: '#3A805B' },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#dee2e6',
  },
  displayName: { fontSize: 24, fontWeight: '700', color: '#333', marginBottom: 4, textAlign: 'center' },
  username: { fontSize: 16, color: '#3A805B', marginBottom: 8, fontWeight: '500' },
  phoneNumber: { fontSize: 16, color: '#666', marginBottom: 16 },
  statusSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  statusItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusIndicator: { width: 12, height: 12, borderRadius: 6 },
  onlineIndicator: { backgroundColor: '#4CAF50' },
  offlineIndicator: { backgroundColor: '#999' },
  statusText: { fontSize: 16, color: '#333', fontWeight: '500' },
  aboutSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  aboutHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  aboutTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  aboutText: { fontSize: 16, color: '#333', lineHeight: 24, marginBottom: 12 },
  aboutFooter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aboutUpdated: { fontSize: 12, color: '#999' },
  actionsSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#fff',
    marginTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3A805B',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  infoSection: { backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 20, marginTop: 8 },
  infoTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 16 },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: { fontSize: 14, color: '#666', fontWeight: '500' },
  infoValue: { fontSize: 14, color: '#333', fontWeight: '600' },
});
