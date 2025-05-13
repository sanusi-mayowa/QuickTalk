import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: "AIzaSyDKgoXFknzGcLi9hJLmRNRDEV4eQnMAdes",
    authDomain: "quicktalk-2025.firebaseapp.com",
    projectId: "quicktalk-2025",
    storageBucket: "quicktalk-2025.firebasestorage.app",
    messagingSenderId: "991687520715",
    appId: "1:991687520715:web:be4c6b824466c5e87f864e",
    measurementId: "G-E1C4860SLC"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Collection references
export const USERS_COLLECTION = 'users';
export const CONTACTS_COLLECTION = 'contacts';
export const MESSAGES_COLLECTION = 'messages';
export const CHATS_COLLECTION = 'chats';
export const STORIES_COLLECTION = 'stories';
export const STORY_VIEWS_COLLECTION = 'story_views';
export const MESSAGE_REACTIONS_COLLECTION = 'message_reactions';
export const STARRED_MESSAGES_COLLECTION = 'starred_messages';
export const CHAT_SETTINGS_COLLECTION = 'chat_settings';
export const BLOCKED_USERS_COLLECTION = 'blocked_users';
export const GROUP_SETTINGS_COLLECTION = 'group_settings';