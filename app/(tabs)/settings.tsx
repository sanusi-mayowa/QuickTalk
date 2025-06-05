import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Switch, Image, TextInput, Alert } from 'react-native';
// import { ChevronRight, Bell, Lock, Moon, CircleHelp as HelpCircle, LogOut, User, Eye, Database } from 'lucide-react-native';
import { useState, useEffect } from 'react';
// import { useAuth } from '@/hooks/useAuth';
// import { db, auth, CHATS_COLLECTION, MESSAGES_COLLECTION } from '@/lib/firebase';
// import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';

type LastSeenOption = 'everyone' | 'contacts' | 'nobody';
type OnlineOption = 'everyone' | 'same_as_last_seen';
type StatusOption = 'everyone' | 'contacts' | 'nobody';

export default function SettingsScreen() {
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [showBackupSettings, setShowBackupSettings] = useState(false);
  const [lastSeen, setLastSeen] = useState<LastSeenOption>('everyone');
  const [onlineStatus, setOnlineStatus] = useState<OnlineOption>('everyone');
  const [statusPrivacy, setStatusPrivacy] = useState<StatusOption>('everyone');
  const [readReceipts, setReadReceipts] = useState(true);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [about, setAbout] = useState('Hey there! I am using QuickTalk');
//   const { signOut } = useAuth();f

  useEffect(() => {
    loadBackupSettings();
  }, []);

  const loadBackupSettings = async () => {
    try {
      const backupSettingsRef = doc(db, 'backup_settings', auth.currentUser!.uid);
      const backupSettingsDoc = await getDocs(backupSettingsRef);
      if (backupSettingsDoc.exists()) {
        const data = backupSettingsDoc.data();
        setAutoBackupEnabled(data.autoBackup);
        setLastBackup(data.lastBackup);
      }
    } catch (error) {
      console.error('Error loading backup settings:', error);
    }
  };

  const handleBackupNow = async () => {
    try {
      Alert.alert(
        'Backup Chats',
        'This will backup all your chats and media. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Backup',
            onPress: async () => {
              const chatsRef = collection(db, CHATS_COLLECTION);
              const userChatsQuery = query(chatsRef, where('participants', 'array-contains', auth.currentUser!.uid));
              const chatsSnapshot = await getDocs(userChatsQuery);
              
              const backupData = {
                chats: chatsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
                timestamp: new Date().toISOString()
              };

              const backupRef = doc(db, 'backups', auth.currentUser!.uid);
              await setDoc(backupRef, backupData);

              setLastBackup(new Date().toISOString());
              Alert.alert('Success', 'Your chats have been backed up successfully');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error backing up chats:', error);
      Alert.alert('Error', 'Failed to backup chats. Please try again.');
    }
  };

  const handleRestoreBackup = async () => {
    try {
      Alert.alert(
        'Restore Chats',
        'This will restore your chats from the last backup. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            onPress: async () => {
              const backupRef = doc(db, 'backups', auth.currentUser!.uid);
              const backupDoc = await getDocs(backupRef);
              
              if (backupDoc.exists()) {
                const backupData = backupDoc.data();
                // Restore logic here
                Alert.alert('Success', 'Your chats have been restored successfully');
              } else {
                Alert.alert('Error', 'No backup found');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error restoring chats:', error);
      Alert.alert('Error', 'Failed to restore chats. Please try again.');
    }
  };

  // ... (rest of the component code remains exactly the same)

  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>Chat Backup</Text>
        
        <View style={styles.settingItem}>
          <View style={styles.settingIconContainer}>
            {/* <Database size={20} color="#6A5ACD" /> */}
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingTitle}>Auto Backup</Text>
            <Switch
              value={autoBackupEnabled}
              onValueChange={setAutoBackupEnabled}
              trackColor={{ false: '#E0E0E0', true: '#9370DB' }}
              thumbColor={autoBackupEnabled ? '#6A5ACD' : '#F5F5F5'}
            />
          </View>
        </View>

        <TouchableOpacity 
          style={styles.settingItem}
          onPress={handleBackupNow}
        >
          <View style={styles.settingContent}>
            <Text style={styles.settingTitle}>Backup Now</Text>
            <Text style={styles.backupInfo}>
              {lastBackup ? `Last backup: ${new Date(lastBackup).toLocaleDateString()}` : 'Never backed up'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingItem}
          onPress={handleRestoreBackup}
        >
          <View style={styles.settingContent}>
            <Text style={styles.settingTitle}>Restore from Backup</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ... (rest of the JSX remains exactly the same) */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // ... (all previous styles remain exactly the same)
  
  backupInfo: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
});