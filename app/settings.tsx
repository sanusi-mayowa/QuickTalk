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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const q = query(collection(db, "user_profiles"), where("auth_user_id", "==", user.uid));
      const snap = await getDocs(q);
      const userProfile = snap.docs[0]?.data() as UserProfile | undefined;
      if (userProfile) setProfile(userProfile);
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3A805B" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3A805B" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)')}
          style={styles.headerIcon}
        >
          <Feather name="chevron-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <TouchableOpacity style={styles.headerIcon}>
          <Feather name="search" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Main Screen Content */}
      <View style={styles.screenContent}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* Profile Section */}
          {profile && (
            <View style={styles.profileSection}>
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
                  <Text style={styles.username}>{profile.username}</Text>
                  <Text style={styles.about} numberOfLines={2}>
                    {profile.about}
                  </Text>
                  <Text style={styles.contactInfo}>{profile.email}</Text>
                  <Text style={styles.contactInfo}>{profile.phone}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.editButton}
                onPress={handleEditProfile}
              >
                <Feather name="edit" size={16} color="#3A805B" />
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Settings Options */}
          <View style={styles.settingsSection}>
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingItemLeft}>
                <View style={styles.settingIcon}>
                  <Feather name="bell" size={20} color="#3A805B" />
                </View>
                <Text style={styles.settingText}>Notifications</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingItemLeft}>
                <View style={styles.settingIcon}>
                  <Feather name="shield" size={20} color="#3A805B" />
                </View>
                <Text style={styles.settingText}>Privacy & Security</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingItemLeft}>
                <View style={styles.settingIcon}>
                  <Feather name="help-circle" size={20} color="#3A805B" />
                </View>
                <Text style={styles.settingText}>Help & Support</Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Logout Button pinned at bottom */}
        <View style={styles.logoutSection}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Feather name="log-out" size={20} color="#d32f2f" />
            <Text style={styles.logoutText}>Logout</Text>
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
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
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
  settingText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  logoutSection: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 30,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
