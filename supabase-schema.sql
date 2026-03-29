-- Ribbi Database Schema v3 - Advanced Features

-- =============================================
-- USERS TABLE (Extended)
-- =============================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  bio TEXT,
  profile_img_url TEXT,
  cover_img_url TEXT,
  music_url TEXT,
  birthday DATE,
  occupation VARCHAR(100),
  address VARCHAR(200),
  workplace VARCHAR(100),
  theme_color VARCHAR(7) DEFAULT '#9de5a8',
  bg_style VARCHAR(50) DEFAULT 'solid',
  push_token TEXT,
  
  -- NEW: Relationship Status
  relationship_status VARCHAR(50), -- 'single', 'in_relationship', 'engaged', 'married', 'complicated', 'custom'
  relationship_with_id UUID REFERENCES users(id) ON DELETE SET NULL, -- ถ้าเลือกคนใน Ribbi
  relationship_custom_name VARCHAR(100), -- ถ้าใส่ชื่อเอง
  relationship_custom_status VARCHAR(100), -- ถ้าใส่สถานะเอง
  
  -- NEW: Hobbies (stored as JSON array)
  hobbies JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- POSTS TABLE (Extended)
-- =============================================
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  target_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  
  -- NEW: Post Types & Rich Content
  post_type VARCHAR(20) DEFAULT 'text', -- 'text', 'poll', 'youtube', 'link'
  
  -- Poll data (if post_type = 'poll')
  poll_data JSONB, -- { "question": "...", "options": ["A", "B", "C"], "multiple": false }
  
  -- YouTube data (if post_type = 'youtube')
  youtube_url TEXT,
  youtube_id VARCHAR(50), -- extracted video ID
  
  -- Link data (if post_type = 'link')
  link_url TEXT,
  link_title TEXT,
  link_description TEXT,
  link_image TEXT,
  
  -- Feeling & Activity
  feeling VARCHAR(50), -- 'happy', 'sad', 'excited', 'loved', etc.
  activity VARCHAR(100), -- 'eating', 'watching', 'playing', 'reading', etc.
  activity_detail VARCHAR(200), -- 'eating at KFC', 'watching Avengers', etc.
  
  -- Check-in / Location
  location_name VARCHAR(200),
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- POST TAGS (Tagged Friends)
-- =============================================
CREATE TABLE post_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  tagged_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, tagged_user_id)
);

-- =============================================
-- POLL VOTES
-- =============================================
CREATE TABLE poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  option_index INT NOT NULL, -- index of the selected option in poll_data.options
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, user_id, option_index) -- Allow multiple votes if poll allows
);

-- =============================================
-- CHAT ROOMS (Extended for Group Chat)
-- =============================================
CREATE TABLE chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200),
  is_group BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- NEW: Group Chat Features
  group_image_url TEXT, -- รูปประจำกลุ่ม
  group_description TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- EXISTING TABLES (No Changes)
-- =============================================

CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(sender_id, receiver_id)
);

CREATE TABLE profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  visitor_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  -- NEW: Group Chat Role
  role VARCHAR(20) DEFAULT 'member', -- 'admin', 'member'
  
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  message_text TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE message_read_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receiver_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  is_read BOOLEAN DEFAULT false,
  link_url TEXT,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================

-- Posts indexes
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_target ON posts(target_id);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
CREATE INDEX idx_posts_type ON posts(post_type);
CREATE INDEX idx_posts_location ON posts(location_lat, location_lng) WHERE location_lat IS NOT NULL;

-- Post tags indexes
CREATE INDEX idx_post_tags_post ON post_tags(post_id);
CREATE INDEX idx_post_tags_user ON post_tags(tagged_user_id);

-- Poll votes indexes
CREATE INDEX idx_poll_votes_post ON poll_votes(post_id);
CREATE INDEX idx_poll_votes_user ON poll_votes(user_id);

-- Users indexes
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_relationship_with ON users(relationship_with_id) WHERE relationship_with_id IS NOT NULL;

-- Chat indexes
CREATE INDEX idx_chat_rooms_updated ON chat_rooms(updated_at DESC);
CREATE INDEX idx_chat_rooms_is_group ON chat_rooms(is_group);
CREATE INDEX idx_chat_members_room ON chat_members(room_id);
CREATE INDEX idx_chat_members_user ON chat_members(user_id);
CREATE INDEX idx_messages_room ON messages(room_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

-- Other indexes
CREATE INDEX idx_friendships_sender ON friendships(sender_id);
CREATE INDEX idx_friendships_receiver ON friendships(receiver_id);
CREATE INDEX idx_profile_views_profile ON profile_views(profile_id);
CREATE INDEX idx_profile_views_viewed_at ON profile_views(viewed_at DESC);
CREATE INDEX idx_message_read_receipts_message ON message_read_receipts(message_id);
CREATE INDEX idx_message_read_receipts_user ON message_read_receipts(user_id);
CREATE INDEX idx_notifications_receiver ON notifications(receiver_id);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(receiver_id, is_read);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users Policies
CREATE POLICY "Users are viewable by everyone" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);

-- Posts Policies
CREATE POLICY "Posts are viewable by everyone" ON posts FOR SELECT USING (true);
CREATE POLICY "Users can create posts" ON posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can delete own posts" ON posts FOR DELETE USING (auth.uid() = author_id);
CREATE POLICY "Users can update own posts" ON posts FOR UPDATE USING (auth.uid() = author_id);

-- Post Tags Policies
CREATE POLICY "Post tags are viewable by everyone" ON post_tags FOR SELECT USING (true);
CREATE POLICY "Post author can tag users" ON post_tags FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM posts WHERE id = post_id AND author_id = auth.uid())
);
CREATE POLICY "Post author can remove tags" ON post_tags FOR DELETE USING (
  EXISTS (SELECT 1 FROM posts WHERE id = post_id AND author_id = auth.uid())
);

-- Poll Votes Policies
CREATE POLICY "Poll votes are viewable by everyone" ON poll_votes FOR SELECT USING (true);
CREATE POLICY "Users can vote on polls" ON poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their votes" ON poll_votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their votes" ON poll_votes FOR DELETE USING (auth.uid() = user_id);

-- Friendships Policies
CREATE POLICY "Friendships are viewable by involved users" ON friendships FOR SELECT USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);
CREATE POLICY "Users can create friendship requests" ON friendships FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update received requests" ON friendships FOR UPDATE USING (auth.uid() = receiver_id);

-- Profile Views Policies
CREATE POLICY "Users can track profile views" ON profile_views FOR INSERT WITH CHECK (auth.uid() = visitor_id);
CREATE POLICY "Users can see who viewed their profile" ON profile_views FOR SELECT USING (auth.uid() = profile_id);

-- Chat Rooms Policies
CREATE POLICY "Users can view their chat rooms" ON chat_rooms FOR SELECT USING (
  EXISTS (SELECT 1 FROM chat_members WHERE room_id = chat_rooms.id AND user_id = auth.uid())
);
CREATE POLICY "Users can create chat rooms" ON chat_rooms FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Room admins can update room" ON chat_rooms FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM chat_members 
    WHERE room_id = chat_rooms.id AND user_id = auth.uid() AND role = 'admin'
  )
);

-- Chat Members Policies
CREATE POLICY "Users can view chat members" ON chat_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM chat_members cm WHERE cm.room_id = chat_members.room_id AND cm.user_id = auth.uid())
);
CREATE POLICY "Room admins can add members" ON chat_members FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM chat_members 
    WHERE room_id = chat_members.room_id AND user_id = auth.uid() AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM chat_rooms WHERE id = room_id AND created_by = auth.uid()
  )
);
CREATE POLICY "Users can update their own chat member record" ON chat_members FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Room admins can remove members" ON chat_members FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM chat_members cm
    WHERE cm.room_id = chat_members.room_id AND cm.user_id = auth.uid() AND cm.role = 'admin'
  )
);

-- Messages Policies
CREATE POLICY "Users can view messages in their rooms" ON messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM chat_members WHERE room_id = messages.room_id AND user_id = auth.uid())
);
CREATE POLICY "Users can send messages to their rooms" ON messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND EXISTS (
    SELECT 1 FROM chat_members WHERE room_id = messages.room_id AND user_id = auth.uid()
  )
);

-- Message Read Receipts Policies
CREATE POLICY "Users can view read receipts for their messages" ON message_read_receipts FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM messages m 
    JOIN chat_members cm ON cm.room_id = m.room_id 
    WHERE m.id = message_read_receipts.message_id AND cm.user_id = auth.uid()
  )
);
CREATE POLICY "Users can create read receipts" ON message_read_receipts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Notifications Policies
CREATE POLICY "Users can view their notifications" ON notifications FOR SELECT USING (auth.uid() = receiver_id);
CREATE POLICY "Users can update their notifications" ON notifications FOR UPDATE USING (auth.uid() = receiver_id);
CREATE POLICY "System can create notifications" ON notifications FOR INSERT WITH CHECK (true);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Get Recent Visitors
CREATE OR REPLACE FUNCTION get_recent_visitors(p_profile_id UUID)
RETURNS TABLE (
  visitor_id UUID,
  username VARCHAR,
  display_name VARCHAR,
  profile_img_url TEXT,
  viewed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (pv.visitor_id)
    pv.visitor_id,
    u.username,
    u.display_name,
    u.profile_img_url,
    pv.viewed_at
  FROM profile_views pv
  JOIN users u ON u.id = pv.visitor_id
  WHERE pv.profile_id = p_profile_id
  ORDER BY pv.visitor_id, pv.viewed_at DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Create DM Room
CREATE OR REPLACE FUNCTION create_dm_room(user1_id UUID, user2_id UUID)
RETURNS UUID AS $$
DECLARE
  existing_room_id UUID;
  new_room_id UUID;
BEGIN
  SELECT cr.id INTO existing_room_id
  FROM chat_rooms cr
  WHERE cr.is_group = false
    AND EXISTS (SELECT 1 FROM chat_members WHERE room_id = cr.id AND user_id = user1_id)
    AND EXISTS (SELECT 1 FROM chat_members WHERE room_id = cr.id AND user_id = user2_id)
  LIMIT 1;
  
  IF existing_room_id IS NOT NULL THEN
    RETURN existing_room_id;
  END IF;
  
  INSERT INTO chat_rooms (is_group, created_by) VALUES (false, user1_id) RETURNING id INTO new_room_id;
  INSERT INTO chat_members (room_id, user_id, role) VALUES (new_room_id, user1_id, 'admin');
  INSERT INTO chat_members (room_id, user_id, role) VALUES (new_room_id, user2_id, 'admin');
  
  RETURN new_room_id;
END;
$$ LANGUAGE plpgsql;

-- Create Group Chat Room
CREATE OR REPLACE FUNCTION create_group_room(
  p_creator_id UUID,
  p_name VARCHAR,
  p_description TEXT,
  p_image_url TEXT,
  p_member_ids UUID[]
)
RETURNS UUID AS $$
DECLARE
  new_room_id UUID;
  member_id UUID;
BEGIN
  -- Create room
  INSERT INTO chat_rooms (is_group, created_by, name, group_description, group_image_url)
  VALUES (true, p_creator_id, p_name, p_description, p_image_url)
  RETURNING id INTO new_room_id;
  
  -- Add creator as admin
  INSERT INTO chat_members (room_id, user_id, role)
  VALUES (new_room_id, p_creator_id, 'admin');
  
  -- Add other members
  FOREACH member_id IN ARRAY p_member_ids
  LOOP
    IF member_id != p_creator_id THEN
      INSERT INTO chat_members (room_id, user_id, role)
      VALUES (new_room_id, member_id, 'member');
    END IF;
  END LOOP;
  
  RETURN new_room_id;
END;
$$ LANGUAGE plpgsql;

-- Get Unread Message Count
CREATE OR REPLACE FUNCTION get_unread_message_count(p_user_id UUID, p_room_id UUID)
RETURNS INTEGER AS $$
DECLARE
  last_read TIMESTAMP WITH TIME ZONE;
  unread_count INTEGER;
BEGIN
  SELECT last_read_at INTO last_read
  FROM chat_members
  WHERE user_id = p_user_id AND room_id = p_room_id;
  
  SELECT COUNT(*) INTO unread_count
  FROM messages
  WHERE room_id = p_room_id AND created_at > last_read AND sender_id != p_user_id;
  
  RETURN unread_count;
END;
$$ LANGUAGE plpgsql;

-- Get Poll Results
CREATE OR REPLACE FUNCTION get_poll_results(p_post_id UUID)
RETURNS TABLE (
  option_index INT,
  vote_count BIGINT,
  percentage DECIMAL(5,2)
) AS $$
DECLARE
  total_votes BIGINT;
BEGIN
  SELECT COUNT(*) INTO total_votes FROM poll_votes WHERE post_id = p_post_id;
  
  RETURN QUERY
  SELECT 
    pv.option_index,
    COUNT(*)::BIGINT as vote_count,
    CASE 
      WHEN total_votes > 0 THEN (COUNT(*)::DECIMAL / total_votes * 100)
      ELSE 0
    END as percentage
  FROM poll_votes pv
  WHERE pv.post_id = p_post_id
  GROUP BY pv.option_index
  ORDER BY pv.option_index;
END;
$$ LANGUAGE plpgsql;

-- Auto-create User Profile Trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'User')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
