import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import {
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useTheme } from "@/lib/theme";
import { useOffline } from "@/hooks/useOffline";

export default function EditContactScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { theme } = useTheme();
  const { queueContactUpdate, syncStatus } = useOffline();
  const contactId = params.contactId as string;
  const prefillFirst = (params.firstName as string) || "";
  const prefillLast = (params.lastName as string) || "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dirtyFirst, setDirtyFirst] = useState(false);
  const [dirtyLast, setDirtyLast] = useState(false);

  const [ownerProfileId, setOwnerProfileId] = useState<string>("");

  useEffect(() => {
    if (!contactId) {
      Toast.show({
        type: "error",
        text1: "Missing contact",
        text2: "No contactId was provided",
      });
      setLoading(false);
      return;
    }

    // Resolve owner profile id for the current user
    (async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setLoading(false);
          return;
        }
        const meSnap = await getDocs(
          query(
            collection(db, "user_profiles"),
            where("auth_user_id", "==", user.uid)
          )
        );
        const meDoc = meSnap.docs[0];
        if (!meDoc) {
          setLoading(false);
          return;
        }
        const ownerId = meDoc.id;
        setOwnerProfileId(ownerId);

        let initialApplied = false;
        const unsubscribe = onSnapshot(
          doc(db, "user_profiles", ownerId, "contacts", contactId),
          (snap) => {
            if (!snap.exists()) {
              Toast.show({
                type: "error",
                text1: "Not found",
                text2: "Contact does not exist",
              });
              setLoading(false);
              return;
            }
            const data: any = snap.data();
            if (!initialApplied) {
              setFirstName(prefillFirst || data.first_name || "");
              setLastName(prefillLast || data.last_name || "");
              setLoading(false);
              initialApplied = true;
              return;
            }
            if (!dirtyFirst) setFirstName(data.first_name || "");
            if (!dirtyLast) setLastName(data.last_name || "");
          },
          (e) => {
            Toast.show({
              type: "error",
              text1: "Load failed",
              text2: e?.message || "Unable to load contact",
            });
            setLoading(false);
          }
        );

        return () => {
          unsubscribe();
        };
      } catch {
        setLoading(false);
      }
    })();
  }, [contactId, prefillFirst, prefillLast, dirtyFirst, dirtyLast]);

  const onSave = async () => {
    if (!contactId) return;
    if (!firstName.trim()) {
      Toast.show({ type: "error", text1: "First name required" });
      return;
    }
    setSaving(true);
    try {
      // Check if we're offline
      const isOffline = !syncStatus.isOnline;

      if (isOffline) {
        // Queue contact update for offline processing
        await queueContactUpdate(contactId, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          displayName: `${firstName.trim()} ${lastName.trim()}`.trim(),
        });

        Toast.show({
          type: "info",
          text1: "Update Queued",
          text2: "Contact will be updated when you're back online",
        });
        router.back();
        return;
      }

      // Online flow - proceed with normal updating
      if (!ownerProfileId) throw new Error("Profile not resolved");
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in");
      await updateDoc(
        doc(db, "user_profiles", ownerProfileId, "contacts", contactId),
        {
          first_name: firstName.trim(),
          last_name: lastName.trim() || null,
          displayName: `${firstName.trim()} ${lastName.trim()}`.trim(),
          ownerProfileId,
          ownerAuthUid: user.uid,
          contactProfileId: contactId,
        } as any
      );
      Toast.show({ type: "success", text1: "Saved", text2: "Contact updated" });
      router.back();
    } catch (e: any) {
      Toast.show({
        type: "error",
        text1: "Update failed",
        text2: e?.message || "Insufficient permissions",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3A805B" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#3A805B" }}>
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Feather
            name="chevron-left"
            size={22}
            color={theme.colors.primaryText}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.primaryText }]}>
          Edit Contact
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        style={[styles.content, { backgroundColor: theme.colors.surface }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.label, { color: theme.colors.primary }]}>
          First Name
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.inputBg,
              color: theme.colors.text,
              borderColor: "#ccc",
            },
            firstName && styles.inputActive,
          ]}
          placeholder="Enter first name"
          placeholderTextColor={theme.colors.mutedText}
          value={firstName}
          onChangeText={(t) => {
            setDirtyFirst(true);
            setFirstName(t);
          }}
        />

        <Text style={[styles.label, { color: theme.colors.primary }]}>
          Last Name
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.inputBg,
              color: theme.colors.text,
              borderColor: "#ccc",
            },
            lastName && styles.inputActive,
          ]}
          placeholder="Enter last name"
          placeholderTextColor={theme.colors.mutedText}
          value={lastName}
          onChangeText={(t) => {
            setDirtyLast(true);
            setLastName(t);
          }}
        />
      </ScrollView>
      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: theme.colors.primary },
            saving && { opacity: 0.6 },
          ]}
          onPress={onSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={theme.colors.primaryText} />
          ) : (
            <Text
              style={[
                styles.saveButtonText,
                { color: theme.colors.primaryText },
              ]}
            >
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
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
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderColor: "#eaeaea",
    backgroundColor: "#fff",
    marginBottom: 50,
  },
  saveButton: {
    backgroundColor: "#3A805B",
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
