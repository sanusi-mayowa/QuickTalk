import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

interface StatusUpdate {
  id: string;
  user_id: string;
  content: string;
  media_url?: string;
  media_type: 'text' | 'image' | 'video';
  created_at: string;
  expires_at: string;
  views_count: number;
  user?: {
    id: string;
    display_name: string;
    email: string;
    avatar_url?: string;
  };
}

interface StatusGroup {
  user_id: string;
  user: {
    id: string;
    display_name: string;
    email: string;
    avatar_url?: string;
  };
  statuses: StatusUpdate[];
  latest_status: StatusUpdate;
  unviewed_count: number;
}

export default function UpdatesScreen() {
  const [myStatuses, setMyStatuses] = useState<StatusUpdate[]>([]);
  const [recentUpdates, setRecentUpdates] = useState<StatusGroup[]>([]);
  const [viewedUpdates, setViewedUpdates] = useState<StatusGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    getCurrentUser();
    fetchStatusUpdates();
  }, []);

  const getCurrentUser = async () => {
    const userId = await AsyncStorage.getItem('userID');
    if (userId) {
      setCurrentUserId(userId);
    }
  };

  const fetchStatusUpdates = async () => {
    try {
      const userId = await AsyncStorage.getItem('userID');
      if (!userId) return;

      // Fetch my statuses
      const { data: myStatusData, error: myError } = await supabase
        .from('status_updates')
        .select(`
          *,
          user:users (
            id,
            display_name,
            email,
            avatar_url
          )
        `)
        .eq('user_id', userId)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (myError) throw myError;
      setMyStatuses(myStatusData || []);

      // Fetch other users' statuses
      const { data: othersStatusData, error: othersError } = await supabase
        .from('status_updates')
        .select(`
          *,
          user:users (
            id,
            display_name,
            email,
            avatar_url
          )
        `)
        .neq('user_id', userId)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (othersError) throw othersError;

      // Group statuses by user
      const groupedStatuses = groupStatusesByUser(othersStatusData || []);
      
      // Separate recent and viewed updates (mock logic for now)
      const recent = groupedStatuses.slice(0, 3);
      const viewed = groupedStatuses.slice(3);
      
      setRecentUpdates(recent);
      setViewedUpdates(viewed);
    } catch (error) {
      console.error('Error fetching status updates:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupStatusesByUser = (statuses: StatusUpdate[]): StatusGroup[] => {
    const grouped = statuses.reduce((acc, status) => {
      const userId = status.user_id;
      if (!acc[userId]) {
        acc[userId] = {
          user_id: userId,
          user: status.user!,
          statuses: [],
          latest_status: status,
          unviewed_count: 0,
        };
      }
      acc[userId].statuses.push(status);
      if (new Date(status.created_at) > new Date(acc[userId].latest_status.created_at)) {
        acc[userId].latest_status = status;
      }
      acc[userId].unviewed_count = acc[userId].statuses.length;
      return acc;
    }, {} as Record<string, StatusGroup>);

    return Object.values(grouped);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return `${Math.floor(diffInHours / 24)}d ago`;
    }
  };

  const renderMyStatus = () => (
    <View style={styles.myStatusSection}>
      <Text style={styles.sectionTitle}>My status</Text>
      <TouchableOpacity style={styles.myStatusItem}>
        <View style={styles.statusAvatarContainer}>
          <View style={[styles.statusAvatar, styles.myStatusAvatar]}>
            <Text style={styles.statusAvatarText}>
              {currentUserId ? 'U' : 'M'}
            </Text>
          </View>
          <View style={styles.addStatusButton}>
            <Feather name="plus" size={16} color="#FFFFFF" />
          </View>
        </View>
        
        <View style={styles.statusContent}>
          <Text style={styles.statusName}>My status</Text>
          <Text style={styles.statusTime}>
            {myStatuses.length > 0 
              ? `${formatTime(myStatuses[0].created_at)} • Tap to add status update`
              : 'Tap to add status update'
            }
          </Text>
        </View>
        
        <TouchableOpacity style={styles.moreButton}>
            <Feather name="more-horizontal" size={16} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );

  const renderStatusGroup = ({ item }: { item: StatusGroup }) => (
    <TouchableOpacity style={styles.statusItem}>
      <View style={styles.statusAvatarContainer}>
        <View style={[
          styles.statusAvatar,
          item.unviewed_count > 0 ? styles.unviewedStatusBorder : styles.viewedStatusBorder
        ]}>
          {item.user.avatar_url ? (
            <Image source={{ uri: item.user.avatar_url }} style={styles.statusAvatarImage} />
          ) : (
            <View style={[styles.statusAvatarImage, styles.defaultStatusAvatar]}>
              <Text style={styles.statusAvatarText}>
                {item.user.display_name?.charAt(0).toUpperCase() || 
                 item.user.email.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      </View>
      
      <View style={styles.statusContent}>
        <Text style={styles.statusName}>
          {item.user.display_name || item.user.email}
        </Text>
        <Text style={styles.statusTime}>
          {formatTime(item.latest_status.created_at)}
        </Text>
      </View>
    </TouchableOpacity>
  );

//   const renderChannelUpdates = () => (
//     <View style={styles.channelSection}>
//       <View style={styles.channelHeader}>
//         <Text style={styles.sectionTitle}>Channels</Text>
//         <TouchableOpacity>
//           <Text style={styles.findChannelsText}>Find channels</Text>
//         </TouchableOpacity>
//       </View>
      
//       <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.channelScroll}>
//         {[
//           { name: 'WhatsApp', image: 'https://images.pexels.com/photos/147413/twitter-facebook-together-exchange-of-information-147413.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&fit=crop' },
//           { name: 'Tech News', image: 'https://images.pexels.com/photos/518543/pexels-photo-518543.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&fit=crop' },
//           { name: 'Sports', image: 'https://images.pexels.com/photos/274422/pexels-photo-274422.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&fit=crop' },
//           { name: 'News', image: 'https://images.pexels.com/photos/518543/pexels-photo-518543.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&fit=crop' },
//         ].map((channel, index) => (
//           <TouchableOpacity key={index} style={styles.channelItem}>
//             <Image source={{ uri: channel.image }} style={styles.channelImage} />
//             <Text style={styles.channelName}>{channel.name}</Text>
//             <TouchableOpacity style={styles.followButton}>
//               <Text style={styles.followButtonText}>Follow</Text>
//             </TouchableOpacity>
//           </TouchableOpacity>
//         ))}
//       </ScrollView>
//     </View>
//   );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Updates</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton}>
            <Feather name="camera" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Feather name="more-vertical" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* My Status */}
        {renderMyStatus()}

        {/* Channel Updates */}
        {/* {renderChannelUpdates()} */}

        {/* Recent Updates */}
        {recentUpdates.length > 0 && (
          <View style={styles.updatesSection}>
            <Text style={styles.sectionTitle}>Recent updates</Text>
            <FlatList
              data={recentUpdates}
              renderItem={renderStatusGroup}
              keyExtractor={(item) => item.user_id}
              scrollEnabled={false}
            />
          </View>
        )}

        {/* Viewed Updates */}
        {viewedUpdates.length > 0 && (
          <View style={styles.updatesSection}>
            <Text style={styles.sectionTitle}>Viewed updates</Text>
            <FlatList
              data={viewedUpdates}
              renderItem={renderStatusGroup}
              keyExtractor={(item) => item.user_id}
              scrollEnabled={false}
            />
          </View>
        )}

        {/* Empty State */}
        {recentUpdates.length === 0 && viewedUpdates.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Feather name="eye" size={48} color="#8E8E93" />
            <Text style={styles.emptyStateTitle}>No updates</Text>
            <Text style={styles.emptyStateText}>
              Status updates from your contacts will appear here
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Floating Action Buttons */}
      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fabSecondary}>
            <Feather name="camera" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.fabPrimary}>
            <Feather name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
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
    backgroundColor: '#3A805B',
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
  content: {
    flex: 1,
  },
  myStatusSection: {
    paddingVertical: 16,
    borderBottomWidth: 8,
    borderBottomColor: '#F2F2F7',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 12,
    marginHorizontal: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  myStatusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statusAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  statusAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    padding: 3,
  },
  myStatusAvatar: {
    backgroundColor: '#F2F2F7',
  },
  unviewedStatusBorder: {
    backgroundColor: '#25D366',
  },
  viewedStatusBorder: {
    backgroundColor: '#E5E5EA',
  },
  statusAvatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  defaultStatusAvatar: {
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  addStatusButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  statusContent: {
    flex: 1,
  },
  statusName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  statusTime: {
    fontSize: 14,
    color: '#8E8E93',
  },
  moreButton: {
    padding: 8,
  },
  channelSection: {
    paddingVertical: 16,
    borderBottomWidth: 8,
    borderBottomColor: '#F2F2F7',
  },
  channelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  findChannelsText: {
    fontSize: 14,
    color: '#25D366',
    fontWeight: '600',
  },
  channelScroll: {
    paddingLeft: 16,
  },
  channelItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 80,
  },
  channelImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginBottom: 8,
  },
  channelName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
    marginBottom: 8,
  },
  followButton: {
    backgroundColor: '#25D366',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  followButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  updatesSection: {
    paddingVertical: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
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
    backgroundColor: '#8E8E93',
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
  fabPrimary: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#25D366',
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