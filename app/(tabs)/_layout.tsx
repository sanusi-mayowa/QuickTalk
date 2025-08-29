import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TabLayout() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#3A805B" }} edges={["bottom"]}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#6eba96",
        tabBarInactiveTintColor: "#fff",
        tabBarStyle: {
          backgroundColor: "#3A805B",
          borderTopWidth: 1,
          borderTopColor: "#EFEFEF",
          height: 70,
          position: "absolute",
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
          marginTop: 2,
        },
        tabBarItemStyle: {
          justifyContent: "center",
          alignItems: "center",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Chats",
          tabBarIcon: ({ size, color }) => (
            <Feather name="message-circle" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calls"
        options={{
          title: "Calls",
          tabBarIcon: ({ size, color }) => (
            <Feather name="phone" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="updates"
        options={{
          title: "Updates",
          tabBarIcon: ({ size, color }) => (
            <Feather name="camera" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
    </SafeAreaView>
  );
}
