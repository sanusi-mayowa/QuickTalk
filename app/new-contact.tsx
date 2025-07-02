import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { supabase } from "@/lib/supabase"

interface CountryCode {
  code: string;
  country: string;
  flag: string;
}

const COUNTRY_CODES: CountryCode[] = [
  { code: "+234", country: "Nigeria", flag: "🇳🇬" },
  { code: "+1", country: "United States", flag: "🇺🇸" },
  { code: "+44", country: "United Kingdom", flag: "🇬🇧" },
  { code: "+91", country: "India", flag: "🇮🇳" },
  { code: "+86", country: "China", flag: "🇨🇳" },
  { code: "+33", country: "France", flag: "🇫🇷" },
  { code: "+49", country: "Germany", flag: "🇩🇪" },
];

export default function NewContactScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [loading, setLoading] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const handleSave = async () => {
    if (!firstName.trim() || !phoneNumber.trim()) {
      Toast.show({
        type: "error",
        text1: "Missing Information",
        text2: "Please enter at least first name and phone number",
      });
      return;
    }

    const fullPhone = selectedCountry.code + phoneNumber.trim();

    // Validate phone number format
    const phoneRegex = /^\+\d{10,15}$/;
    if (!phoneRegex.test(fullPhone)) {
      Toast.show({
        type: "error",
        text1: "Invalid Phone Number",
        text2: "Please enter a valid phone number",
      });
      return;
    }

    setLoading(true);

    try {
      // Get current user's profile
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const { data: currentUserProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', session.user.id)
        .single();

      if (!currentUserProfile) {
        throw new Error('User profile not found');
      }

      // Check if contact already exists
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('owner_id', currentUserProfile.id)
        .eq('phone', fullPhone)
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

      // Save contact to database
      const { data: newContact, error } = await supabase
        .from('contacts')
        .insert({
          owner_id: currentUserProfile.id,
          first_name: firstName.trim(),
          last_name: lastName.trim() || null,
          phone: fullPhone,
        })
        .select(`
          *,
          contact_user:contact_user_id(
            id,
            username,
            about,
            profile_picture_url
          )
        `)
        .single();

      if (error) {
        throw error;
      }

      // Show appropriate success message
      if (newContact.is_quicktalk_user) {
        Toast.show({
          type: 'success',
          text1: 'QuickTalk User Found!',
          text2: `${firstName} is on QuickTalk. You can now send messages!`,
        });
      } else {
        Toast.show({
          type: 'info',
          text1: 'Contact Saved',
          text2: `${firstName} has been added. They're not on QuickTalk yet.`,
        });
      }

      // Clear form
      setFirstName('');
      setLastName('');
      setPhoneNumber('');
      // setSyncToPhone(true);
      
      router.back();
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


  const renderCountryPicker = () => {
    if (!showCountryPicker) return null;

    return (
      <View style={styles.countryPickerOverlay}>
        <View style={styles.countryPickerContainer}>
          <View style={styles.countryPickerHeader}>
            <Text style={styles.countryPickerTitle}>Select Country</Text>
            <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
              <Text style={styles.countryPickerClose}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.countryList}>
            {COUNTRY_CODES.map((country) => (
              <TouchableOpacity
                key={country.code}
                style={[
                  styles.countryItem,
                  selectedCountry.code === country.code &&
                    styles.selectedCountryItem,
                ]}
                onPress={() => {
                  setSelectedCountry(country);
                  setShowCountryPicker(false);
                }}
              >
                <Text style={styles.countryFlag}>{country.flag}</Text>
                <Text style={styles.countryName}>{country.country}</Text>
                <Text style={styles.countryCode}>{country.code}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push("/select-contact")}
        >
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>New contact</Text>
        </View>

        <TouchableOpacity style={styles.headerButton}>
          <Feather name="search" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Name Section */}
        <View style={styles.section}>
          <View style={styles.inputColumn}>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.textInput, firstName && styles.textInputFilled]}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First Name"
                placeholderTextColor="#000"
              />
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor="#000"
              />
            </View>
          </View>
        </View>

        {/* Phone Section */}
        <View style={styles.section}>
          <View style={styles.phoneInputContainer}>
            <View style={styles.phoneRow}>
              <TouchableOpacity
                style={styles.countrySelector}
                onPress={() => setShowCountryPicker(true)}
              >
                <Text style={styles.countrySelectorText}>
                  {selectedCountry.flag} {selectedCountry.code}
                </Text>
                <Feather name="chevron-down" size={16} color="#000" />
              </TouchableOpacity>

              <TextInput
                style={styles.phoneInput}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="Phone"
                placeholderTextColor="#000"
                keyboardType="phone-pad"
              />
            </View>

          </View>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Country Picker Modal */}
      {renderCountryPicker()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: "#3A805B",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  inputColumn: {
    flex: 1,
    gap: 16,
  },
  inputContainer: {
    position: "relative",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: "#000",
    backgroundColor: "transparent",
  },
  textInputFilled: {
    borderColor: "#3A805B",
  },
  phoneInputContainer: {
    flex: 1,
  },
  phoneRow: {
    flexDirection: "row",
    gap: 12,
  },
  countrySelector: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
    minWidth: 120,
  },
  countrySelectorText: {
    fontSize: 16,
    color: "#000",
  },
  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: "#000",
    backgroundColor: "transparent",
  },
  bottomContainer: {
    paddingBottom: 50,
    padding: 20,
    backgroundColor: "#f8f9fa",
  },
  saveButton: {
    backgroundColor: "#3A805B",
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  countryPickerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
    zIndex: 1000,
  },
  countryPickerContainer: {
    backgroundColor: "#f8f9fa",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
  },
  countryPickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    backgroundColor: "#3A805B",
  },
  countryPickerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    letterSpacing: 0.5,
  },
  countryPickerClose: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
  countryList: {
    flex: 1,
  },
  countryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#3A805B",
  },
  selectedCountryItem: {
    backgroundColor: "rgba(58, 128, 91, 0.1)",
  },
  countryFlag: {
    fontSize: 24,
    marginRight: 16,
  },
  countryName: {
    flex: 1,
    fontSize: 16,
    color: "#000",
  },
  countryCode: {
    fontSize: 16,
    color: "#3A805B",
    fontWeight: "600",
  },
});
