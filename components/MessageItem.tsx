import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Message } from '@/hooks/useRealtimeChat';

interface MessageItemProps {
  message: Message;
  isMyMessage: boolean;
  showReadReceipt?: boolean;
  otherParticipantId?: string;
}

export default function MessageItem({ 
  message, 
  isMyMessage, 
  showReadReceipt = false,
  otherParticipantId 
}: MessageItemProps) {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getReadStatus = () => {
    if (!isMyMessage || !showReadReceipt || !otherParticipantId) return null;

    const isReadByOther = message.read_by && message.read_by[otherParticipantId];
    
    if (isReadByOther) {
      return <Feather name='check' size={14} color="#4CAF50" />;
    } else {
      return <Feather name='check' size={14} color="#999" />;
    }
  };

  return (
    <View style={[
      styles.messageContainer,
      isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer
    ]}>
      <View style={[
        styles.messageBubble,
        isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble
      ]}>
        <Text style={[
          styles.messageText,
          isMyMessage ? styles.myMessageText : styles.otherMessageText
        ]}>
          {message.content}
        </Text>
        
        <View style={styles.messageFooter}>
          <Text style={[
            styles.messageTime,
            isMyMessage ? styles.myMessageTime : styles.otherMessageTime
          ]}>
            {formatTime(message.created_at)}
          </Text>
          
          {isMyMessage && (
            <View style={styles.readStatus}>
              {getReadStatus()}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  messageContainer: {
    paddingHorizontal: 16,
    marginVertical: 2,
  },
  myMessageContainer: {
    alignItems: 'flex-end',
  },
  otherMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
  },
  myMessageBubble: {
    backgroundColor: '#3A805B',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#e9ecef',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
    marginBottom: 4,
  },
  myMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#333',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  messageTime: {
    fontSize: 11,
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  otherMessageTime: {
    color: '#666',
  },
  readStatus: {
    marginLeft: 4,
  },
});