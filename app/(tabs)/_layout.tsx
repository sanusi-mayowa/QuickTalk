import { useState, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Tabs } from 'expo-router';
import { TouchableOpacity, View, Text, StyleSheet, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function TabLayout() {
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const router = useRouter();

  const openMenu = () => {
    setIsMenuVisible(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const closeMenu = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setIsMenuVisible(false));
  };

  const toggleMenu = () => {
    if (isMenuVisible) {
      closeMenu();
    } else {
      openMenu();
    }
  };

  const handleNewGroup = () => {
    closeMenu();
    router.push('/(tabs)/new-group');
  };

  const handleLinkedDevices = () => {
    closeMenu();
    router.push('/(tabs)/linkedDevices');
  };

  const handleStarredMessages = () => {
    closeMenu();
    router.push('/(tabs)/starredMessages');
  };

  const handleSettings = () => {
    closeMenu();
    router.push('/(tabs)/settings');
  };

 
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#6eba96',
          tabBarInactiveTintColor: '#fff',
          tabBarStyle: {
            backgroundColor: '#3A805B',
            borderTopWidth: 1,
            borderTopColor: '#EFEFEF',
            height: 90,
            paddingBottom: 8,
            paddingTop: 8,
            justifyContent: 'center',
          },
          tabBarLabelStyle: {
            fontSize: 12,
            marginTop: 4,
            fontWeight: '500',
            color: "white",
          },
          headerStyle: {
            backgroundColor: '#3A805B'
          },
          headerTitleStyle: {
            color: 'white',
            fontSize: 25,
            fontWeight: '600',
            letterSpacing: 0.5,
          },
          
          headerTintColor: 'white',
          headerRight: () => (
            <TouchableOpacity
              style={{ marginRight: 16 }}
              onPress={toggleMenu}
              accessible={true}
              accessibilityLabel="Open menu"
              accessibilityHint="Shows more options menu"
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
            tabBarIcon: ({ size, color }) => (
              <Feather name="message-circle" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="updates"
          options={{
            title: 'Updates',
            tabBarIcon: ({ size, color }) => (
              <Feather name="camera" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="calls"
          options={{
            title: 'Calls',
            tabBarIcon: ({ size, color }) => (
              <Feather name="phone" size={size} color={color} />
            ),
          }}
        />
      </Tabs>

      {isMenuVisible && (
        <Animated.View style={[styles.menuOverlay, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={styles.menuBackground}
            onPress={closeMenu}
            accessible={true}
            accessibilityLabel="Close menu"
          />
          <View style={styles.menuContainer}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleNewGroup}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="New Group"
            >
              <Text style={styles.menuText}>New Group</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleLinkedDevices}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Linked Devices"
            >
              <Text style={styles.menuText}>Linked Devices</Text>
            </TouchableOpacity>


            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleStarredMessages}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Starred Mesages"
            >
              <Text style={styles.menuText}>Starred Messages</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleSettings}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <Text style={styles.menuText}>Settings</Text>
            </TouchableOpacity>

            
          </View>
        </Animated.View>
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
  },
  menuContainer: {
    position: 'absolute',
    top: 56,
    right: 0,
    backgroundColor: '#2d5743',
    borderRadius: 8,
    elevation: 5,
    minWidth: 180,
  },
  menuItem: {
    padding: 16,
  },
  menuText: {
    fontSize: 16,
    color: '#fff',
  },
});
