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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { auth, db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, updateDoc, where, deleteDoc } from 'firebase/firestore';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRealtimeChat } from '@/hooks/useRealtimeChat';
import MessageItem from '@/components/MessageItem';

interface ChatParticipant {
  id: string;
  username: string;
  about: string;
  profile_picture_data: string | null;
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
  const insets = useSafeAreaInsets();
  const { id: chatId } = useLocalSearchParams<{ id: string }>();
  const [participant, setParticipant] = useState<ChatParticipant | null>(null);
  // ADDED: State for contact information
  const [contactInfo, setContactInfo] = useState<ContactInfo>({ is_saved: false });
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use the real-time chat hook (only when we have valid IDs)
  const {
    messages,
    typingUsers,
    otherUserPresence,
    unreadCount,
    loading: chatLoading,
    isOffline,
    sendMessage,
    sendTypingIndicator,
    markChatAsRead,
    markMessageAsDelivered,
  } = useRealtimeChat({
    chatId: chatId || '',
    currentUserId: currentUserId || '',
    otherParticipantId: participant?.id || '',
  });



  // ADDED: Function to load contact information
  const loadContactInfo = useCallback(async (participantId: string, participantPhone: string) => {
    try {
        if (!participantId) {
            console.warn('No participantId, skipping contact info query');
            setContactInfo({ is_saved: false });
            return;
        }

      const user = auth.currentUser;
      if (!user) return;
      const userSnap = await getDocs(query(collection(db, 'user_profiles'), where('auth_user_id', '==', user.uid)));
      const currentUserProfile: any = userSnap.docs[0]?.data();
      if (!currentUserProfile) return;

      const contactSnap = await getDocs(query(
        collection(db, 'contacts'),
        where('owner_id', '==', currentUserProfile.id),
        where('contact_user_id', '==', participantId)
      ));

      const contact: any = contactSnap.docs[0]?.data();

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
  }, []);

  const loadChatDetails = useCallback(async () => {
    try {
      if (!chatId) return;

      // Try to load cached participant and contact info first for offline/startup
      try {
        const cachedParticipantRaw = await AsyncStorage.getItem(`cache:chat:${chatId}:participant`);
        if (cachedParticipantRaw) {
          const cachedParticipant = JSON.parse(cachedParticipantRaw);
          setParticipant(cachedParticipant);
        }
        const cachedContactRaw = await AsyncStorage.getItem(`cache:chat:${chatId}:contact`);
        if (cachedContactRaw) {
          const cachedContact = JSON.parse(cachedContactRaw);
          setContactInfo(cachedContact);
        }
      } catch {}

      // Get current user profile by auth
      const user = auth.currentUser;
      if (!user) return;
      const userSnap = await getDocs(query(collection(db, 'user_profiles'), where('auth_user_id', '==', user.uid)));
      
      if (userSnap.empty) {
        console.error('No user profile found');
        setLoading(false);
        return;
      }
      
      const currentUserProfile: any = userSnap.docs[0]?.data();

      // Add the document ID to the profile
      const currentUserProfileWithId = {
        id: userSnap.docs[0].id,
        ...currentUserProfile
      };
      
      setCurrentUserId(currentUserProfileWithId.id);

      // Get chat details
      const chatRef = doc(db, 'chats', chatId);
      const chatSnapshot = await getDoc(chatRef);
      if (!chatSnapshot.exists()) throw new Error('Chat not found');
      const chatData: any = chatSnapshot.data();

      // Determine the other participant
      const otherParticipantId = (chatData.participants || [chatData.participant_1, chatData.participant_2])
        .find((pid: string) => pid !== currentUserProfileWithId.id);
            
      // Guard: don't query if undefined
      if (!otherParticipantId) {
        console.warn("Other participant ID is undefined, skipping participant query");
        setParticipant(null);
        setLoading(false);
        return;
      }

      // Get other participant details by document ID
      const otherDoc = await getDoc(doc(db, 'user_profiles', otherParticipantId));
      if (!otherDoc.exists()) throw new Error('Participant not found');
      
      const participantData: any = otherDoc.data();

      // Add the document ID to participant data
      const participantWithId = {
        id: otherDoc.id,
        ...participantData
      };
      setParticipant(participantWithId);
      try { await AsyncStorage.setItem(`cache:chat:${chatId}:participant`, JSON.stringify(participantData)); } catch {}

      if (participantWithId.id) {
        await loadContactInfo(participantWithId.id, participantWithId.phone);
      }
      try {
        await AsyncStorage.setItem(`cache:chat:${chatId}:contact`, JSON.stringify({
          id: contactInfo.id,
          first_name: contactInfo.first_name,
          last_name: contactInfo.last_name,
          is_saved: contactInfo.is_saved,
        }));
      } catch {}
    } catch (error: any) {
      console.error('Error loading chat details:', error);
      // Fallback to cached data if available instead of navigating back
      try {
        const cachedParticipantRaw = await AsyncStorage.getItem(`cache:chat:${chatId}:participant`);
        const cachedContactRaw = await AsyncStorage.getItem(`cache:chat:${chatId}:contact`);
        if (cachedParticipantRaw) {
          const cachedParticipant = JSON.parse(cachedParticipantRaw);
          setParticipant(cachedParticipant);
        }
        if (cachedContactRaw) {
          const cachedContact = JSON.parse(cachedContactRaw);
          setContactInfo(cachedContact);
        }
        if (!cachedParticipantRaw) {
          Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load chat details' });
          router.back();
        }
      } catch {
        Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load chat details' });
        router.back();
      }
    } finally {
      setLoading(false);
    }
  }, [chatId, router, loadContactInfo, contactInfo.id, contactInfo.first_name, contactInfo.last_name, contactInfo.is_saved]);

  // Only run hooks when we have valid data
  const hasValidData = chatId && currentUserId && participant?.id;

  // Load chat details when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (chatId) {
        loadChatDetails();
        // Mark chat as read when entering (only if we have valid data)
        if (hasValidData) {
          markChatAsRead();
        }
      }
    }, [chatId, hasValidData, loadChatDetails, markChatAsRead])
  );

  const handleSendMessage = async () => {
    if (!messageText.trim() || !currentUserId || !participant) {
      console.log('Cannot send message - missing data:', {
        messageText: messageText.trim(),
        currentUserId,
        participant: !!participant
      });
      return;
    }

    const message = messageText.trim();
    console.log('Sending message:', {
      content: message,
      chatId,
      currentUserId,
      participantId: participant?.id
    });
    
    setMessageText(''); // Clear input immediately

    // Stop typing indicator
    setIsTyping(false);
    sendTypingIndicator(false);

    try {
      // Use Supabase for message sending
      console.log('Using Supabase for message sending');
      const result = await sendMessage(message);
      console.log('Message sent via Supabase:', result);
      
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

  const handleMessageReaction = async (messageId: string, reaction: string) => {
    try {
      const msgRef = doc(db, 'messages', messageId);
      const snap = await getDoc(msgRef);
      const currentReactions = (snap.data() as any)?.reactions || {};
      const updatedReactions = { ...currentReactions, [currentUserId]: reaction };
      await updateDoc(msgRef, { reactions: updatedReactions });

      Toast.show({
        type: 'success',
        text1: 'Reaction added',
        text2: `You reacted with ${reaction}`,
      });
    } catch (error: any) {
      console.error('Error adding reaction:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to add reaction',
        text2: 'Please try again',
      });
    }
  };

  const handleMessageCopy = async (messageId: string, content: string) => {
    try {
      // In React Native, we would use Clipboard API
      // For now, just show a toast
      Toast.show({
        type: 'success',
        text1: 'Copied to clipboard',
        text2: 'Message copied successfully',
      });
    } catch (error: any) {
      console.error('Error copying message:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to copy message',
        text2: 'Please try again',
      });
    }
  };

  const handleMessageForward = async (messageId: string) => {
    try {
      const snap = await getDoc(doc(db, 'messages', messageId));
      const message: any = snap.exists() ? snap.data() : null;
      if (message) {
        // Navigate to contact selection for forwarding
        router.push({
          pathname: '/select-contact',
          params: {
            forwardMessage: message.content,
            forwardMessageId: messageId,
          },
        });
      }
    } catch (error: any) {
      console.error('Error forwarding message:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to forward message',
        text2: 'Please try again',
      });
    }
  };

  const handleMessageDelete = async (messageId: string) => {
    try {
      await deleteDoc(doc(db, 'messages', messageId));

      Toast.show({
        type: 'success',
        text1: 'Message deleted',
        text2: 'Message has been deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting message:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to delete message',
        text2: 'Please try again',
      });
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

  const mergedMessages: any[] = Array.isArray(messages) ? (messages as any[]) : [];

  // Function to format date for separators
  const formatDateSeparator = (timestamp: string) => {
    const date = new Date(timestamp);
    // Use absolute local date for separators
    return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Function to group messages by date
  const groupMessagesByDate = (messages: any[] | readonly any[]) => {
    const list = Array.from(messages);
    const grouped: any[] = [];
    let currentDate = '';
    
    list.forEach((message, index) => {
      const messageDate = formatDateSeparator(message.created_at);
      
      if (messageDate !== currentDate) {
        // Add date separator
        grouped.push({
          type: 'dateSeparator',
          date: messageDate,
          id: `date-${message.created_at}`,
        });
        currentDate = messageDate;
      }
      
      // Add message
      grouped.push({
        type: 'message',
        ...message,
      });
    });
    
    return grouped;
  };

  const groupedMessages = groupMessagesByDate(mergedMessages as any[]);

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    if (item.type === 'dateSeparator') {
      return (
        <View style={styles.dateSeparator}>
          <Text style={styles.dateSeparatorText}>{item.date}</Text>
        </View>
      );
    }
    
    const isMyMessage = item.sender_id === currentUserId;
    // Find the last actual message (not date separator) to show read receipt
    const lastMessageIndex = groupedMessages.findLastIndex(msg => msg.type === 'message');
    const showReadReceipt = isMyMessage && index === lastMessageIndex;

    return (
      <MessageItem
        message={item}
        isMyMessage={isMyMessage}
        showReadReceipt={showReadReceipt}
        otherParticipantId={participant?.id}
        senderLabel={isMyMessage ? 'You' : getDisplayName()}
        onReaction={handleMessageReaction}
        onForward={handleMessageForward}
        onCopy={handleMessageCopy}
        onDelete={handleMessageDelete}
      />
    );
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (groupedMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [groupedMessages.length]);

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

  

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {/* Header */}
      <View style={[
        styles.header,
        { paddingTop: Math.max(insets.top, 12), paddingBottom: 12 }
      ]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name='chevron-left' size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          {/* MODIFIED: Made participant info clickable */}
          <TouchableOpacity style={styles.participantInfo} onPress={handleProfileView}>
            {participant?.profile_picture_url ? (
              <Image source={{ uri: participant?.profile_picture_url || '' }} style={styles.headerAvatar} />
            ) : (
              <View style={styles.headerAvatarPlaceholder}>
                {/* MODIFIED: Show first letter of display name */}
                <Feather name='user' size={20} color="#fff" />
              </View>
            )}
            
            <View style={styles.headerTextContainer}>
              {/* MODIFIED: Show contact name or phone number */}
              <Text style={styles.headerTitle}>{getDisplayName()}</Text>
              {/* MODIFIED: Hide presence when offline */}
              <Text style={styles.presenceText}>{isOffline ? '' : getPresenceText()}</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.headerActions}>
          {/* <TouchableOpacity style={styles.headerButton} onPress={handleVideoCall}>
            <Feather name='video' size={22} color="#fff" />
          </TouchableOpacity> */}
          <TouchableOpacity onPress={handleCall}>
            <Feather name='phone-missed' size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity>
            <Feather name='more-vertical' size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={groupedMessages}
        renderItem={renderItem}
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
        ListFooterComponent={
          typingUsers.length > 0 ? (
            <View style={styles.typingIndicatorContainer}>
              <View style={styles.typingIndicatorBubble}>
                <Text style={styles.typingIndicatorDots}>•••</Text>
              </View>
            </View>
          ) : null
        }
      />

      {/* Message Input */}
      <View style={styles.inputContainer}>
        <View style={[
          styles.inputWrapper,
          isInputFocused && styles.inputWrapperFocused
        ]}>
          <TextInput
            style={styles.textInput}
            value={messageText}
            onChangeText={handleTextChange}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
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
            activeOpacity={0.7}
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
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 40,
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
  // ADDED: Typing indicator bubble at bottom
  typingIndicatorContainer: {
    paddingTop: 4,
    paddingBottom: 8,
    paddingHorizontal: 16,
    alignItems: 'flex-start',
  },
  typingIndicatorBubble: {
    backgroundColor: '#e9ecef',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    maxWidth: '60%',
  },
  typingIndicatorDots: {
    fontSize: 18,
    color: '#666',
    letterSpacing: 2,
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
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f8f9fa',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  inputWrapperFocused: {
    borderColor: '#3A805B',
    backgroundColor: '#fff',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    maxHeight: 120,
    paddingVertical: 8,
    paddingHorizontal: 4,
    lineHeight: 20,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  sendButtonActive: {
    backgroundColor: '#3A805B',
  },
  sendButtonInactive: {
    backgroundColor: '#e9ecef',
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  dateSeparatorText: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    fontWeight: '500',
  },
});   