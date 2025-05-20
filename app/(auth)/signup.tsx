import React, { useState } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity,
  ScrollView, Platform, KeyboardAvoidingView,
  ActivityIndicator, StyleSheet
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  
  const isMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const isPasswordValid = isMinLength && hasNumber;
  const isEmailValid = /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email.trim());


  const handleSignup = async () => {
    if (!email || !phone || !password) {
      Toast.show({
        type: 'error',
        text1: 'Missing fields',
        text2: 'Please fill all fields to continue',
      });
      return;
    }
    if (!isEmailValid) {
      Toast.show({
        type: 'error',
        text1: 'Invalid email',
        text2: 'Please enter a valid Gmail address',
      });
      return;
    }
  
    if (!isPasswordValid) {
      Toast.show({
        type: 'error',
        text1: 'Invalid password',
        text2: 'Password must be at least 8 characters and include a number',
      });
      return;
    }
  
    setLoading(true);
  
    try {
      const response = await fetch('https://quick-talk-backend.vercel.app/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone, password }),

      });
      if (response.status === 409) {
        // User already exists
        const data = await response.json();
        Toast.show({
          type: 'error',
          text1: 'User already exists',
          text2: data.error || 'A user with this email or phone number already exists',
        });
        setLoading(false);
        return;
      }

      if (!response.ok) throw new Error('Failed to send OTP');
  
      Toast.show({
        type: 'success',
        text1: 'OTP Sent',
        text2: 'Check your email for the verification code',
      });
  
      router.push({
        pathname: '/verify',
        params: { email, phone, password },
      });
  
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Signup failed',
        text2: error.message || 'Something went wrong',
      });
    } finally {
      setLoading(false);
    }
  };
  


  return (
    <View style={styles.container}>
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardAvoidingView}
    >
      <ScrollView contentContainerStyle={styles.scrollView}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push('/getting-started')}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>

        <View style={styles.logoContainer}>
          <Image source={require('../../assets/images/logo.png')} style={styles.logo} />
        </View>

        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Create Account</Text>
        </View>

        <View style={styles.formContainer}>
          {/* Email */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Your email</Text>
            <TextInput
              style={styles.textInput}
              placeholder="johndoe@gmail.com"
              placeholderTextColor="#000"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {email.length > 0 && (
                <Text style={{ color: isEmailValid ? '#4CAF50' : '#FF5252', marginTop: 4 }}>
                  {isEmailValid
                    ? '✓ Valid Gmail address'
                    : '✗ Enter a valid email'}
                </Text>
              )}
          </View>

          {/* Password */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="*********"
                placeholderTextColor="#000"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                underlineColorAndroid="transparent"
              />
              <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
                <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color="#000" />
              </TouchableOpacity>
            </View>

            <View style={styles.guidelines}>
              <Text style={{ color: isMinLength ? '#4CAF50' : '#fff' }}>Minimum 8 characters,</Text>
              <Text style={{ color: hasNumber ? '#4CAF50' : '#fff' }}>at least one number</Text>
            </View>
          </View>

          {/* Phone Number */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Phone number</Text>
            <TextInput
              style={styles.textInput}
              placeholder="+234 (810) 000-0000"
              placeholderTextColor="#000"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
            />
          </View>

          {/* Submit */}
          <TouchableOpacity style={styles.buttonWrapper} onPress={handleSignup}>
            <LinearGradient
              colors={['#F857A6', '#FF5858']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradient}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Sign Up</Text>
              )}
            </LinearGradient>
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
    backgroundColor: '#3A805B',
  },
  keyboardAvoidingView: { flex: 1 },
  scrollView: { flexGrow: 1, padding: 24 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  logoContainer: { alignItems: 'center' },
  logo: { width: 60, height: 60, marginBottom: 12 },
  headerContainer: {
    marginTop: 25,
    marginBottom: 32,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
    marginBottom: 8,
  },
  formContainer: { flex: 1 },
  inputContainer: { marginBottom: 20 },
  label: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: 'rgb(232, 240, 254)',
    borderRadius: 12,
    padding: 16,
    color: '#000',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#3A805B',
    outlineStyle: 'none',
  },
  passwordContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgb(232, 240, 254)',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A805B',
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    color: '#000',
    fontSize: 16,
    outlineStyle: 'none',
  },
  eyeIcon: {
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  guidelines: {
    marginTop: 10,
    marginLeft: 8,
    display: 'flex',
    flexDirection: 'row', 
    gap: 4,
  },
  buttonWrapper: {
    width: '100%',
    borderRadius: 30,
    overflow: 'hidden',
    marginTop: 30,
  },
  gradient: {
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});