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
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db, storage } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import Toast from 'react-native-toast-message';

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
      //  Try login
      const credentials = await signInWithEmailAndPassword(auth, email, password);

      if (!credentials.user) {
        Toast.show({
          type: 'error',
          text1: 'Login Failed',
          text2: 'User not found',
        });
        setLoading(false);
        return;
      }

      const userID = credentials.user.uid;
      console.log("Login successful, UID:", userID); // Debug log

      await AsyncStorage.setItem('userID', userID);
      console.log('userID',userID);
      await AsyncStorage.setItem('isAuthenticated', 'true');
      console.log('isAuthenticated', 'true');
      await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
      console.log('hasCompletedOnboarding', 'true');
      

      // Fetch profile safely
      try {
        const q = query(
          collection(db, 'user_profiles'),
          where('auth_user_id', '==', userID)
        );
        const snap = await getDocs(q);

        const profile = snap.docs.length > 0
          ? { id: snap.docs[0].id, ...snap.docs[0].data() }
          : null;

        Toast.show({
          type: 'success',
          text1: 'Login Successful',
          text2: 'Welcome back!',
        });

        if (profile) {
          router.replace('/(tabs)');
        } else {
          router.replace('/create-profile');
        }
      } catch (firestoreError: any) {
        console.error("Firestore error:", firestoreError.message);
        Toast.show({
          type: 'error',
          text1: 'Profile Error',
          text2: 'Could not load your profile. Check Firestore rules.',
        });
      }

    } catch (error: any) {
      console.error('Login error:', error);
      Toast.show({
        type: 'error',
        text1: 'Unexpected Error',
        text2: error?.message || 'Something went wrong. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollView}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/images/logo.png')}
                style={styles.logo}
              />
            </View>

            <View style={styles.headerContainer}>
              <Text style={styles.headerTitle}>Welcome back 👋</Text>
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
                  <Text
                    style={{
                      color: isEmailValid ? '#4CAF50' : '#FF5252',
                      marginTop: 4,
                    }}
                  >
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
                    <Feather
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color="gray"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.statusContainer}>
                <TouchableOpacity onPress={() => router.push('/(auth)/verify')}>
                  <Text style={styles.forgotPasswordText}>VerifyAccount!!</Text>
                </TouchableOpacity>
                <TouchableOpacity>
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.buttonWrapper}
                onPress={handleLogin}
              >
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
      </TouchableWithoutFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#3A805B',
    paddingTop: 60,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flexGrow: 1,
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: 12,
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
  },
  eyeIcon: {
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  forgotPasswordText: {
    color: '#fff',
    fontSize: 14,
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
