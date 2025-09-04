import { SafeAreaView, View, Text, TouchableOpacity, StatusBar, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';

export default function SecuritySettingsScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.primary} />
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
          <Feather name="chevron-left" size={24} color={theme.colors.primaryText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.primaryText }]}>Privacy & Security</Text>
        <View style={styles.headerIcon} />
      </View>

      <View style={styles.content}>
        <TouchableOpacity style={[styles.row]} onPress={() => (router.push as any)({ pathname: '/settings/reset-password' })}>
          <View style={styles.rowLeft}>
            <Feather name="key" size={20} color={theme.colors.primary} />
            <Text style={[styles.rowText, { color: theme.colors.text }]}>Reset Password</Text>
          </View>
          <Feather name="chevron-right" size={20} color={theme.colors.mutedText} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.row]} onPress={() => (router.push as any)({ pathname: '/settings/delete-account' })}>
          <View style={styles.rowLeft}>
            <Feather name="trash-2" size={20} color="#d32f2f" />
            <Text style={[styles.rowText, { color: theme.colors.text }]}>Delete Account</Text>
          </View>
          <Feather name="chevron-right" size={20} color={theme.colors.mutedText} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 18, paddingTop: 40 },
  headerIcon: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '600' },
  content: { padding: 20 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowText: { fontSize: 16 },
});


