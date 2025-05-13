import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Tabs } from 'expo-router';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function TabLayout() {
  const [showMenu, setShowMenu] = useState(false);
  const router = useRouter();

  const handleNewGroup = () => {
    router.push('/(tabs)/new-group');
  };

  const handleSettings = () => {
    setShowMenu(false);
    router.push('/(tabs)/settings');
  };

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#6A5ACD',
          tabBarInactiveTintColor: '#909090',
          tabBarStyle: {
            backgroundColor: 'white',
            borderTopWidth: 1,
            borderTopColor: '#EFEFEF',
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
          },
          headerStyle: {
            color: 'white',
            fontSize: 20,
            fontWeight: '600',
          },
          headerTintColor: 'white',
          headerRight: () => (
            <TouchableOpacity
              style={{ marginRight: 16 }}
              onPress={() => setShowMenu(!showMenu)}
            >
              <Feather name="more-vertical" size={24} color="white" />
            </TouchableOpacity>
          ),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'QuickTalk',
            tabBarLabel: 'Chats',
            tabBarIcon: ({ color, size }) => (
              <Feather name="message-circle" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="updates"
          options={{
            title: 'Updates',
            tabBarIcon: ({ color, size }) => (
              <Feather name="camera" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="calls"
          options={{
            title: 'Calls',
            tabBarIcon: ({ color, size }) => (
              <Feather name="phone" size={size} color={color} />
            ),
          }}
        />
      </Tabs>

      {showMenu && (
        <View style={styles.menuOverlay}>
          <TouchableOpacity
            style={styles.menuBackground}
            onPress={() => setShowMenu(false)}
          />
          <View style={styles.menuContainer}>
            <TouchableOpacity style={styles.menuItem} onPress={handleNewGroup}>
              <Text style={styles.menuText}>New Group</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleSettings}>
              <Text style={styles.menuText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  menuOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  menuBackground: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menuContainer: {
    position: 'absolute',
    top: 56, // adjust based on the header height if needed
    right: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.25,
    // shadowRadius: 4,
    elevation: 5,
    minWidth: 180,
  },
  menuItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuText: {
    fontSize: 16,
    color: '#333',
  },
});
