import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

const handleLogin = async () => {
  try {
    if (!email || !password) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please fill in all fields',
      });
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      Toast.show({
        type: 'error',
        text1: 'Login Failed',
        text2: error?.message || 'User not found',
      });
      setLoading(false);
      return;
    }

    const userID = data.user.id;
    await AsyncStorage.setItem('userID', userID);
    await AsyncStorage.setItem('isAuthenticated', 'true');
    await AsyncStorage.setItem('hasCompletedOnboarding', 'true');

    // ✅ Check if user has profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('auth_user_id', userID)
      .maybeSingle(); // Returns null if no row found

    if (profileError) {
      throw profileError;
    }

    Toast.show({
      type: 'success',
      text1: 'Login Successful',
      text2: 'Welcome back!',
    });

    // ✅ Redirect based on whether profile exists
    if (profile) {
      router.replace('/(tabs)');
    } else {
      router.replace('/create-profile');
    }

  } catch (error) {
    console.error('Login error:', error);
    Toast.show({
      type: 'error',
      text1: 'Unexpected Error',
      text2: 'Something went wrong. Please try again.',
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
          <View style={styles.logoContainer}>
            <Image source={require('../../assets/images/logo.png')} style={styles.logo} />
          </View>

          <View style={styles.headerContainer}>
            <Text style={styles.headerTitle}>Welcome back 👋 </Text>
            <Text style={styles.headerSubtitle}>Sign in to continue</Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.textInput}
                placeholder="johndoe@email.com"
                placeholderTextColor="gray"
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

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter your password"
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
                  {showPassword ? (
                    <Feather name="eye-off" size={20} color={"gray)"} />
                  ) : (
                    <Feather name="eye" size={20} color={"gray)"} />

                  )}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Submit */}
            <TouchableOpacity style={styles.buttonWrapper} onPress={handleLogin}>
              <LinearGradient
                colors={['#F857A6', '#FF5858']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradient}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Sign In</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
                <Text style={styles.registerLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
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
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flexGrow: 1,
    padding: 24,
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
    alignItems: 'center',
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
  formContainer: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
  },
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
    // outlineStyle: 'none',
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
    // outlineStyle: 'none',
  },
  eyeIcon: {
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: '#fff',
    fontSize: 14,
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
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30,
  },
  registerText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  registerLink: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
