import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { VoiceService, VoiceRecording } from '@/lib/voice';

interface VoiceRecorderProps {
  onRecordingComplete: (recording: VoiceRecording) => void;
  onCancel: () => void;
}

export default function VoiceRecorder({ onRecordingComplete, onCancel }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRecording) {
      // Start pulse animation
      const pulse = () => {
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (isRecording) pulse();
        });
      };
      pulse();

      // Start duration counter
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      pulseAnim.setValue(1);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording, pulseAnim]);

  const startRecording = async () => {
    if (Platform.OS === 'web') {
      // Web fallback - show message
      alert('Voice recording is not available on web platform');
      return;
    }

    const success = await VoiceService.startRecording();
    if (success) {
      setIsRecording(true);
      setDuration(0);
    }
  };

  const stopRecording = async () => {
    const recording = await VoiceService.stopRecording();
    setIsRecording(false);
    setDuration(0);

    if (recording) {
      onRecordingComplete(recording);
    }
  };

  const cancelRecording = async () => {
    await VoiceService.cancelRecording();
    setIsRecording(false);
    setDuration(0);
    onCancel();
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isRecording) {
    return (
      <TouchableOpacity style={styles.recordButton} onPress={startRecording}>
        <Feather name='mic' size={24} color="#FFFFFF" />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.recordingContainer}>
      <TouchableOpacity style={styles.cancelButton} onPress={cancelRecording}>
        <Feather name='x' size={20} color="#FF3B30" />
      </TouchableOpacity>

      <View style={styles.recordingInfo}>
        <Animated.View style={[styles.recordingIndicator, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.recordingDot} />
        </Animated.View>
        <Text style={styles.durationText}>{formatDuration(duration)}</Text>
      </View>

      <TouchableOpacity style={styles.sendButton} onPress={stopRecording}>
        <Feather name='send' size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  recordButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flex: 1,
  },
  cancelButton: {
    padding: 8,
    marginRight: 12,
  },
  recordingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingIndicator: {
    marginRight: 8,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF3B30',
  },
  durationText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
});