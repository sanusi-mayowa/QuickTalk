import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { auth, db } from "./firebase";
import {
  addDoc,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import Toast from "react-native-toast-message";

// Storage keys
const OFFLINE_MESSAGES_KEY = "offline_messages";
const OFFLINE_CONTACTS_KEY = "offline_contacts";
const OFFLINE_CONTACT_UPDATES_KEY = "offline_contact_updates";
const SYNC_STATUS_KEY = "sync_status";

// Types
export interface OfflineMessage {
  id: string;
  chatId: string;
  content: string;
  senderId: string;
  timestamp: string;
  status: "pending" | "sent" | "failed";
  retryCount: number;
}

export interface OfflineContact {
  id: string;
  displayName: string;
  firstName: string;
  lastName?: string;
  phone: string;
  isQuickTalkUser: boolean;
  contactUserId?: string;
  avatarUrl?: string;
  timestamp: string;
  status: "pending" | "saved" | "failed";
}

export interface OfflineContactUpdate {
  id: string;
  contactId: string;
  updates: {
    displayName?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
  timestamp: string;
  status: "pending" | "updated" | "failed";
}

export interface SyncStatus {
  lastSync: string;
  isOnline: boolean;
  pendingMessages: number;
  pendingContacts: number;
  pendingUpdates: number;
}

class OfflineService {
  private isOnline = true;
  private syncInProgress = false;
  private listeners: Array<(status: SyncStatus) => void> = [];

  constructor() {
    this.initializeNetworkListener();
  }

  private async initializeNetworkListener() {
    // Get initial network state
    const state = await NetInfo.fetch();
    this.isOnline = state.isConnected || false;

    // Listen for network changes
    NetInfo.addEventListener((state) => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected || false;

      if (!wasOnline && this.isOnline) {
        // Just came online, trigger sync
        this.syncOfflineData();
      }

      this.notifyListeners();
    });
  }

  // Add listener for sync status changes
  addSyncListener(listener: (status: SyncStatus) => void) {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private async notifyListeners() {
    const status = await this.getSyncStatus();
    this.listeners.forEach((listener) => listener(status));
  }

  // Check if currently online
  isCurrentlyOnline(): boolean {
    return this.isOnline;
  }

  // Queue a message for offline sending
  async queueMessage(
    chatId: string,
    content: string,
    senderId: string
  ): Promise<string> {
    const message: OfflineMessage = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      chatId,
      content,
      senderId,
      timestamp: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
    };

    try {
      const existing = await this.getOfflineMessages();
      existing.push(message);
      await AsyncStorage.setItem(
        OFFLINE_MESSAGES_KEY,
        JSON.stringify(existing)
      );

      if (this.isOnline) {
        // Try to send immediately if online
        this.syncOfflineData();
      }

      await this.notifyListeners();
      return message.id;
    } catch (error) {
      console.error("Failed to queue message:", error);
      throw error;
    }
  }

  // Queue a contact for offline saving
  async queueContact(
    displayName: string,
    firstName: string,
    lastName: string,
    phone: string,
    isQuickTalkUser: boolean,
    contactUserId?: string,
    avatarUrl?: string
  ): Promise<string> {
    const contact: OfflineContact = {
      id: `offline_contact_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`,
      displayName,
      firstName,
      lastName,
      phone,
      isQuickTalkUser,
      contactUserId,
      avatarUrl,
      timestamp: new Date().toISOString(),
      status: "pending",
    };

    try {
      const existing = await this.getOfflineContacts();
      existing.push(contact);
      await AsyncStorage.setItem(
        OFFLINE_CONTACTS_KEY,
        JSON.stringify(existing)
      );

      if (this.isOnline) {
        // Try to save immediately if online
        this.syncOfflineData();
      }

      await this.notifyListeners();
      return contact.id;
    } catch (error) {
      console.error("Failed to queue contact:", error);
      throw error;
    }
  }

  // Queue a contact update for offline processing
  async queueContactUpdate(
    contactId: string,
    updates: {
      displayName?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
    }
  ): Promise<string> {
    const update: OfflineContactUpdate = {
      id: `offline_update_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`,
      contactId,
      updates,
      timestamp: new Date().toISOString(),
      status: "pending",
    };

    try {
      const existing = await this.getOfflineContactUpdates();
      existing.push(update);
      await AsyncStorage.setItem(
        OFFLINE_CONTACT_UPDATES_KEY,
        JSON.stringify(existing)
      );

      if (this.isOnline) {
        // Try to update immediately if online
        this.syncOfflineData();
      }

      await this.notifyListeners();
      return update.id;
    } catch (error) {
      console.error("Failed to queue contact update:", error);
      throw error;
    }
  }

  // Get all offline messages
  async getOfflineMessages(): Promise<OfflineMessage[]> {
    try {
      const data = await AsyncStorage.getItem(OFFLINE_MESSAGES_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Failed to get offline messages:", error);
      return [];
    }
  }

  // Get all offline contacts
  async getOfflineContacts(): Promise<OfflineContact[]> {
    try {
      const data = await AsyncStorage.getItem(OFFLINE_CONTACTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Failed to get offline contacts:", error);
      return [];
    }
  }

  // Get all offline contact updates
  async getOfflineContactUpdates(): Promise<OfflineContactUpdate[]> {
    try {
      const data = await AsyncStorage.getItem(OFFLINE_CONTACT_UPDATES_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Failed to get offline contact updates:", error);
      return [];
    }
  }

  // Get sync status
  async getSyncStatus(): Promise<SyncStatus> {
    try {
      const [messages, contacts, updates, lastSyncData] = await Promise.all([
        this.getOfflineMessages(),
        this.getOfflineContacts(),
        this.getOfflineContactUpdates(),
        AsyncStorage.getItem(SYNC_STATUS_KEY),
      ]);

      const pendingMessages = messages.filter(
        (m) => m.status === "pending"
      ).length;
      const pendingContacts = contacts.filter(
        (c) => c.status === "pending"
      ).length;
      const pendingUpdates = updates.filter(
        (u) => u.status === "pending"
      ).length;

      return {
        lastSync: lastSyncData ? JSON.parse(lastSyncData).lastSync : "",
        isOnline: this.isOnline,
        pendingMessages,
        pendingContacts,
        pendingUpdates,
      };
    } catch (error) {
      console.error("Failed to get sync status:", error);
      return {
        lastSync: "",
        isOnline: this.isOnline,
        pendingMessages: 0,
        pendingContacts: 0,
        pendingUpdates: 0,
      };
    }
  }

  // Sync offline data when online
  async syncOfflineData(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) {
      return;
    }

    this.syncInProgress = true;

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("No authenticated user");
      }

      // Get current user profile
      const userSnap = await getDoc(doc(db, "user_profiles", user.uid));
      if (!userSnap.exists()) {
        throw new Error("User profile not found");
      }

      const currentUserProfile = { id: userSnap.id, ...userSnap.data() };

      // Sync messages
      await this.syncMessages(currentUserProfile);

      // Sync contacts
      await this.syncContacts(currentUserProfile);

      // Sync contact updates
      await this.syncContactUpdates(currentUserProfile);

      // Update last sync time
      await AsyncStorage.setItem(
        SYNC_STATUS_KEY,
        JSON.stringify({
          lastSync: new Date().toISOString(),
        })
      );

      await this.notifyListeners();

      // Show success message if there were pending items
      const status = await this.getSyncStatus();
      if (
        status.pendingMessages > 0 ||
        status.pendingContacts > 0 ||
        status.pendingUpdates > 0
      ) {
        Toast.show({
          type: "success",
          text1: "Sync Complete",
          text2: "All offline data has been synchronized",
        });
      }
    } catch (error) {
      console.error("Sync failed:", error);
      Toast.show({
        type: "error",
        text1: "Sync Failed",
        text2: "Some offline data could not be synchronized",
      });
    } finally {
      this.syncInProgress = false;
    }
  }

  private async syncMessages(currentUserProfile: any): Promise<void> {
    const messages = await this.getOfflineMessages();
    const pendingMessages = messages.filter((m) => m.status === "pending");

    for (const message of pendingMessages) {
      try {
        // Add message to Firestore
        await addDoc(collection(db, "chats", message.chatId, "messages"), {
          content: message.content,
          senderId: message.senderId,
          timestamp: message.timestamp,
          status: "sent",
        });

        // Update message status
        message.status = "sent";
      } catch (error) {
        console.error("Failed to sync message:", error);
        message.status = "failed";
        message.retryCount += 1;
      }
    }

    // Save updated messages
    await AsyncStorage.setItem(OFFLINE_MESSAGES_KEY, JSON.stringify(messages));
  }

  private async syncContacts(currentUserProfile: any): Promise<void> {
    const contacts = await this.getOfflineContacts();
    const pendingContacts = contacts.filter((c) => c.status === "pending");

    for (const contact of pendingContacts) {
      try {
        const contactDocId = contact.contactUserId || contact.phone;
        const contactDocRef = doc(
          db,
          "user_profiles",
          currentUserProfile.id,
          "contacts",
          contactDocId
        );

        // Check if this phone belongs to a QuickTalk user
        const quicktalkSnap = await getDocs(
          query(
            collection(db, "user_profiles"),
            where("phone", "==", contact.phone)
          )
        );
        const quicktalkUserExists = !quicktalkSnap.empty;
        const linkedProfileId = quicktalkUserExists
          ? quicktalkSnap.docs[0].id
          : null;

        await setDoc(
          contactDocRef,
          {
            ownerProfileId: currentUserProfile.id,
            ownerAuthUid: currentUserProfile.auth_user_id,
            contactProfileId: contactDocId,
            displayName: contact.displayName,
            first_name: contact.firstName,
            last_name: contact.lastName || null,
            phone: contact.phone,
            profile_picture_url: contact.avatarUrl || null,
            is_quicktalk_user: quicktalkUserExists,
            contact_user_id: linkedProfileId,
            created_at: contact.timestamp,
          },
          { merge: true }
        );

        contact.status = "saved";
      } catch (error) {
        console.error("Failed to sync contact:", error);
        contact.status = "failed";
      }
    }

    // Save updated contacts
    await AsyncStorage.setItem(OFFLINE_CONTACTS_KEY, JSON.stringify(contacts));
  }

  private async syncContactUpdates(currentUserProfile: any): Promise<void> {
    const updates = await this.getOfflineContactUpdates();
    const pendingUpdates = updates.filter((u) => u.status === "pending");

    for (const update of pendingUpdates) {
      try {
        const contactDocRef = doc(
          db,
          "user_profiles",
          currentUserProfile.id,
          "contacts",
          update.contactId
        );

        const updateData: any = {};
        if (update.updates.displayName)
          updateData.displayName = update.updates.displayName;
        if (update.updates.firstName)
          updateData.first_name = update.updates.firstName;
        if (update.updates.lastName)
          updateData.last_name = update.updates.lastName;
        if (update.updates.phone) updateData.phone = update.updates.phone;

        await updateDoc(contactDocRef, updateData);
        update.status = "updated";
      } catch (error) {
        console.error("Failed to sync contact update:", error);
        update.status = "failed";
      }
    }

    // Save updated updates
    await AsyncStorage.setItem(
      OFFLINE_CONTACT_UPDATES_KEY,
      JSON.stringify(updates)
    );
  }

  // Clear failed items
  async clearFailedItems(): Promise<void> {
    try {
      const [messages, contacts, updates] = await Promise.all([
        this.getOfflineMessages(),
        this.getOfflineContacts(),
        this.getOfflineContactUpdates(),
      ]);

      const filteredMessages = messages.filter((m) => m.status !== "failed");
      const filteredContacts = contacts.filter((c) => c.status !== "failed");
      const filteredUpdates = updates.filter((u) => u.status !== "failed");

      await Promise.all([
        AsyncStorage.setItem(
          OFFLINE_MESSAGES_KEY,
          JSON.stringify(filteredMessages)
        ),
        AsyncStorage.setItem(
          OFFLINE_CONTACTS_KEY,
          JSON.stringify(filteredContacts)
        ),
        AsyncStorage.setItem(
          OFFLINE_CONTACT_UPDATES_KEY,
          JSON.stringify(filteredUpdates)
        ),
      ]);

      await this.notifyListeners();
    } catch (error) {
      console.error("Failed to clear failed items:", error);
    }
  }

  // Get offline message by ID
  async getOfflineMessage(id: string): Promise<OfflineMessage | null> {
    const messages = await this.getOfflineMessages();
    return messages.find((m) => m.id === id) || null;
  }

  // Remove offline message
  async removeOfflineMessage(id: string): Promise<void> {
    const messages = await this.getOfflineMessages();
    const filtered = messages.filter((m) => m.id !== id);
    await AsyncStorage.setItem(OFFLINE_MESSAGES_KEY, JSON.stringify(filtered));
    await this.notifyListeners();
  }
}

// Export singleton instance
export const offlineService = new OfflineService();
