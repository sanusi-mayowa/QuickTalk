import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import NetInfo from '@react-native-community/netinfo';

interface UserProfile {
  id: string;
  auth_user_id: string;
  username: string;
  about?: string;
  profile_picture_url?: string | null;
  phone: string;
  email?: string;
  is_profile_complete?: boolean;
  [key: string]: any;
}

interface OfflineAuthState {
  isOnline: boolean;
  currentUser: UserProfile | null;
  isLoading: boolean;
  error: string | null;
}

const USER_PROFILE_CACHE_KEY = 'cached_user_profile';
const USER_PROFILE_TIMESTAMP_KEY = 'cached_user_profile_timestamp';
const CACHE_EXPIRY_HOURS = 24; // Cache user profile for 24 hours

export function useOfflineAuth() {
  const [state, setState] = useState<OfflineAuthState>({
    isOnline: true,
    currentUser: null,
    isLoading: true,
    error: null,
  });

  // Load cached user profile on mount
  useEffect(() => {
    loadCachedUserProfile();
  }, []);

  // Load user profile from cache
  const loadCachedUserProfile = useCallback(async () => {
    try {
      const [cachedProfile, timestamp] = await Promise.all([
        AsyncStorage.getItem(USER_PROFILE_CACHE_KEY),
        AsyncStorage.getItem(USER_PROFILE_TIMESTAMP_KEY),
      ]);

      if (cachedProfile && timestamp) {
        const profile = JSON.parse(cachedProfile);
        const cacheTime = parseInt(timestamp);
        const now = Date.now();
        const hoursSinceCache = (now - cacheTime) / (1000 * 60 * 60);

        // Check if cache is still valid
        if (hoursSinceCache < CACHE_EXPIRY_HOURS) {
          setState(prev => ({
            ...prev,
            currentUser: profile,
            isLoading: false,
          }));
          return true;
        }
      }
    } catch (error) {
      console.error('Error loading cached profile:', error);
    }

    return false;
  }, []);

  // Cache user profile to local storage
  const cacheUserProfile = useCallback(async (profile: UserProfile) => {
    try {
      const timestamp = Date.now().toString();
      await Promise.all([
        AsyncStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify(profile)),
        AsyncStorage.setItem(USER_PROFILE_TIMESTAMP_KEY, timestamp),
      ]);
    } catch (error) {
      console.error('Error caching user profile:', error);
    }
  }, []);

  // Load user profile from Firestore
  const loadUserProfile = useCallback(async (): Promise<UserProfile | null> => {
    try {
      const user = auth.currentUser;
      if (!user) return null;

      const q = query(
        collection(db, 'user_profiles'),
        where('auth_user_id', '==', user.uid)
      );
      const snap = await getDocs(q);
      const profile = snap.docs[0]?.data() as UserProfile | undefined;

      if (profile) {
        const fullProfile = {
          ...profile,
          id: snap.docs[0].id,
        };
        
        // Cache the profile for offline use
        await cacheUserProfile(fullProfile);
        return fullProfile;
      }

      return null;
    } catch (error) {
      console.error('Error loading user profile:', error);
      return null;
    }
  }, [cacheUserProfile]);

  // Refresh user profile (online only)
  const refreshUserProfile = useCallback(async () => {
    if (!state.isOnline) return;

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      const profile = await loadUserProfile();
      
      setState(prev => ({
        ...prev,
        currentUser: profile,
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to refresh profile',
      }));
    }
  }, [state.isOnline, loadUserProfile]);

  // Initialize user profile (tries cache first, then online)
  const initializeUserProfile = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // First try to load from cache
      const hasCachedProfile = await loadCachedUserProfile();
      
      if (hasCachedProfile) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // If no cache or cache expired, try to load from Firestore
      if (state.isOnline) {
        const profile = await loadUserProfile();
        setState(prev => ({
          ...prev,
          currentUser: profile,
          isLoading: false,
          error: null,
        }));
      } else {
        // Offline and no cache, show error
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'No cached profile available offline',
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to initialize profile',
      }));
    }
  }, [state.isOnline, loadCachedUserProfile, loadUserProfile]);

  // Clear cached profile (useful for logout)
  const clearCachedProfile = useCallback(async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(USER_PROFILE_CACHE_KEY),
        AsyncStorage.removeItem(USER_PROFILE_TIMESTAMP_KEY),
      ]);
      setState(prev => ({ ...prev, currentUser: null }));
    } catch (error) {
      console.error('Error clearing cached profile:', error);
    }
  }, []);

  // Check if user has a valid profile (online or cached)
  const hasValidProfile = useCallback(() => {
    return !!state.currentUser && state.currentUser.is_profile_complete;
  }, [state.currentUser]);

  // Check network connectivity (moved here to avoid circular dependencies)
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((networkState) => {
      const isOnline = networkState.isConnected || false;
      setState(prev => {
        // If we just came online and have cached data, try to refresh
        if (isOnline && !prev.isOnline && prev.currentUser) {
          // Use setTimeout to avoid calling refreshUserProfile during state update
          setTimeout(() => {
            refreshUserProfile();
          }, 0);
        }
        return { ...prev, isOnline };
      });
    });

    return unsubscribe;
  }, [refreshUserProfile]);

  return {
    ...state,
    loadUserProfile,
    refreshUserProfile,
    initializeUserProfile,
    clearCachedProfile,
    hasValidProfile,
    loadCachedUserProfile,
  };
}
