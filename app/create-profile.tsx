import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import Toast from "react-native-toast-message";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";

const PRESET_ABOUTS = [
  "Love to travel and explore new places ✈️",
  "Coffee enthusiast and book lover ☕📚",
  "Fitness enthusiast and healthy living 💪",
  "Tech geek and innovation lover 💻",
  "Music lover and concert goer 🎵",
  "Foodie and cooking enthusiast 🍳",
  "Nature lover and outdoor adventurer 🌲",
  "Art and creativity enthusiast 🎨",
];

export default function CreateProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [about, setAbout] = useState("");
  const [customAbout, setCustomAbout] = useState("");
  const [useCustomAbout, setUseCustomAbout] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [userPhone, setUserPhone] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setUserEmail(session.user.email || "");

        // Try to get existing profile data
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("auth_user_id", session.user.id)
          .single();

        if (profile) {
          setUsername(profile.username || "");
          setAbout(profile.about || "");
          setProfileImage(profile.profile_picture_url);
          setUserPhone(profile.phone || "");
        } else {
          // Get phone from user metadata
          setUserPhone(session.user.user_metadata?.phone || "");
        }
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  };

  const handleImagePicker = async () => {
    if (Platform.OS === "web") {
      // Web implementation
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = (e: any) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            setProfileImage(e.target?.result as string);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      // Mobile implementation
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setProfileImage(result.assets[0].uri);
      }
    }
  };

  const handleCamera = async () => {
    if (Platform.OS === "web") {
      Toast.show({
        type: "info",
        text1: "Camera Not Available",
        text2:
          "Camera is not available on web. Please use image upload instead.",
      });
      return;
    }

    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        Toast.show({
          type: "error",
          text1: "Permission Required",
          text2: "Camera permission is required to take photos.",
        });
        return;
      }
    }

    setShowCamera(true);
  };

  const takePicture = async (camera: any) => {
    if (camera) {
      const photo = await camera.takePictureAsync();
      setProfileImage(photo.uri);
      setShowCamera(false);
    }
  };

  const handleCreateProfile = async () => {
    if (!username.trim()) {
      Toast.show({
        type: "error",
        text1: "Username Required",
        text2: "Please enter a username",
      });
      return;
    }

    const finalAbout = useCustomAbout ? customAbout.trim() : about;
    if (!finalAbout) {
      Toast.show({
        type: "error",
        text1: "About Required",
        text2: "Please select or write something about yourself",
      });
      return;
    }

    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No active session");
      }

      // Check if username is already taken
      const { data: existingUser } = await supabase
        .from("user_profiles")
        .select("username")
        .eq("username", username.trim())
        .neq("auth_user_id", session.user.id)
        .single();

      if (existingUser) {
        Toast.show({
          type: "error",
          text1: "Username Taken",
          text2: "This username is already taken. Please choose another.",
        });
        setLoading(false);
        return;
      }

      // Upload profile image if exists (simplified for demo)
      let profileImageUrl = profileImage;

      // Create or update profile
      const profileData = {
        auth_user_id: session.user.id,
        username: username.trim(),
        about: finalAbout,
        profile_picture_url: profileImageUrl,
        phone: userPhone,
        email: userEmail,
        is_profile_complete: true,
      };

      const { error } = await supabase
        .from("user_profiles")
        .upsert(profileData, { onConflict: "auth_user_id" });

      if (error) {
        throw error;
      }

      Toast.show({
        type: "success",
        text1: "Profile Created!",
        text2: "Your profile has been created successfully",
      });

      router.replace("/(tabs)");
    } catch (error: any) {
      console.error("Error creating profile:", error);
      Toast.show({
        type: "error",
        text1: "Profile Creation Failed",
        text2: error.message || "Something went wrong",
      });
    } finally {
      setLoading(false);
    }
  };

  if (showCamera && Platform.OS !== "web") {
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="front"
          ref={(ref) => {
            if (ref) {
              // Camera ref handling
            }
          }}
        >
          <View style={styles.cameraControls}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowCamera(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.captureButton}
              onPress={() => takePicture}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Create Your Profile</Text>
          <Text style={styles.subtitle}>Let others know who you are</Text>
        </View>

        {/* Profile Picture Section */}
        <View style={styles.profileImageSection}>
          <View style={styles.profileImageContainer}>
            {profileImage ? (
              <Image
                source={{ uri: profileImage }}
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <Feather name="users" size={40} color="#666" />
              </View>
            )}
          </View>

          <View style={styles.imageButtons}>
            <TouchableOpacity
              style={styles.imageButton}
              onPress={handleImagePicker}
            >
              <Feather name="upload" size={20} color="#3A805B" />
              <Text style={styles.imageButtonText}>Upload</Text>
            </TouchableOpacity>

            {Platform.OS !== "web" && (
              <TouchableOpacity
                style={styles.imageButton}
                onPress={handleCamera}
              >
                <Feather name="upload" size={20} color="#3A805B" />
                <Text style={styles.imageButtonText}>Camera</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Username Section */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter your username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
        </View>

        {/* About Section */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>About You</Text>

          <View style={styles.aboutToggle}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                !useCustomAbout && styles.toggleButtonActive,
              ]}
              onPress={() => setUseCustomAbout(false)}
            >
              <Text
                style={[
                  styles.toggleButtonText,
                  !useCustomAbout && styles.toggleButtonTextActive,
                ]}
              >
                Choose from presets
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.toggleButton,
                useCustomAbout && styles.toggleButtonActive,
              ]}
              onPress={() => setUseCustomAbout(true)}
            >
              <Text
                style={[
                  styles.toggleButtonText,
                  useCustomAbout && styles.toggleButtonTextActive,
                ]}
              >
                Write custom
              </Text>
            </TouchableOpacity>
          </View>

          {useCustomAbout ? (
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Write something about yourself..."
              value={customAbout}
              onChangeText={setCustomAbout}
              multiline
              numberOfLines={4}
            />
          ) : (
            <View style={styles.presetContainer}>
              {PRESET_ABOUTS.map((preset, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.presetOption,
                    about === preset && styles.presetOptionSelected,
                  ]}
                  onPress={() => setAbout(preset)}
                >
                  <Text
                    style={[
                      styles.presetText,
                      about === preset && styles.presetTextSelected,
                    ]}
                  >
                    {preset}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Contact Info Section */}
        <View style={styles.contactSection}>
          <Text style={styles.sectionTitle}>Contact Information</Text>

          <View style={styles.contactItem}>
            <Text style={styles.contactLabel}>Email</Text>
            <Text style={styles.contactValue}>{userEmail}</Text>
          </View>

          <View style={styles.contactItem}>
            <Text style={styles.contactLabel}>Phone</Text>
            <Text style={styles.contactValue}>{userPhone}</Text>
          </View>
        </View>

        {/* Create Profile Button */}
        <TouchableOpacity
          style={[styles.createButton, loading && styles.createButtonDisabled]}
          onPress={handleCreateProfile}
          disabled={loading}
        >
          <LinearGradient
            colors={["#3A805B", "#2E6B47"]}
            style={styles.createButtonGradient}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.createButtonText}>Create Profile</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#3A805B",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  profileImageSection: {
    alignItems: "center",
    marginBottom: 30,
  },
  profileImageContainer: {
    marginBottom: 16,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: "#3A805B",
  },
  profileImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#e9ecef",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#dee2e6",
    borderStyle: "dashed",
  },
  imageButtons: {
    flexDirection: "row",
    gap: 12,
  },
  imageButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#3A805B",
    gap: 6,
  },
  imageButtonText: {
    color: "#3A805B",
    fontSize: 14,
    fontWeight: "600",
  },
  inputSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  aboutToggle: {
    flexDirection: "row",
    backgroundColor: "#e9ecef",
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  toggleButtonActive: {
    backgroundColor: "#3A805B",
  },
  toggleButtonText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  toggleButtonTextActive: {
    color: "#fff",
  },
  presetContainer: {
    gap: 8,
  },
  presetOption: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  presetOptionSelected: {
    borderColor: "#3A805B",
    backgroundColor: "#f8fffe",
  },
  presetText: {
    fontSize: 15,
    color: "#333",
  },
  presetTextSelected: {
    color: "#3A805B",
    fontWeight: "500",
  },
  contactSection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
  },
  contactItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  contactLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  contactValue: {
    fontSize: 14,
    color: "#333",
    fontWeight: "600",
  },
  createButton: {
    borderRadius: 25,
    overflow: "hidden",
    marginBottom: 20,
  },
  createButtonDisabled: {
    opacity: 0.7,
  },
  createButtonGradient: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  createButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    flex: 1,
    backgroundColor: "transparent",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    padding: 20,
  },
  cancelButton: {
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  captureButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#fff",
  },
});
