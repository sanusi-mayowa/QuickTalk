export interface User {
  id: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  display_name?: string;
  status_message?: string;
  last_seen?: string;
  is_online?: boolean;
  push_token?: string;
  notification_settings?: {
    messages: boolean;
    calls: boolean;
    groups: boolean;
    sound: boolean;
    vibration: boolean;
  };
  privacy_settings?: {
    last_seen: 'everyone' | 'contacts' | 'nobody';
    profile_photo: 'everyone' | 'contacts' | 'nobody';
    about: 'everyone' | 'contacts' | 'nobody';
    status: 'contacts' | 'contacts_except' | 'only_share_with';
    read_receipts: boolean;
    groups: 'everyone' | 'contacts' | 'nobody';
  };
  created_at: string;
  updated_at?: string;
}

export interface Chat {
  id: string;
  name?: string;
  description?: string;
  is_group: boolean;
  avatar_url?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  last_message?: Message;
}

export interface ChatParticipant {
  id: string;
  chat_id: string;
  user_id: string;
  is_admin?: boolean;
  joined_at: string;
  left_at?: string;
  user?: User;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location';
  media_url?: string;
  media_thumbnail?: string;
  reply_to_id?: string;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  sender?: User;
  reply_to?: Message;
}

export interface MessageRead {
  id: string;
  message_id: string;
  user_id: string;
  read_at: string;
}

export interface StatusUpdate {
  id: string;
  user_id: string;
  content: string;
  media_url?: string;
  media_type: 'text' | 'image' | 'video';
  background_color?: string;
  font_style?: string;
  views_count: number;
  created_at: string;
  expires_at: string;
  user?: User;
}

export interface StatusView {
  id: string;
  status_id: string;
  viewer_id: string;
  viewed_at: string;
}