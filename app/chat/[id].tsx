import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { RealtimeService } from '@/lib/realtime';
import { Message, User, Chat } from '@/types/chat';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MediaPicker from '@/components/MediaPicker';
import VoiceRecorder from '@/components/VoiceRecorder';
import VoicePlayer from '@/components/VoicePlayer';
import { CameraService, MediaResult } from '@/lib/camera';
import { VoiceRecording } from '@/lib/voice';

interface MessageWithSender extends Message {
  sender?: User;
}

export default function ChatScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [chat, setChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    getCurrentUser();
    fetchChat();
    fetchMessages();
    
    // Subscribe to real-time updates
    const messageSubscription = RealtimeService.subscribeToChat(
      id as string,
      handleNewMessage,
      handleMessageUpdate,
      handleMessageDelete
    );

    const typingSubscription = RealtimeService.subscribeToTyping(
      id as string,
      handleTypingStart,
      handleTypingStop
    );

    return () => {
      messageSubscription.unsubscribe();
      typingSubscription.unsubscribe();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [id]);

  const getCurrentUser = async () => {
    const userId = await AsyncStorage.getItem('userID');
    if (userId) {
      setCurrentUserId(userId);
    }
  };

  const fetchChat = async () => {
    try {
      const { data, error } = await supabase
        .from('chats')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setChat(data);
    } catch (error) {
      console.error('Error fetching chat:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users (
            id,
            display_name,
            email,
            avatar_url
          )
        `)
        .eq('chat_id', id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewMessage = async (newMessage: Message) => {
    // Fetch the complete message with sender info
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:users (
          id,
          display_name,
          email,
          avatar_url
        )
      `)
      .eq('id', newMessage.id)
      .single();

    if (!error && data) {
      setMessages(prev => {
        const exists = prev.find(msg => msg.id === newMessage.id);
        if (exists) return prev;
        return [...prev, data];
      });
    }
  };

  const handleMessageUpdate = (updatedMessage: Message) => {
    setMessages(prev => 
      prev.map(msg => 
        msg.id === updatedMessage.id ? { ...msg, ...updatedMessage } : msg
      )
    );
  };

  const handleMessageDelete = (messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  };

  const handleTypingStart = (userId: string) => {
    if (userId !== currentUserId) {
      setTypingUsers(prev => new Set([...prev, userId]));
    }
  };

  const handleTypingStop = (userId: string) => {
    setTypingUsers(prev => {
      const newSet = new Set(prev);
      newSet.delete(userId);
      return newSet;
    });
  };

  const handleTextChange = (text: string) => {
    setNewMessage(text);
    
    // Send typing indicator
    if (text.length > 0) {
      RealtimeService.sendTypingIndicator(id as string, currentUserId, true);
      
      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        RealtimeService.sendTypingIndicator(id as string, currentUserId, false);
      }, 2000);
    } else {
      RealtimeService.sendTypingIndicator(id as string, currentUserId, false);
    }
  };

  const sendMessage = async (content: string, messageType: 'text' | 'image' | 'video' | 'audio' = 'text', mediaUrl?: string) => {
    if (!content.trim() && !mediaUrl) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          chat_id: id,
          sender_id: currentUserId,
          content: content.trim() || '',
          message_type: messageType,
          media_url: mediaUrl,
        });

      if (error) throw error;
      
      // Stop typing indicator
      RealtimeService.sendTypingIndicator(id as string, currentUserId, false);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const handleSendText = () => {
    if (newMessage.trim()) {
      sendMessage(newMessage);
      setNewMessage('');
    }
  };

  const handleMediaSelected = async (media: MediaResult) => {
    // In a real app, you would upload the media to storage first
    // For now, we'll just send the local URI
    const messageType = media.type === 'image' ? 'image' : 'video';
    await sendMessage('', messageType, media.uri);
  };

  const handleVoiceRecordingComplete = async (recording: VoiceRecording) => {
    // In a real app, you would upload the audio to storage first
    await sendMessage('Voice message', 'audio', recording.uri);
    setShowVoiceRecorder(false);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const renderMessage = ({ item, index }: { item: MessageWithSender; index: number }) => {
    const isOwnMessage = item.sender_id === currentUserId;
    const showAvatar = !isOwnMessage && (
      index === messages.length - 1 ||
      messages[index + 1]?.sender_id !== item.sender_id
    );

    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer
      ]}>
        {showAvatar && (
          <View style={styles.avatarContainer}>
            {item.sender?.avatar_url ? (
              <Image source={{ uri: item.sender.avatar_url }} style={styles.messageAvatar} />
            ) : (
              <View style={[styles.messageAvatar, styles.defaultMessageAvatar]}>
                <Text style={styles.messageAvatarText}>
                  {item.sender?.display_name?.charAt(0).toUpperCase() || 
                   item.sender?.email?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
            )}
          </View>
        )}
        
        <View style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
          !showAvatar && !isOwnMessage && styles.messageBubbleNoAvatar
        ]}>
          {item.message_type === 'image' && item.media_url && (
            <Image source={{ uri: item.media_url }} style={styles.messageImage} />
          )}
          
          {item.message_type === 'video' && item.media_url && (
            <View style={styles.videoContainer}>
              <Image source={{ uri: item.media_url }} style={styles.messageImage} />
              <View style={styles.playButton}>
                <Text style={styles.playButtonText}>▶</Text>
              </View>
            </View>
          )}
          
          {item.message_type === 'audio' && item.media_url && (
            <VoicePlayer
              uri={item.media_url}
              duration={5000} // You would get this from the message data
              isOwnMessage={isOwnMessage}
            />
          )}
          
          {item.content && (
            <Text style={[
              styles.messageText,
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText
            ]}>
              {item.content}
            </Text>
          )}
          
          <Text style={[
            styles.messageTime,
            isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime
          ]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  const renderTypingIndicator = () => {
    if (typingUsers.size === 0) return null;

    return (
      <View style={styles.typingContainer}>
        <Text style={styles.typingText}>
          {typingUsers.size === 1 ? 'Someone is typing...' : 'Multiple people are typing...'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#075E54" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name='arrow-left' size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatar}>
            {chat?.avatar_url ? (
              <Image source={{ uri: chat.avatar_url }} style={styles.headerAvatarImage} />
            ) : (
              <View style={[styles.headerAvatarImage, styles.defaultHeaderAvatar]}>
                <Text style={styles.headerAvatarText}>
                  {chat?.name?.charAt(0).toUpperCase() || 'C'}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>{chat?.name || 'Chat'}</Text>
            <Text style={styles.headerSubtitle}>
              {typingUsers.size > 0 ? 'typing...' : 'Online'}
            </Text>
          </View>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionButton}>
            <Feather name='video' size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerActionButton}>
            <Feather name='phone' size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={renderTypingIndicator}
      />

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <View style={styles.inputContainer}>
          {showVoiceRecorder ? (
            <VoiceRecorder
              onRecordingComplete={handleVoiceRecordingComplete}
              onCancel={() => setShowVoiceRecorder(false)}
            />
          ) : (
            <View style={styles.inputWrapper}>
              <TouchableOpacity 
                style={styles.attachButton}
                onPress={() => setShowMediaPicker(true)}
              >
                <Feather name='paperclip' size={20} color="#8E8E93" />
              </TouchableOpacity>
              
              <TextInput
                style={styles.textInput}
                placeholder="Type a message..."
                placeholderTextColor="#8E8E93"
                value={newMessage}
                onChangeText={handleTextChange}
                multiline
                maxLength={1000}
              />
              
              {newMessage.trim() ? (
                <TouchableOpacity style={styles.sendButton} onPress={handleSendText}>
                  <Feather name='send' size={20} color="#FFFFFF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={styles.micButton}
                  onPress={() => setShowVoiceRecorder(true)}
                >
                  <Feather name='mic' size={20} color="#8E8E93" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Media Picker */}
      <MediaPicker
        visible={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onMediaSelected={handleMediaSelected}
        allowVideo={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E5DDD5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#075E54',
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
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    marginRight: 12,
  },
  headerAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  defaultHeaderAvatar: {
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  headerActionButton: {
    padding: 4,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 16,
  },
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 2,
    paddingHorizontal: 16,
  },
  ownMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  defaultMessageAvatar: {
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageAvatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    marginVertical: 1,
  },
  messageBubbleNoAvatar: {
    marginLeft: 40,
  },
  ownMessageBubble: {
    backgroundColor: '#DCF8C6',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
  },
  videoContainer: {
    position: 'relative',
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#000',
  },
  otherMessageText: {
    color: '#000',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  ownMessageTime: {
    color: '#666',
  },
  otherMessageTime: {
    color: '#999',
  },
  typingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  typingText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  inputContainer: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  attachButton: {
    marginRight: 8,
    padding: 4,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: 4,
    color: '#000',
  },
  sendButton: {
    backgroundColor: '#25D366',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  micButton: {
    padding: 8,
    marginLeft: 8,
  },
});