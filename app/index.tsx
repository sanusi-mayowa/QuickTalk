import React, { useEffect } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Contacts from 'expo-contacts';

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      await new Promise(res => setTimeout(res, 3000));

      const isAuthenticated = await AsyncStorage.getItem('isAuthenticated');
      const hasCompletedOnboarding = await AsyncStorage.getItem('hasCompletedOnboarding');
      const hasImportedContacts = await AsyncStorage.getItem('hasImportedContacts');

      if (isAuthenticated === 'true' && hasCompletedOnboarding === 'true') {
        if (hasImportedContacts !== 'true') {
          await importContacts();
          await AsyncStorage.setItem('hasImportedContacts', 'true');
        }
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/welcome');
      }
    };

    const importContacts = async () => {
      try {
        const { status } = await Contacts.requestPermissionsAsync();
        if (status === 'granted') {
          const { data } = await Contacts.getContactsAsync({
            fields: [Contacts.Fields.PhoneNumbers],
          });

          if (data.length > 0) {
            const phoneNumbers = data
              .filter(contact => contact.phoneNumbers && contact.phoneNumbers.length > 0)
              .map(contact => ({
                name: contact.name,
                phone: contact.phoneNumbers[0].number,
              }));

            await AsyncStorage.setItem('phoneContacts', JSON.stringify(phoneNumbers));
          }
        }
      } catch (error) {
        console.error('Error importing contacts:', error);
      }
    };

    init();
  }, []);

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
  },
});
