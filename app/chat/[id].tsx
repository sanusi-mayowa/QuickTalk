import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import Toast from 'react-native-toast-message';
import { useRealtimeChat } from '@/hooks/useRealtimeChat';
import MessageItem from '@/components/MessageItem';

interface ChatParticipant {
  id: string;
  username: string;
  about: string;
  profile_picture_url: string | null;
  phone: string;
}

// ADDED: Interface for contact information
interface ContactInfo {
  id?: string;
  first_name?: string;
  last_name?: string;
  is_saved: boolean;
}

export default function ChatScreen() {
  const router = useRouter();
  const { id: chatId } = useLocalSearchParams<{ id: string }>();
  const [participant, setParticipant] = useState<ChatParticipant | null>(null);
  // ADDED: State for contact information
  const [contactInfo, setContactInfo] = useState<ContactInfo>({ is_saved: false });
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use the real-time chat hook
  const {
    messages,
    typingUsers,
    otherUserPresence,
    unreadCount,
    loading: chatLoading,
    sendMessage,
    sendTypingIndicator,
    markChatAsRead,
  } = useRealtimeChat({
    chatId: chatId || '',
    currentUserId,
    otherParticipantId: participant?.id || '',
  });

  // Load chat details when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (chatId) {
        loadChatDetails();
        // Mark chat as read when entering
        if (currentUserId && participant?.id) {
          markChatAsRead();
        }
      }
    }, [chatId, currentUserId, participant?.id])
  );

  // ADDED: Function to load contact information
  const loadContactInfo = async (participantId: string, participantPhone: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: currentUserProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', session.user.id)
        .single();

      if (!currentUserProfile) return;

      // Check if this user is saved as a contact
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, first_name, last_name')
        .eq('owner_id', currentUserProfile.id)
        .eq('contact_user_id', participantId)
        .single();

      if (contact) {
        setContactInfo({
          id: contact.id,
          first_name: contact.first_name,
          last_name: contact.last_name,
          is_saved: true,
        });
      } else {
        setContactInfo({ is_saved: false });
      }
    } catch (error) {
      console.error('Error loading contact info:', error);
      setContactInfo({ is_saved: false });
    }
  };

  const loadChatDetails = async () => {
    try {
      if (!chatId) return;

      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: currentUserProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', session.user.id)
        .single();

      if (!currentUserProfile) return;

      setCurrentUserId(currentUserProfile.id);

      // Get chat details
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .select('participant_1, participant_2')
        .eq('id', chatId)
        .single();

      if (chatError) {
        throw chatError;
      }

      // Determine the other participant
      const otherParticipantId = chat.participant_1 === currentUserProfile.id 
        ? chat.participant_2 
        : chat.participant_1;

      // Get other participant details
      const { data: participantData, error: participantError } = await supabase
        .from('user_profiles')
        .select('id, username, about, profile_picture_url, phone')
        .eq('id', otherParticipantId)
        .single();

      if (participantError) {
        throw participantError;
      }

      setParticipant(participantData);
      // ADDED: Load contact information after setting participant
      await loadContactInfo(participantData.id, participantData.phone);
    } catch (error: any) {
      console.error('Error loading chat details:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load chat details',
      });
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !currentUserId || !participant) return;

    const message = messageText.trim();
    setMessageText('');

    // Stop typing indicator
    setIsTyping(false);
    sendTypingIndicator(false);

    try {
      await sendMessage(message);
      
      // Scroll to bottom after sending
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error: any) {
      console.error('Error sending message:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to send message',
        text2: error.message || 'Please try again',
      });
      // Restore message text on error
      setMessageText(message);
    }
  };

  const handleTextChange = (text: string) => {
    setMessageText(text);

    // Handle typing indicator
    if (text.length > 0 && !isTyping) {
      setIsTyping(true);
      sendTypingIndicator(true);
    } else if (text.length === 0 && isTyping) {
      setIsTyping(false);
      sendTypingIndicator(false);
    }

    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing indicator after 2 seconds of inactivity
    if (text.length > 0) {
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        sendTypingIndicator(false);
      }, 2000);
    }
  };

  const handleCall = () => {
    // MODIFIED: Use display name instead of username
    const displayName = getDisplayName();
    Alert.alert(
      'Voice Call',
      `Call ${displayName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Call', 
          onPress: () => {
            Toast.show({
              type: 'info',
              text1: 'Coming Soon',
              text2: 'Voice calling feature will be available soon',
            });
          }
        },
      ]
    );
  };

  const handleVideoCall = () => {
    // MODIFIED: Use display name instead of username
    const displayName = getDisplayName();
    Alert.alert(
      'Video Call',
      `Video call ${displayName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Call', 
          onPress: () => {
            Toast.show({
              type: 'info',
              text1: 'Coming Soon',
              text2: 'Video calling feature will be available soon',
            });
          }
        },
      ]
    );
  };

  // ADDED: Function to get display name (contact name or phone number)
  const getDisplayName = () => {
    if (contactInfo.is_saved && contactInfo.first_name) {
      return `${contactInfo.first_name}${contactInfo.last_name ? ` ${contactInfo.last_name}` : ''}`;
    }
    return participant?.phone || 'Unknown';
  };

  // ADDED: Function to handle profile view
  const handleProfileView = () => {
    if (!participant) return;
    
    router.push({
      pathname: '/user-profile',
      params: {
        userId: participant.id,
        username: participant.username,
        about: participant.about,
        profilePicture: participant.profile_picture_url || '',
        phone: participant.phone,
        isOnline: otherUserPresence?.is_online ? 'true' : 'false',
        lastSeen: otherUserPresence?.last_seen || '',
        isSaved: contactInfo.is_saved ? 'true' : 'false',
        contactId: contactInfo.id || '',
        contactName: contactInfo.is_saved ? getDisplayName() : '',
      },
    });
  };

  // ADDED: Function to format presence status
  const getPresenceText = () => {
    if (!otherUserPresence) return '';
    
    if (otherUserPresence.is_online) {
      return 'Online';
    }
    
    const lastSeen = new Date(otherUserPresence.last_seen);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60));
    
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
        return lastSeen.toLocaleDateString();
      }
    }
  };

  const renderMessage = ({ item, index }: { item: any; index: number }) => {
    const isMyMessage = item.sender_id === currentUserId;
    const showReadReceipt = isMyMessage && index === messages.length - 1; // Show on last message only

    return (
      <MessageItem
        message={item}
        isMyMessage={isMyMessage}
        showReadReceipt={showReadReceipt}
        otherParticipantId={participant?.id}
      />
    );
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTyping) {
        sendTypingIndicator(false);
      }
    };
  }, [isTyping, sendTypingIndicator]);

  if (loading || chatLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3A805B" />
        <Text style={styles.loadingText}>Loading chat...</Text>
      </View>
    );
  }

  if (!participant) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Chat not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Feather name='chevron-left' size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          {/* MODIFIED: Made participant info clickable */}
          <TouchableOpacity style={styles.participantInfo} onPress={handleProfileView}>
            {participant.profile_picture_url ? (
              <Image source={{ uri: participant.profile_picture_url }} style={styles.headerAvatar} />
            ) : (
              <View style={styles.headerAvatarPlaceholder}>
                {/* MODIFIED: Show first letter of display name */}
                <Feather name='user' size={20} color="#fff" />
              </View>
            )}
            
            <View style={styles.headerTextContainer}>
              {/* MODIFIED: Show contact name or phone number */}
              <Text style={styles.headerTitle}>{getDisplayName()}</Text>
              {/* ADDED: Show typing indicator under name when user is typing */}
              {typingUsers.length > 0 ? (
                <Text style={styles.typingText}>typing...</Text>
              ) : (
                <Text style={styles.presenceText}>{getPresenceText()}</Text>
              )}
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={handleVideoCall}>
            <Feather name='video' size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={handleCall}>
            <Feather name='phone' size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Feather name='more-vertical' size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              Start your conversation with {getDisplayName()}
            </Text>
          </View>
        }
      />

      {/* Message Input */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.textInput}
            value={messageText}
            onChangeText={handleTextChange}
            placeholder="Type a message..."
            placeholderTextColor="#999"
            multiline
            maxLength={1000}
          />
          
          <TouchableOpacity
            style={[
              styles.sendButton,
              messageText.trim() ? styles.sendButtonActive : styles.sendButtonInactive
            ]}
            onPress={handleSendMessage}
            disabled={!messageText.trim()}
          >
            <Feather name='send' size={20} color={messageText.trim() ? "#fff" : "#999"} />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#3A805B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#3A805B',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 16,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  // ADDED: Style for typing text under name
  typingText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontStyle: 'italic',
  },
  // ADDED: Style for presence text under name
  presenceText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  messagesList: {
    flex: 1,
    backgroundColor: '#fff',
  },
  messagesContainer: {
    paddingVertical: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  inputContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f8f9fa',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 44,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonActive: {
    backgroundColor: '#3A805B',
  },
  sendButtonInactive: {
    backgroundColor: 'transparent',
  },
});