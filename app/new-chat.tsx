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
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { User } from '@/types/chat';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function NewChatScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    getCurrentUser();
    fetchUsers();
  }, []);

  const getCurrentUser = async () => {
    const userId = await AsyncStorage.getItem('userID');
    if (userId) {
      setCurrentUserId(userId);
    }
  };

  const fetchUsers = async () => {
    try {
      const userId = await AsyncStorage.getItem('userID');
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .neq('id', userId) // Exclude current user
        .order('display_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const createChat = async (otherUserId: string) => {
    try {
      // Check if chat already exists between these users
      const { data: existingChats, error: checkError } = await supabase
        .from('chat_participants')
        .select(`
          chat_id,
          chat:chats!inner (
            id,
            is_group
          )
        `)
        .eq('user_id', currentUserId);

      if (checkError) throw checkError;

      // Find existing one-on-one chat
      for (const chatParticipant of existingChats || []) {
        if (!chatParticipant.chat.is_group) {
          const { data: otherParticipants } = await supabase
            .from('chat_participants')
            .select('user_id')
            .eq('chat_id', chatParticipant.chat_id)
            .neq('user_id', currentUserId);

          if (otherParticipants?.length === 1 && otherParticipants[0].user_id === otherUserId) {
            // Chat already exists, navigate to it
            router.replace(`/chat/${chatParticipant.chat_id}`);
            return;
          }
        }
      }

      // Create new chat
      const { data: newChat, error: chatError } = await supabase
        .from('chats')
        .insert({
          is_group: false,
        })
        .select()
        .single();

      if (chatError) throw chatError;

      // Add participants
      const { error: participantsError } = await supabase
        .from('chat_participants')
        .insert([
          { chat_id: newChat.id, user_id: currentUserId },
          { chat_id: newChat.id, user_id: otherUserId },
        ]);

      if (participantsError) throw participantsError;

      // Navigate to the new chat
      router.replace(`/chat/${newChat.id}`);
    } catch (error) {
      console.error('Error creating chat:', error);
    }
  };

  const filteredUsers = users.filter(user =>
    user.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderUserItem = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => createChat(item.id)}
    >
      <View style={styles.avatarContainer}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.defaultAvatar]}>
            <Text style={styles.avatarText}>
              {item.display_name?.charAt(0).toUpperCase() || 
               item.email.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        {item.is_online && <View style={styles.onlineIndicator} />}
      </View>

      <View style={styles.userContent}>
        <Text style={styles.userName}>
          {item.display_name || item.email}
        </Text>
        <Text style={styles.userStatus}>
          {item.is_online ? 'Online' : `Last seen ${item.last_seen || 'recently'}`}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#075E54" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Chat</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
            <Feather name="search" size={24} color="#8E8E93" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts..."
            placeholderTextColor="#8E8E93"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Users List */}
      <FlatList
        data={filteredUsers}
        renderItem={renderUserItem}
        keyExtractor={(item) => item.id}
        style={styles.usersList}
        showsVerticalScrollIndicator={false}
      />
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
    alignItems: 'center',
    backgroundColor: '#3A805B',
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F2F2F7',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#000',
  },
  usersList: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  userItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  defaultAvatar: {
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#25D366',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  userContent: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  userStatus: {
    fontSize: 14,
    color: '#8E8E93',
  },
});