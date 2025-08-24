import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Message } from '@/hooks/useRealtimeChat';

interface MessageItemProps {
  message: Message;
  isMyMessage: boolean;
  showReadReceipt?: boolean;
  otherParticipantId?: string;
  senderLabel?: string;
  onReaction?: (messageId: string, reaction: string) => void;
  onForward?: (messageId: string) => void;
  onCopy?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
}

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

export default function MessageItem({ 
  message, 
  isMyMessage, 
  showReadReceipt = false,
  otherParticipantId,
  senderLabel,
  onReaction,
  onForward,
  onCopy,
  onDelete
}: MessageItemProps) {
  const [showReactions, setShowReactions] = useState(false);
  const [reactionModalVisible, setReactionModalVisible] = useState(false);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    // Only show time (grouped by date at the top)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const getStatusIcon = () => {
    if (!isMyMessage || !showReadReceipt || !otherParticipantId) return null;

    // ADDED: Offline queued status
    if (message.status === 'queued') {
      return <Feather name='clock' size={14} color="#999" />;
    }

    const isReadByOther = !!(message.read_by && message.read_by[otherParticipantId]);
    const isDelivered = !!(message.delivered_to && message.delivered_to[otherParticipantId]);

    if (isReadByOther) {
      // double-check (read) - green
      return (
        <View style={styles.doubleCheckContainer}>
          <Feather name='check' size={12} color="#4CAF50" style={styles.firstCheck} />
          <Feather name='check' size={12} color="#4CAF50" style={styles.secondCheck} />
        </View>
      );
    }
    if (isDelivered) {
      // double-check (delivered) - blue
      return (
        <View style={styles.doubleCheckContainer}>
          <Feather name='check' size={12} color="#2196F3" style={styles.firstCheck} />
          <Feather name='check' size={12} color="#2196F3" style={styles.secondCheck} />
        </View>
      );
    }
    // sent only (clock icon to indicate sending) - gray
    return <Feather name='clock' size={14} color="#999" />;
  };

  const handleLongPress = () => {
    setContextMenuVisible(true);
  };

  const handleReaction = (reaction: string) => {
    onReaction?.(message.id, reaction);
    setReactionModalVisible(false);
  };

  const getReactionDisplay = () => {
    if (!message.reactions || Object.keys(message.reactions).length === 0) return null;
    
    const reactionCounts: Record<string, number> = {};
    Object.values(message.reactions).forEach(reaction => {
      reactionCounts[reaction] = (reactionCounts[reaction] || 0) + 1;
    });

    return (
      <View style={styles.reactionsContainer}>
        {Object.entries(reactionCounts).map(([reaction, count], index) => (
          <View key={index} style={styles.reactionBubble}>
            <Text style={styles.reactionEmoji}>{reaction}</Text>
            {count > 1 && <Text style={styles.reactionCount}>{count}</Text>}
          </View>
        ))}
      </View>
    );
  };

  return (
    <>
      <TouchableOpacity 
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer
        ]}
        onLongPress={handleLongPress}
        activeOpacity={0.8}
      >
        {!!senderLabel && (
          <Text style={[styles.senderLabel, isMyMessage ? styles.mySenderLabel : styles.otherSenderLabel]}>
            {senderLabel}
          </Text>
        )}
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
          
          {getReactionDisplay()}
          
          <View style={styles.messageFooter}>
            <Text style={[
              styles.messageTime,
              isMyMessage ? styles.myMessageTime : styles.otherMessageTime
            ]}>
              {formatTime(message.created_at)}
            </Text>
            
            {isMyMessage && (
              <View style={styles.readStatus}>
                {getStatusIcon()}
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>

      {/* Context Menu Modal */}
      <Modal
        visible={contextMenuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setContextMenuVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setContextMenuVisible(false)}
        >
          <View style={styles.contextMenu}>
            <TouchableOpacity
              style={styles.contextMenuItem}
              onPress={() => {
                setContextMenuVisible(false);
                setReactionModalVisible(true);
              }}
            >
              <Feather name="heart" size={20} color="#666" />
              <Text style={styles.contextMenuText}>React</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.contextMenuItem}
              onPress={() => {
                onCopy?.(message.id, message.content);
                setContextMenuVisible(false);
              }}
            >
              <Feather name="copy" size={20} color="#666" />
              <Text style={styles.contextMenuText}>Copy</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.contextMenuItem}
              onPress={() => {
                onForward?.(message.id);
                setContextMenuVisible(false);
              }}
            >
              <Feather name="share" size={20} color="#666" />
              <Text style={styles.contextMenuText}>Forward</Text>
            </TouchableOpacity>
            
            {isMyMessage && (
              <TouchableOpacity
                style={[styles.contextMenuItem, styles.deleteMenuItem]}
                onPress={() => {
                  onDelete?.(message.id);
                  setContextMenuVisible(false);
                }}
              >
                <Feather name="trash-2" size={20} color="#ff4444" />
                <Text style={[styles.contextMenuText, styles.deleteMenuText]}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Reaction Modal */}
      <Modal
        visible={reactionModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setReactionModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setReactionModalVisible(false)}
        >
          <View style={styles.reactionModal}>
            {REACTIONS.map((reaction, index) => (
              <TouchableOpacity
                key={index}
                style={styles.reactionButton}
                onPress={() => handleReaction(reaction)}
              >
                <Text style={styles.reactionEmojiLarge}>{reaction}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
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
  senderLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  mySenderLabel: {
    color: '#3A805B',
    alignSelf: 'flex-end',
  },
  otherSenderLabel: {
    color: '#666',
    alignSelf: 'flex-start',
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
  doubleCheckContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 16,
    height: 12,
  },
  firstCheck: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  secondCheck: {
    position: 'absolute',
    top: 0,
    left: 4,
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
    marginBottom: 4,
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 15,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reactionEmoji: {
    fontSize: 16,
  },
  reactionCount: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  reactionEmojiLarge: {
    fontSize: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionModal: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    width: '80%',
    alignItems: 'center',
  },
  reactionButton: {
    padding: 10,
  },
  contextMenu: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 8,
    minWidth: 150,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  contextMenuText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  deleteMenuItem: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginTop: 4,
  },
  deleteMenuText: {
    color: '#ff4444',
  },
});