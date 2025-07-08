import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { supabase } from "@/lib/supabase"
import PhoneInput from "@/components/PhoneInput";

export default function NewContactScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [formattedPhone, setFormattedPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!firstName.trim() || !phoneNumber.trim()) {
      Toast.show({
        type: "error",
        text1: "Missing Information",
        text2: "Please enter at least first name and phone number",
      });
      return;
    }

    if (!formattedPhone || formattedPhone.length < 10) {
      Toast.show({
        type: "error",
        text1: "Invalid Phone Number",
        text2: "Please enter a valid phone number",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const { data: currentUserProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', session.user.id)
        .single();

      if (!currentUserProfile) throw new Error('User profile not found');

      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('owner_id', currentUserProfile.id)
        .eq('phone', formattedPhone)
        .single();

      if (existingContact) {
        Toast.show({
          type: 'error',
          text1: 'Contact Exists',
          text2: 'This contact already exists in your contacts',
        });
        setLoading(false);
        return;
      }

      const { data: newContact, error } = await supabase
        .from('contacts')
        .insert({
          owner_id: currentUserProfile.id,
          first_name: firstName.trim(),
          last_name: lastName.trim() || null,
          phone: formattedPhone,
        })
        .select(`*, contact_user:contact_user_id(id, username, about, profile_picture_url)`)
        .single();

      if (error) throw error;

      Toast.show({
        type: newContact.is_quicktalk_user ? 'success' : 'info',
        text1: newContact.is_quicktalk_user ? 'QuickTalk User Found!' : 'Contact Saved',
        text2: newContact.is_quicktalk_user
          ? `${firstName} is on QuickTalk. You can now send messages!`
          : `${firstName} has been added. They're not on QuickTalk yet.`,
      });

      setFirstName('');
      setLastName('');
      setPhoneNumber('');
      setFormattedPhone('');
      router.replace('/select-contact');

    } catch (error: any) {
      console.error('Error saving contact:', error);
      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: error.message || 'Failed to save contact. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/select-contact')}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Contact</Text>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.formSection}>
          {/* First Name */}
          <Text style={styles.label}>First Name</Text>
          <TextInput
            style={[styles.input, firstName && styles.inputActive]}
            placeholder="Enter first name"
            placeholderTextColor="#999"
            value={firstName}
            onChangeText={setFirstName}
          />

          {/* Last Name */}
          <Text style={styles.label}>Last Name</Text>
          <TextInput
            style={[styles.input, lastName && styles.inputActive]}
            placeholder="Enter last name"
            placeholderTextColor="#999"
            value={lastName}
            onChangeText={setLastName}
          />

          {/* Phone Number */}
          <Text style={styles.label}>Phone Number</Text>
          <PhoneInput
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            onChangeFormattedText={setFormattedPhone}
            placeholder="Enter phone number"
            defaultCode="US"
            darkMode={false}
            containerStyle={styles.phoneInputContainer}
            textContainerStyle={styles.phoneTextContainer}
            textInputStyle={{ color: "#000" }}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, loading && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Contact</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3A805B',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  formSection: {
    marginBottom: 30,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
    color: '#3A805B',
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#000',
  },
  inputActive: {
    borderColor: '#3A805B',
  },
  phoneInputContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    backgroundColor: '#fff',
    height: 56,
  },
  phoneTextContainer: {
    backgroundColor: 'transparent',
    paddingVertical: 0,
    borderRadius: 8,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderColor: '#eaeaea',
    backgroundColor: '#fff',
  },
  saveButton: {
    backgroundColor: '#3A805B',
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
