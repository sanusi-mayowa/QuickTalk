import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { doc, getDoc, updateDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export default function EditContactScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const contactId = params.contactId as string;
  const prefillFirst = (params.firstName as string) || '';
  const prefillLast = (params.lastName as string) || '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dirtyFirst, setDirtyFirst] = useState(false);
  const [dirtyLast, setDirtyLast] = useState(false);

  const [ownerProfileId, setOwnerProfileId] = useState<string>('');

  useEffect(() => {
    if (!contactId) {
      Toast.show({ type: 'error', text1: 'Missing contact', text2: 'No contactId was provided' });
      setLoading(false);
      return;
    }

    // Resolve owner profile id for the current user
    (async () => {
      try {
        const user = auth.currentUser;
        if (!user) { setLoading(false); return; }
        const meSnap = await getDocs(query(collection(db, 'user_profiles'), where('auth_user_id', '==', user.uid)));
        const meDoc = meSnap.docs[0];
        if (!meDoc) { setLoading(false); return; }
        const ownerId = meDoc.id;
        setOwnerProfileId(ownerId);

        let initialApplied = false;
        const unsubscribe = onSnapshot(
          doc(db, 'user_profiles', ownerId, 'contacts', contactId),
          (snap) => {
            if (!snap.exists()) {
              Toast.show({ type: 'error', text1: 'Not found', text2: 'Contact does not exist' });
              setLoading(false);
              return;
            }
            const data: any = snap.data();
            if (!initialApplied) {
              setFirstName((prefillFirst || data.first_name || ''));
              setLastName((prefillLast || data.last_name || ''));
              setLoading(false);
              initialApplied = true;
              return;
            }
            if (!dirtyFirst) setFirstName((data.first_name || ''));
            if (!dirtyLast) setLastName((data.last_name || ''));
          },
          (e) => {
            Toast.show({ type: 'error', text1: 'Load failed', text2: e?.message || 'Unable to load contact' });
            setLoading(false);
          }
        );

        return () => { unsubscribe(); };
      } catch {
        setLoading(false);
      }
    })();
  }, [contactId, prefillFirst, prefillLast, dirtyFirst, dirtyLast]);

  const onSave = async () => {
    if (!contactId) return;
    if (!firstName.trim()) {
      Toast.show({ type: 'error', text1: 'First name required' });
      return;
    }
    setSaving(true);
    try {
      if (!ownerProfileId) throw new Error('Profile not resolved');
      const user = auth.currentUser;
      if (!user) throw new Error('Not signed in');
      await updateDoc(doc(db, 'user_profiles', ownerProfileId, 'contacts', contactId), {
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        displayName: `${firstName.trim()} ${lastName.trim()}`.trim(),
        ownerProfileId,
        ownerAuthUid: user.uid,
        contactProfileId: contactId,
      } as any);
      Toast.show({ type: 'success', text1: 'Saved', text2: 'Contact updated' });
      router.back();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Update failed', text2: e?.message || 'Insufficient permissions' });
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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Contact</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>First Name</Text>
        <TextInput
          style={[styles.input, firstName && styles.inputActive]}
          placeholder="Enter first name"
          placeholderTextColor="#999"
          value={firstName}
          onChangeText={(t) => { setDirtyFirst(true); setFirstName(t); }}
        />

        <Text style={styles.label}>Last Name</Text>
        <TextInput
          style={[styles.input, lastName && styles.inputActive]}
          placeholder="Enter last name"
          placeholderTextColor="#999"
          value={lastName}
          onChangeText={(t) => { setDirtyLast(true); setLastName(t); }}
        />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.saveButton, saving && { opacity: 0.6 }]} onPress={onSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3A805B',
    paddingHorizontal: 16,
    paddingVertical: 18,
    paddingTop: 40,
    justifyContent: 'space-between',
  },
  backButton: { marginRight: 16 },
  headerTitle: { fontSize: 20, fontWeight: '600', color: '#fff' },
  content: { flex: 1, padding: 20, backgroundColor: '#f8f9fa' },
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
  inputActive: { borderColor: '#3A805B' },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderColor: '#eaeaea',
    backgroundColor: '#fff',
    marginBottom: 50,
  },
  saveButton: {
    backgroundColor: '#3A805B',
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});


