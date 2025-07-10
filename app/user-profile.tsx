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
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import Toast from 'react-native-toast-message';

export default function UserProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Extract parameters
  const userId = params.userId as string;
  const username = params.username as string;
  const about = params.about as string;
  const profilePicture = params.profilePicture as string;
  const phone = params.phone as string;
  const isOnline = params.isOnline === 'true';
  const lastSeen = params.lastSeen as string;
  const isSaved = params.isSaved === 'true';
  const contactId = params.contactId as string;
  const contactName = params.contactName as string;

  const [loading, setLoading] = useState(false);
  const [aboutUpdatedAt, setAboutUpdatedAt] = useState<string>('');

  useEffect(() => {
    loadProfileDetails();
  }, []);

  const loadProfileDetails = async () => {
    try {
      // Get when the about was last updated
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('updated_at')
        .eq('id', userId)
        .single();

      if (profile) {
        setAboutUpdatedAt(profile.updated_at);
      }
    } catch (error) {
      console.error('Error loading profile details:', error);
    }
  };

  const handleSaveContact = () => {
    router.push({
      pathname: '/new-contact',
      params: {
        prefillPhone: phone,
        prefillFirstName: username,
        fromProfile: 'true',
      },
    });
  };

  const formatLastSeen = (lastSeenTime: string) => {
    if (!lastSeenTime) return '';
    
    const date = new Date(lastSeenTime);
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

  const formatAboutUpdated = (updatedTime: string) => {
    if (!updatedTime) return '';
    
    const date = new Date(updatedTime);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return 'Today';
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getDisplayName = () => {
    return isSaved && contactName ? contactName : phone;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
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
            {profilePicture ? (
              <Image source={{ uri: profilePicture }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Feather name='user' size={40} color="#666" />
              </View>
            )}
          </View>
          
          <Text style={styles.displayName}>{getDisplayName()}</Text>
          
          {isSaved && (
            <Text style={styles.username}>{username}</Text>
          )}
          
          <Text style={styles.phoneNumber}>{phone}</Text>
        </View>

        {/* Status Section */}
        <View style={styles.statusSection}>
          <View style={styles.statusItem}>
            <View style={[
              styles.statusIndicator,
              isOnline ? styles.onlineIndicator : styles.offlineIndicator
            ]} />
            <Text style={styles.statusText}>
              {isOnline ? 'Online' : `Last seen ${formatLastSeen(lastSeen)}`}
            </Text>
          </View>
        </View>

        {/* About Section */}
        <View style={styles.aboutSection}>
          <View style={styles.aboutHeader}>
            <Feather name='info' size={20} color="#666" />
            <Text style={styles.aboutTitle}>About</Text>
          </View>
          
          <Text style={styles.aboutText}>{about}</Text>
          
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
        {!isSaved && (
          <View style={styles.actionsSection}>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveContact}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name='user-plus' size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>Save Contact</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Contact Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Contact Information</Text>
          
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{phone}</Text>
          </View>
          
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Username</Text>
            <Text style={styles.infoValue}>{username}</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#3A805B',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  avatarContainer: {
    marginBottom: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#3A805B',
  },
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
  displayName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  username: {
    fontSize: 16,
    color: '#3A805B',
    marginBottom: 8,
    fontWeight: '500',
  },
  phoneNumber: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  statusSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  onlineIndicator: {
    backgroundColor: '#4CAF50',
  },
  offlineIndicator: {
    backgroundColor: '#999',
  },
  statusText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  aboutSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  aboutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  aboutTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  aboutText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    marginBottom: 12,
  },
  aboutFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aboutUpdated: {
    fontSize: 12,
    color: '#999',
  },
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
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
});