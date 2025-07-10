import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { UserPresence } from '@/hooks/useRealtimeChat';

interface UserPresenceIndicatorProps {
  presence: UserPresence | null;
  style?: any;
}

export default function UserPresenceIndicator({ presence, style }: UserPresenceIndicatorProps) {
  if (!presence) return null;

  const formatLastSeen = (lastSeen: string) => {
    const date = new Date(lastSeen);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} min ago`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      if (days === 1) {
        return 'Yesterday';
      } else if (days < 7) {
        return `${days} days ago`;
      } else {
        return date.toLocaleDateString();
      }
    }
  };

  return (
    <View style={[styles.container, style]}>
      <View style={[
        styles.indicator,
        presence.is_online ? styles.online : styles.offline
      ]} />
      <Text style={styles.text}>
        {presence.is_online ? 'Online' : `Last seen ${formatLastSeen(presence.last_seen)}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  offline: {
    backgroundColor: '#999',
  },
  text: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: -5,
  },
});