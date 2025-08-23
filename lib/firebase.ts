import { Platform } from 'react-native';
import { initializeApp, getApps, getApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getAuth, initializeAuth, type Auth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your Firebase config is now here instead of app.json
const firebaseConfig: FirebaseOptions = {
    apiKey: "AIzaSyDSbG7pWUe_EX9r2wU_AVnPdGgGSUrXYl4",
    authDomain: "quicktalk-chat.firebaseapp.com",
    projectId: "quicktalk-chat",
    storageBucket: "quicktalk-chat.firebasestorage.app",
    messagingSenderId: "1014653996428",
    appId: "1:1014653996428:web:d1398f5a5614c817fedaa9",
    measurementId: "G-R624FK66Y6"
  };

function createFirebaseApp(): FirebaseApp {
  const apps = getApps();
  if (apps.length) return getApp();
  return initializeApp(firebaseConfig);
}

function createAuth(app: FirebaseApp): Auth {
  // Use React Native persistence on native; default web persistence in browser
  if (Platform.OS === 'web') {
    return getAuth(app);
  }
  return initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

const app = createFirebaseApp();
const auth = createAuth(app);
const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);

export { app as firebaseApp, auth, db, storage };
