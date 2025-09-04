import { View, Text, TouchableOpacity, SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeMode } from '@/lib/theme';

export default function ThemeSettingsScreen() {
  const router = useRouter();
  const { theme, mode, setMode } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.primary} />
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
          <Feather name="chevron-left" size={24} color={theme.colors.primaryText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.primaryText }]}>Theme</Text>
        <View style={styles.headerIcon} />
      </View>

      <View style={styles.content}>
        {(['light', 'dark', 'system'] as ThemeMode[]).map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.row, { borderBottomColor: theme.colors.border }]}
            onPress={() => setMode(opt)}
            accessibilityRole="radio"
            accessibilityState={{ selected: mode === opt }}
          >
            <View style={styles.rowLeft}>
              <Feather name={mode === opt ? 'check-circle' : 'circle'} size={20} color={mode === opt ? theme.colors.primary : theme.colors.mutedText} />
              <Text style={[styles.rowText, { color: theme.colors.text }]}>
                {opt[0].toUpperCase() + opt.slice(1)}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 18,
    paddingTop: 40,
  },
  headerIcon: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '600' },
  content: { padding: 20 },
  row: { paddingVertical: 14, borderBottomWidth: 1 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowText: { fontSize: 16, fontWeight: '500' },
});


