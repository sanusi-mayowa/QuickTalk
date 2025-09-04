import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { auth, db } from '@/lib/firebase';
import FirebaseService from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import Toast from 'react-native-toast-message';
import { useTheme } from '@/lib/theme';

export default function DisappearingSettingsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [enabled, setEnabled] = useState<boolean>(false);
  const [durationSec, setDurationSec] = useState<number>(60*60*24);
  const [applyToExisting, setApplyToExisting] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const q = query(collection(db, 'user_profiles'), where('auth_user_id', '==', user.uid));
        const snap = await getDocs(q);
        const meDoc = snap.docs[0];
        if (meDoc?.exists()) {
          const d: any = meDoc.data();
          const defaults = d.disappearingDefaults || {};
          setEnabled(!!defaults.enabled);
          setDurationSec(Number(defaults.duration || 60*60*24));
        }
      } catch {}
    })();
  }, []);

  const formatLabel = (sec: number) => sec === 60*60*24*90 ? '90 days' : sec === 60*60*24*7 ? '7 days' : sec === 60*60*24 ? '24 hours' : `${Math.round(sec/60)} min`;

  const onSave = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      setSaving(true);
      const q = query(collection(db, 'user_profiles'), where('auth_user_id', '==', user.uid));
      const snap = await getDocs(q);
      const meDoc = snap.docs[0];
      if (!meDoc) { Toast.show({ type: 'error', text1: 'Profile not found' }); return; }
      const myProfileId = meDoc.id;
      await FirebaseService.setUserDisappearingDefaults({ userProfileId: myProfileId, enabled, durationSec: enabled ? durationSec : 0 });
      if (applyToExisting) {
        await FirebaseService.applyUserDefaultToAllChats({ userProfileId: myProfileId, enabled, durationSec: enabled ? durationSec : 0 });
        const content = enabled ? `You turned on disappearing messages. New messages will disappear after ${formatLabel(durationSec)}.` : 'You turned off disappearing messages.';
        await FirebaseService.notifyAllChatsDisappearingChanged({ userProfileId: myProfileId, content });
      }
      Toast.show({ type: 'success', text1: 'Saved' });
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
        <Text style={[styles.headerTitle, { color: theme.colors.primaryText }]}>Disappearing messages</Text>
        <View style={styles.headerIcon} />
      </View>

      <View style={styles.content}>
        {[ { label: 'Off', value: 0 }, { label: '24 hours', value: 60*60*24 }, { label: '7 days', value: 60*60*24*7 }, { label: '90 days', value: 60*60*24*90 } ].map((opt) => (
          <TouchableOpacity
            key={opt.label}
            style={[styles.row, { borderBottomColor: theme.colors.border }]}
            onPress={() => {
              if (opt.value === 0) { setEnabled(false); setDurationSec(60*60*24); }
              else { setEnabled(true); setDurationSec(opt.value); }
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: (enabled ? durationSec : 0) === opt.value }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Feather name={(enabled ? durationSec : 0) === opt.value ? 'check-circle' : 'circle'} size={20} color={(enabled ? durationSec : 0) === opt.value ? theme.colors.primary : theme.colors.mutedText} />
              <Text style={[styles.rowText, { color: theme.colors.text }]}>{opt.label}</Text>
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={[styles.row, { borderBottomColor: theme.colors.border }]} onPress={() => setApplyToExisting((v) => !v)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Feather name={applyToExisting ? 'check-square' : 'square'} size={20} color={theme.colors.primary} />
            <Text style={[styles.rowText, { color: theme.colors.text }]}>Apply to existing chats now</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.colors.primary }]} onPress={onSave} disabled={saving}>
          <Text style={{ color: theme.colors.primaryText, fontWeight: '600' }}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 18, paddingTop: 40 },
  headerIcon: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '600' },
  content: { padding: 20, gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1 },
  rowText: { fontSize: 16 },
  saveBtn: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
});


