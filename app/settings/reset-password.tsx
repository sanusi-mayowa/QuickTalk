import { useState } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StatusBar, StyleSheet, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';
import { auth } from '@/lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import Toast from 'react-native-toast-message';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [email, setEmail] = useState<string>(auth.currentUser?.email || '');
  const [saving, setSaving] = useState(false);

  const onSend = async () => {
    try {
      if (!email.trim()) { Toast.show({ type: 'error', text1: 'Enter your email' }); return; }
      setSaving(true);
      await sendPasswordResetEmail(auth, email.trim());
      Toast.show({ type: 'success', text1: 'Email sent', text2: 'Check your inbox to reset password' });
      router.back();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Failed', text2: e?.message || '' });
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.primary} />
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
          <Feather name="chevron-left" size={24} color={theme.colors.primaryText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.primaryText }]}>Reset Password</Text>
        <View style={styles.headerIcon} />
      </View>

      <View style={styles.content}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
          <View style={styles.cardHeader}>
            <Feather name="key" size={20} color={theme.colors.primary} />
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Reset your password</Text>
          </View>
          <Text style={[styles.cardDesc, { color: theme.colors.mutedText }]}>We'll email you a secure link to reset your password.</Text>
          <Text style={[styles.label, { color: theme.colors.text }]}>Email</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.inputBg || '#fff' }]}
            value={email}
            onChangeText={setEmail}
            keyboardType='email-address'
            autoCapitalize='none'
            placeholder='your@email.com'
            placeholderTextColor={theme.colors.mutedText}
          />
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.colors.primary }]} onPress={onSend} disabled={saving}>
            <Text style={{ color: theme.colors.primaryText, fontWeight: '600' }}>{saving ? 'Sending...' : 'Send reset email'}</Text>
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
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardDesc: { fontSize: 13 },
  label: { fontSize: 13, marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  primaryBtn: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, marginTop: 8 },
});


