import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { CameraService, MediaResult } from '@/lib/camera';

interface MediaPickerProps {
  visible: boolean;
  onClose: () => void;
  onMediaSelected: (media: MediaResult) => void;
  allowVideo?: boolean;
  allowMultiple?: boolean;
}

export default function MediaPicker({
  visible,
  onClose,
  onMediaSelected,
  allowVideo = true,
  allowMultiple = false,
}: MediaPickerProps) {
  const handleTakePhoto = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Camera is not available on web platform');
      return;
    }

    const result = await CameraService.takePhoto({
      quality: 0.8,
      allowsEditing: true,
    });

    if (result) {
      onMediaSelected(result);
      onClose();
    }
  };

  const handleRecordVideo = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Video recording is not available on web platform');
      return;
    }

    if (!allowVideo) return;

    const result = await CameraService.recordVideo({
      quality: 'high' as any,
      maxDuration: 60,
      allowsEditing: true,
    });

    if (result) {
      onMediaSelected(result);
      onClose();
    }
  };

  const handlePickFromLibrary = async () => {
    const result = await CameraService.pickImageFromLibrary({
      quality: 0.8,
      allowsEditing: true,
      allowsMultipleSelection: allowMultiple,
    });

    if (result) {
      if (Array.isArray(result)) {
        // Handle multiple selection
        result.forEach(media => onMediaSelected(media));
      } else {
        onMediaSelected(result);
      }
      onClose();
    }
  };

  const handlePickVideoFromLibrary = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Video selection is not available on web platform');
      return;
    }

    if (!allowVideo) return;

    const result = await CameraService.pickVideoFromLibrary({
      allowsEditing: true,
    });

    if (result) {
      onMediaSelected(result);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Select Media</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Feather name='x' size={24} color="#000" />
            </TouchableOpacity>
          </View>

          {/* Options */}
          <View style={styles.options}>
            <TouchableOpacity style={styles.option} onPress={handleTakePhoto}>
              <View style={[styles.optionIcon, { backgroundColor: '#25D366' }]}>
                <Feather name='camera' size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.optionText}>Camera</Text>
            </TouchableOpacity>

            {allowVideo && (
              <TouchableOpacity style={styles.option} onPress={handleRecordVideo}>
                <View style={[styles.optionIcon, { backgroundColor: '#FF3B30' }]}>
                  <Feather name='video' size={24} color="#FFFFFF" />
                </View>
                <Text style={styles.optionText}>Video</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.option} onPress={handlePickFromLibrary}>
              <View style={[styles.optionIcon, { backgroundColor: '#007AFF' }]}>
                <Feather name='image' size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.optionText}>Photo Library</Text>
            </TouchableOpacity>

            {allowVideo && (
              <TouchableOpacity style={styles.option} onPress={handlePickVideoFromLibrary}>
                <View style={[styles.optionIcon, { backgroundColor: '#FF9500' }]}>
                  <Feather name='video' size={24} color="#FFFFFF" />
                </View>
                <Text style={styles.optionText}>Video Library</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34, // Safe area padding
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  closeButton: {
    padding: 4,
  },
  options: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  option: {
    alignItems: 'center',
    flex: 1,
  },
  optionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
    textAlign: 'center',
  },
});