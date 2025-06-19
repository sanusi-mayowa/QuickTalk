import React, { useEffect } from 'react';
import { View, StyleSheet, Image, Text } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      await new Promise(res => setTimeout(res, 5000)); // 5-second delay
      checkAuthStatus();
    };

    init(); // Call the function
  }, []);

  const checkAuthStatus = async () => {
    try {
      const isAuthenticated = await AsyncStorage.getItem('isAuthenticated');
      
      if (isAuthenticated === 'true') {
        router.replace('/(tabs)');
      } else {
        router.replace('/login');
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      router.replace('/login');
    }
  };

  return (
    <View style={styles.container}>
      <Image source={require('../assets/images/logo.png')} style={styles.logo} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3A805B',
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  text: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
