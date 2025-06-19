
import { createClient } from '@supabase/supabase-js'
// import 'react-native-url-polyfill/auto';

const supabaseUrl = 'https://olfnfnydntkvlrvaqegz.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZm5mbnlkbnRrdmxydmFxZWd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4NDkyOTEsImV4cCI6MjA2NDQyNTI5MX0.vQsSkJve-ikB1-t4wRkzN2SnVWApFOwPbmH0x2wNm6s'
export const supabase = createClient(supabaseUrl, supabaseKey)