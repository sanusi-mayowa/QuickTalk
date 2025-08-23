import { ScrollView, StyleSheet, Text, View, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function GetStartedScreen() {
  const router = useRouter();
  const [signupLoading, setSignupLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const handleSignup = () => {
    setSignupLoading(true);
    setTimeout(() => {
      setSignupLoading(false);
      router.push('/(auth)/signup');
    }, 1500);
  };

  const handleLogin = () => {
    setLoginLoading(true);
    setTimeout(() => {
      setLoginLoading(false);
      router.push('/(auth)/login');
    }, 1500);
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollView}>
      <View style={styles.container}>
        <View style={styles.logoContainer}>
          <Image source={require('../../assets/images/logo.png')} style={styles.logo} />
          <View style={styles.QuickTalkLogoContainer}>
            <Text style={styles.title}>QuickTalk</Text>
          </View>

          <Text style={styles.subtitle}>The #1 trusted messaging app</Text>
        </View>

        <View style={styles.buttonSection}>
          <TouchableOpacity style={styles.buttonWrapper} onPress={handleSignup}>
            <LinearGradient
              colors={['#F857A6', '#FF5858']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradient}
            >
              {signupLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Join now</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.outlineButton} onPress={handleLogin}>
            {loginLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.outlineButtonText}>Log in</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  scrollView: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#3A805B',
  },
  container: {
    flex: 1,
    backgroundColor: '#3A805B',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 24,
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
    alignItems: 'center',
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: 12,
  },
  QuickTalkLogoContainer: {
    marginTop: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
    marginTop: 12,
    textAlign: 'center',
  },
  buttonSection: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  buttonWrapper: {
    width: '100%',
    borderRadius: 30,
    overflow: 'hidden',
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
  outlineButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});