import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { VoiceService } from '@/lib/voice';

interface VoicePlayerProps {
  uri: string;
  duration: number;
  isOwnMessage?: boolean;
}

export default function VoicePlayer({ uri, duration, isOwnMessage = false }: VoicePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [waveformAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (isPlaying) {
      // Animate waveform
      Animated.loop(
        Animated.sequence([
          Animated.timing(waveformAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: false,
          }),
          Animated.timing(waveformAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: false,
          }),
        ])
      ).start();

      // Simulate progress (in real app, you'd get actual playback position)
      const interval = setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= duration) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 100;
        });
      }, 100);

      return () => clearInterval(interval);
    } else {
      waveformAnim.setValue(0);
    }
  }, [isPlaying, duration, waveformAnim]);

  const togglePlayback = async () => {
    if (isPlaying) {
      await VoiceService.pausePlayback();
      setIsPlaying(false);
    } else {
      const success = await VoiceService.playVoiceMessage(uri);
      if (success) {
        setIsPlaying(true);
      }
    }
  };

  const formatTime = (milliseconds: number): string => {
    return VoiceService.formatDuration(milliseconds);
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <View style={[
      styles.container,
      isOwnMessage ? styles.ownMessage : styles.otherMessage
    ]}>
      <TouchableOpacity style={styles.playButton} onPress={togglePlayback}>
        {isPlaying ? (
          <Feather name='pause' size={16} color="#FFFFFF" />
        ) : (
          <Feather name='play' size={16} color="#FFFFFF" />
        )}
      </TouchableOpacity>

      <View style={styles.waveformContainer}>
        <View style={styles.waveform}>
          {Array.from({ length: 20 }).map((_, index) => {
            const height = waveformAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [4, Math.random() * 20 + 4],
            });

            return (
              <Animated.View
                key={index}
                style={[
                  styles.waveformBar,
                  {
                    height,
                    backgroundColor: index / 20 <= progress ? '#25D366' : '#E5E5EA',
                  },
                ]}
              />
            );
          })}
        </View>
        
        <Text style={[
          styles.timeText,
          isOwnMessage ? styles.ownTimeText : styles.otherTimeText
        ]}>
          {formatTime(isPlaying ? currentTime : duration)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    minWidth: 200,
  },
  ownMessage: {
    backgroundColor: '#DCF8C6',
  },
  otherMessage: {
    backgroundColor: '#FFFFFF',
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  waveformContainer: {
    flex: 1,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    marginBottom: 4,
  },
  waveformBar: {
    width: 2,
    marginHorizontal: 1,
    borderRadius: 1,
  },
  timeText: {
    fontSize: 12,
    alignSelf: 'flex-end',
  },
  ownTimeText: {
    color: '#666',
  },
  otherTimeText: {
    color: '#999',
  },
});