import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Linking,
  Image,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { useState } from "react";

export default function WelcomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleGetStarted = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      router.push("/(auth)/getting-started");
    }, 1500);
  };

  const openTerms = () => {
    Linking.openURL("https://yourdomain.com/terms");
  };

  const openPrivacy = () => {
    Linking.openURL("https://yourdomain.com/privacy");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#3A805B" }}>
      <View style={styles.container}>
        <View style={styles.logoContainer}>
          <Image
            source={require("../../assets/images/logo.png")}
            style={styles.logo}
          />
        </View>
        <Image
          source={require("../../assets/images/QuickTalk.png")}
          style={styles.QuickTalkLogo}
        />
        <Text style={styles.subtitle}>
          Connect with friends and family quickly and privately
        </Text>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.buttonWrapper}
            onPress={handleGetStarted}
          >
            <LinearGradient
              colors={["#F857A6", "#FF5858"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradient}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Get Started</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
        <Text style={styles.termsText}>
          By continuing, you agree to our{" "}
          <Text style={styles.link} onPress={openTerms}>
            Terms of Service
          </Text>{" "}
          and{" "}
          <Text style={styles.link} onPress={openPrivacy}>
            Privacy Policy
          </Text>
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#3A805B",
  },
  logoContainer: {
    marginBottom: 24,
  },
  logo: {
    width: 100,
    height: 100,
  },
  QuickTalkLogo: {
    marginBottom: 24,
  },
  buttonContainer: {
    alignItems: "center",
    width: "100%",
  },
  buttonWrapper: {
    borderRadius: 30,
    overflow: "hidden",
    width: "100%",
  },
  gradient: {
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 48,
    lineHeight: 24,
    maxWidth: 280,
  },
  termsText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center",
    maxWidth: 280,
    position: "absolute",
    bottom: 32,
  },
  link: {
    textDecorationLine: "none",
    color: "#fff",
  },
});
