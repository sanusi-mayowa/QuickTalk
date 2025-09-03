import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth } from "@/lib/firebase";
import { useOfflineAuth } from "@/hooks/useOfflineAuth";

export default function SplashScreen() {
  const router = useRouter();
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));
  const [statusText, setStatusText] = useState("Initializing...");
  const { currentUser, isLoading, error, initializeUserProfile, isOnline } = useOfflineAuth();

  useEffect(() => {
    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Start authentication check after a brief delay
    setTimeout(() => {
      checkAuthenticationStatus();
    }, 1500);
  }, []);

  const checkAuthenticationStatus = async () => {
    try {
      setStatusText("Checking authentication...");

      // Check if user has completed onboarding
      const hasCompletedOnboarding = await AsyncStorage.getItem(
        "hasCompletedOnboarding"
      );

      if (!hasCompletedOnboarding) {
        setStatusText("Setting up your experience...");
        setTimeout(() => {
          router.replace("/welcome");
        }, 1000);
        return;
      }

      setStatusText("Verifying session...");

      const firebaseUser = auth.currentUser;

      if (firebaseUser) {
        setStatusText("Loading your profile...");
        
        // Initialize user profile (will try cache first, then online)
        await initializeUserProfile();
        
        if (currentUser) {
          if (!currentUser.is_profile_complete) {
            // Profile exists but incomplete, redirect to create profile
            setStatusText("Completing your profile...");
            setTimeout(() => {
              router.replace("/create-profile");
            }, 1000);
          } else {
            // Profile complete, go to main app
            setStatusText("Welcome back!");
            setTimeout(() => {
              router.replace("/(tabs)");
            }, 800);
          }
        } else if (error) {
          // Handle error cases
          if (error === "No cached profile available offline") {
            setStatusText("Offline mode - using cached data");
            // Try to load from cache one more time
            const cachedProfile = await AsyncStorage.getItem('cached_user_profile');
            if (cachedProfile) {
              const profile = JSON.parse(cachedProfile);
              if (profile && profile.is_profile_complete) {
                setStatusText("Welcome back (offline mode)!");
                setTimeout(() => {
                  router.replace("/(tabs)");
                }, 800);
                return;
              }
            }
            setStatusText("Profile not available offline");
            setTimeout(() => {
              router.replace("/(auth)/login");
            }, 1000);
          } else {
            setStatusText("Profile not found");
            setTimeout(() => {
              router.replace("/create-profile");
            }, 1000);
          }
        }
      } else {
        setStatusText("Redirecting to login...");
        setTimeout(() => {
          router.replace("/(auth)/login");
        }, 1000);
      }
    } catch (error) {
      console.error("Error checking auth state:", error);
      setStatusText("Something went wrong...");
      setTimeout(() => {
        router.replace("/getting-started");
      }, 1000);
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Logo Section */}
        <View style={styles.logoContainer}>
          <View>
            <Image
              source={require("../assets/images/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Loading Section */}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#3A805B",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 80,
  },
  logoWrapper: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  logo: {
    width: 80,
    height: 80,
  },
  brandContainer: {
    alignItems: "center",
  },
  brandName: {
    fontSize: 36,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 8,
    letterSpacing: -1,
  },
  brandTagline: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
    fontWeight: "400",
    letterSpacing: 0.5,
  },
  loadingContainer: {
    alignItems: "center",
    gap: 16,
  },
  statusText: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.9)",
    fontWeight: "500",
    textAlign: "center",
  },
  bottomSection: {
    position: "absolute",
    bottom: 40,
    alignItems: "center",
  },
  versionText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.6)",
    marginBottom: 4,
  },
});
