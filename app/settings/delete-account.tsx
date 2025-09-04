import { useState } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StatusBar, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';
import { auth, db } from '@/lib/firebase';
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import Toast from 'react-native-toast-message';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const onDelete = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      setBusy(true);
      // Optional: soft-delete user profile
      try {
        const q = query(collection(db, 'user_profiles'), where('auth_user_id', '==', user.uid));
        const snap = await getDocs(q);
        const meDoc = snap.docs[0];
        if (meDoc) {
          await updateDoc(doc(db, 'user_profiles', meDoc.id), { deletedAt: new Date() } as any);
        }
      } catch {}
      await deleteUser(user);
      Toast.show({ type: 'success', text1: 'Account deleted' });
      router.replace('/(auth)/login');
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Failed to delete', text2: e?.message || '' });
    } finally { setBusy(false); }
  };

  const confirm = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. Do you really want to delete your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.primary} />
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
          <Feather name="chevron-left" size={24} color={theme.colors.primaryText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.primaryText }]}>Delete Account</Text>
        <View style={styles.headerIcon} />
      </View>

      <View style={styles.content}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
          <View style={styles.cardHeader}>
            <Feather name="trash-2" size={20} color="#d32f2f" />
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Permanently delete your account</Text>
          </View>
          <Text style={[styles.cardDesc, { color: theme.colors.mutedText }]}>This action is irreversible and will remove your profile. You’ll be signed out immediately.</Text>
          <View style={styles.bullets}>
            <View style={styles.bulletRow}>
              <Feather name="minus" size={16} color={theme.colors.mutedText} />
              <Text style={[styles.bulletText, { color: theme.colors.mutedText }]}>Your profile will be marked as deleted.</Text>
            </View>
            <View style={styles.bulletRow}>
              <Feather name="minus" size={16} color={theme.colors.mutedText} />
              <Text style={[styles.bulletText, { color: theme.colors.mutedText }]}>You can’t undo this operation.</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.checkboxRow} onPress={() => setAcknowledged(!acknowledged)}>
            <Feather name={acknowledged ? 'check-square' : 'square'} size={20} color={acknowledged ? theme.colors.primary : theme.colors.mutedText} />
            <Text style={[styles.checkboxText, { color: theme.colors.text }]}>I understand this cannot be undone</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.deleteBtn, { backgroundColor: acknowledged ? '#d32f2f' : '#f19999' }]}
            onPress={confirm}
            disabled={busy || !acknowledged}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>{busy ? 'Deleting...' : 'Delete my account'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 18, paddingTop: 40 },
  headerIcon: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '600' },
  content: { padding: 20 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardDesc: { fontSize: 13 },
  bullets: { gap: 6, marginTop: 4 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bulletText: { fontSize: 13 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  checkboxText: { fontSize: 14 },
  deleteBtn: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, marginTop: 8 },
});


