# Offline Authentication System

## Overview

This system prevents users from being logged out when there's no network connection by caching user profile data to local storage and providing fallback mechanisms for offline operation.

## How It Works

### 1. User Profile Caching

The `useOfflineAuth` hook automatically caches user profile data to AsyncStorage whenever it's fetched from Firestore. This includes:
- User ID
- Username
- Profile picture URL
- Phone number
- Email
- Profile completion status
- Other profile fields

### 2. Cache Expiry

User profiles are cached for 24 hours by default. After this time, the system will attempt to refresh the data when online.

### 3. Offline Fallback

When the app is offline:
- It first tries to load the user profile from cache
- If a valid cached profile exists, the user can continue using the app
- If no cache exists, the user is redirected to login (but not automatically logged out)

### 4. Network State Monitoring

The system continuously monitors network connectivity using NetInfo and:
- Automatically refreshes cached data when coming back online
- Falls back to cached data when going offline
- Provides real-time network status to components

## Implementation Details

### Files Modified

1. **`hooks/useOfflineAuth.ts`** - New hook for offline authentication
2. **`app/index.tsx`** - Updated splash screen to use offline auth
3. **`app/chat/[id].tsx`** - Updated chat screen to use offline auth
4. **`app/settings.tsx`** - Updated settings to clear cache on logout
5. **`app/(tabs)/index.tsx`** - Updated main tabs to use offline auth

### Key Functions

- `loadCachedUserProfile()` - Loads user profile from AsyncStorage
- `cacheUserProfile()` - Saves user profile to AsyncStorage
- `loadUserProfile()` - Fetches user profile from Firestore (online only)
- `clearCachedProfile()` - Removes cached profile (used on logout)
- `initializeUserProfile()` - Main function that tries cache first, then online

## Usage

### Basic Usage

```typescript
import { useOfflineAuth } from '@/hooks/useOfflineAuth';

function MyComponent() {
  const { 
    currentUser, 
    isOnline, 
    isLoading, 
    error,
    initializeUserProfile,
    clearCachedProfile 
  } = useOfflineAuth();

  // currentUser will contain cached profile if offline
  // isOnline indicates network connectivity
  // initializeUserProfile() tries cache first, then online
}
```

### In Authentication Flow

```typescript
// In splash screen or auth check
const checkAuth = async () => {
  if (auth.currentUser) {
    await initializeUserProfile();
    
    if (currentUser) {
      // User has valid profile (cached or fresh)
      router.replace("/(tabs)");
    } else if (error === "No cached profile available offline") {
      // Offline and no cache - show appropriate message
      // Don't automatically logout
    }
  }
};
```

## Benefits

1. **No More Offline Logouts** - Users stay logged in even without network
2. **Better User Experience** - App continues to function offline
3. **Automatic Sync** - Data refreshes when network returns
4. **Seamless Transitions** - Users don't notice network changes
5. **Data Persistence** - Important user data survives app restarts

## Cache Management

### Storage Keys

- `cached_user_profile` - User profile data
- `cached_user_profile_timestamp` - Cache creation time

### Cache Invalidation

- Cache expires after 24 hours
- Cache is cleared on logout
- Cache is refreshed when coming back online

## Error Handling

The system gracefully handles various scenarios:

- **Network Unavailable** - Falls back to cached data
- **Cache Expired** - Attempts online refresh, falls back to expired cache if offline
- **No Cache Available** - Shows appropriate offline message
- **Firestore Errors** - Falls back to cached data when possible

## Security Considerations

- Cached data is stored locally on device
- Sensitive data should not be cached
- Cache is cleared on logout
- Cache has expiration to prevent stale data

## Future Enhancements

1. **Selective Caching** - Cache only non-sensitive profile fields
2. **Compression** - Compress cached data to save storage
3. **Background Sync** - Sync data in background when online
4. **Conflict Resolution** - Handle conflicts between cached and server data
5. **Cache Analytics** - Track cache hit rates and performance
