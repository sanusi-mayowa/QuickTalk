
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://olfnfnydntkvlrvaqegz.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZm5mbnlkbnRrdmxydmFxZWd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4NDkyOTEsImV4cCI6MjA2NDQyNTI5MX0.vQsSkJve-ikB1-t4wRkzN2SnVWApFOwPbmH0x2wNm6s'
export const supabase = createClient(supabaseUrl, supabaseKey)

export const USERS_TABLE = 'users';
export const CONTACTS_TABLE = 'contacts';
export const MESSAGES_TABLE = 'messages';
export const CHATS_TABLE = 'chats';
export const STORIES_TABLE = 'stories';
export const STORY_VIEWS_TABLE = 'story_views';
export const MESSAGE_REACTIONS_TABLE = 'message_reactions';
export const STARRED_MESSAGES_TABLE = 'starred_messages';
export const CHAT_SETTINGS_TABLE = 'chat_settings';
export const BLOCKED_USERS_TABLE = 'blocked_users';
export const GROUP_SETTINGS_TABLE = 'group_settings';
