import * as ImagePicker from 'expo-image-picker';
import { CameraType } from 'expo-camera';
import { Platform } from 'react-native';

export interface MediaResult {
  uri: string;
  type: 'image' | 'video';
  width?: number;
  height?: number;
  duration?: number;
  fileSize?: number;
}

export class CameraService {
  static async requestPermissions(): Promise<{
    camera: boolean;
    mediaLibrary: boolean;
  }> {
    if (Platform.OS === 'web') {
      return { camera: false, mediaLibrary: false };
    }

    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    const mediaLibraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    return {
      camera: cameraPermission.status === 'granted',
      mediaLibrary: mediaLibraryPermission.status === 'granted',
    };
  }

  static async takePhoto(options?: {
    quality?: number;
    allowsEditing?: boolean;
    aspect?: [number, number];
  }): Promise<MediaResult | null> {
    try {
      if (Platform.OS === 'web') {
        // Web fallback - use file input
        return await this.pickImageFromLibrary(options);
      }

      const permissions = await this.requestPermissions();
      if (!permissions.camera) {
        throw new Error('Camera permission not granted');
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: options?.allowsEditing ?? true,
        aspect: options?.aspect ?? [4, 3],
        quality: options?.quality ?? 0.8,
      });

      if (result.canceled || !result.assets[0]) {
        return null;
      }

      const asset = result.assets[0];
      return {
        uri: asset.uri,
        type: 'image',
        width: asset.width,
        height: asset.height,
        fileSize: asset.fileSize,
      };
    } catch (error) {
      console.error('Error taking photo:', error);
      return null;
    }
  }

  static async recordVideo(options?: {
    quality?: ImagePicker.VideoQuality;
    maxDuration?: number;
    allowsEditing?: boolean;
  }): Promise<MediaResult | null> {
    try {
      if (Platform.OS === 'web') {
        // Web doesn't support video recording through ImagePicker
        return null;
      }

      const permissions = await this.requestPermissions();
      if (!permissions.camera) {
        throw new Error('Camera permission not granted');
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: options?.allowsEditing ?? true,
        videoQuality: options?.quality ?? ImagePicker.VideoQuality.High,
        videoMaxDuration: options?.maxDuration ?? 60,
      });

      if (result.canceled || !result.assets[0]) {
        return null;
      }

      const asset = result.assets[0];
      return {
        uri: asset.uri,
        type: 'video',
        width: asset.width,
        height: asset.height,
        duration: asset.duration,
        fileSize: asset.fileSize,
      };
    } catch (error) {
      console.error('Error recording video:', error);
      return null;
    }
  }

  static async pickImageFromLibrary(options?: {
    quality?: number;
    allowsEditing?: boolean;
    aspect?: [number, number];
    allowsMultipleSelection?: boolean;
  }): Promise<MediaResult | MediaResult[] | null> {
    try {
      const permissions = await this.requestPermissions();
      if (!permissions.mediaLibrary && Platform.OS !== 'web') {
        throw new Error('Media library permission not granted');
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: options?.allowsEditing ?? true,
        aspect: options?.aspect ?? [4, 3],
        quality: options?.quality ?? 0.8,
        allowsMultipleSelection: options?.allowsMultipleSelection ?? false,
      });

      if (result.canceled || !result.assets.length) {
        return null;
      }

      const assets = result.assets.map(asset => ({
        uri: asset.uri,
        type: 'image' as const,
        width: asset.width,
        height: asset.height,
        fileSize: asset.fileSize,
      }));

      return options?.allowsMultipleSelection ? assets : assets[0];
    } catch (error) {
      console.error('Error picking image from library:', error);
      return null;
    }
  }

  static async pickVideoFromLibrary(options?: {
    quality?: ImagePicker.VideoQuality;
    allowsEditing?: boolean;
  }): Promise<MediaResult | null> {
    try {
      if (Platform.OS === 'web') {
        // Limited web support for video
        return null;
      }

      const permissions = await this.requestPermissions();
      if (!permissions.mediaLibrary) {
        throw new Error('Media library permission not granted');
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: options?.allowsEditing ?? true,
        videoQuality: options?.quality ?? ImagePicker.VideoQuality.High,
      });

      if (result.canceled || !result.assets[0]) {
        return null;
      }

      const asset = result.assets[0];
      return {
        uri: asset.uri,
        type: 'video',
        width: asset.width,
        height: asset.height,
        duration: asset.duration,
        fileSize: asset.fileSize,
      };
    } catch (error) {
      console.error('Error picking video from library:', error);
      return null;
    }
  }

  static async uploadMedia(
    mediaUri: string,
    fileName: string,
    bucket: string = 'media'
  ): Promise<string | null> {
    try {
      // This would typically upload to Supabase Storage
      // For now, we'll return the local URI
      // In production, implement actual file upload
      
      // Example Supabase Storage upload:
      // const { data, error } = await supabase.storage
      //   .from(bucket)
      //   .upload(fileName, {
      //     uri: mediaUri,
      //     type: 'image/jpeg', // or appropriate type
      //     name: fileName,
      //   });
      
      // if (error) throw error;
      // return data.path;
      
      return mediaUri; // Return local URI for now
    } catch (error) {
      console.error('Error uploading media:', error);
      return null;
    }
  }
}