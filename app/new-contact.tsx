import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { auth, db } from "@/lib/firebase";
import { addDoc, collection, getDocs, query, where, doc, getDoc, setDoc } from "firebase/firestore";
import PhoneInput from "@/components/PhoneInput";
import { parsePhoneNumberFromString } from "libphonenumber-js";

export default function NewContactScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [formattedPhone, setFormattedPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [defaultCountryCode, setDefaultCountryCode] = useState<string>("US");
  const [isPrefilled, setIsPrefilled] = useState<boolean>(false);

  // Prefill from params
  useEffect(() => {
    const prefillPhone = (params?.prefillPhone as string) || "";
    const prefillCountry = (params?.prefillCountry as string) || "";
    const prefillFirstName =
      (params?.prefillFirstName as string) ||
      (params?.prefillUsername as string) ||"";

    if (prefillFirstName) setFirstName(prefillFirstName);

    if (prefillPhone) {
      setIsPrefilled(true);
      try {
        const parsed = parsePhoneNumberFromString(prefillPhone, undefined);
        if (parsed && parsed.isValid()) {
          setDefaultCountryCode(parsed.country || "US");
          setPhoneNumber(parsed.nationalNumber || "");
          setFormattedPhone(parsed.number); // E.164 format
        } else {
          if (prefillPhone.startsWith("+")) {
            const commonCodes = [
              "+1",
              "+44",
              "+234",
              "+91",
              "+61",
              "+81",
              "+82",
              "+86",
              "+971",
              "+972",
            ];
            const match = commonCodes
              .filter((dc) => prefillPhone.startsWith(dc))
              .sort((a, b) => b.length - a.length)[0];
            if (match) {
              const codeMap: Record<string, string> = {
                "+1": "US",
                "+44": "GB",
                "+234": "NG",
                "+91": "IN",
                "+61": "AU",
                "+81": "JP",
                "+82": "KR",
                "+86": "CN",
                "+971": "AE",
                "+972": "IL",
              };
              setDefaultCountryCode(codeMap[match] || "US");
              setPhoneNumber(prefillPhone.replace(match, ""));
              setFormattedPhone(prefillPhone);
            } else {
              setPhoneNumber(prefillPhone.replace(/^\+/, ""));
              setFormattedPhone(prefillPhone);
            }
          } else {
            // No "+"; try using provided country fallback
            if (prefillCountry) {
              setDefaultCountryCode(prefillCountry.toUpperCase());
              // Best-effort dial code mapping for common countries
              const countryToDial: Record<string, string> = {
                US: "+1", CA: "+1", GB: "+44", NG: "+234", IN: "+91",
                AU: "+61", JP: "+81", KR: "+82", CN: "+86", AE: "+971", IL: "+972"
              };
              const dial = countryToDial[prefillCountry.toUpperCase()] || "+";
              const national = prefillPhone.replace(/\D/g, "");
              if (dial !== "+") setFormattedPhone(`${dial}${national}`);
            }
            setPhoneNumber(prefillPhone);
          }
        }
      } catch {
        setPhoneNumber(prefillPhone.replace(/^\+/, ""));
        if (prefillCountry) setDefaultCountryCode(prefillCountry.toUpperCase());
      }
    }
  }, [params]);

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
      const user = auth.currentUser;
      if (!user) throw new Error("No active session");

      // Get current user profile
      const userSnap = await getDocs(
        query(
          collection(db, "user_profiles"),
          where("auth_user_id", "==", user.uid)
        )
      );
      const currentUserProfileDoc = userSnap.docs[0];
      const currentUserProfile: any = currentUserProfileDoc
        ? { id: currentUserProfileDoc.id, ...currentUserProfileDoc.data() }
        : null;

      if (!currentUserProfile) throw new Error("User profile not found");

      // Determine if this phone belongs to a QuickTalk user
      const quicktalkSnap = await getDocs(
        query(collection(db, "user_profiles"), where("phone", "==", formattedPhone))
      );
      const quicktalkUserExists = !quicktalkSnap.empty;
      const linkedProfileId = quicktalkUserExists ? quicktalkSnap.docs[0].id : null;

      // Use stable doc id: linked profile id if present, otherwise E.164 phone
      const contactDocId = linkedProfileId || formattedPhone;

      // Prevent duplicate by checking deterministic path
      const contactDocRef = doc(db, "user_profiles", currentUserProfile.id, "contacts", contactDocId);
      const existingDoc = await getDoc(contactDocRef);
      if (existingDoc.exists()) {
        Toast.show({
          type: "error",
          text1: "Contact Exists",
          text2: "This contact already exists in your contacts",
        });
        setLoading(false);
        return;
      }

      // Save contact to subcollection to satisfy rules
      await setDoc(contactDocRef, {
        // Required by rules
        ownerProfileId: currentUserProfile.id,
        ownerAuthUid: user.uid,
        contactProfileId: contactDocId,
        // Display info
        displayName: `${firstName.trim()} ${lastName.trim()}`.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        phone: formattedPhone,
        // QuickTalk linking
        is_quicktalk_user: quicktalkUserExists,
        contact_user_id: linkedProfileId,
        created_at: new Date().toISOString(),
      }, { merge: true });

      Toast.show({
        type: quicktalkUserExists ? "success" : "info",
        text1: quicktalkUserExists
          ? "QuickTalk User Found!"
          : "Contact Saved",
        text2: quicktalkUserExists
          ? `${firstName} is on QuickTalk. You can now send messages!`
          : `${firstName} has been added. They're not on QuickTalk yet.`,
      });

      // Reset form
      setFirstName("");
      setLastName("");
      setPhoneNumber("");
      setFormattedPhone("");
      router.replace("/select-contact");
    } catch (error: any) {
      console.error("Error saving contact:", error);
      Toast.show({
        type: "error",
        text1: "Save Failed",
        text2: error.message || "Failed to save contact. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace("/select-contact")}
        >
          <Feather name="chevron-left" size={22} color="#fff" />
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
          {isPrefilled ? (
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={formattedPhone || phoneNumber}
              editable={false}
              selectTextOnFocus={false}
            />
          ) : (
            <PhoneInput
              key={defaultCountryCode}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              onChangeFormattedText={setFormattedPhone}
              placeholder="Enter phone number"
              defaultCode={defaultCountryCode}
              containerStyle={styles.phoneInputContainer}
              textInputStyle={{ color: "#000" }}
            />
          )}
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
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3A805B",
    paddingHorizontal: 16,
    paddingVertical: 18,
    paddingTop: 40,
  },
  backButton: { marginRight: 16 },
  headerTitle: { fontSize: 20, fontWeight: "600", color: "#fff" },
  content: { flex: 1, padding: 20, backgroundColor: "#f8f9fa" },
  formSection: { marginBottom: 30 },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 6,
    color: "#3A805B",
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    color: "#000",
  },
  inputActive: { borderColor: "#3A805B" },
  inputDisabled: {
    backgroundColor: "#f3f3f3",
    color: "#666",
  },
  phoneInputContainer: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#fff",
    height: 56,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderColor: "#eaeaea",
    backgroundColor: "#fff",
  },
  saveButton: {
    backgroundColor: "#3A805B",
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
