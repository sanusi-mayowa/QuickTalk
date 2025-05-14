import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View, TouchableOpacity, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function WelcomeScreen() {
  const router = useRouter();

  const handleGetStarted = () => {
    router.push('/(auth)/signup');
  };

  const openTerms = () => {
    Linking.openURL('https://yourdomain.com/terms');
  };

  const openPrivacy = () => {
    Linking.openURL('https://yourdomain.com/privacy');
  };

  return (
    <LinearGradient
      colors={['#9370DB', '#7B68EE', '#6A5ACD']}
      style={styles.container}
    >
      <View style={styles.logoContainer}>
        <View style={styles.iconBackground}>
          <Feather name="message-circle" size={40} color={"#6A5ACD"} />
        </View>
      </View>

      <Text style={styles.title}>QuickTalk</Text>
      <Text style={styles.subtitle}>
        Connect with friends and family quickly and privately
      </Text>

      <TouchableOpacity style={styles.button} onPress={handleGetStarted}>
        <Text style={styles.buttonText}>Get Started</Text>
      </TouchableOpacity>

      <Text style={styles.termsText}>
        By continuing, you agree to our{' '}
        <Text style={styles.link} onPress={openTerms}>
          Terms of Service
        </Text>{' '}
        and{' '}
        <Text style={styles.link} onPress={openPrivacy}>
          Privacy Policy
        </Text>
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoContainer: {
    marginBottom: 24,
  },
  iconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
    color: 'white',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 48,
    lineHeight: 24,
    maxWidth: 280,
  },
  button: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 999,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  buttonText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  termsText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    maxWidth: 280,
    position: 'absolute',
    bottom: 32,
  },
  link: {
    textDecorationLine: 'none',
    color: '#fff',
  },
});
