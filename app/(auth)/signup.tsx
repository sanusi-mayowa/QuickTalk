import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import PhoneInput from "@/components/PhoneInput";
import Toast from "react-native-toast-message";

export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [formattedPhone, setFormattedPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const isPasswordValid = isMinLength && hasNumber;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isPhoneValid = formattedPhone.length >= 10;

  const handleSignup = async () => {
    if (!email || !phone || !password) {
      Toast.show({
        type: "error",
        text1: "Missing fields",
        text2: "Please fill all fields to continue",
      });
      return;
    }

    if (!isEmailValid) {
      Toast.show({
        type: "error",
        text1: "Invalid email",
        text2: "Please enter a valid email address",
      });
      return;
    }

    if (!isPasswordValid) {
      Toast.show({
        type: "error",
        text1: "Invalid password",
        text2: "Password must be at least 8 characters and include a number",
      });
      return;
    }

    if (!isPhoneValid) {
      Toast.show({
        type: "error",
        text1: "Invalid phone number",
        text2: "Please enter a valid phone number",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("https://quicktalk-backend-m3aq.onrender.com/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone: formattedPhone, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        //  Handle duplicate checks
        let errorMessage = data.message || "Registration failed";
        Toast.show({
          type: "error",
          text1: "Registration Failed",
          text2: errorMessage,
        });
        setLoading(false);
        return;
      }

      Toast.show({
        type: "success",
        text1: "Verification Code Sent!",
        text2: "Check your email for the 6-digit verification code",
      });

      router.push({
        pathname: "/(auth)/verify",
        params: { email, phone: formattedPhone, password },
      });

      // Clear form
      setEmail("");
      setPhone("");
      setFormattedPhone("");
      setPassword("");
    } catch (error: any) {
      console.error("Signup error:", error);
      Toast.show({
        type: "error",
        text1: "Registration Failed",
        text2: error.message || "Something went wrong. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };


  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollView}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.logoContainer}>
            <Image
              source={require("../../assets/images/logo.png")}
              style={styles.logo}
            />
          </View>

          <View style={styles.headerContainer}>
            <Text style={styles.headerTitle}>Create Account</Text>
            <Text style={styles.headerSubtitle}>
              Join QuickTalk and start connecting
            </Text>
          </View>
          
          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                blurOnSubmit={true}
                style={styles.textInput}
                placeholder="johndoe@gmail.com"
                placeholderTextColor="gray"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {email.length > 0 && (
                <Text
                  style={{
                    color: isEmailValid ? "#4CAF50" : "#FF5252",
                    marginTop: 4,
                  }}
                >
                  {isEmailValid
                    ? "✓ Valid email address"
                    : "✗ Enter a valid email"}
                </Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Phone Number</Text>
              <PhoneInput
                value={phone}
                onChangeText={setPhone}
                onChangeFormattedText={setFormattedPhone}
                placeholder="Enter phone number"
                defaultCode="US"
                containerStyle={styles.phoneContainer}
              />
              {phone.length > 0 && (
                <Text
                  style={{
                    color: isPhoneValid ? "#4CAF50" : "#FF5252",
                    marginTop: 4,
                  }}
                >
                  {isPhoneValid
                    ? "✓ Valid phone number"
                    : "✗ Enter a valid phone number"}
                </Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  blurOnSubmit={true}
                  style={styles.passwordInput}
                  placeholder="Create a strong password"
                  placeholderTextColor="gray"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Feather
                    name={showPassword ? "eye-off" : "eye"}
                    size={20}
                    color="gray"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.guidelines}>
                <Text
                  style={{
                    color: isMinLength ? "#4CAF50" : "rgba(255, 255, 255, 0.7)",
                    fontSize: 12,
                  }}
                >
                  ✓ Minimum 8 characters
                </Text>
                <Text
                  style={{
                    color: hasNumber ? "#4CAF50" : "rgba(255, 255, 255, 0.7)",
                    fontSize: 12,
                  }}
                >
                  ✓ At least one number
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.buttonWrapper, loading && styles.buttonDisabled]}
              onPress={handleSignup}
              disabled={loading}
            >
              <LinearGradient
                colors={["#F857A6", "#FF5858"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradient}
              >
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={[styles.buttonText, { marginLeft: 8 }]}>
                      Creating Account...
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.buttonText}>Create Account</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
              <Text style={styles.registerLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#3A805B",
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flexGrow: 1,
    padding: 24,
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 30,
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: 12,
  },
  headerContainer: {
    marginTop: 25,
    marginBottom: 32,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "white",
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center",
  },
  formContainer: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: 8,
    fontWeight: "600",
  },
  textInput: {
    backgroundColor: "rgb(232, 240, 254)",
    borderRadius: 12,
    padding: 16,
    color: "#000",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#3A805B",
  },
  phoneContainer: {
    marginBottom: 4,
  },
  passwordContainer: {
    flexDirection: "row",
    backgroundColor: "rgb(232, 240, 254)",
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3A805B",
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    color: "#000",
    fontSize: 16,
  },
  eyeIcon: {
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  guidelines: {
    marginTop: 8,
    marginLeft: 4,
    display: "flex",
    flexDirection: "row",
  },
  buttonWrapper: {
    width: "100%",
    borderRadius: 30,
    overflow: "hidden",
    marginTop: 30,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  gradient: {
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 30,
    marginBottom: 35,
  },
  registerText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 14,
  },
  registerLink: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
});
