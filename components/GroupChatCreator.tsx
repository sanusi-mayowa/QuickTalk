import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  Modal,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { CameraService } from '@/lib/camera';
import { User } from '@/types/chat';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface GroupChatCreatorProps {
  visible: boolean;
  onClose: () => void;
  onGroupCreated: (chatId: string) => void;
}

export default function GroupChatCreator({ visible, onClose, onGroupCreated }: GroupChatCreatorProps) {
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupAvatar, setGroupAvatar] = useState<string>('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    if (visible) {
      getCurrentUser();
      fetchUsers();
    }
  }, [visible]);

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
        .neq('id', userId)
        .order('display_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const toggleUserSelection = (userId: string) => {
    const newSelection = new Set(selectedUsers);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUsers(newSelection);
  };

  const handleChangeAvatar = async () => {
    Alert.alert(
      'Group Photo',
      'Choose an option',
      [
        { text: 'Camera', onPress: takePhoto },
        { text: 'Photo Library', onPress: pickFromLibrary },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const takePhoto = async () => {
    const result = await CameraService.takePhoto({
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result) {
      setGroupAvatar(result.uri);
    }
  };

  const pickFromLibrary = async () => {
    const result = await CameraService.pickImageFromLibrary({
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result && !Array.isArray(result)) {
      setGroupAvatar(result.uri);
    }
  };

  const createGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    if (selectedUsers.size < 1) {
      Alert.alert('Error', 'Please select at least one member');
      return;
    }

    setLoading(true);

    try {
      // Create the group chat
      const { data: newChat, error: chatError } = await supabase
        .from('chats')
        .insert({
          name: groupName.trim(),
          description: groupDescription.trim() || null,
          avatar_url: groupAvatar || null,
          is_group: true,
          created_by: currentUserId,
        })
        .select()
        .single();

      if (chatError) throw chatError;

      // Add participants (including creator as admin)
      const participants = [
        { chat_id: newChat.id, user_id: currentUserId, is_admin: true },
        ...Array.from(selectedUsers).map(userId => ({
          chat_id: newChat.id,
          user_id: userId,
          is_admin: false,
        })),
      ];

      const { error: participantsError } = await supabase
        .from('chat_participants')
        .insert(participants);

      if (participantsError) throw participantsError;

      // Send welcome message
      await supabase
        .from('messages')
        .insert({
          chat_id: newChat.id,
          sender_id: currentUserId,
          content: `${groupName} group was created`,
          message_type: 'text',
        });

      onGroupCreated(newChat.id);
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert('Error', 'Failed to create group. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setGroupName('');
    setGroupDescription('');
    setGroupAvatar('');
    setSelectedUsers(new Set());
  };

  const renderUserItem = ({ item }: { item: User }) => {
    const isSelected = selectedUsers.has(item.id);

    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => toggleUserSelection(item.id)}
      >
        <View style={styles.userInfo}>
          <View style={styles.userAvatar}>
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {item.display_name?.charAt(0).toUpperCase() || 
                 item.email.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <Text style={styles.userName}>
            {item.display_name || item.email}
          </Text>
        </View>
        
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Feather name='check' size={16} color="#FFFFFF" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Feather name='x' size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Group</Text>
          <TouchableOpacity
            onPress={createGroup}
            disabled={loading || !groupName.trim() || selectedUsers.size === 0}
            style={[
              styles.createButton,
              (!groupName.trim() || selectedUsers.size === 0) && styles.createButtonDisabled
            ]}
          >
            <Text style={[
              styles.createButtonText,
              (!groupName.trim() || selectedUsers.size === 0) && styles.createButtonTextDisabled
            ]}>
              Create
            </Text>
          </TouchableOpacity>
        </View>

        {/* Group Info */}
        <View style={styles.groupInfo}>
          <TouchableOpacity style={styles.avatarContainer} onPress={handleChangeAvatar}>
            {groupAvatar ? (
              <Image source={{ uri: groupAvatar }} style={styles.groupAvatar} />
            ) : (
              <View style={[styles.groupAvatar, styles.defaultAvatar]}>
                <Feather name="users" size={32} color="#FFFFFF" />
              </View>
            )}
            <View style={styles.cameraButton}>
              <Feather name='camera' size={16} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Group name"
              value={groupName}
              onChangeText={setGroupName}
              maxLength={50}
            />
            <TextInput
              style={[styles.input, styles.descriptionInput]}
              placeholder="Group description (optional)"
              value={groupDescription}
              onChangeText={setGroupDescription}
              multiline
              maxLength={200}
            />
          </View>
        </View>

        {/* Members */}
        <View style={styles.membersSection}>
          <Text style={styles.sectionTitle}>
            Add Members ({selectedUsers.size} selected)
          </Text>
          
          <FlatList
            data={users}
            renderItem={renderUserItem}
            keyExtractor={(item) => item.id}
            style={styles.usersList}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>
    </Modal>
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
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.5,
  },
  createButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
  },
  createButtonDisabled: {
    backgroundColor: '#E5E5EA',
  },
  createButtonText: {
    color: '#000',
    fontWeight: '600',
  },
  createButtonTextDisabled: {
    color: '#8E8E93',
  },
  groupInfo: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  groupAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  defaultAvatar: {
    backgroundColor: '#3A805B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 50,
    height: 50,
    borderRadius: 50,
    backgroundColor: '#3A805B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  inputContainer: {
    flex: 1,
  },
  input: {
    fontSize: 16,
    color: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    paddingVertical: 8,
    marginBottom: 12,
  },
  descriptionInput: {
    minHeight: 40,
    textAlignVertical: 'top',
  },
  membersSection: {
    flex: 1,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  usersList: {
    flex: 1,
  },
  userItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 16,
    color: '#000',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#25D366',
    borderColor: '#25D366',
  },
});