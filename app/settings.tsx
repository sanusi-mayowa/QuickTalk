import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { auth, db } from "@/lib/firebase";
import FirebaseService from "@/lib/firebase";
import { useTheme, ThemeMode } from "@/lib/theme";
import { useOffline } from "@/hooks/useOffline";
import { useOfflineAuth } from "@/hooks/useOfflineAuth";
import { signOut } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";

interface UserProfile {
  username: string;
  about: string;
  profile_picture_data: string | null;
  phone: string;
  email: string;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { theme, mode, setMode } = useTheme();
  const { syncStatus, syncOfflineData, clearFailedItems } = useOffline();
  const { clearCachedProfile } = useOfflineAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  // Disappearing defaults UI state
  const [dmEnabled, setDmEnabled] = useState<boolean>(false);
  const [dmDurationSec, setDmDurationSec] = useState<number>(60 * 60 * 24);
  const [savingDm, setSavingDm] = useState<boolean>(false);
  const [applyToExistingChats, setApplyToExistingChats] = useState<boolean>(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const q = query(
        collection(db, "user_profiles"),
        where("auth_user_id", "==", user.uid)
      );
      const snap = await getDocs(q);
      const userDoc = snap.docs[0];
      const userProfile = userDoc?.data() as UserProfile | undefined;
      if (userProfile) setProfile(userProfile);
      // Load user disappearing defaults
      if (userDoc?.exists()) {
        const d: any = userDoc.data();
        const defaults = d.disappearingDefaults || {};
        setDmEnabled(!!defaults.enabled);
        setDmDurationSec(Number(defaults.duration || 60 * 60 * 24));
      }
    } catch (error: any) {
      console.error("Error loading profile:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to load profile",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditProfile = () => {
    router.push("/create-profile");
  };

  const handleLogout = async () => {
    try {
      // Clear cached profile before signing out
      await clearCachedProfile();
      
      await signOut(auth);
      await AsyncStorage.multiRemove(["userID", "isAuthenticated"]);
      console.log("signout sucessfull");

      Toast.show({
        type: "success",
        text1: "Logged Out",
        text2: "You have been successfully logged out",
      });

      router.replace("/(auth)/login");
    } catch (error) {
      console.error("Logout error:", error);
      Toast.show({
        type: "error",
        text1: "Logout Failed",
        text2: "Something went wrong",
      });
    }
  };

  const formatDurationLabel = (sec: number) => {
    if (sec === 60 * 60 * 24 * 90) return "90 days";
    if (sec === 60 * 60 * 24 * 7) return "7 days";
    if (sec === 60 * 60 * 24) return "24 hours";
    return `${Math.round(sec / 60)} min`;
  };

  const handleSaveDisappearingDefaults = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      setSavingDm(true);
      // Find profile id
      const q = query(
        collection(db, "user_profiles"),
        where("auth_user_id", "==", user.uid)
      );
      const snap = await getDocs(q);
      const meDoc = snap.docs[0];
      if (!meDoc) {
        Toast.show({ type: "error", text1: "Profile not found" });
        return;
      }
      const myProfileId = meDoc.id;

      await FirebaseService.setUserDisappearingDefaults({
        userProfileId: myProfileId,
        enabled: dmEnabled,
        durationSec: dmEnabled ? dmDurationSec : 0,
      });

      // Optionally apply to existing chats and notify
      if (applyToExistingChats) {
        await FirebaseService.applyUserDefaultToAllChats({
          userProfileId: myProfileId,
          enabled: dmEnabled,
          durationSec: dmEnabled ? dmDurationSec : 0,
        });
        const content = dmEnabled
          ? `You turned on disappearing messages. New messages will disappear after ${formatDurationLabel(dmDurationSec)}.`
          : `You turned off disappearing messages.`;
        await FirebaseService.notifyAllChatsDisappearingChanged({
          userProfileId: myProfileId,
          content,
        });
      }

      Toast.show({ type: "success", text1: "Saved", text2: "Disappearing defaults updated" });
    } catch (e: any) {
      Toast.show({ type: "error", text1: "Failed", text2: e?.message || "Please try again" });
    } finally {
      setSavingDm(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3A805B" />
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <StatusBar
        barStyle={theme.mode === "dark" ? "light-content" : "dark-content"}
        backgroundColor={theme.colors.primary}
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)")}
          style={styles.headerIcon}
        >
          <Feather
            name="chevron-left"
            size={24}
            color={theme.colors.primaryText}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.primaryText }]}>
          Settings
        </Text>
        <TouchableOpacity style={styles.headerIcon}>
          <Feather name="search" size={24} color={theme.colors.primaryText} />
        </TouchableOpacity>
      </View>

      {/* Main Screen Content */}
      <View style={styles.screenContent}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* Profile Section */}
          {profile && (
            <View
              style={[
                styles.profileSection,
                { backgroundColor: theme.colors.surface },
              ]}
            >
              <View style={styles.profileInfo}>
                <View style={styles.avatarContainer}>
                  {profile.profile_picture_data ? (
                    <Image
                      source={{ uri: profile.profile_picture_data }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Feather name="users" size={32} color="#666" />
                    </View>
                  )}
                </View>

                <View style={styles.profileDetails}>
                  <Text style={[styles.username, { color: theme.colors.text }]}>
                    {profile.username}
                  </Text>
                  <Text
                    style={[styles.about, { color: theme.colors.mutedText }]}
                    numberOfLines={2}
                  >
                    {profile.about}
                  </Text>
                  <Text
                    style={[
                      styles.contactInfo,
                      { color: theme.colors.mutedText },
                    ]}
                  >
                    {profile.email}
                  </Text>
                  <Text
                    style={[
                      styles.contactInfo,
                      { color: theme.colors.mutedText },
                    ]}
                  >
                    {profile.phone}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.editButton,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.primary,
                  },
                ]}
                onPress={handleEditProfile}
              >
                <Feather
                  name="edit"
                  size={16}
                  color={theme.colors.primaryText}
                />
                <Text
                  style={[
                    styles.editButtonText,
                    { color: theme.colors.primaryText },
                  ]}
                >
                  Edit Profile
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Settings Options */}
          <View
            style={[
              styles.settingsSection,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.settingItem,
                { borderBottomColor: theme.colors.border },
              ]}
              onPress={() => (router.push as any)({ pathname: '/settings/disappearing' })}
              accessibilityRole="button"
            >
              <View style={styles.settingItemLeft}>
                <View style={styles.settingIcon}>
                  <Feather name="clock" size={20} color={theme.colors.primary} />
                </View>
                <Text style={[styles.settingText, { color: theme.colors.text }]}>Disappearing messages</Text>
              </View>
              <Feather name="chevron-right" size={20} color={theme.colors.mutedText} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.settingItem,
                { borderBottomColor: theme.colors.border },
              ]}
              onPress={() => (router.push as any)({ pathname: '/settings/theme' })}
              accessibilityRole="button"
            >
              <View style={styles.settingItemLeft}>
                <View style={styles.settingIcon}>
                  <Feather name="moon" size={20} color={theme.colors.primary} />
                </View>
                <Text style={[styles.settingText, { color: theme.colors.text }]}>Theme</Text>
              </View>
              <Feather name="chevron-right" size={20} color={theme.colors.mutedText} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.settingItem,
                { borderBottomColor: theme.colors.border },
              ]}
              onPress={() => router.push('/blocked-contacts')}
            >
              <View style={styles.settingItemLeft}>
                <View style={styles.settingIcon}>
                  <Feather name="slash" size={20} color={theme.colors.primary} />
                </View>
                <Text
                  style={[styles.settingText, { color: theme.colors.text }]}
                >
                  Blocked contacts
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color={theme.colors.mutedText} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.settingItem,
                { borderBottomColor: theme.colors.border },
              ]}
              onPress={() => (router.push as any)({ pathname: '/settings/security' })}
            >
              <View style={styles.settingItemLeft}>
                <View style={styles.settingIcon}>
                  <Feather
                    name="shield"
                    size={20}
                    color={theme.colors.primary}
                  />
                </View>
                <Text
                  style={[styles.settingText, { color: theme.colors.text }]}
                >
                  Privacy & Security
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color={theme.colors.mutedText} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.settingItem,
                { borderBottomColor: theme.colors.border },
              ]}
            >
              <View style={styles.settingItemLeft}>
                <View style={styles.settingIcon}>
                  <Feather
                    name="help-circle"
                    size={20}
                    color={theme.colors.primary}
                  />
                </View>
                <Text
                  style={[styles.settingText, { color: theme.colors.text }]}
                >
                  Help & Support
                </Text>
              </View>
            </TouchableOpacity>
            {/* </View> */}

            {/* Offline Sync Status (inline) */}
            {/* <View style={[styles.settingsSection, { backgroundColor: theme.colors.surface }]}> */}
            <View
              style={[
                styles.settingItem,
                { borderBottomColor: theme.colors.border },
              ]}
            >
              <View style={styles.settingItemLeft}>
                <View style={styles.settingIcon}>
                  <Feather
                    name={syncStatus.isOnline ? "wifi" : "wifi-off"}
                    size={20}
                    color={
                      syncStatus.isOnline ? theme.colors.primary : "#d32f2f"
                    }
                  />
                </View>
                <View>
                  <Text
                    style={[styles.settingText, { color: theme.colors.text }]}
                  >
                    {syncStatus.isOnline ? "Online" : "Offline"}
                  </Text>
                  <Text
                    style={[
                      styles.syncStatusText,
                      { color: theme.colors.mutedText },
                    ]}
                  >
                    {syncStatus.isOnline
                      ? "All changes sync automatically"
                      : "Changes will sync when online"}
                  </Text>
                </View>
              </View>
            </View>

            {(syncStatus.pendingMessages > 0 ||
              syncStatus.pendingContacts > 0 ||
              syncStatus.pendingUpdates > 0) && (
              <View
                style={[
                  styles.settingItem,
                  { borderBottomColor: theme.colors.border },
                ]}
              >
                <View style={styles.settingItemLeft}>
                  <View style={styles.settingIcon}>
                    <Feather name="clock" size={20} color="#ff9800" />
                  </View>
                  <View>
                    <Text
                      style={[styles.settingText, { color: theme.colors.text }]}
                    >
                      Pending Sync
                    </Text>
                    <Text
                      style={[
                        styles.syncStatusText,
                        { color: theme.colors.mutedText },
                      ]}
                    >
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
                  </View>
                </View>
                <TouchableOpacity
                  style={[
                    styles.syncButton,
                    { backgroundColor: theme.colors.primary },
                  ]}
                  onPress={syncOfflineData}
                >
                  <Feather
                    name="refresh-cw"
                    size={16}
                    color={theme.colors.primaryText}
                  />
                  <Text
                    style={[
                      styles.syncButtonText,
                      { color: theme.colors.primaryText },
                    ]}
                  >
                    Sync
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {syncStatus.lastSync && (
              <View style={styles.settingItem}>
                <View style={styles.settingItemLeft}>
                  <View style={styles.settingIcon}>
                    <Feather name="check-circle" size={20} color="#4caf50" />
                  </View>
                  <Text
                    style={[styles.settingText, { color: theme.colors.text }]}
                  >
                    Last sync: {new Date(syncStatus.lastSync).toLocaleString()}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Logout Button pinned at bottom */}
        <View style={styles.logoutSection}>
          <TouchableOpacity
            style={[
              styles.logoutButton,
              { backgroundColor: theme.colors.surface, borderColor: "#d32f2f" },
            ]}
            onPress={handleLogout}
          >
            <Feather name="log-out" size={20} color="#d32f2f" />
            <Text
              style={[
                styles.logoutText,
                {
                  color:
                    theme.mode === "dark"
                      ? theme.colors.primaryText
                      : "#d32f2f",
                },
              ]}
            >
              Logout
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingBottom: 30,
  },
  screenContent: {
    flex: 1,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#3A805B",
    paddingHorizontal: 12,
    paddingVertical: 18,
    paddingTop: 40,
  },
  headerIcon: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
    marginHorizontal: 16,
  },
  content: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  profileSection: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  profileInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#e9ecef",
    justifyContent: "center",
    alignItems: "center",
  },
  profileDetails: {
    flex: 1,
    marginTop: 20,
  },
  username: {
    fontSize: 18,
    fontWeight: "600",
    color: "#3A805B",
  },
  about: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 8,
  },
  contactInfo: {
    fontSize: 12,
    color: "#999",
    marginBottom: 2,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fffe",
    borderWidth: 1,
    borderColor: "#3A805B",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  editButtonText: {
    color: "#3A805B",
    fontSize: 14,
    fontWeight: "600",
  },
  settingsSection: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 20,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f8f9fa",
  },
  settingItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f8fffe",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  themeChip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 4,
  },
  settingText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  syncStatusText: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  syncButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  logoutSection: {
    backgroundColor: "transparent",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#d32f2f",
    borderRadius: 12,
  },
  logoutText: {
    fontSize: 16,
    color: "#d32f2f",
    fontWeight: "600",
  },
});
