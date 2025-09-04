import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  RefreshControl,
  SafeAreaView,
  ActionSheetIOS,
  Modal,
  Pressable,
} from "react-native";
import { useTheme } from "@/lib/theme";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { auth, db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import Toast from "react-native-toast-message";
import { useSocketChat } from "@/hooks/useSocketChat";
// Use require to avoid TS type issues if expo-clipboard types are missing
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Clipboard: any = require("expo-clipboard");
import FirebaseService from "@/lib/firebase";
import { useOffline } from "@/hooks/useOffline";
import { useOfflineAuth } from "@/hooks/useOfflineAuth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

export default function ChatScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const chatId = params.id as string;
  const initialContactName = (params.contactName as string) || "";

  // Use offline auth hook for user profile management
  const { currentUser, isOnline: authIsOnline, loadCachedUserProfile } = useOfflineAuth();

  const [currentUserProfileId, setCurrentUserProfileId] = useState<string>("");
  const [otherParticipantId, setOtherParticipantId] = useState<string>("");
  const [resolving, setResolving] = useState(true);
  const [otherSummary, setOtherSummary] = useState<{
    username?: string;
    phone?: string;
    profile_picture_url?: string | null;
    is_online?: boolean;
    last_seen?: string;
  } | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [savedContactName, setSavedContactName] = useState<string | null>(null);
  const [savedContactId, setSavedContactId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<any | null>(null);
  const [showAndroidSheet, setShowAndroidSheet] = useState(false);
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [sendingMedia, setSendingMedia] = useState(false);
  // Optimistic UI overlays
  const [messageOverrides, setMessageOverrides] = useState<Record<string, Partial<any>>>({});
  const [hiddenMessageIds, setHiddenMessageIds] = useState<Set<string>>(new Set());
  // Blocking state
  const [isBlockedByMe, setIsBlockedByMe] = useState<boolean>(false);
  const [isBlockedByOther, setIsBlockedByOther] = useState<boolean>(false);
  // Disappearing messages state
  const [disappearingEnabled, setDisappearingEnabled] = useState<boolean>(false);
  const [disappearingDurationSec, setDisappearingDurationSec] = useState<number>(0);
  const [showDisappearModal, setShowDisappearModal] = useState(false);
  // User default disappearing messages
  const [userDefaultEnabled, setUserDefaultEnabled] = useState<boolean>(false);
  const [userDefaultDurationSec, setUserDefaultDurationSec] = useState<number>(0);

  const getChatCacheKey = useCallback(() => `chat:${chatId}:data`, [chatId]);
  const getMessagesCacheKey = useCallback(
    () => `chat:${chatId}:messages`,
    [chatId]
  );
  const getParticipantCacheKey = useCallback(
    () => `participant:${otherParticipantId}`,
    [otherParticipantId]
  );

  const loadCachedData = useCallback(async () => {
    try {
      const [chatData, participant] = await Promise.all([
        AsyncStorage.getItem(getChatCacheKey()),
        otherParticipantId
          ? AsyncStorage.getItem(getParticipantCacheKey())
          : null,
      ]);

      if (chatData) {
        const parsed = JSON.parse(chatData);
        if (parsed.participants) {
          // Use cached user profile if available, fallback to Firestore only if online
          if (currentUser) {
            const myProfileId = currentUser.id;
            const otherId =
              parsed.participants.find((p: string) => p !== myProfileId) ||
              "";
            setCurrentUserProfileId(myProfileId);
            setOtherParticipantId(otherId);
          } else if (authIsOnline) {
            // Only try Firestore if we're online and don't have cached profile
            const user = auth.currentUser;
            if (user) {
              const qUser = query(
                collection(db, "user_profiles"),
                where("auth_user_id", "==", user.uid)
              );
              const snapUser = await getDocs(qUser);
              const meDoc = snapUser.docs[0];
              if (meDoc) {
                const myProfileId = meDoc.id;
                const otherId =
                  parsed.participants.find((p: string) => p !== myProfileId) ||
                  "";
                setCurrentUserProfileId(myProfileId);
                setOtherParticipantId(otherId);
              }
            }
          }
        }
      }

      if (participant) {
        setOtherSummary(JSON.parse(participant));
      }
    } catch {}
  }, [chatId, otherParticipantId, getChatCacheKey, getParticipantCacheKey, currentUser, authIsOnline]);

  const cacheData = useCallback(
    async (chatData: any, participantData: any) => {
      try {
        await Promise.all([
          AsyncStorage.setItem(getChatCacheKey(), JSON.stringify(chatData)),
          participantData
            ? AsyncStorage.setItem(
                getParticipantCacheKey(),
                JSON.stringify(participantData)
              )
            : null,
        ]);
      } catch {}
    },
    [getChatCacheKey, getParticipantCacheKey]
  );

  useEffect(() => {
    // Prime header with passed-in saved contact name if available
    if (initialContactName && !savedContactName) {
      setSavedContactName(initialContactName);
    }
  }, [initialContactName, savedContactName]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
      setIsConnected(!!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    (async () => {
      if (chatId && otherSummary) {
        try {
          await AsyncStorage.setItem(
            `cache:chat:${chatId}:header`,
            JSON.stringify(otherSummary)
          );
        } catch {}
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

        // Use cached user profile if available, fallback to Firestore only if online
        let myProfileId: string;
        
        if (currentUser) {
          myProfileId = currentUser.id;
        } else if (authIsOnline) {
          // Only try Firestore if we're online and don't have cached profile
          const qUser = query(
            collection(db, "user_profiles"),
            where("auth_user_id", "==", user.uid)
          );
          const snapUser = await getDocs(qUser);
          const meDoc = snapUser.docs[0];
          if (!meDoc) {
            Toast.show({ type: "error", text1: "Profile not found" });
            setResolving(false);
            return;
          }
          myProfileId = meDoc.id;
        } else {
          // Offline and no cached profile, try to load from cache
          const hasCachedProfile = await loadCachedUserProfile();
          if (hasCachedProfile) {
            // The hook should have updated currentUser by now, check again
            if (currentUser) {
              myProfileId = (currentUser as any).id;
            } else {
              // Still no currentUser, try to get from AsyncStorage directly
              try {
                const cachedProfileStr = await AsyncStorage.getItem('cached_user_profile');
                if (cachedProfileStr) {
                  const cachedProfile = JSON.parse(cachedProfileStr) as any;
                  myProfileId = cachedProfile.id;
                } else {
                  Toast.show({ type: "error", text1: "Profile not available offline" });
                  setResolving(false);
                  return;
                }
              } catch {
                Toast.show({ type: "error", text1: "Profile not available offline" });
                setResolving(false);
                return;
              }
            }
          } else {
            Toast.show({ type: "error", text1: "Profile not available offline" });
            setResolving(false);
            return;
          }
        }

        const chatDoc = await getDoc(doc(db, "chats", chatId));
        const chatData = chatDoc.exists() ? (chatDoc.data() as any) : null;
        if (!chatData) {
          Toast.show({ type: "error", text1: "Chat not found" });
          setResolving(false);
          return;
        }
        const parts: string[] = chatData.participants || [];
        const otherId = parts.find((p) => p !== myProfileId) || "";

        setCurrentUserProfileId(myProfileId);
        setOtherParticipantId(otherId);

        // Load disappearing settings (nested object)
        const dm = chatData.disappearingMessages || {};
        setDisappearingEnabled(!!dm.enabled);
        setDisappearingDurationSec(Number(dm.duration || 0));

        // Load user-level default
        try {
          const meRef = doc(db, 'user_profiles', myProfileId);
          const meSnap = await getDoc(meRef);
          if (meSnap.exists()) {
            const ud = (meSnap.data() as any).disappearingDefaults || {};
            setUserDefaultEnabled(!!ud.enabled);
            setUserDefaultDurationSec(Number(ud.duration || 0));
          }
        } catch {}

        let participantData = null;
        if (
          chatData &&
          chatData.participant_summaries &&
          chatData.participant_summaries[otherId]
        ) {
          participantData = chatData.participant_summaries[otherId];
          setOtherSummary(participantData);
        } else {
          try {
            const otherDoc = await getDoc(doc(db, "user_profiles", otherId));
            if (otherDoc.exists()) {
              const d: any = otherDoc.data();
              participantData = {
                username: d.username,
                phone: d.phone,
                profile_picture_url:
                  d.profile_picture_url || d.profile_picture_data,
                is_online: d.is_online,
                last_seen: d.last_seen,
              };
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
  }, [chatId, cacheData, currentUser, authIsOnline, loadCachedUserProfile]);

  // Subscribe to other participant profile for live avatar/username updates
  useEffect(() => {
    if (!otherParticipantId) return;
    const ref = doc(db, "user_profiles", otherParticipantId);
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const d: any = snap.data();
      setOtherSummary((prev) => ({
        ...(prev || {}),
        username: d.username || (prev || {}).username,
        phone: d.phone || (prev || {}).phone,
        profile_picture_url: d.profile_picture_url || d.profile_picture_data || (prev || {}).profile_picture_url || null,
        is_online: typeof d.is_online === 'boolean' ? d.is_online : (prev || {}).is_online,
        last_seen: d.last_seen || (prev || {}).last_seen,
      }));
    });
    return () => unsubscribe();
  }, [otherParticipantId]);

  // Subscribe to chat doc for disappearing updates
  useEffect(() => {
    if (!chatId) return;
    const ref = doc(db, 'chats', chatId);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const d: any = snap.data();
      const dm = (d as any).disappearingMessages || {};
      setDisappearingEnabled(!!dm.enabled);
      setDisappearingDurationSec(Number(dm.duration || 0));
    });
    return () => unsub();
  }, [chatId]);

  // Subscribe to my user default
  useEffect(() => {
    if (!currentUserProfileId) return;
    const ref = doc(db, 'user_profiles', currentUserProfileId);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const d: any = snap.data();
      const ud = (d as any).disappearingDefaults || {};
      setUserDefaultEnabled(!!ud.enabled);
      setUserDefaultDurationSec(Number(ud.duration || 0));
    });
    return () => unsub();
  }, [currentUserProfileId]);

  // Watch block status (both directions)
  useEffect(() => {
    if (!currentUserProfileId || !otherParticipantId) return;
    const myBlockRef = doc(
      db,
      "user_profiles",
      currentUserProfileId,
      "blocked",
      otherParticipantId
    );
    const theirBlockRef = doc(
      db,
      "user_profiles",
      otherParticipantId,
      "blocked",
      currentUserProfileId
    );
    const unsubMine = onSnapshot(myBlockRef, (snap) => {
      const d: any = snap.exists() ? snap.data() : null;
      // Active when doc exists and not explicitly unblocked
      const active = !!d && d.blocked !== false && !d.unblockedAt;
      setIsBlockedByMe(active);
    });
    const unsubTheirs = onSnapshot(theirBlockRef, (snap) => {
      const d: any = snap.exists() ? snap.data() : null;
      const active = !!d && d.blocked !== false && !d.unblockedAt;
      setIsBlockedByOther(active);
    });
    return () => {
      try { unsubMine(); } catch {}
      try { unsubTheirs(); } catch {}
    };
  }, [currentUserProfileId, otherParticipantId]);

  // Load saved contact name/id for the other participant from current user's contacts
  useEffect(() => {
    const loadSavedContact = async () => {
      try {
        if (!currentUserProfileId || !otherParticipantId) return;
        // First try deterministic doc id: other participant profile id
        const subDocRef = doc(
          db,
          "user_profiles",
          currentUserProfileId,
          "contacts",
          otherParticipantId
        );
        const subDoc = await getDoc(subDocRef);
        if (subDoc.exists()) {
          const data: any = subDoc.data();
          const first = (data.first_name || "").toString().trim();
          const last = (data.last_name || "").toString().trim();
          const display =
            first || last
              ? `${first} ${last}`.trim()
              : data.displayName || null;
          setSavedContactName(display || null);
          setSavedContactId(subDoc.id);
          return;
        }
        // Fallback: query by contact_user_id
        const q = query(
          collection(db, "user_profiles", currentUserProfileId, "contacts"),
          where("contact_user_id", "==", otherParticipantId)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0];
          const v: any = d.data();
          const first = (v.first_name || "").toString().trim();
          const last = (v.last_name || "").toString().trim();
          const display =
            first || last ? `${first} ${last}`.trim() : v.displayName || null;
          setSavedContactName(display || null);
          setSavedContactId(d.id);
          return;
        }
        // As a last resort, try phone-based id if we have it
        if (otherSummary?.phone) {
          const phoneDocRef = doc(
            db,
            "user_profiles",
            currentUserProfileId,
            "contacts",
            otherSummary.phone
          );
          const phoneDoc = await getDoc(phoneDocRef);
          if (phoneDoc.exists()) {
            const data: any = phoneDoc.data();
            const first = (data.first_name || "").toString().trim();
            const last = (data.last_name || "").toString().trim();
            const display =
              first || last
                ? `${first} ${last}`.trim()
                : data.displayName || null;
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
    clearMessageStatusesOnReply,
    otherUserPresence,
    refreshMessages,
  } = useSocketChat({
    chatId: chatId || "",
    currentUserId: currentUserProfileId || "",
    otherParticipantId: otherParticipantId || "",
    currentUsername: otherSummary?.username || otherSummary?.phone || "User",
  });

  useEffect(() => {
    (async () => {
      try {
        if (chatId && Array.isArray(messages)) {
          await AsyncStorage.setItem(
            `cache:chat:${chatId}:messages`,
            JSON.stringify(messages)
          );
        }
      } catch {}
    })();
  }, [chatId, messages]);

  const [input, setInput] = useState("");
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

    if (isBlockedByMe) {
      Toast.show({ type: "info", text1: "You blocked this user" });
      return;
    }
    if (isBlockedByOther) {
      Toast.show({ type: "error", text1: "Can't message this user" });
      return;
    }

    try {
      if (editingMessageId) {
        // Edit existing message
        const msg = (messages as any[]).find((m: any) => m.id === editingMessageId);
        if (!msg) return;
        const tenMinMs = 10 * 60 * 1000;
        const withinWindow = Date.now() - new Date(msg.timestamp).getTime() <= tenMinMs;
        const isMine = msg.senderId === currentUserProfileId;
        if (!isMine || !withinWindow) {
          Toast.show({ type: "error", text1: "Cannot edit", text2: "Edit window expired" });
        } else {
          await FirebaseService.editMessage(msg.id, text);
        }
        setEditingMessageId(null);
      } else if (isOffline || !isConnected) {
        // Queue message for offline sending
        await queueMessage(chatId, text, currentUserProfileId);
        Toast.show({
          type: "info",
          text1: "Message Queued",
          text2: "Message will be sent when you're back online",
        });
      } else {
        // Send immediately if online
        // The sendMessage function will handle the message status automatically
        const effectiveEnabled = disappearingEnabled || userDefaultEnabled;
        const effectiveDuration = disappearingEnabled ? disappearingDurationSec : userDefaultDurationSec;
        const expiresAt = effectiveEnabled && effectiveDuration > 0 
          ? new Date(Date.now() + disappearingDurationSec * 1000) 
          : null;
        const sentId = await sendMessage(text, { expiresAt });
        if (replyToMessageId) {
          try {
            await FirebaseService.setReply(sentId, replyToMessageId);
          } catch {}
          setReplyToMessageId(null);
        }
      }

      setInput("");
      // Scroll to bottom after sending
      requestAnimationFrame(() => {
        try {
          listRef.current?.scrollToEnd({ animated: true });
        } catch {}
      });
    } catch (e: any) {
      Toast.show({
        type: "error",
        text1: "Send failed",
        text2: e?.message || "Please try again",
      });
    }
  };

  const pickAndSendMedia = async () => {
    try {
      if (isBlockedByMe) {
        Toast.show({ type: 'info', text1: 'You blocked this user' });
        return;
      }
      if (isBlockedByOther) {
        Toast.show({ type: 'error', text1: "Can't message this user" });
        return;
      }
      // Request permissions
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Toast.show({ type: 'error', text1: 'Permission required' });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];
      const isVideo = (asset.type || '').includes('video');
      let toUploadUri = asset.uri;
      let contentType = isVideo ? 'video/mp4' : 'image/jpeg';
      // Compress image if large
      if (!isVideo) {
        try {
          const manipulated = await ImageManipulator.manipulateAsync(
            asset.uri,
            [{ resize: { width: 1600 } }],
            { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
          );
          toUploadUri = manipulated.uri;
        } catch {}
      }
      setSendingMedia(true);
      const filename = `${Date.now()}-${Math.round(Math.random() * 1e6)}${isVideo ? '.mp4' : '.jpg'}`;
      const path = `chats/${chatId}/${isVideo ? 'videos' : 'images'}/${filename}`;
      const url = await FirebaseService.uploadMediaAsync({ uri: toUploadUri, path, contentType });
      const effectiveEnabled = disappearingEnabled || userDefaultEnabled;
      const effectiveDuration = disappearingEnabled ? disappearingDurationSec : userDefaultDurationSec;
      await FirebaseService.sendMediaMessage({
        chatId: chatId,
        senderId: currentUserProfileId,
        receiverId: otherParticipantId,
        type: isVideo ? 'video' : 'image',
        mediaUrl: url,
        caption: input.trim() || undefined,
        expiresAt: effectiveEnabled && effectiveDuration > 0 
          ? new Date(Date.now() + effectiveDuration * 1000) 
          : undefined,
      });
      setInput("");
      Toast.show({ type: 'success', text1: isVideo ? 'Video sent' : 'Photo sent' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Send failed', text2: e?.message || '' });
    } finally {
      setSendingMedia(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Clear message cache to force fresh load
      await AsyncStorage.removeItem(`cache:chat:${chatId}:messages`);
      // Force refresh messages from Firestore
      await refreshMessages();
      await loadCachedData();
      if (!isOffline) {
        setResolving(true);
        setTimeout(() => setResolving(false), 100);
      }
    } finally {
      setRefreshing(false);
    }
  }, [loadCachedData, isOffline, chatId, refreshMessages]);

  const formatLastSeen = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60)
    );
    if (diffInMinutes < 1) return "just now";
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    }
    const days = Math.floor(diffInMinutes / 1440);
    if (days === 1) return "yesterday";
    if (days < 7) return `${days} days ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const isWithinEditDeleteWindow = (msg: any) => {
    const tenMinMs = 10 * 60 * 1000;
    return Date.now() - new Date(msg.timestamp).getTime() <= tenMinMs;
  };

  const openActionMenu = (msg: any) => {
    setSelectedMessage(msg);
    const isMine = msg.senderId === currentUserProfileId;
    const withinWindow = isWithinEditDeleteWindow(msg);

    const options: string[] = [
      "Copy",
      "Reply",
      "React",
      ...(isMine ? ["Edit"] : []),
      ...(isMine && withinWindow ? ["Delete for everyone"] : []),
      "Cancel",
    ];
    const cancelButtonIndex = options.length - 1;

    const handleIndex = async (index: number) => {
      const picked = options[index];
      if (!picked || picked === "Cancel") return;
      await handleAction(picked, msg);
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          userInterfaceStyle: "light",
        },
        handleIndex
      );
    } else {
      setShowAndroidSheet(true);
    }
  };

  const handleAction = async (action: string, msg: any) => {
    try {
      switch (action) {
        case "Copy":
          await Clipboard.setStringAsync(msg.content || "");
          Toast.show({ type: "success", text1: "Copied" });
          break;
        case "Reply":
          setReplyToMessageId(msg.id);
          break;
        case "React":
          setShowAndroidSheet(false);
          setTimeout(() => setShowReactions(trueFor(msg)), 0);
          break;
        case "Edit": {
          const isMine = msg.senderId === currentUserProfileId;
          if (!isMine || !isWithinEditDeleteWindow(msg)) {
            Toast.show({ type: "error", text1: "Cannot edit" });
            break;
          }
          setEditingMessageId(msg.id);
          setInput(msg.content || "");
          break;
        }
        
        case "Delete for everyone": {
          const isMine = msg.senderId === currentUserProfileId;
          if (!isMine || !isWithinEditDeleteWindow(msg)) {
            Toast.show({ type: "error", text1: "Not allowed" });
            break;
          }
          // Optimistic hide locally
          setHiddenMessageIds((prev) => new Set([...Array.from(prev), msg.id]));
          try {
            await FirebaseService.deleteForEveryone(msg.id);
          } catch (e) {
            // Rollback
            setHiddenMessageIds((prev) => {
              const next = new Set(Array.from(prev));
              next.delete(msg.id);
              return next;
            });
            Toast.show({ type: "error", text1: "Delete failed" });
          }
          break;
        }
      }
    } catch (e: any) {
      Toast.show({ type: "error", text1: "Action failed", text2: e?.message || "" });
    } finally {
      setSelectedMessage(null);
      setShowAndroidSheet(false);
    }
  };

  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const setShowReactions = (val: boolean) => {
    setReactionPickerFor(val && selectedMessage ? selectedMessage.id : null);
  };
  const trueFor = (msg: any) => {
    setReactionPickerFor(msg.id);
    return true;
  };

  const onPickReaction = async (emoji: string) => {
    if (!reactionPickerFor) return;
    const id = reactionPickerFor;
    // Optimistic: set reaction locally
    setMessageOverrides((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        reactions: {
          ...(((prev[id] || {}) as any).reactions || {}),
          ...(messages.find((m: any) => m.id === id)?.reactions || {}),
          [currentUserProfileId]: emoji,
        },
      },
    }));
    try {
      await FirebaseService.setReaction(id, currentUserProfileId, emoji);
    } catch (e) {
      // Rollback on failure
      setMessageOverrides((prev) => {
        const copy = { ...prev } as any;
        delete copy[id];
        return copy;
      });
      Toast.show({ type: "error", text1: "Failed to react" });
    } finally {
      setReactionPickerFor(null);
    }
  };

  const renderMessageItem = useCallback(
    ({ item }: { item: any }) => {
      if (item.__type === "header") {
        return (
          <View
            style={[
              styles.dayHeaderContainer,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text
              style={[styles.dayHeaderText, { color: theme.colors.mutedText }]}
            >
              {item.label}
            </Text>
          </View>
        );
      }
      if (hiddenMessageIds.has(item.id)) return null;
      const overlay = messageOverrides[item.id] || {};
      const mergedItem = { ...item, ...overlay } as any;
      const isMine = mergedItem.senderId === currentUserProfileId;
      
      // Get message status for my messages
      let messageStatus = null;
      if (isMine && item.status) {
        if (item.status === "seen") {
          messageStatus = "Seen";
        } else if (item.status === "delivered") {
          messageStatus = "Delivered";
        } else if (item.status === "sent") {
          messageStatus = "Sent";
        }
      }
      
      const repliedTo = mergedItem.replyTo
        ? messages.find((m: any) => m.id === mergedItem.replyTo)
        : null;
      const reactions = mergedItem.reactions || {};
      const edited = !!mergedItem.editedAt;

      return (
        <Pressable
          onLongPress={() => openActionMenu(mergedItem)}
          style={[styles.messageRow, isMine ? styles.mineRow : styles.theirRow]}
        >
          <View
            style={[
              styles.bubble,
              isMine ? styles.mineBubble : styles.theirBubble,
            ]}
          >
            {repliedTo && (
              <View style={styles.replyPreview}>
                <Text style={styles.replyAuthor}>
                  {repliedTo.senderId === currentUserProfileId ? "You" : savedContactName || otherSummary?.phone || otherSummary?.username || "User"}
                </Text>
                <Text style={styles.replyText} numberOfLines={2}>
                  {repliedTo.content}
                </Text>
              </View>
            )}
            <Text
              style={[
                styles.bubbleText,
                isMine ? styles.mineText : styles.theirText,
              ]}
            >
              {mergedItem.type === 'system' ? (
                <Text style={[styles.bubbleText, { fontStyle: 'italic', color: '#666' }]}>{mergedItem.content}</Text>
              ) : mergedItem.type === 'image' && mergedItem.mediaUrl ? (
                <Image source={{ uri: mergedItem.mediaUrl }} style={{ width: 220, height: 220, borderRadius: 12 }} />
              ) : mergedItem.type === 'video' && mergedItem.mediaUrl ? (
                <View style={{ width: 220, height: 220, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="play" size={32} color="#fff" />
                </View>
              ) : (
                mergedItem.content
              )}
            </Text>
            <View style={styles.messageTime}>
              <Text
                style={[
                  styles.timeText,
                  isMine ? styles.timeTextMine : styles.timeTextTheirs,
                ]}
              >
                {formatMessageTime(mergedItem.timestamp)} {edited ? "· edited" : ""}
              </Text>
              {isMine && messageStatus && (
                <Text style={styles.statusText}>
                  {messageStatus}
                </Text>
              )}
            </View>
            {Object.keys(reactions).length > 0 && (
              <View style={styles.reactionsBar}>
                {Object.entries(reactions).map(([uid, emoji]) => (
                  <Text key={uid} style={styles.reactionEmoji}>{emoji as any}</Text>
                ))}
              </View>
            )}
          </View>
        </Pressable>
      );
    },
    [currentUserProfileId, messages, otherSummary]
  );

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    
    // Check if the latest message is from the other participant
    const latestMessage = messages[messages.length - 1];
    if (latestMessage && latestMessage.senderId !== currentUserProfileId) {
      // Other participant sent a message, clear our message statuses
      clearMessageStatusesOnReply();
    }
    
    // Defer to next frame to ensure list has rendered
    requestAnimationFrame(() => {
      try {
        listRef.current?.scrollToEnd({ animated: true });
      } catch {}
    });
  }, [messages?.length, currentUserProfileId, clearMessageStatusesOnReply]);

  // The message status updates are now handled automatically by the useSocketChat hook
  // No need for manual status simulation

  const getItemLayout = useCallback(
    (_: any, index: number) => ({ length: 56, offset: 56 * index, index }),
    []
  );

  const isColdEmpty = !otherSummary && (!messages || messages.length === 0);

  const buildDatedItems = useCallback(() => {
    if (!Array.isArray(messages)) return [] as any[];
    const items: any[] = [];
    let lastDateKey = "";
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const dateKeyOf = (iso: string) => new Date(iso).toDateString();
    const labelOf = (iso: string) => {
      const d = new Date(iso);
      if (d.toDateString() === now.toDateString()) return "Today";
      if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
      return d.toLocaleDateString();
    };
    const sorted = [...messages].sort(
      (a: any, b: any) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    for (const m of sorted) {
      const k = dateKeyOf(m.timestamp);
      if (k !== lastDateKey) {
        items.push({
          __type: "header",
          id: `hdr-${k}-${items.length}`,
          label: labelOf(m.timestamp),
        });
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
            {typingUsers[0].username || "User"} is typing
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

  // AI suggestions removed per request

  const renderConnectionStatus = () => {
    if (socketConnected && !isOffline) return null;
    return (
      <View
        style={[
          styles.connectionBanner,
          { backgroundColor: socketConnected ? "#FF9800" : "#F44336" },
        ]}
      >
        <Feather
          name={socketConnected ? "wifi" : "wifi-off"}
          size={16}
          color="#fff"
        />
        <Text style={styles.connectionText}>
          {socketConnected
            ? "Reconnecting..."
            : "Offline - Showing cached data"}
        </Text>
      </View>
    );
  };

  const renderBlockBanner = () => {
    if (!isBlockedByMe && !isBlockedByOther) return null;
    const label = isBlockedByMe
      ? "You blocked this user"
      : "You can't message this user";
    return (
      <View
        style={[
          styles.connectionBanner,
          { backgroundColor: '#9E9E9E', top: 112 },
        ]}
      >
        <Feather name="slash" size={16} color="#fff" />
        <Text style={styles.connectionText}>{label}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#3A805B" }}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={[styles.header, { backgroundColor: theme.colors.primary }]}
        >
          <TouchableOpacity onPress={() => router.back()}>
            <Feather
              name="chevron-left"
              size={24}
              color={theme.colors.primaryText}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerCenter}
            onPress={() => {
              if (otherParticipantId) {
                router.push({
                  pathname: "/user-profile",
                  params: {
                    id: otherParticipantId,
                    isSaved: savedContactId ? "true" : "false",
                    ownerProfileId: currentUserProfileId,
                    contactId: savedContactId || "",
                    contactName:
                      savedContactName ||
                      otherSummary?.phone ||
                      otherSummary?.username ||
                      "QuickTalk user",
                  },
                });
              }
            }}
          >
            {otherSummary?.profile_picture_url ? (
              <Image
                source={{ uri: otherSummary.profile_picture_url }}
                style={styles.headerAvatar}
              />
            ) : (
              <View style={styles.headerAvatarPlaceholder}>
                <Feather
                  name="user"
                  size={20}
                  color={theme.colors.primaryText}
                />
              </View>
            )}
            <View style={styles.headerInfo}>
              <Text
                style={[
                  styles.headerTitle,
                  { color: theme.colors.primaryText },
                ]}
              >
                {savedContactName ||
                  (!savedContactId
                    ? otherSummary?.phone || otherSummary?.username
                    : otherSummary?.username || otherSummary?.phone) ||
                  "QuickTalk user"}
              </Text>
              <Text
                style={[
                  styles.headerSubtitle,
                  { color: theme.colors.primaryText },
                ]}
              >
                {isBlockedByMe || isBlockedByOther
                  ? ""
                  : otherUserPresence?.isOnline
                  ? "online"
                  : otherUserPresence?.lastSeen
                  ? `last seen ${formatLastSeen(otherUserPresence.lastSeen)}`
                  : ""}
              </Text>
            </View>
          </TouchableOpacity>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel="Voice call"
            >
              <Feather
                name="phone"
                size={20}
                color={theme.colors.primaryText}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel="Disappearing messages"
              onPress={() => setShowDisappearModal(true)}
            >
              <Feather
                name={disappearingEnabled ? "clock" : "clock"}
                size={20}
                color={theme.colors.primaryText}
              />
            </TouchableOpacity>
          </View>
        </View>

        {renderConnectionStatus()}
        {renderBlockBanner()}
        {disappearingEnabled && (
          <View style={[styles.connectionBanner, { backgroundColor: '#607D8B', top: 112 }]}> 
            <Feather name="clock" size={16} color="#fff" />
            <Text style={styles.connectionText}>You turned on disappearing messages. New messages will disappear after {disappearingDurationSec === 60*60*24*90 ? '90 days' : disappearingDurationSec === 60*60*24*7 ? '7 days' : disappearingDurationSec === 60*60*24 ? '24 hours' : `${Math.round(disappearingDurationSec/60)} min`}.</Text>
          </View>
        )}

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
            data={isBlockedByMe || isBlockedByOther ? [] : datedItems}
            keyExtractor={(m: any, idx: number) =>
              m.__type === "header" ? m.id : m.id
            }
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
          />
        )}

        {!!replyToMessageId && (
          <View style={styles.replyBar}>
            <Text style={styles.replyBarText} numberOfLines={1}>
              Replying to {messages.find((m: any) => m.id === replyToMessageId)?.content || "message"}
            </Text>
            <TouchableOpacity onPress={() => setReplyToMessageId(null)} style={{ padding: 8 }}>
              <Feather name="x" size={16} color={theme.colors.mutedText} />
            </TouchableOpacity>
          </View>
        )}

        {renderTypingIndicator()}

        {/* AI Suggestions removed */}

        <View
          style={[
            styles.composer,
            {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.border,
            },
          ]}
        >
          {/* Emoji button removed as requested */}
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.inputBg,
                color: theme.colors.text,
              },
            ]}
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
            editable={!isBlockedByMe && !isBlockedByOther}
          />
          <TouchableOpacity
            style={styles.composerButton}
            accessibilityRole="button"
            accessibilityLabel="Attach"
            onPress={pickAndSendMedia}
            disabled={sendingMedia || isBlockedByMe || isBlockedByOther}
          >
            <Feather
              name="paperclip"
              size={24}
              color={theme.colors.mutedText}
            />
          </TouchableOpacity>
          {/* Camera button removed as requested */}
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: theme.colors.primary },
              !input.trim() && { opacity: 0.5 },
            ]}
            onPress={onSend}
            disabled={!input.trim() || isBlockedByMe || isBlockedByOther}
          >
            {input.trim() ? (
              <Feather name="send" size={20} color={theme.colors.primaryText} />
            ) : (
              <Feather name="mic" size={20} color={theme.colors.primaryText} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {Platform.OS !== "ios" && (
        <Modal
          visible={showAndroidSheet}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAndroidSheet(false)}
        >
          <Pressable style={styles.sheetBackdrop} onPress={() => setShowAndroidSheet(false)} />
          <View style={[styles.sheetContainer, { backgroundColor: theme.colors.surface }]}>
            {selectedMessage && (
              <>
                {(() => {
                  const isMine = selectedMessage.senderId === currentUserProfileId;
                  const within = isWithinEditDeleteWindow(selectedMessage);
                  const options = [
                    "Copy",
                    "Reply",
                    "React",
                    ...(isMine ? ["Edit"] : []),
                    ...(isMine && within ? ["Delete for everyone"] : []),
                    "Cancel",
                  ];
                  return options.map((opt) => (
                    <TouchableOpacity key={opt} style={styles.sheetItem} onPress={() => handleAction(opt, selectedMessage)}>
                      <Text style={styles.sheetItemText}>{opt}</Text>
                    </TouchableOpacity>
                  ));
                })()}
              </>
            )}
          </View>
        </Modal>
      )}

      {reactionPickerFor && (
        <Modal transparent animationType="fade" onRequestClose={() => setReactionPickerFor(null)}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setReactionPickerFor(null)} />
          <View style={[styles.reactionPicker, { backgroundColor: theme.colors.surface }]}>
            {['👍','❤️','😂','😮','😢'].map((e) => (
              <TouchableOpacity key={e} style={styles.reactionBtn} onPress={() => onPickReaction(e)}>
                <Text style={styles.reactionEmoji}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Modal>
      )}

      {/* Disappearing messages modal */}
      <Modal
        visible={showDisappearModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDisappearModal(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowDisappearModal(false)} />
        <View style={[styles.sheetContainer, { backgroundColor: theme.colors.surface }]}> 
          <Text style={[styles.sheetItemText, { fontWeight: '600', padding: 16 }]}>Disappearing messages</Text>
          <TouchableOpacity style={styles.sheetItem} onPress={async () => {
            try {
              await FirebaseService.setChatDisappearingSettings({ chatId, enabled: false, durationSec: 0, updatedBy: currentUserProfileId });
              await FirebaseService.sendSystemMessage({ chatId, content: 'You turned off disappearing messages.' });
            } catch {}
            setShowDisappearModal(false);
          }}>
            <Text style={styles.sheetItemText}>Off</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetItem} onPress={async () => {
            try {
              await FirebaseService.setChatDisappearingSettings({ chatId, enabled: true, durationSec: 60*60*24, updatedBy: currentUserProfileId });
              await FirebaseService.sendSystemMessage({ chatId, content: 'You turned on disappearing messages. New messages will disappear after 24 hours.' });
            } catch {}
            setShowDisappearModal(false);
          }}>
            <Text style={styles.sheetItemText}>24 hours</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetItem} onPress={async () => {
            try {
              await FirebaseService.setChatDisappearingSettings({ chatId, enabled: true, durationSec: 60*60*24*7, updatedBy: currentUserProfileId });
              await FirebaseService.sendSystemMessage({ chatId, content: 'You turned on disappearing messages. New messages will disappear after 7 days.' });
            } catch {}
            setShowDisappearModal(false);
          }}>
            <Text style={styles.sheetItemText}>7 days</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetItem} onPress={async () => {
            try {
              await FirebaseService.setChatDisappearingSettings({ chatId, enabled: true, durationSec: 60*60*24*90, updatedBy: currentUserProfileId });
              await FirebaseService.sendSystemMessage({ chatId, content: 'You turned on disappearing messages. New messages will disappear after 90 days.' });
            } catch {}
            setShowDisappearModal(false);
          }}>
            <Text style={styles.sheetItemText}>90 days</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetItem} onPress={async () => {
            try {
              await FirebaseService.setChatDisappearingSettings({ chatId, enabled: true, durationSec: 60*60*24, updatedBy: currentUserProfileId });
              await FirebaseService.sendSystemMessage({ chatId, content: 'You turned on disappearing messages. New messages will disappear after 24 hours.' });
            } catch {}
            setShowDisappearModal(false);
          }}>
            <Text style={styles.sheetItemText}>24 hours</Text>
          </TouchableOpacity>
        </View>
      </Modal>



    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: "#3A805B",
    paddingTop: 40,
    paddingBottom: 12,
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginLeft: 16,
  },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerInfo: { flex: 1 },
  headerTitle: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
    marginBottom: 2,
  },
  headerSubtitle: { fontSize: 12, color: "rgba(255,255,255,0.8)" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 16 },
  headerButton: { padding: 4 },
  connectionBanner: {
    position: "absolute",
    top: 84,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    opacity: 0.9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  connectionText: { color: "#fff", fontSize: 12 },
  list: { padding: 12, paddingBottom: 70 },
  messageRow: { flexDirection: "row", marginVertical: 4 },
  mineRow: { justifyContent: "flex-end" },
  theirRow: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  mineBubble: { backgroundColor: "#3A805B", borderTopRightRadius: 4 },
  theirBubble: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  bubbleText: { fontSize: 16, marginBottom: 4 },
  mineText: { color: "#fff" },
  theirText: { color: "#333" },
  messageTime: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  timeText: { fontSize: 11, color: "#999" },
  timeTextMine: { color: "rgba(255,255,255,0.8)" },
  timeTextTheirs: { color: "#999" },
  statusText: { 
    fontSize: 10, 
    color: "rgba(255,255,255,0.7)", 
    marginLeft: 8,
    fontStyle: "italic"
  },
  typingContainer: { paddingHorizontal: 12, marginBottom: 6 },
  typingBubble: {
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#e9ecef",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  typingText: { color: "#666", fontStyle: "italic", fontSize: 14 },
  typingDots: { flexDirection: "row", gap: 2 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#999" },
  dot1: { opacity: 0.4 },
  dot2: { opacity: 0.7 },
  dot3: { opacity: 1 },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 8,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e9ecef",
  },
  composerButton: { padding: 8 },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#000",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f6f6f6",
    borderRadius: 20,
    minHeight: 40,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: "#3A805B",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  doubleCheckContainer: { flexDirection: "row", alignItems: "center" },
  firstCheck: { position: "absolute" },
  secondCheck: { position: "absolute" },
  dayHeaderContainer: {
    alignItems: "center",
    marginVertical: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  dayHeaderText: { fontSize: 12 },
  replyPreview: {
    borderLeftWidth: 3,
    borderLeftColor: '#3A805B',
    paddingLeft: 8,
    marginBottom: 6,
  },
  replyAuthor: { fontSize: 12, color: '#666', marginBottom: 2 },
  replyText: { fontSize: 13, color: '#555' },
  reactionsBar: { flexDirection: 'row', gap: 6, marginTop: 6 },
  reactionEmoji: { fontSize: 16 },
  replyBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 70 + 44,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  replyBarText: { color: '#333', flex: 1, marginRight: 8 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  sheetItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  sheetItemText: { fontSize: 16, color: '#333' },
  reactionPicker: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 100,
    alignSelf: 'center',
    marginHorizontal: 24,
    borderRadius: 24,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center'
  },
  reactionBtn: { padding: 6 },
  // AI suggestion styles removed
  reportContainer: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 100,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
});
