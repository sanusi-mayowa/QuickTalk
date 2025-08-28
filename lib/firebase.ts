import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, doc, query, orderBy, limit, onSnapshot, serverTimestamp, getDoc, where, setDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { socketService } from './socket';

// Your Firebase config - replace with your actual values
const firebaseConfig = {
  apiKey: "AIzaSyDSbG7pWUe_EX9r2wU_AVnPdGgGSUrXYl4",
  authDomain: "quicktalk-chat.firebaseapp.com",
  projectId: "quicktalk-chat",
  storageBucket: "quicktalk-chat.firebasestorage.app",
  messagingSenderId: "1014653996428",
  appId: "1:1014653996428:web:d1398f5a5614c817fedaa9",
  measurementId: "G-R624FK66Y6"
};

// Initialize Firebase (guard against duplicate init on web/hot reload)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Firestore collections
export const COLLECTIONS = {
  USERS: 'users',
  MESSAGES: 'messages',
  CHATS: 'chats',
  USER_PROFILES: 'user_profiles',
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
  status: 'sent' | 'delivered' | 'seen';
  type: 'text' | 'image' | 'file';
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
  static async saveMessage(message: Omit<Message, 'id' | 'timestamp'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.MESSAGES), {
        ...message,
        timestamp: serverTimestamp(),
        status: 'sent'
      });
      
      // Emit message via Socket.IO for real-time delivery
      if (socketService.getConnectionStatus()) {
        socketService.sendMessage(
          message.chatId || 'default',
          message.content,
          message.receiverId,
          docRef.id
        );
      }
      
      return docRef.id;
    } catch (error) {
      console.error('Error saving message:', error);
      throw error;
    }
  }

  // Update message status and emit via Socket.IO
  static async updateMessageStatus(messageId: string, status: Message['status'], receiverId?: string): Promise<void> {
    try {
      const messageRef = doc(db, COLLECTIONS.MESSAGES, messageId);
      await updateDoc(messageRef, { status });
      
      // Emit status update via Socket.IO
      if (socketService.getConnectionStatus() && receiverId) {
        if (status === 'delivered') {
          socketService.markMessageDelivered(messageId, receiverId);
        } else if (status === 'seen') {
          socketService.markMessageSeen(messageId, receiverId);
        }
      }
    } catch (error) {
      console.error('Error updating message status:', error);
      throw error;
    }
  }

  // Update user's last seen and emit offline status
  static async updateLastSeen(userProfileId: string): Promise<void> {
    try {
      const userRef = doc(db, COLLECTIONS.USER_PROFILES, userProfileId);
      await updateDoc(userRef, { 
        lastSeen: serverTimestamp(),
        isOnline: false 
      });
      
      // Emit offline status via Socket.IO
      if (socketService.getConnectionStatus()) {
        socketService.updateOnlineStatus(false);
      }
    } catch (error) {
      console.error('Error updating last seen:', error);
      throw error;
    }
  }

  // Update user's online status and emit via Socket.IO
  static async updateOnlineStatus(userProfileId: string, isOnline: boolean): Promise<void> {
    try {
      const userRef = doc(db, COLLECTIONS.USER_PROFILES, userProfileId);
      await updateDoc(userRef, { 
        isOnline,
        lastSeen: serverTimestamp()
      });
      
      // Emit online status via Socket.IO
      if (socketService.getConnectionStatus()) {
        socketService.updateOnlineStatus(isOnline);
      }
    } catch (error) {
      console.error('Error updating online status:', error);
      throw error;
    }
  }

  // Get messages for a chat with real-time updates
  static getMessages(chatId: string, callback: (messages: Message[]) => void) {
    const messagesRef = collection(db, COLLECTIONS.MESSAGES);
    const q = query(
      messagesRef,
      where('chatId', '==', chatId),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    return onSnapshot(q, (snapshot) => {
      const messages: Message[] = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Message));
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
      console.error('Error getting user:', error);
      return null;
    }
  }

  // Initialize Socket.IO connection for a user
  static async initializeSocket(userId: string, username: string): Promise<void> {
    try {
      await socketService.initialize(userId, username);
      console.log('Socket.IO initialized for user:', userId);
    } catch (error) {
      console.error('Failed to initialize Socket.IO:', error);
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
    const { ownerProfileId, contactProfileId, displayName, phone, profilePictureUrl, notes } = params;
    const ref = doc(db, this.contactsCollectionPath(ownerProfileId), contactProfileId);
    await setDoc(ref, {
      ownerProfileId,
      contactProfileId,
      ownerAuthUid: auth.currentUser ? auth.currentUser.uid : null,
      displayName: displayName ?? null,
      phone: phone ?? null,
      profilePictureUrl: profilePictureUrl ?? null,
      notes: notes ?? null,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    }, { merge: true });
  }

  // Update contact fields (owner only)
  static async updateContact(ownerProfileId: string, contactProfileId: string, updates: Partial<Contact>): Promise<void> {
    const ref = doc(db, this.contactsCollectionPath(ownerProfileId), contactProfileId);
    await updateDoc(ref, {
      ...updates,
      updatedAt: serverTimestamp(),
    } as any);
  }

  // Get a single contact (owner only)
  static async getContact(ownerProfileId: string, contactProfileId: string): Promise<Contact | null> {
    const ref = doc(db, this.contactsCollectionPath(ownerProfileId), contactProfileId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return { id: snap.id, ...(snap.data() as any) } as Contact;
    }
    return null;
  }

  // Subscribe to contacts list
  static onContacts(ownerProfileId: string, cb: (contacts: Contact[]) => void) {
    return onSnapshot(collection(db, this.contactsCollectionPath(ownerProfileId)), (qs) => {
      const items: Contact[] = qs.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Contact));
      cb(items);
    });
  }

  // Delete a contact
  static async deleteContact(ownerProfileId: string, contactProfileId: string): Promise<void> {
    const ref = doc(db, this.contactsCollectionPath(ownerProfileId), contactProfileId);
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
