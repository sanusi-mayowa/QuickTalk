import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Image, RefreshControl, SafeAreaView, } from 'react-native';
import { useTheme } from '@/lib/theme';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { auth, db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import Toast from 'react-native-toast-message';
import { useSocketChat } from '@/hooks/useSocketChat';
import { useOffline } from '@/hooks/useOffline';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

export default function ChatScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const chatId = params.id as string;
  const initialContactName = (params.contactName as string) || '';

  const [currentUserProfileId, setCurrentUserProfileId] = useState<string>('');
  const [otherParticipantId, setOtherParticipantId] = useState<string>('');
  const [resolving, setResolving] = useState(true);
  const [otherSummary, setOtherSummary] = useState<{ username?: string; phone?: string; profile_picture_url?: string | null; is_online?: boolean; last_seen?: string } | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [savedContactName, setSavedContactName] = useState<string | null>(null);
  const [savedContactId, setSavedContactId] = useState<string | null>(null);

  const getChatCacheKey = useCallback(() => `chat:${chatId}:data`, [chatId]);
  const getMessagesCacheKey = useCallback(() => `chat:${chatId}:messages`, [chatId]);
  const getParticipantCacheKey = useCallback(() => `participant:${otherParticipantId}`, [otherParticipantId]);

  const loadCachedData = useCallback(async () => {
    try {
      const [chatData, participant] = await Promise.all([
        AsyncStorage.getItem(getChatCacheKey()),
        otherParticipantId ? AsyncStorage.getItem(getParticipantCacheKey()) : null
      ]);

      if (chatData) {
        const parsed = JSON.parse(chatData);
        if (parsed.participants) {
          const user = auth.currentUser;
          if (user) {
            const qUser = query(collection(db, 'user_profiles'), where('auth_user_id', '==', user.uid));
            const snapUser = await getDocs(qUser);
            const meDoc = snapUser.docs[0];
            if (meDoc) {
              const myProfileId = meDoc.id;
              const otherId = parsed.participants.find((p: string) => p !== myProfileId) || '';
              setCurrentUserProfileId(myProfileId);
              setOtherParticipantId(otherId);
            }
          }
        }
      }

      if (participant) {
        setOtherSummary(JSON.parse(participant));
      }
    } catch {}
  }, [chatId, otherParticipantId, getChatCacheKey, getParticipantCacheKey]);

  const cacheData = useCallback(async (chatData: any, participantData: any) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(getChatCacheKey(), JSON.stringify(chatData)),
        participantData ? AsyncStorage.setItem(getParticipantCacheKey(), JSON.stringify(participantData)) : null
      ]);
    } catch {}
  }, [getChatCacheKey, getParticipantCacheKey]);

  useEffect(() => {
    // Prime header with passed-in saved contact name if available
    if (initialContactName && !savedContactName) {
      setSavedContactName(initialContactName);
    }
  }, [initialContactName, savedContactName]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
      setIsConnected(!!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    (async () => {
      if (chatId && otherSummary) {
        try { await AsyncStorage.setItem(`cache:chat:${chatId}:header`, JSON.stringify(otherSummary)); } catch {}
      }
    })();
  }, [chatId, otherSummary]);

  useEffect(() => {
    (async () => {
      if (!otherSummary && chatId) {
        try {
          const raw = await AsyncStorage.getItem(`cache:chat:${chatId}:header`);
          if (raw) setOtherSummary(JSON.parse(raw));
        } catch {}
      }
    })();
  }, [chatId, otherSummary]);

  useFocusEffect(
    useCallback(() => {
      loadCachedData();
    }, [loadCachedData])
  );

  useEffect(() => {
    const resolveParticipants = async () => {
      try {
        const user = auth.currentUser;
        if (!user || !chatId) return;

        const qUser = query(collection(db, 'user_profiles'), where('auth_user_id', '==', user.uid));
        const snapUser = await getDocs(qUser);
        const meDoc = snapUser.docs[0];
        if (!meDoc) {
          Toast.show({ type: 'error', text1: 'Profile not found' });
          setResolving(false);
          return;
        }
        const myProfileId = meDoc.id;

        const chatDoc = await getDoc(doc(db, 'chats', chatId));
        const chatData = chatDoc.exists() ? (chatDoc.data() as any) : null;
        if (!chatData) {
          Toast.show({ type: 'error', text1: 'Chat not found' });
          setResolving(false);
          return;
        }
        const parts: string[] = chatData.participants || [];
        const otherId = parts.find(p => p !== myProfileId) || '';

        setCurrentUserProfileId(myProfileId);
        setOtherParticipantId(otherId);
        
        let participantData = null;
        if (chatData && chatData.participant_summaries && chatData.participant_summaries[otherId]) {
          participantData = chatData.participant_summaries[otherId];
          setOtherSummary(participantData);
        } else {
          try {
            const otherDoc = await getDoc(doc(db, 'user_profiles', otherId));
            if (otherDoc.exists()) {
              const d: any = otherDoc.data();
              participantData = { username: d.username, phone: d.phone, profile_picture_url: d.profile_picture_url || d.profile_picture_data, is_online: d.is_online, last_seen: d.last_seen };
              setOtherSummary(participantData);
            }
          } catch {}
        }

        await cacheData(chatData, participantData);
      } catch (e) {
        setResolving(false);
      } finally {
        setResolving(false);
      }
    };
    resolveParticipants();
  }, [chatId, cacheData]);

  // Load saved contact name/id for the other participant from current user's contacts
  useEffect(() => {
    const loadSavedContact = async () => {
      try {
        if (!currentUserProfileId || !otherParticipantId) return;
        // First try deterministic doc id: other participant profile id
        const subDocRef = doc(db, 'user_profiles', currentUserProfileId, 'contacts', otherParticipantId);
        const subDoc = await getDoc(subDocRef);
        if (subDoc.exists()) {
          const data: any = subDoc.data();
          const first = (data.first_name || '').toString().trim();
          const last = (data.last_name || '').toString().trim();
          const display = (first || last) ? `${first} ${last}`.trim() : (data.displayName || null);
          setSavedContactName(display || null);
          setSavedContactId(subDoc.id);
          return;
        }
        // Fallback: query by contact_user_id
        const q = query(collection(db, 'user_profiles', currentUserProfileId, 'contacts'), where('contact_user_id', '==', otherParticipantId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0];
          const v: any = d.data();
          const first = (v.first_name || '').toString().trim();
          const last = (v.last_name || '').toString().trim();
          const display = (first || last) ? `${first} ${last}`.trim() : (v.displayName || null);
          setSavedContactName(display || null);
          setSavedContactId(d.id);
          return;
        }
        // As a last resort, try phone-based id if we have it
        if (otherSummary?.phone) {
          const phoneDocRef = doc(db, 'user_profiles', currentUserProfileId, 'contacts', otherSummary.phone);
          const phoneDoc = await getDoc(phoneDocRef);
          if (phoneDoc.exists()) {
            const data: any = phoneDoc.data();
            const first = (data.first_name || '').toString().trim();
            const last = (data.last_name || '').toString().trim();
            const display = (first || last) ? `${first} ${last}`.trim() : (data.displayName || null);
            setSavedContactName(display || null);
            setSavedContactId(phoneDoc.id);
            return;
          }
        }
        setSavedContactName(null);
        setSavedContactId(null);
      } catch {
        setSavedContactName(null);
        setSavedContactId(null);
      }
    };
    loadSavedContact();
  }, [currentUserProfileId, otherParticipantId, otherSummary?.phone]);

  const {
    messages,
    typingUsers,
    loading,
    isConnected: socketConnected,
    sendMessage,
    sendTypingIndicator,
    markChatAsRead,
    otherUserPresence,
  } = useSocketChat({ 
    chatId: chatId || '', 
    currentUserId: currentUserProfileId || '', 
    otherParticipantId: otherParticipantId || '',
    currentUsername: otherSummary?.username || otherSummary?.phone || 'User'
  });

  useEffect(() => {
    (async () => {
      try {
        if (chatId && Array.isArray(messages)) {
          await AsyncStorage.setItem(`cache:chat:${chatId}:messages`, JSON.stringify(messages));
        }
      } catch {}
    })();
  }, [chatId, messages]);

  const [input, setInput] = useState('');
  const { queueMessage } = useOffline();
  const listRef = useRef<FlatList<any>>(null);

  useFocusEffect(
    useCallback(() => {
      if (!chatId || !currentUserProfileId || !otherParticipantId) return;
      markChatAsRead().catch(() => {});
      return () => {};
    }, [chatId, currentUserProfileId, otherParticipantId, markChatAsRead])
  );

  const onSend = async () => {
    const text = input.trim();
    if (!text) return;
    
    try {
      if (isOffline || !isConnected) {
        // Queue message for offline sending
        await queueMessage(chatId, text, currentUserProfileId);
        Toast.show({
          type: 'info',
          text1: 'Message Queued',
          text2: 'Message will be sent when you\'re back online',
        });
      } else {
        // Send immediately if online
        await sendMessage(text);
      }
      
      setInput('');
      // Scroll to bottom after sending
      requestAnimationFrame(() => {
        try { listRef.current?.scrollToEnd({ animated: true }); } catch {}
      });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Send failed', text2: e?.message || 'Please try again' });
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadCachedData();
      if (!isOffline) {
        setResolving(true);
        setTimeout(() => setResolving(false), 100);
      }
    } finally {
      setRefreshing(false);
    }
  }, [loadCachedData, isOffline]);

  const formatLastSeen = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    const days = Math.floor(diffInMinutes / 1440);
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessageItem = useCallback(({ item }: { item: any }) => {
    if (item.__type === 'header') {
      return (
        <View style={[styles.dayHeaderContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }] }>
          <Text style={[styles.dayHeaderText, { color: theme.colors.mutedText }]}>{item.label}</Text>
        </View>
      );
    }
    const isMine = item.senderId === currentUserProfileId;
    const isDelivered = isMine && item.status === 'delivered';
    const isRead = isMine && item.status === 'seen';
    return (
      <View style={[styles.messageRow, isMine ? styles.mineRow : styles.theirRow]}>
        <View style={[styles.bubble, isMine ? styles.mineBubble : styles.theirBubble]}>
          <Text style={[styles.bubbleText, isMine ? styles.mineText : styles.theirText]}>{item.content}</Text>
          <View style={styles.messageTime}>
            <Text style={[styles.timeText, isMine ? styles.timeTextMine : styles.timeTextTheirs]}>
              {formatMessageTime(item.timestamp)}
            </Text>
            {isMine && (
              <View style={styles.messageStatus}>
                {isRead ? (
                  <View style={styles.doubleCheckContainer}>
                    <Feather name='check' size={12} color="#4CAF50" style={styles.firstCheck} />
                    <Feather name='check' size={12} color="#4CAF50" style={styles.secondCheck} />
                  </View>
                ) : isDelivered ? (
                  <View style={styles.doubleCheckContainer}>
                    <Feather name='check' size={12} color="#2196F3" style={styles.firstCheck} />
                    <Feather name='check' size={12} color="#2196F3" style={styles.secondCheck} />
                  </View>
                ) : (
                  <Feather name='check' size={12} color="#fff" />
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  }, [currentUserProfileId]);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    // Defer to next frame to ensure list has rendered
    requestAnimationFrame(() => {
      try { listRef.current?.scrollToEnd({ animated: true }); } catch {}
    });
  }, [messages?.length]);

  const getItemLayout = useCallback((_: any, index: number) => ({ length: 56, offset: 56 * index, index }), []);

  const isColdEmpty = !otherSummary && (!messages || messages.length === 0);

  const buildDatedItems = useCallback(() => {
    if (!Array.isArray(messages)) return [] as any[];
    const items: any[] = [];
    let lastDateKey = '';
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const dateKeyOf = (iso: string) => new Date(iso).toDateString();
    const labelOf = (iso: string) => {
      const d = new Date(iso);
      if (d.toDateString() === now.toDateString()) return 'Today';
      if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
      return d.toLocaleDateString();
    };
    const sorted = [...messages].sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    for (const m of sorted) {
      const k = dateKeyOf(m.timestamp);
      if (k !== lastDateKey) {
        items.push({ __type: 'header', id: `hdr-${k}-${items.length}`, label: labelOf(m.timestamp) });
        lastDateKey = k;
      }
      items.push(m);
    }
    return items;
  }, [messages]);

  const datedItems = buildDatedItems();

  const renderTypingIndicator = () => {
    if (typingUsers.length === 0) return null;
    return (
      <View style={styles.typingContainer}>
        <View style={styles.typingBubble}>
          <Text style={styles.typingText}>
            {typingUsers[0].username || 'User'} is typing
          </Text>
          <View style={styles.typingDots}>
            <View style={[styles.dot, styles.dot1]} />
            <View style={[styles.dot, styles.dot2]} />
            <View style={[styles.dot, styles.dot3]} />
          </View>
        </View>
      </View>
    );
  };

  const renderConnectionStatus = () => {
    if (socketConnected && !isOffline) return null;
    return (
      <View style={[styles.connectionBanner, { backgroundColor: socketConnected ? '#FF9800' : '#F44336' }]}>
        <Feather name={socketConnected ? 'wifi' : 'wifi-off'} size={16} color="#fff" />
        <Text style={styles.connectionText}>
          {socketConnected ? 'Reconnecting...' : 'Offline - Showing cached data'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#3A805B" }}>
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name='chevron-left' size={24} color={theme.colors.primaryText} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerCenter} onPress={() => {
          if (otherParticipantId) {
            router.push({
              pathname: '/user-profile',
              params: { 
                id: otherParticipantId,
                isSaved: savedContactId ? 'true' : 'false',
                ownerProfileId: currentUserProfileId,
                contactId: savedContactId || '',
                contactName: savedContactName || otherSummary?.phone || otherSummary?.username || 'QuickTalk user'
              }
            });
          }
        }}>
          {otherSummary?.profile_picture_url ? (
            <Image source={{ uri: otherSummary.profile_picture_url }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarPlaceholder}>
              <Feather name="user" size={20} color={theme.colors.primaryText} />
            </View>
          )}
          <View style={styles.headerInfo}>
            <Text style={[styles.headerTitle, { color: theme.colors.primaryText }]}>{savedContactName || (!savedContactId ? (otherSummary?.phone || otherSummary?.username) : (otherSummary?.username || otherSummary?.phone)) || 'QuickTalk user'}</Text>
            <Text style={[styles.headerSubtitle, { color: theme.colors.primaryText }]}>
              {otherUserPresence?.isOnline
                ? 'online'
                : (otherUserPresence?.lastSeen ? `last seen ${formatLastSeen(otherUserPresence.lastSeen)}` : '')}
            </Text>
          </View>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Video call">
            <Feather name="video" size={20} color={theme.colors.primaryText} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Voice call">
            <Feather name="phone" size={20} color={theme.colors.primaryText} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} accessibilityRole="button" accessibilityLabel="More options">
            <Feather name="more-vertical" size={20} color={theme.colors.primaryText} />
          </TouchableOpacity>
        </View>
      </View>

      {renderConnectionStatus()}

      {isColdEmpty && (
        <View style={styles.center}>
          <ActivityIndicator size="small" color="#3A805B" />
        </View>
      )}

      {!currentUserProfileId ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color="#3A805B" />
        </View>
      ) : (
      <FlatList
        data={datedItems}
        keyExtractor={(m: any, idx: number) => m.__type === 'header' ? m.id : m.id}
        contentContainerStyle={styles.list}
        ref={listRef}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        renderItem={renderMessageItem}
        getItemLayout={getItemLayout}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={10}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
      />)}

      {renderTypingIndicator()}

      <View style={[styles.composer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.composerButton} accessibilityRole="button" accessibilityLabel="Emoji">
          <Feather name="smile" size={24} color={theme.colors.mutedText} />
        </TouchableOpacity>
        <TextInput
          style={[styles.input, { backgroundColor: theme.colors.inputBg, color: theme.colors.text }]}
          value={input}
          onChangeText={(t) => { 
            setInput(t); 
            if (t.trim()) {
              sendTypingIndicator(true).catch(() => {}); 
            } else {
              sendTypingIndicator(false).catch(() => {});
            }
          }}
          onBlur={() => sendTypingIndicator(false).catch(() => {})}
          placeholder="Message"
          placeholderTextColor={theme.colors.mutedText}
          multiline
        />
        <TouchableOpacity style={styles.composerButton} accessibilityRole="button" accessibilityLabel="Attach">
          <Feather name="paperclip" size={24} color={theme.colors.mutedText} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.composerButton} accessibilityRole="button" accessibilityLabel="Camera">
          <Feather name="camera" size={24} color={theme.colors.mutedText} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.sendButton, { backgroundColor: theme.colors.primary }, !input.trim() && { opacity: 0.5 }]} 
          onPress={onSend} 
          disabled={!input.trim()}
        >
          {input.trim() ? (
            <Feather name='send' size={20} color={theme.colors.primaryText} />
          ) : (
            <Feather name='mic' size={20} color={theme.colors.primaryText} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
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
    paddingTop: 40,
    paddingBottom: 12,
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', flex: 1, marginLeft: 16 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  headerAvatarPlaceholder: { 
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center', marginRight: 12 
  },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 16, color: '#fff', fontWeight: '600', marginBottom: 2 },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerButton: { padding: 4 },
  connectionBanner: { 
    position: 'absolute', 
    top: 84, 
    alignSelf: 'center', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 12, 
    opacity: 0.9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  connectionText: { color: '#fff', fontSize: 12 },
  list: { padding: 12, paddingBottom: 70 },
  messageRow: { flexDirection: 'row', marginVertical: 4 },
  mineRow: { justifyContent: 'flex-end' },
  theirRow: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  mineBubble: { backgroundColor: '#3A805B', borderTopRightRadius: 4 },
  theirBubble: { backgroundColor: '#fff', borderTopLeftRadius: 4, borderWidth: 1, borderColor: '#e9ecef' },
  bubbleText: { fontSize: 16, marginBottom: 4 },
  mineText: { color: '#fff' },
  theirText: { color: '#333' },
  messageTime: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  timeText: { fontSize: 11, color: '#999' },
  timeTextMine: { color: 'rgba(255,255,255,0.8)' },
  timeTextTheirs: { color: '#999' },
  messageStatus: { marginLeft: 2 },
  typingContainer: { paddingHorizontal: 12, marginBottom: 6 },
  typingBubble: { 
    backgroundColor: '#fff', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 18, 
    borderTopLeftRadius: 4,
    borderWidth: 1, 
    borderColor: '#e9ecef',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  typingText: { color: '#666', fontStyle: 'italic', fontSize: 14 },
  typingDots: { flexDirection: 'row', gap: 2 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#999' },
  dot1: { opacity: 0.4 },
  dot2: { opacity: 0.7 },
  dot3: { opacity: 1 },
  composer: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e9ecef' },
  composerButton: { padding: 8 },
  input: { flex: 1, fontSize: 16, color: '#000', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#f6f6f6', borderRadius: 20, minHeight: 40, maxHeight: 100 },
  sendButton: { backgroundColor: '#3A805B', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  doubleCheckContainer: { flexDirection: 'row', alignItems: 'center' },
  firstCheck: { position: 'absolute' },
  secondCheck: { position: 'absolute' },
  dayHeaderContainer: { alignItems: 'center', marginVertical: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  dayHeaderText: { fontSize: 12 },
});
