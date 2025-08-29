import { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  Image,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
  SafeAreaView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import Toast from "react-native-toast-message";

export default function VerifyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [email, setEmail] = useState((params.email as string) || "");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  // Timer for OTP expiration
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  // Set initial timer (10 minutes = 600 seconds)
  useEffect(() => {
    setTimeLeft(600);
  }, []);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const handleCodeChange = (text: string, index: number) => {
    if (text.length > 1) text = text[0];
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);
    if (text && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResendOTP = async () => {
    if (!email) {
      Toast.show({
        type: "error",
        text1: "Email Required",
        text2: "Please enter your email address",
      });
      return;
    }

    setResendLoading(true);

    try {
      const response = await fetch(
        "https://quicktalk-backend-m3aq.onrender.com/resend-otp",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        Toast.show({
          type: "error",
          text1: "Resend Failed",
          text2: result.error || "Failed to resend OTP",
        });
        return;
      }

      Toast.show({
        type: "success",
        text1: "OTP Sent",
        text2: "A new verification code has been sent to your email",
      });

      // Reset timer and code
      setTimeLeft(600);
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (error) {
      console.error("Resend OTP error:", error);
      Toast.show({
        type: "error",
        text1: "Network Error",
        text2: "Please check your connection and try again",
      });
    } finally {
      setResendLoading(false);
    }
  };

  const handleVerify = async () => {
    const enteredCode = code.join("").trim();

    if (!email || enteredCode.length !== 6) {
      Toast.show({
        type: "error",
        text1: "Incomplete Fields",
        text2: "Please enter both email and 6-digit code",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "https://quicktalk-backend-m3aq.onrender.com/verify-otp",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp: enteredCode }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401 && result.error === "OTP has expired") {
          Toast.show({
            type: "error",
            text1: "Code Expired",
            text2:
              "Your verification code has expired. Please request a new one.",
          });
        } else {
          Toast.show({
            type: "error",
            text1: "Verification Failed",
            text2: result.error || "Invalid OTP",
          });
        }
        setLoading(false);
        return;
      }

      Toast.show({
        type: "success",
        text1: "Account Created!",
        text2: "Your account has been successfully created",
      });

      router.replace("/(auth)/login");
      setEmail("");
      setCode(["", "", "", "", "", ""]);
    } catch (err: any) {
      console.error(err);
      Toast.show({
        type: "error",
        text1: "Network Error",
        text2: "Please check your connection and try again",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#3A805B" }}>
      <View style={styles.container}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <ScrollView
              contentContainerStyle={styles.scrollView}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.logoContainer}>
                <Image
                  source={require("../../assets/images/logo.png")}
                  style={styles.logo}
                />
              </View>

              <View style={styles.headerContainer}>
                <Text style={styles.headerTitle}>Email Verification</Text>
                <Text style={styles.subtitle}>
                  Enter the 6-digit code sent to your email
                </Text>

                {timeLeft > 0 && (
                  <View style={styles.timerContainer}>
                    <Feather name="clock" size={16} color="#fff" />
                    <Text style={styles.timerText}>
                      Code expires in {formatTime(timeLeft)}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Your email</Text>
                <TextInput
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

              <View style={styles.codeContainer}>
                <Text style={styles.label}>Verification Code</Text>
                <View style={styles.codeRow}>
                  {code.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(ref) => (inputRefs.current[index] = ref)}
                      style={[
                        styles.codeInput,
                        digit ? styles.codeInputFilled : null,
                      ]}
                      value={digit}
                      onChangeText={(text) => handleCodeChange(text, index)}
                      onKeyPress={(e) => handleKeyPress(e, index)}
                      keyboardType="number-pad"
                      placeholderTextColor="gray"
                      maxLength={1}
                    />
                  ))}
                </View>
              </View>

              {timeLeft === 0 && (
                <View style={styles.expiredContainer}>
                  <Text style={styles.expiredText}>
                    Your verification code has expired
                  </Text>
                  <TouchableOpacity
                    style={styles.resendButton}
                    onPress={handleResendOTP}
                    disabled={resendLoading}
                  >
                    {resendLoading ? (
                      <ActivityIndicator size="small" color="#3A805B" />
                    ) : (
                      <>
                        <Feather name="refresh-cw" size={16} color="#3A805B" />
                        <Text style={styles.resendButtonText}>
                          Request New Code
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {timeLeft > 0 && (
                <TouchableOpacity
                  style={styles.resendLink}
                  onPress={handleResendOTP}
                  disabled={resendLoading}
                >
                  {resendLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.resendLinkText}>
                      Didn't receive the code? Resend
                    </Text>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.buttonWrapper,
                  (!timeLeft || loading) && styles.buttonDisabled,
                ]}
                onPress={handleVerify}
                disabled={loading || timeLeft === 0}
              >
                <LinearGradient
                  colors={
                    timeLeft === 0 ? ["#ccc", "#999"] : ["#F857A6", "#FF5858"]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>
                      {timeLeft === 0 ? "Code Expired" : "Verify Account"}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#3A805B",
  },
  scrollView: {
    flexGrow: 1,
    padding: 24,
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 60,
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
  subtitle: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 16,
    marginBottom: 16,
    textAlign: "center",
  },
  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  timerText: {
    color: "#fff",
    fontSize: 14,
    marginLeft: 6,
    fontWeight: "500",
  },
  inputContainer: {
    marginBottom: 24,
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
  codeContainer: {
    marginBottom: 24,
  },
  codeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  codeInput: {
    width: 48,
    height: 56,
    backgroundColor: "rgb(232, 240, 254)",
    borderRadius: 10,
    textAlign: "center",
    fontSize: 22,
    color: "#000",
    borderWidth: 2,
    borderColor: "rgb(232, 240, 254)",
  },
  codeInputFilled: {
    borderColor: "#3A805B",
    backgroundColor: "#fff",
  },
  expiredContainer: {
    alignItems: "center",
    marginBottom: 24,
    padding: 16,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
  },
  expiredText: {
    color: "#FFB74D",
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 12,
    textAlign: "center",
  },
  resendButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  resendButtonText: {
    color: "#3A805B",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
  resendLink: {
    alignItems: "center",
    marginBottom: 24,
  },
  resendLinkText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 14,
    textDecorationLine: "underline",
  },
  buttonWrapper: {
    width: "100%",
    borderRadius: 30,
    overflow: "hidden",
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  gradient: {
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});
