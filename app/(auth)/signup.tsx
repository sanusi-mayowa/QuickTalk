import { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { auth } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async () => {
    try {
      // Clear previous errors
      setError('');

      // Basic input validation
      if (!email || !password || !phone) {
        setError('Please fill in all fields');
        return;
      }

      // Email format validation
      if (!email.includes('@')) {
        setError('Please enter a valid email address');
        return;
      }

      // Phone number validation
      const phoneNumber = parsePhoneNumberFromString(phone, 'US');
      if (!phoneNumber?.isValid()) {
        setError('Please enter a valid phone number');
        return;
      }

      const formattedPhone = phoneNumber.format('E.164');

      // Create user in Firebase
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Save phone number locally for next step (e.g. verification)
      await AsyncStorage.setItem('phoneNumber', formattedPhone);

      // Navigate to verification screen with phone number param
      router.push({
        pathname: '/(auth)/verify',
        params: { phone: formattedPhone },
      });

    } catch (error: any) {
      // Handle Firebase signup errors
      setError(error.message);
    }
  };

  return (
    <LinearGradient
      colors={['#9370DB', '#7B68EE', '#6A5ACD']}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView contentContainerStyle={styles.scrollView}>
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Feather name="chevron-left" size={20} color="#fff" />
          </TouchableOpacity>

          {/* Header Text */}
          <View style={styles.headerContainer}>
            <Text style={styles.headerTitle}>Create Account</Text>
            <Text style={styles.headerSubtitle}>Enter your details to get started</Text>
          </View>

          {/* Error Message */}
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Signup Form */}
          <View style={styles.formContainer}>
            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="example@email.com"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Choose a password"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
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
                    color="rgba(255, 255, 255, 0.7)"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Phone Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="+1 (555) 000-0000"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
            </View>

            {/* Continue Button */}
            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleSignup}
              activeOpacity={0.8}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>

            {/* Redirect to Login */}
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flexGrow: 1,
    padding: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  headerContainer: {
    marginTop: 40,
    marginBottom: 32,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 87, 87, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 87, 87, 0.2)',
  },
  errorText: {
    color: '#FF5757',
    fontSize: 14,
  },
  formContainer: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 16,
    color: 'white',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  passwordContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    color: 'white',
    fontSize: 16,
  },
  eyeIcon: {
    justifyContent: 'center',
    paddingRight: 16,
  },
  continueButton: {
    backgroundColor: 'white',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  continueButtonText: {
    color: '#6A5ACD',
    fontSize: 16,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loginText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  loginLink: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
