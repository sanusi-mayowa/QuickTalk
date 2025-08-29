import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { useOffline } from "@/hooks/useOffline";

interface OfflineIndicatorProps {
  onSyncPress?: () => void;
  showPendingCount?: boolean;
}

export default function OfflineIndicator({
  onSyncPress,
  showPendingCount = true,
}: OfflineIndicatorProps) {
  const { theme } = useTheme();
  const { syncStatus, syncOfflineData } = useOffline();

  const handleSyncPress = () => {
    if (onSyncPress) {
      onSyncPress();
    } else {
      syncOfflineData();
    }
  };

  const hasPendingItems =
    syncStatus.pendingMessages > 0 ||
    syncStatus.pendingContacts > 0 ||
    syncStatus.pendingUpdates > 0;

  if (syncStatus.isOnline && !hasPendingItems) {
    return null; // Don't show anything when online and no pending items
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.content}>
        <Feather
          name={syncStatus.isOnline ? "wifi" : "wifi-off"}
          size={16}
          color={syncStatus.isOnline ? theme.colors.primary : "#d32f2f"}
        />
        <Text style={[styles.text, { color: theme.colors.text }]}>
          {syncStatus.isOnline ? "Online" : "Offline"}
        </Text>

        {showPendingCount && hasPendingItems && (
          <Text style={[styles.pendingText, { color: theme.colors.mutedText }]}>
            {syncStatus.pendingMessages > 0 &&
              `${syncStatus.pendingMessages} message${
                syncStatus.pendingMessages > 1 ? "s" : ""
              }`}
            {syncStatus.pendingContacts > 0 &&
              `${syncStatus.pendingContacts > 0 ? ", " : ""}${
                syncStatus.pendingContacts
              } contact${syncStatus.pendingContacts > 1 ? "s" : ""}`}
            {syncStatus.pendingUpdates > 0 &&
              `${syncStatus.pendingUpdates > 0 ? ", " : ""}${
                syncStatus.pendingUpdates
              } update${syncStatus.pendingUpdates > 1 ? "s" : ""}`}
          </Text>
        )}
      </View>

      {hasPendingItems && (
        <TouchableOpacity
          style={[styles.syncButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleSyncPress}
        >
          <Feather
            name="refresh-cw"
            size={14}
            color={theme.colors.primaryText}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: "500",
  },
  pendingText: {
    fontSize: 12,
    marginLeft: 4,
  },
  syncButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
});
