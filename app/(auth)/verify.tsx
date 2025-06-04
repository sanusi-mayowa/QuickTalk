import { useState, useRef } from 'react';
import {
  StyleSheet, Text, Image, View,
  TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import Toast from 'react-native-toast-message';

export default function VerifyScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleCodeChange = (text: string, index: number) => {
    if (text.length > 1) text = text[0];
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);
    if (text && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const enteredCode = code.join('').trim();

    if (!email || enteredCode.length !== 6) {
      Toast.show({
        type: 'error',
        text1: 'Incomplete Fields',
        text2: 'Please enter both email and 6-digit code',
      });
      return;
    }

    setLoading(true);

    try {
      // Send email and OTP to Node.js backend
      // const response = await fetch('https://quick-talk-backend.vercel.app/api/verify-otp', {
        const response = await fetch('http://localhost:5000/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: enteredCode }),
      });

      const result = await response.json();

      if (!response.ok) {
        Toast.show({
          type: 'error',
          text1: 'Verification Failed',
          text2: result.error || 'Invalid OTP',
        });
        setLoading(false);
        return;
      }
      const password = result.password;

      if (!password) {
        Toast.show({
          type: 'error',
          text1: 'Missing Password',
          text2: 'No password found in Database',
        });
        setLoading(false);
        return;
      }
      //  Create user in supabase Authentication
      let { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        Toast.show({
          type: 'error',
          text1: 'Sign Up Failed',
          text2: error.message,
      });
      setLoading(false);
      return;
    }

      Toast.show({
        type: 'success',
        text1: 'Verification Successful',
        text2: 'Account created',
      });
      router.push({
        pathname: '/login',
        params: { email, password },
      });
      setEmail('');
      setCode(['', '', '', '', '', '']);

    } catch (err: any) {
      console.error(err);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: err.message || 'Something went wrong',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollView}>
          <TouchableOpacity onPress={() => router.push('/(auth)/signup')} style={styles.backButton}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>

          <View style={styles.logoContainer}>
            <Image source={require('../../assets/images/logo.png')} style={styles.logo} />
          </View>

          <View style={styles.headerContainer}>
            <Text style={styles.headerTitle}>Email Verification</Text>
            <Text style={styles.subtitle}>Enter the OTP sent to your email</Text>
          </View>

          {/* Email Input */}
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
              <Text style={{ color: isEmailValid ? '#4CAF50' : '#FF5252', marginTop: 4 }}>
                {isEmailValid ? '✓ Valid Gmail address' : '✗ Enter a valid email'}
              </Text>
            )}
          </View>

          {/* OTP Inputs */}
          <View style={styles.codeRow}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                style={styles.codeInput}
                value={digit}
                onChangeText={(text) => handleCodeChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                placeholderTextColor="gray"
                maxLength={1}
              />
            ))}
          </View>

          {/* Verify Button */}
          <TouchableOpacity style={styles.buttonWrapper} onPress={handleVerify} disabled={loading}>
            <LinearGradient
              colors={['#F857A6', '#FF5858']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradient}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Toast />
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#3A805B'
  },
  scrollView: {
    flexGrow: 1,
    padding: 24
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  logoContainer: {
    alignItems: 'center'
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: 12
  },
  headerContainer: {
    marginTop: 25,
    marginBottom: 32,
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
    marginBottom: 8
  },
  subtitle: {
    color: '#ddd',
    fontSize: 16,
    marginBottom: 24
  },
  inputContainer: {
    marginBottom: 20

  },
  label: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
    fontWeight: '600'
  },
  textInput: {
    backgroundColor: 'rgb(232, 240, 254)',
    borderRadius: 12,
    padding: 16,
    color: '#000',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#3A805B',
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32
  },
  codeInput: {
    width: 48,
    height: 56,
    backgroundColor: 'rgb(232, 240, 254)',
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 22,
    color: '#000',
    borderWidth: 1,
    borderColor: 'rgb(232, 240, 254)',
    outlineStyle:'none',
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
    fontSize: 16
  },
});
