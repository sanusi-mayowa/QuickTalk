import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = 'https://fklndjdqlzeymfiuyxyr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrbG5kamRxbHpleW1maXV5eHlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2NzE3MzQsImV4cCI6MjA2NjI0NzczNH0.ES0WNSfQSUdaD6edUZZCi6QQv3ryzsJDGb-dhLrDlo8';

let supabase;

if (Platform.OS === 'web') {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

export { supabase };
