import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Contacts from 'expo-contacts';
import { StatusBar } from 'expo-status-bar';
import { Stack } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function RootLayout() {
    const router = useRouter();

    useEffect(() => {
        checkInitialRoute();
    }, []);

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

    const checkInitialRoute = async () => {
        try {
            const isAuthenticated = await AsyncStorage.getItem('isAuthenticated');
            const hasCompletedOnboarding = await AsyncStorage.getItem('hasCompletedOnboarding');
            const hasImportedContacts = await AsyncStorage.getItem('hasImportedContacts');

            if (isAuthenticated === 'true' && hasCompletedOnboarding === 'true') {
                if (hasImportedContacts !== 'true') {
                    await importContacts();
                    await AsyncStorage.setItem('hasImportedContacts', 'true');
                }
                router.replace('/(tabs)');
                console.log("has completed onboarding");
                
            } else {
                router.replace('/(auth)/welcome');
                console.log("has not completed onboarding");
                
            }
        } catch (error) {
            console.error('Error checking auth state:', error);
            router.replace('/(auth)/welcome');
            console.log("Error checking auth state");
        }
    };

    return (
        <>
        <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
            <StatusBar style="light" />
        </>
    );
}