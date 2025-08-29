import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  TextInput,
  SafeAreaView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import NetInfo from "@react-native-community/netinfo";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useTheme } from "@/lib/theme";

export default function UserProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { theme } = useTheme();

  // navigation params (some are still needed)
  const userId = (params.id as string) || (params.userId as string);
  const isSaved = params.isSaved === "true";
  const contactId = params.contactId as string;
  const ownerProfileId = params.ownerProfileId as string;
  const contactName = params.contactName as string;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [aboutUpdatedAt, setAboutUpdatedAt] = useState<string>("");
  const [isConnected, setIsConnected] = useState(true);
  const [isEditingSavedName, setIsEditingSavedName] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [savedFirstName, setSavedFirstName] = useState<string | null>(null);
  const [savedLastName, setSavedLastName] = useState<string | null>(null);

  const normalizeProfile = (raw: any, idFromSource?: string) => {
    if (!raw) return null;
    const normalized: any = {
      id: idFromSource || raw.id || userId,
      ...raw,
    };
    normalized.profile_picture_url =
      raw.profile_picture_url ||
      raw.profile_picture_data ||
      raw.profilePicture ||
      null;
    return normalized;
  };

  useEffect(() => {
    if (!userId) return;

    // Watch network status
    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? false);
    });

    // Try cached profile first
    const loadCache = async () => {
      try {
        const cached = await AsyncStorage.getItem(`user_profile:${userId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          const normalizedFromCache = normalizeProfile(parsed, userId);
          setProfile(normalizedFromCache);
          if (normalizedFromCache?.updated_at)
            setAboutUpdatedAt(normalizedFromCache.updated_at);
          setLoading(false);
        }
      } catch (e) {
        console.error("Error reading cache", e);
      }
    };
    loadCache();

    // Firestore real-time subscription
    const unsubscribe = onSnapshot(
      doc(db, "user_profiles", userId),
      async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          console.log("Raw profile data from Firestore:", {
            userId,
            allFields: Object.keys(data),
            profilePicture: data.profilePicture,
            profile_picture_data: data.profile_picture_data,
            profile_picture_url: data.profile_picture_url,
          });
          // Normalize fields: ensure an id is present and map any picture field to profile_picture_url
          const normalized = normalizeProfile(data, snapshot.id);
          setProfile(normalized);
          setLoading(false);

          if (data.updated_at) setAboutUpdatedAt(data.updated_at);

          // update cache
          try {
            await AsyncStorage.setItem(
              `user_profile:${userId}`,
              JSON.stringify(normalized)
            );
            console.log(`user_profile:${userId}` + "" + "profile completed ");
          } catch {}
        } else {
          Toast.show({ type: "error", text1: "User not found" });
          setLoading(false);
        }
      },
      (error) => {
        console.error("Firestore error:", error);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
      unsubscribeNetInfo();
    };
  }, [userId]);

  // Live-update saved contact name when this profile is a saved contact
  useEffect(() => {
    if (!isSaved || !contactId || !ownerProfileId) return;
    const unsubscribe = onSnapshot(
      doc(db, "user_profiles", ownerProfileId, "contacts", contactId),
      (snap) => {
        if (snap.exists()) {
          const data: any = snap.data();
          const display = (data.displayName || "").trim();
          if (display) {
            const [first, ...rest] = display.split(" ");
            setSavedFirstName(first || null);
            setSavedLastName(rest.join(" ") || null);
          } else {
            setSavedFirstName((data.first_name || "").trim() || null);
            setSavedLastName((data.last_name || "").trim() || null);
          }
        }
      },
      (error) => {
        console.error("Contact watch error:", error);
      }
    );
    return () => unsubscribe();
  }, [isSaved, contactId, ownerProfileId]);

  const handleEditContact = () => {
    if (!isSaved || !contactId) return;
    router.push({
      pathname: "/edit-contact",
      params: {
        contactId,
        firstName: contactName
          ? contactName.split(" ")[0]
          : profile?.username || "",
        lastName: contactName ? contactName.split(" ").slice(1).join(" ") : "",
      },
    });
  };

  const handleSaveEditedName = async () => {
    if (!isSaved || !contactId || !ownerProfileId) return;
    if (!editFirstName.trim()) {
      Toast.show({ type: "error", text1: "First name required" });
      return;
    }
    try {
      await updateDoc(
        doc(db, "user_profiles", ownerProfileId, "contacts", contactId),
        {
          first_name: editFirstName.trim(),
          last_name: editLastName.trim() || null,
          displayName: `${editFirstName.trim()} ${editLastName.trim()}`.trim(),
        }
      );
      Toast.show({
        type: "success",
        text1: "Saved",
        text2: "Contact name updated",
      });
      setIsEditingSavedName(false);
    } catch (e: any) {
      console.error("Error updating contact name:", e);
      Toast.show({
        type: "error",
        text1: "Update failed",
        text2: e?.message || "Insufficient permissions",
      });
    }
  };

  const handleSaveContact = () => {
    if (!profile) return;
    router.push({
      pathname: "/new-contact",
      params: {
        prefillPhone: profile.phone,
        prefillFirstName: profile.username,
        prefillCountry:
          profile.phone && profile.phone.startsWith("+")
            ? ""
            : profile.countryCode || "",
        prefillUsername: profile.username,
        prefillAvatar: profile.profile_picture_url || "",
        fromProfile: "true",
      },
    });
  };

  const formatLastSeen = (lastSeenTime: any) => {
    if (!lastSeenTime) return "";
    let date: Date | null = null;
    if (typeof lastSeenTime === "string") {
      const d = new Date(lastSeenTime);
      date = isNaN(d.getTime()) ? null : d;
    } else if (lastSeenTime?.toDate) {
      try {
        date = lastSeenTime.toDate();
      } catch {
        date = null;
      }
    }
    if (!date) return "";
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60)
    );
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    }
    const days = Math.floor(diffInMinutes / 1440);
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const formatAboutUpdated = (updatedTime: string) => {
    if (!updatedTime) return "";
    const date = new Date(updatedTime);
    const now = new Date();
    const diffInDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffInDays === 0) return "Today";
    if (diffInDays === 1) return "Yesterday";
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return date.toLocaleDateString();
  };

  const capitalizeName = (name: string | null | undefined) => {
    if (!name) return "";
    return name
      .split(" ")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  };

  const getDisplayName = () => {
    if (!profile) return "";
    if (isSaved && (savedFirstName || savedLastName || contactName)) {
      const first =
        savedFirstName ?? (contactName ? contactName.split(" ")[0] : "");
      const last =
        savedLastName ??
        (contactName ? contactName.split(" ").slice(1).join(" ") : "");
      return capitalizeName(`${first} ${last}`.trim());
    }
    if (profile.username) return capitalizeName(profile.username);
    return profile.phone;
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3A805B" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text>User not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#3A805B" }}>
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: theme.colors.primary,
            },
          ]}
        >
          <TouchableOpacity onPress={() => router.back()}>
            <Feather
              name="chevron-left"
              size={24}
              color={theme.colors.primaryText}
            />
          </TouchableOpacity>
          <Text
            style={[styles.headerTitle, { color: theme.colors.primaryText }]}
          >
            Profile
          </Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Profile Section */}
          <View
            style={[
              styles.profileSection,
              {
                backgroundColor: theme.colors.surface,
                borderBottomColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.avatarContainer}>
              {(() => {
                // Debug profile picture fields
                console.log("User profile picture fields:", {
                  userId,
                  profilePicture: profile?.profilePicture,
                  profile_picture_data: profile?.profile_picture_data,
                  profile_picture_url: profile?.profile_picture_url,
                  finalValue: profile?.profile_picture_url,
                });
                return null;
              })()}
              {profile.profile_picture_url ? (
                <Image
                  source={{ uri: profile.profile_picture_url }}
                  style={styles.avatar}
                />
              ) : (
                <View
                  style={[
                    styles.avatarPlaceholder,
                    {
                      backgroundColor: theme.colors.border,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Feather
                    name="user"
                    size={40}
                    color={theme.colors.mutedText}
                  />
                </View>
              )}
            </View>
            <Text style={[styles.displayName, { color: theme.colors.text }]}>
              {getDisplayName()}
            </Text>
            {isSaved && (
              <Text style={[styles.username, { color: theme.colors.primary }]}>
                {profile.username}
              </Text>
            )}
            <Text
              style={[styles.phoneNumber, { color: theme.colors.mutedText }]}
            >
              {profile.phone}
            </Text>
          </View>

          {/* Status Section */}
          <View
            style={[
              styles.statusSection,
              {
                backgroundColor: theme.colors.surface,
                borderBottomColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.statusItem}>
              <View
                style={[
                  styles.statusIndicator,
                  profile.isOnline
                    ? styles.onlineIndicator
                    : styles.offlineIndicator,
                ]}
              />
              <Text style={[styles.statusText, { color: theme.colors.text }]}>
                {profile.isOnline ?? profile.is_online
                  ? "Online"
                  : `Last seen ${formatLastSeen(
                      profile.lastSeen || profile.last_seen
                    )}`}
              </Text>
            </View>
            {!isConnected && (
              <Text
                style={{
                  fontSize: 12,
                  color: theme.colors.mutedText,
                  marginTop: 4,
                }}
              >
                Offline mode (showing cached data)
              </Text>
            )}
          </View>

          {/* About Section */}
          <View
            style={[
              styles.aboutSection,
              {
                backgroundColor: theme.colors.surface,
                borderBottomColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.aboutHeader}>
              <Feather name="info" size={20} color={theme.colors.mutedText} />
              <Text style={[styles.aboutTitle, { color: theme.colors.text }]}>
                About
              </Text>
            </View>
            <Text style={[styles.aboutText, { color: theme.colors.text }]}>
              {profile.about}
            </Text>
            {aboutUpdatedAt && (
              <View style={styles.aboutFooter}>
                <Feather
                  name="clock"
                  size={14}
                  color={theme.colors.mutedText}
                />
                <Text
                  style={[
                    styles.aboutUpdated,
                    { color: theme.colors.mutedText },
                  ]}
                >
                  Updated {formatAboutUpdated(aboutUpdatedAt)}
                </Text>
              </View>
            )}
          </View>

          {/* Actions Section */}
          {!isSaved ? (
            <View
              style={[
                styles.actionsSection,
                {
                  backgroundColor: theme.colors.surface,
                  borderBottomColor: theme.colors.border,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  { backgroundColor: theme.colors.primary },
                ]}
                onPress={handleSaveContact}
              >
                <Feather
                  name="user-plus"
                  size={20}
                  color={theme.colors.primaryText}
                />
                <Text
                  style={[
                    styles.saveButtonText,
                    { color: theme.colors.primaryText },
                  ]}
                >
                  Save Contact
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View
              style={[
                styles.actionsSection,
                {
                  backgroundColor: theme.colors.surface,
                  borderBottomColor: theme.colors.border,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  {
                    borderColor: theme.colors.primary,
                    backgroundColor: theme.colors.surface,
                  },
                ]}
                onPress={handleEditContact}
              >
                <Feather name="edit-3" size={18} color={theme.colors.primary} />
                <Text
                  style={[
                    styles.secondaryButtonText,
                    { color: theme.colors.primary },
                  ]}
                >
                  Edit Saved Name
                </Text>
              </TouchableOpacity>
              {isEditingSavedName && (
                <View style={{ marginTop: 12 }}>
                  <Text
                    style={[
                      styles.infoLabel,
                      { color: theme.colors.mutedText },
                    ]}
                  >
                    First name
                  </Text>
                  <View
                    style={[
                      styles.inlineInput,
                      {
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.surface,
                      },
                    ]}
                  >
                    <TextInput
                      style={[
                        styles.inlineTextInput,
                        { color: theme.colors.text },
                      ]}
                      value={editFirstName}
                      onChangeText={setEditFirstName}
                      placeholder="First name"
                      placeholderTextColor={theme.colors.mutedText}
                    />
                  </View>
                  <Text
                    style={[
                      styles.infoLabel,
                      { marginTop: 10, color: theme.colors.mutedText },
                    ]}
                  >
                    Last name
                  </Text>
                  <View
                    style={[
                      styles.inlineInput,
                      {
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.surface,
                      },
                    ]}
                  >
                    <TextInput
                      style={[
                        styles.inlineTextInput,
                        { color: theme.colors.text },
                      ]}
                      value={editLastName}
                      onChangeText={setEditLastName}
                      placeholder="Last name (optional)"
                      placeholderTextColor={theme.colors.mutedText}
                    />
                  </View>
                  <View
                    style={{ flexDirection: "row", gap: 12, marginTop: 12 }}
                  >
                    <TouchableOpacity
                      style={[
                        styles.saveButton,
                        { backgroundColor: theme.colors.primary },
                      ]}
                      onPress={handleSaveEditedName}
                    >
                      <Feather
                        name="check"
                        size={20}
                        color={theme.colors.primaryText}
                      />
                      <Text
                        style={[
                          styles.saveButtonText,
                          { color: theme.colors.primaryText },
                        ]}
                      >
                        Save
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.secondaryButton,
                        { borderColor: theme.colors.primary },
                      ]}
                      onPress={() => setIsEditingSavedName(false)}
                    >
                      <Feather
                        name="x"
                        size={18}
                        color={theme.colors.primary}
                      />
                      <Text
                        style={[
                          styles.secondaryButtonText,
                          { color: theme.colors.primary },
                        ]}
                      >
                        Cancel
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Contact Info Section */}
          <View
            style={[
              styles.infoSection,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <Text style={[styles.infoTitle, { color: theme.colors.text }]}>
              Contact Information
            </Text>
            <View style={styles.infoItem}>
              <Text
                style={[styles.infoLabel, { color: theme.colors.mutedText }]}
              >
                Phone
              </Text>
              <Text style={[styles.infoValue, { color: theme.colors.text }]}>
                {profile.phone}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text
                style={[styles.infoLabel, { color: theme.colors.mutedText }]}
              >
                Username
              </Text>
              <Text style={[styles.infoValue, { color: theme.colors.text }]}>
                {profile.username}
              </Text>
            </View>
            {isSaved && (
              <View style={styles.infoItem}>
                <Text
                  style={[styles.infoLabel, { color: theme.colors.mutedText }]}
                >
                  Saved as
                </Text>
                <Text
                  style={[styles.infoUsername, { color: theme.colors.text }]}
                >
                  {capitalizeName(
                    `${savedFirstName ?? ""} ${savedLastName ?? ""}`.trim()
                  ) || contactName}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9f9f9",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3A805B",
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
    marginLeft: 5,
  },
  placeholder: { width: 40 },
  content: { flex: 1 },
  profileSection: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  avatarContainer: {
    marginBottom: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: "#3A805B",
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#e9ecef",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#dee2e6",
  },
  displayName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
    textAlign: "center",
  },
  username: {
    fontSize: 16,
    color: "#3A805B",
    marginBottom: 8,
    fontWeight: "500",
  },
  phoneNumber: {
    fontSize: 16,
    color: "#666",
    marginBottom: 16,
  },
  statusSection: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  onlineIndicator: {
    backgroundColor: "#4CAF50",
  },
  offlineIndicator: {
    backgroundColor: "#999",
  },
  statusText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  aboutSection: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  aboutHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  aboutTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  aboutText: {
    fontSize: 16,
    color: "#333",
    lineHeight: 24,
    marginBottom: 12,
  },
  aboutFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  aboutUpdated: {
    fontSize: 12,
    color: "#999",
  },
  actionsSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: "#fff",
    marginTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3A805B",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0fff8",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "#3A805B",
  },
  secondaryButtonText: {
    color: "#3A805B",
    fontSize: 16,
    fontWeight: "600",
  },
  infoSection: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 8,
    marginBottom: 50,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  infoLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 14,
    color: "#333",
    fontWeight: "600",
  },
  infoUsername: {
    textTransform: "capitalize",
    color: "#333",
    fontWeight: "600",
  },
  inlineInput: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inlineTextInput: {
    fontSize: 16,
    color: "#000",
  },
});
