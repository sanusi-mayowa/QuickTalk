import { useState, useEffect } from "react";
import {
  offlineService,
  SyncStatus,
  OfflineMessage,
  OfflineContact,
  OfflineContactUpdate,
} from "@/lib/offline";

export function useOffline() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastSync: "",
    isOnline: true,
    pendingMessages: 0,
    pendingContacts: 0,
    pendingUpdates: 0,
  });

  useEffect(() => {
    // Get initial status
    offlineService.getSyncStatus().then(setSyncStatus);

    // Listen for status changes
    const unsubscribe = offlineService.addSyncListener(setSyncStatus);

    return unsubscribe;
  }, []);

  const queueMessage = async (
    chatId: string,
    content: string,
    senderId: string
  ) => {
    return await offlineService.queueMessage(chatId, content, senderId);
  };

  const queueContact = async (
    displayName: string,
    firstName: string,
    lastName: string,
    phone: string,
    isQuickTalkUser: boolean,
    contactUserId?: string
  ) => {
    return await offlineService.queueContact(
      displayName,
      firstName,
      lastName,
      phone,
      isQuickTalkUser,
      contactUserId
    );
  };

  const queueContactUpdate = async (
    contactId: string,
    updates: {
      displayName?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
    }
  ) => {
    return await offlineService.queueContactUpdate(contactId, updates);
  };

  const syncOfflineData = async () => {
    return await offlineService.syncOfflineData();
  };

  const clearFailedItems = async () => {
    return await offlineService.clearFailedItems();
  };

  const getOfflineMessages = async (): Promise<OfflineMessage[]> => {
    return await offlineService.getOfflineMessages();
  };

  const getOfflineContacts = async (): Promise<OfflineContact[]> => {
    return await offlineService.getOfflineContacts();
  };

  const getOfflineContactUpdates = async (): Promise<
    OfflineContactUpdate[]
  > => {
    return await offlineService.getOfflineContactUpdates();
  };

  const isOnline = () => {
    return offlineService.isCurrentlyOnline();
  };

  return {
    syncStatus,
    queueMessage,
    queueContact,
    queueContactUpdate,
    syncOfflineData,
    clearFailedItems,
    getOfflineMessages,
    getOfflineContacts,
    getOfflineContactUpdates,
    isOnline,
  };
}
