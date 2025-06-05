import { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
// import { LinearGradient } from 'expo-linear-gradient';
// import { ArrowLeft, UserPlus } from 'lucide-react-native';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { Feather } from '@expo/vector-icons';
// import { db, USERS_COLLECTION, CONTACTS_COLLECTION } from '@/lib/firebase';
// import { collection, query, where, getDocs, addDoc, doc, getDoc } from 'firebase/firestore';
// import { auth } from '@/lib/firebase';

export default function NewContactScreen() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [userFound, setUserFound] = useState(false);

      const handlePhoneChange = async (text: string) => {
        setPhone(text);
        setError('');
        setUserFound(false);

    //     if (text.length >= 10) {
    //       try {
    //         const phoneNumber = parsePhoneNumberFromString(text, 'US');
    //         if (phoneNumber?.isValid()) {
    //           setLoading(true);
    //           const formattedPhone = phoneNumber.format('E.164');

    //           // Check if user exists
    //           const usersRef = collection(db, USERS_COLLECTION);
    //           const q = query(usersRef, where('phone', '==', formattedPhone));
    //           const querySnapshot = await getDocs(q);

    //           if (!querySnapshot.empty) {
    //             setUserFound(true);
    //             setError('');
    //           } else {
    //             setUserFound(false);
    //             setError('This number is not registered on QuickTalk');
    //           }
    //         }
    //       } catch (err) {
    //         console.error('Error checking phone number:', err);
    //         setError('Invalid phone number');
    //       } finally {
    //         setLoading(false);
    //       }
    //     }
    //   };

    //   const handleSaveContact = async () => {
    //     if (!name.trim() || !phone.trim()) {
    //       setError('Please fill in all fields');
    //       return;
    //     }

    //     if (!userFound) {
    //       setError('This number is not registered on QuickTalk');
    //       return;
    //     }

    //     try {
    //       setLoading(true);
    //       const phoneNumber = parsePhoneNumberFromString(phone, 'US');
    //       if (!phoneNumber?.isValid()) {
    //         setError('Invalid phone number');
    //         return;
    //       }

    //       const formattedPhone = phoneNumber.format('E.164');

    //       // Get the user document for the phone number
    //       const usersRef = collection(db, USERS_COLLECTION);
    //       const q = query(usersRef, where('phone', '==', formattedPhone));
    //       const querySnapshot = await getDocs(q);

    //       if (querySnapshot.empty) {
    //         setError('User not found');
    //         return;
    //       }

    //       const contactUser = querySnapshot.docs[0];
    //       const currentUser = auth.currentUser;

    //       if (!currentUser) {
    //         setError('You must be logged in to add contacts');
    //         return;
    //       }

    //       // Check if contact already exists
    //       const contactsRef = collection(db, CONTACTS_COLLECTION);
    //       const contactQuery = query(
    //         contactsRef,
    //         where('userId', '==', currentUser.uid),
    //         where('contactId', '==', contactUser.id)
    //       );
    //       const contactSnapshot = await getDocs(contactQuery);

    //       if (!contactSnapshot.empty) {
    //         setError('This contact already exists');
    //         return;
    //       }

    //       // Add new contact
    //       await addDoc(contactsRef, {
    //         userId: currentUser.uid,
    //         contactId: contactUser.id,
    //         name: name.trim(),
    //         phone: formattedPhone,
    //         createdAt: new Date().toISOString()
    //       });

    //       router.back();
    //     } catch (err) {
    //       console.error('Error saving contact:', err);
    //       setError('Failed to save contact');
    //     } finally {
    //       setLoading(false);
    //     }
      };

    return (
        <View
            style={styles.container}
        >
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.push('/(tabs)')}
                >
                    <Feather name="arrow-left" size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>New Contact</Text>
            </View>

            {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

            <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="+1 (555) 000-0000"
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
            value={phone}
            onChangeText={handlePhoneChange}
            keyboardType="phone-pad"
            autoComplete="tel"
          />
          {loading && (
            <ActivityIndicator 
              style={styles.loadingIndicator} 
              color="white" 
            />
          )}
        </View>

        {userFound && (
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Contact name"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.saveButton,
            (!userFound || loading) && styles.saveButtonDisabled
          ]}
        //   onPress={handleSaveContact}
          disabled={!userFound || loading}
        >
          {/* <UserPlus size={20} color={!userFound ? 'rgba(106, 90, 205, 0.5)' : '#6A5ACD'} /> */}
          <Text style={[
            styles.saveButtonText,
            (!userFound || loading) && styles.saveButtonTextDisabled
          ]}>
            Save Contact
          </Text>
        </TouchableOpacity>
      </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#3A805B',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        paddingTop: 20,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: 'white',
        marginLeft: 16,
    },
    errorContainer: {
        backgroundColor: 'rgba(255, 87, 87, 0.1)',
        borderRadius: 12,
        padding: 16,
        margin: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 87, 87, 0.2)',
    },
    errorText: {
        color: '#FF5757',
        fontSize: 14,
    },
    form: {
        padding: 16,
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
    loadingIndicator: {
        position: 'absolute',
        right: 16,
        top: 48,
    },
    saveButton: {
        flexDirection: 'row',
        backgroundColor: 'white',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 24,
        gap: 8,
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },
    saveButtonText: {
        color: '#6A5ACD',
        fontSize: 16,
        fontWeight: '600',
    },
    saveButtonTextDisabled: {
        opacity: 0.5,
    },
});