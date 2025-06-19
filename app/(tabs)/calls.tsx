import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

interface CallLog {
  id: string;
  name: string;
  type: 'incoming' | 'outgoing' | 'missed';
  time: string;
  duration?: string;
}

const mockCalls: CallLog[] = [
  {
    id: '1',
    name: 'John Doe',
    type: 'incoming',
    time: 'Just now',
    duration: '2:15',
  },
  {
    id: '2',
    name: 'Jane Smith',
    type: 'outgoing',
    time: '5 mins ago',
    duration: '0:45',
  },
  {
    id: '3',
    name: 'Mike Johnson',
    type: 'missed',
    time: '30 mins ago',
  },
  {
    id: '4',
    name: 'Sarah Wilson',
    type: 'incoming',
    time: 'Today, 10:30 AM',
    duration: '3:22',
  },
  {
    id: '5',
    name: 'Daniel Craig',
    type: 'outgoing',
    time: 'Today, 9:00 AM',
    duration: '4:10',
  },
  {
    id: '6',
    name: 'Aisha Bello',
    type: 'missed',
    time: 'Yesterday, 8:45 PM',
  },
  {
    id: '7',
    name: 'Samuel Green',
    type: 'incoming',
    time: 'Yesterday, 4:20 PM',
    duration: '6:55',
  },
  {
    id: '8',
    name: 'Tolu Ade',
    type: 'outgoing',
    time: 'Yesterday, 12:10 PM',
    duration: '10:30',
  },
  {
    id: '9',
    name: 'Ngozi Umeh',
    type: 'missed',
    time: '2 days ago, 6:00 PM',
  },
  {
    id: '10',
    name: 'Victor Okoye',
    type: 'incoming',
    time: '2 days ago, 2:30 PM',
    duration: '1:05',
  },
];

export default function CallsScreen() {
  const getCallIcon = (type: string) => {
    switch (type) {
      case 'incoming':
        return (
          <Feather name="phone-incoming" size={20} color="#25D366" />
        );
      case 'outgoing':
        return (
          <Feather name="phone-outgoing" size={20} color="#25D366" />
        );
      case 'missed':
        return (
          <Feather name="phone-off" size={20} color="#FF3B30" />
        );
      default:
        return (
          <Feather name="phone-call" size={20} color="#FF3B30" />
        );
    }
  };

  const renderCallItem = ({ item }: { item: CallLog }) => (
    <TouchableOpacity style={styles.callItem}>
      <View style={styles.callIcon}>
        {getCallIcon(item.type)}
      </View>

      <View style={styles.callContent}>
        <Text style={styles.callName}>{item.name}</Text>
        <View style={styles.callDetails}>
          <Text style={styles.callTime}>{item.time}</Text>
          {item.duration && (
            <Text style={styles.callDuration}> • {item.duration}</Text>
          )}
        </View>
      </View>

      <TouchableOpacity style={styles.callButton}>
        <Feather name="phone-call" size={20} color="#25D366" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Calls</Text>
      </View>

      {/* Call List */}
      <FlatList
        data={mockCalls}
        renderItem={renderCallItem}
        keyExtractor={(item) => item.id}
        style={styles.callList}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#3A805B',
  },
  headerTitle: {
    fontSize: 25,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.5,
  },
  callList: {
    flex: 1,
  },
  callItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  callIcon: {
    marginRight: 12,
  },
  callContent: {
    flex: 1,
  },
  callName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  callDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callTime: {
    fontSize: 14,
    color: '#8E8E93',
  },
  callDuration: {
    fontSize: 14,
    color: '#8E8E93',
  },
  callButton: {
    padding: 8,
  },
});
