import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
// import { MessageCircle, Users, Settings, Phone, Camera } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
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
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chats',
          tabBarIcon: ({ size, color }) => (
            <Feather name="message-circle" size={size} color={color} />
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
      <Tabs.Screen
        name="updates"
        options={{
          title: 'Updates',
          tabBarIcon: ({ size, color }) => (
            <Feather name="camera" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}