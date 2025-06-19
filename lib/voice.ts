import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

export interface VoiceRecording {
  uri: string;
  duration: number;
  size: number;
}

export class VoiceService {
  private static recording: Audio.Recording | null = null;
  private static sound: Audio.Sound | null = null;

  static async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') {
      return false; // Web doesn't support audio recording in this setup
    }

    try {
      const permission = await Audio.requestPermissionsAsync();
      return permission.status === 'granted';
    } catch (error) {
      console.error('Error requesting audio permissions:', error);
      return false;
    }
  }

  static async startRecording(): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        return false;
      }

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return false;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      this.recording = recording;
      return true;
    } catch (error) {
      console.error('Error starting recording:', error);
      return false;
    }
  }

  static async stopRecording(): Promise<VoiceRecording | null> {
    try {
      if (!this.recording || Platform.OS === 'web') {
        return null;
      }

      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      
      if (!uri) {
        return null;
      }

      const status = await this.recording.getStatusAsync();
      const fileInfo = await FileSystem.getInfoAsync(uri);

      const result: VoiceRecording = {
        uri,
        duration: status.durationMillis || 0,
        size: fileInfo.exists ? fileInfo.size || 0 : 0,
      };

      this.recording = null;
      return result;
    } catch (error) {
      console.error('Error stopping recording:', error);
      return null;
    }
  }

  static async cancelRecording(): Promise<void> {
    try {
      if (this.recording && Platform.OS !== 'web') {
        await this.recording.stopAndUnloadAsync();
        this.recording = null;
      }
    } catch (error) {
      console.error('Error canceling recording:', error);
    }
  }

  static async playVoiceMessage(uri: string): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        // Web fallback - use HTML5 audio
        const audio = new window.Audio(uri);
        audio.play();
        return true;
      }

      // Stop any currently playing sound
      if (this.sound) {
        await this.sound.unloadAsync();
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );

      this.sound = sound;
      return true;
    } catch (error) {
      console.error('Error playing voice message:', error);
      return false;
    }
  }

  static async stopPlayback(): Promise<void> {
    try {
      if (this.sound) {
        await this.sound.stopAsync();
        await this.sound.unloadAsync();
        this.sound = null;
      }
    } catch (error) {
      console.error('Error stopping playback:', error);
    }
  }

  static async pausePlayback(): Promise<void> {
    try {
      if (this.sound) {
        await this.sound.pauseAsync();
      }
    } catch (error) {
      console.error('Error pausing playback:', error);
    }
  }

  static async resumePlayback(): Promise<void> {
    try {
      if (this.sound) {
        await this.sound.playAsync();
      }
    } catch (error) {
      console.error('Error resuming playback:', error);
    }
  }

  static formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}