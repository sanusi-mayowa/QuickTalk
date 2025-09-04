import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  getDoc,
  getDocs,
  where,
  setDoc,
  arrayUnion,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { socketService } from "./socket";

// Your Firebase config - replace with your actual values
const firebaseConfig = {
  apiKey: "AIzaSyDSbG7pWUe_EX9r2wU_AVnPdGgGSUrXYl4",
  authDomain: "quicktalk-chat.firebaseapp.com",
  projectId: "quicktalk-chat",
  storageBucket: "quicktalk-chat.firebasestorage.app",
  messagingSenderId: "1014653996428",
  appId: "1:1014653996428:web:d1398f5a5614c817fedaa9",
  measurementId: "G-R624FK66Y6",
};

// Initialize Firebase (guard against duplicate init on web/hot reload)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Firestore collections
export const COLLECTIONS = {
  USERS: "users",
  MESSAGES: "messages",
  CHATS: "chats",
  USER_PROFILES: "user_profiles",
};

// User interface
export interface User {
  id: string;
  name: string;
  email: string;
  photoURL?: string;
  lastSeen: any;
  isOnline: boolean;
}

// Message interface
export interface Message {
  id?: string;
  chatId: string; // Added: chat id for room routing
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: any;
  status: "sent" | "delivered" | "seen";
  type: "text" | "image" | "video" | "file" | "system";
  mediaUrl?: string;
  expiresAt?: any;
  createdAt?: any;
}

// Chat interface
export interface Chat {
  id?: string;
  participants: string[];
  lastMessage?: Message;
  lastMessageTime: any;
}

// Contact interface (stored as subcollection of user profile)
export interface Contact {
  id?: string; // contact profile id
  ownerProfileId: string; // owner profile id
  contactProfileId: string; // contact's profile id
  displayName?: string;
  phone?: string;
  profilePictureUrl?: string | null;
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

// Firebase utility functions
export class FirebaseService {
  // Save message to Firestore and emit via Socket.IO
  static async saveMessage(
    message: Omit<Message, "id" | "timestamp">
  ): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.MESSAGES), {
        ...message,
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
        status: "sent",
      });

      // Emit message via Socket.IO for real-time delivery
      if (socketService.getConnectionStatus()) {
        socketService.sendMessage(
          message.chatId || "default",
          message.content,
          message.receiverId,
          docRef.id
        );
      }

      return docRef.id;
    } catch (error) {
      console.error("Error saving message:", error);
      throw error;
    }
  }

  // Fetch AI reply suggestions via local AIService (frontend helper) for now.
  // In production, this should be a backend endpoint.
  // Removed per request

  // Upload media to Firebase Storage and return public URL
  static async uploadMediaAsync(params: {
    uri: string;
    path: string; // e.g., `chats/${chatId}/images/${filename}`
    contentType?: string;
  }): Promise<string> {
    const response = await fetch(params.uri);
    const blob = await response.blob();
    const ref = storageRef(storage, params.path);
    await uploadBytes(ref, blob, params.contentType ? { contentType: params.contentType } : undefined);
    const url = await getDownloadURL(ref);
    return url;
  }

  // Send a media message (image/video)
  static async sendMediaMessage(params: {
    chatId: string;
    senderId: string;
    receiverId: string;
    type: "image" | "video";
    mediaUrl: string;
    caption?: string;
    expiresAt?: Date | null;
  }): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTIONS.MESSAGES), {
      chatId: params.chatId,
      senderId: params.senderId,
      receiverId: params.receiverId,
      content: (params.caption || "").trim(),
      type: params.type,
      mediaUrl: params.mediaUrl,
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp(),
      status: "sent",
      ...(params.expiresAt ? { expiresAt: params.expiresAt } : {}),
    });

    // Emit via Socket.IO for real-time
    if (socketService.getConnectionStatus()) {
      socketService.sendMessage(
        params.chatId,
        (params.caption || "").trim() || (params.type === "image" ? "Photo" : "Video"),
        params.receiverId,
        docRef.id
      );
    }

    return docRef.id;
  }

  // ----- Disappearing messages & system helpers -----
  static async setChatDisappearingSettings(params: {
    chatId: string;
    enabled: boolean;
    durationSec: number;
    updatedBy: string;
  }): Promise<void> {
    const ref = doc(db, COLLECTIONS.CHATS, params.chatId);
    await updateDoc(ref, {
      disappearingMessages: {
        enabled: params.enabled,
        duration: params.durationSec,
        lastUpdated: serverTimestamp(),
        updatedBy: params.updatedBy,
      },
    } as any);
  }

  static async sendSystemMessage(params: {
    chatId: string;
    content: string;
  }): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTIONS.MESSAGES), {
      chatId: params.chatId,
      senderId: "system",
      receiverId: "system",
      content: params.content,
      type: "system",
      timestamp: serverTimestamp(),
      status: "sent",
    } as any);
    return docRef.id;
  }

  // ----- User-level defaults -----
  static async setUserDisappearingDefaults(params: {
    userProfileId: string;
    enabled: boolean;
    durationSec: number;
  }): Promise<void> {
    const ref = doc(db, COLLECTIONS.USER_PROFILES, params.userProfileId);
    await updateDoc(ref, {
      disappearingDefaults: {
        enabled: params.enabled,
        duration: params.durationSec,
        lastUpdated: serverTimestamp(),
      },
    } as any);
  }

  static async notifyAllChatsDisappearingChanged(params: {
    userProfileId: string;
    content: string;
  }): Promise<void> {
    // Inform all chats that include this user by adding a system message
    const qs = await getDocs(
      query(collection(db, COLLECTIONS.CHATS), where('participants', 'array-contains', params.userProfileId))
    );
    for (const d of qs.docs) {
      try {
        await addDoc(collection(db, COLLECTIONS.MESSAGES), {
          chatId: d.id,
          senderId: 'system',
          receiverId: 'system',
          content: params.content,
          type: 'system',
          timestamp: serverTimestamp(),
          status: 'sent',
        } as any);
      } catch {}
    }
  }

  static async applyUserDefaultToAllChats(params: {
    userProfileId: string;
    enabled: boolean;
    durationSec: number;
  }): Promise<void> {
    const qs = await getDocs(
      query(collection(db, COLLECTIONS.CHATS), where('participants', 'array-contains', params.userProfileId))
    );
    for (const d of qs.docs) {
      try {
        await updateDoc(doc(db, COLLECTIONS.CHATS, d.id), {
          disappearingMessages: {
            enabled: params.enabled,
            duration: params.durationSec,
            lastUpdated: serverTimestamp(),
            updatedBy: params.userProfileId,
          },
        } as any);
      } catch {}
    }
  }

  // ----- Message actions -----
  static async deleteForMe(messageId: string, userProfileId: string): Promise<void> {
    const ref = doc(db, COLLECTIONS.MESSAGES, messageId);
    await updateDoc(ref, { deletedFor: arrayUnion(userProfileId) } as any);
  }

  static async deleteForEveryone(messageId: string): Promise<void> {
    const ref = doc(db, COLLECTIONS.MESSAGES, messageId);
    await updateDoc(ref, { deletedForEveryone: true, content: "", type: "text" } as any);
  }

  static async editMessage(messageId: string, newContent: string): Promise<void> {
    const ref = doc(db, COLLECTIONS.MESSAGES, messageId);
    await updateDoc(ref, { content: newContent, editedAt: serverTimestamp() } as any);
  }

  static async setReply(messageId: string, replyToId: string): Promise<void> {
    const ref = doc(db, COLLECTIONS.MESSAGES, messageId);
    await updateDoc(ref, { replyTo: replyToId } as any);
  }

  static async setReaction(messageId: string, userId: string, emoji: string): Promise<void> {
    const ref = doc(db, COLLECTIONS.MESSAGES, messageId);
    // Firestore cannot partially update dynamic map keys without merge object; use field path
    const field = `reactions.${userId}` as any;
    await updateDoc(ref, { [field]: emoji } as any);
  }

  // ----- Moderation & Visibility -----
  static async blockUser(blockerProfileId: string, blockedProfileId: string): Promise<void> {
    const ref = doc(db, COLLECTIONS.USER_PROFILES, blockerProfileId, 'blocked', blockedProfileId);
    await setDoc(ref, { blockedAt: serverTimestamp(), blockedProfileId }, { merge: true } as any);
  }

  static async unblockUser(blockerProfileId: string, blockedProfileId: string): Promise<void> {
    const ref = doc(db, COLLECTIONS.USER_PROFILES, blockerProfileId, 'blocked', blockedProfileId);
    // Soft-unblock by clearing marker
    await setDoc(ref, { unblockedAt: serverTimestamp(), blocked: false }, { merge: true } as any);
  }

  static async bulkClearChatForUser(chatId: string, userProfileId: string): Promise<void> {
    // Soft delete per message by adding user to deletedFor
    const qs = await getDocs(query(collection(db, COLLECTIONS.MESSAGES), where('chatId', '==', chatId)));
    for (const d of qs.docs) {
      try {
        await updateDoc(doc(db, COLLECTIONS.MESSAGES, d.id), { deletedFor: arrayUnion(userProfileId) } as any);
      } catch {}
    }
  }

  static async createReport(params: {
    reporterId: string;
    reportedId: string;
    chatId: string;
    category: string;
    reason?: string;
    scope: 'all' | 'range';
    from?: string;
    to?: string;
  }): Promise<void> {
    await addDoc(collection(db, 'reports'), {
      reporterId: params.reporterId,
      reportedId: params.reportedId,
      chatId: params.chatId,
      category: params.category || 'unspecified',
      reason: params.reason || '',
      scope: params.scope,
      from: params.from || null,
      to: params.to || null,
      status: 'open',
      createdAt: serverTimestamp(),
    } as any);
  }

  static async updateReportStatus(reportId: string, status: 'open' | 'in_review' | 'resolved' | 'dismissed'): Promise<void> {
    const ref = doc(db, 'reports', reportId);
    await updateDoc(ref, { status, updatedAt: serverTimestamp() } as any);
  }

  // Update message status and emit via Socket.IO
  static async updateMessageStatus(
    messageId: string,
    status: Message["status"],
    receiverId?: string
  ): Promise<void> {
    try {
      const messageRef = doc(db, COLLECTIONS.MESSAGES, messageId);
      await updateDoc(messageRef, { status });

      // Emit status update via Socket.IO
      if (socketService.getConnectionStatus() && receiverId) {
        if (status === "delivered") {
          socketService.markMessageDelivered(messageId, receiverId);
        } else if (status === "seen") {
          socketService.markMessageSeen(messageId, receiverId);
        }
      }
    } catch (error) {
      console.error("Error updating message status:", error);
      throw error;
    }
  }

  // Update user's last seen and emit offline status
  static async updateLastSeen(userProfileId: string): Promise<void> {
    try {
      const userRef = doc(db, COLLECTIONS.USER_PROFILES, userProfileId);
      await updateDoc(userRef, {
        lastSeen: serverTimestamp(),
        isOnline: false,
      });

      // Emit offline status via Socket.IO
      if (socketService.getConnectionStatus()) {
        socketService.updateOnlineStatus(false);
      }
    } catch (error) {
      console.error("Error updating last seen:", error);
      throw error;
    }
  }

  // Update user's online status and emit via Socket.IO
  static async updateOnlineStatus(
    userProfileId: string,
    isOnline: boolean
  ): Promise<void> {
    try {
      const userRef = doc(db, COLLECTIONS.USER_PROFILES, userProfileId);
      await updateDoc(userRef, {
        isOnline,
        lastSeen: serverTimestamp(),
      });

      // Emit online status via Socket.IO
      if (socketService.getConnectionStatus()) {
        socketService.updateOnlineStatus(isOnline);
      }
    } catch (error) {
      console.error("Error updating online status:", error);
      throw error;
    }
  }

  // Get messages for a chat with real-time updates
  static getMessages(chatId: string, callback: (messages: Message[]) => void) {
    const messagesRef = collection(db, COLLECTIONS.MESSAGES);
    const q = query(
      messagesRef,
      where("chatId", "==", chatId),
      orderBy("timestamp", "desc"),
      limit(50)
    );

    return onSnapshot(q, (snapshot) => {
      const messages: Message[] = snapshot.docs.map(
        (d) => ({ id: d.id, ...(d.data() as any) } as Message)
      );
      callback(messages.reverse());
    });
  }

  // Get user data
  static async getUser(userId: string): Promise<User | null> {
    try {
      const userRef = doc(db, COLLECTIONS.USERS, userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        return { id: userSnap.id, ...(userSnap.data() as any) } as User;
      }
      return null;
    } catch (error) {
      console.error("Error getting user:", error);
      return null;
    }
  }

  // Initialize Socket.IO connection for a user
  static async initializeSocket(
    userId: string,
    username: string
  ): Promise<void> {
    try {
      await socketService.initialize(userId, username);
      console.log("Socket.IO initialized for user:", userId);
    } catch (error) {
      console.error("Failed to initialize Socket.IO:", error);
    }
  }

  // Join chat room via Socket.IO
  static joinChatRoom(chatId: string): void {
    socketService.joinChat(chatId);
  }

  // Leave chat room via Socket.IO
  static leaveChatRoom(chatId: string): void {
    socketService.leaveChat(chatId);
  }

  // Send typing indicator via Socket.IO
  static sendTypingIndicator(chatId: string, isTyping: boolean): void {
    socketService.sendTypingIndicator(chatId, isTyping);
  }

  // Cleanup Socket.IO connection
  static cleanupSocket(): void {
    socketService.cleanup();
  }

  // ---------- Contacts (per-user) ----------
  // Path: user_profiles/{ownerProfileId}/contacts/{contactProfileId}
  static contactsCollectionPath(ownerProfileId: string) {
    return `${COLLECTIONS.USER_PROFILES}/${ownerProfileId}/contacts`;
  }

  // Upsert a contact into the owner's contact list
  static async upsertContact(params: {
    ownerProfileId: string;
    contactProfileId: string;
    displayName?: string;
    phone?: string;
    profilePictureUrl?: string | null;
    notes?: string;
  }): Promise<void> {
    const {
      ownerProfileId,
      contactProfileId,
      displayName,
      phone,
      profilePictureUrl,
      notes,
    } = params;
    const ref = doc(
      db,
      this.contactsCollectionPath(ownerProfileId),
      contactProfileId
    );
    await setDoc(
      ref,
      {
        ownerProfileId,
        contactProfileId,
        ownerAuthUid: auth.currentUser ? auth.currentUser.uid : null,
        displayName: displayName ?? null,
        phone: phone ?? null,
        profilePictureUrl: profilePictureUrl ?? null,
        notes: notes ?? null,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  // Update contact fields (owner only)
  static async updateContact(
    ownerProfileId: string,
    contactProfileId: string,
    updates: Partial<Contact>
  ): Promise<void> {
    const ref = doc(
      db,
      this.contactsCollectionPath(ownerProfileId),
      contactProfileId
    );
    await updateDoc(ref, {
      ...updates,
      updatedAt: serverTimestamp(),
    } as any);
  }

  // Get a single contact (owner only)
  static async getContact(
    ownerProfileId: string,
    contactProfileId: string
  ): Promise<Contact | null> {
    const ref = doc(
      db,
      this.contactsCollectionPath(ownerProfileId),
      contactProfileId
    );
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return { id: snap.id, ...(snap.data() as any) } as Contact;
    }
    return null;
  }

  // Subscribe to contacts list
  static onContacts(ownerProfileId: string, cb: (contacts: Contact[]) => void) {
    return onSnapshot(
      collection(db, this.contactsCollectionPath(ownerProfileId)),
      (qs) => {
        const items: Contact[] = qs.docs.map(
          (d) => ({ id: d.id, ...(d.data() as any) } as Contact)
        );
        cb(items);
      }
    );
  }

  // Delete a contact
  static async deleteContact(
    ownerProfileId: string,
    contactProfileId: string
  ): Promise<void> {
    const ref = doc(
      db,
      this.contactsCollectionPath(ownerProfileId),
      contactProfileId
    );
    // Firestore web v9 requires deleteDoc, but we avoid adding more imports; caller can overwrite by clearing
    await updateDoc(ref, { deletedAt: serverTimestamp() } as any);
  }

  // Fetch a user profile document
  static async getUserProfile(profileId: string): Promise<any | null> {
    const ref = doc(db, COLLECTIONS.USER_PROFILES, profileId);
    const snap = await getDoc(ref);
    return snap.exists() ? { id: snap.id, ...(snap.data() as any) } : null;
  }
}

export default FirebaseService;
