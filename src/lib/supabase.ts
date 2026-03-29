import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types
export interface User {
  id: string;
  username: string;
  display_name: string;
  bio?: string | null;
  profile_img_url?: string | null;
  cover_img_url?: string | null;
  music_url?: string | null;
  music_name?: string | null;
  birthday?: string | null;
  occupation?: string | null;
  address?: string | null;
  workplace?: string | null;
  theme_color?: string | null;
  bg_style?: string | null;
  hobbies?: any;
  relationship_status?: string | null;
  relationship_custom_name?: string | null;
  is_online?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  author_id: string;
  target_id: string;
  content: string;
  image_url?: string | null;
  images?: string[] | null;
  mood?: string | null;
  activity?: string | null;
  location?: string | null;
  created_at: string;
  author?: User;
  target?: User;
}

export interface Friendship {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted';
  created_at: string;
  sender?: User;
  receiver?: User;
}

export interface ProfileView {
  id: string;
  profile_id: string;
  visitor_id: string;
  viewed_at: string;
  visitor?: User;
}

export interface ChatRoom {
  id: string;
  name?: string;
  is_group: boolean;
  theme_color?: string;
  group_img_url?: string | null;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMember {
  id: string;
  room_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  last_read_at: string;
  unread_count: number;
  user?: User;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string | null;
  images: string[] | null;
  event?: string | null;
  deleted_by?: string[];
  created_at: string;
  updated_at?: string;
  sender?: User;
}

export interface Notification {
  id: string;
  receiver_id: string;
  sender_id: string;
  type: 'like' | 'comment' | 'reply' | 'comment_like' | 'friend_request' | 'friend_accept' | 'post_on_profile' | 'tag_post' | 'tag_comment' | 'message';
  is_read: boolean;
  post_id?: string;
  comment_id?: string;
  deleted_by?: string[];
  created_at: string;
  sender?: User;
  post?: {
    id: string;
    content: string;
    author_id: string;
  };
  comment?: {
    id: string;
    content: string;
    author_id: string;
  };
}
