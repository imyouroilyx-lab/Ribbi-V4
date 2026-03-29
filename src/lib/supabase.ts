import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types
export interface User {
  id: string;
  username: string;
  display_name: string;
  bio?: string;
  profile_img_url?: string;
  cover_img_url?: string;
  // เพิ่มข้อมูลเพลงเพื่อแก้ปัญหา Build Error บน Vercel
  music_url?: string;
  music_name?: string;
  birthday?: string;
  occupation?: string;
  address?: string;
  workplace?: string;
  theme_color?: string;
  bg_style?: string;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  author_id: string;
  target_id: string;
  content: string;
  image_url?: string;
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
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMember {
  id: string;
  room_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string;
  user?: User;
}

export interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  message_text: string;
  image_url?: string;
  created_at: string;
  sender?: User;
}

export interface Notification {
  id: string;
  receiver_id: string;
  sender_id?: string;
  // อัปเดตประเภทให้ครอบคลุมระบบแท็กและกิจกรรมต่าง ๆ
  type: 'like' | 'comment' | 'reply' | 'comment_like' | 'friend_request' | 'friend_accept' | 'post_on_profile' | 'tag_post' | 'tag_comment' | 'message';
  is_read: boolean;
  link_url?: string;
  content?: string;
  created_at: string;
  sender?: User;
}