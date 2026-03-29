# 🐸 Ribbi Implementation Guide

## การติดตั้งและการใช้งาน

### 1. ติดตั้ง Dependencies
```bash
npm install
```

### 2. ตั้งค่า Supabase

#### สร้าง Supabase Project
1. ไปที่ https://app.supabase.com
2. สร้าง Project ใหม่
3. รอจน Project พร้อมใช้งาน

#### Import Database Schema
1. ไปที่ SQL Editor ใน Supabase Dashboard
2. Copy SQL จากไฟล์ `supabase-schema.sql`
3. Paste และ Run

Schema นี้จะสร้าง:
- **Tables**: users, posts, friendships, profile_views, chat_rooms, chat_members, messages, notifications
- **Indexes**: สำหรับ Performance
- **Row Level Security (RLS)**: สำหรับความปลอดภัย
- **Functions**: 
  - `get_recent_visitors()` - ดูผู้เยี่ยมชม 10 คนล่าสุด
  - `create_dm_room()` - สร้างห้องแชต DM อัตโนมัติ
  - `get_unread_message_count()` - นับข้อความที่ยังไม่อ่าน

### 3. ตั้งค่า Environment Variables
```bash
cp .env.example .env.local
```

แก้ไขค่าใน `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

หา URL และ Key ได้จาก: Supabase Dashboard → Settings → API

### 4. Run Development Server
```bash
npm run dev
```

เปิด http://localhost:3000

---

## Architecture Overview

### Frontend Stack
- **Next.js 14** (App Router) - React Framework
- **Tailwind CSS** - Utility-first CSS
- **TypeScript** - Type Safety
- **Lucide Icons** - Icon Library

### Backend Stack
- **Supabase** - Backend-as-a-Service
  - PostgreSQL Database
  - Real-time Subscriptions
  - Row Level Security
  - Authentication (ยังไม่ได้ implement)

### Key Design Patterns

#### 1. Real-time Updates
```typescript
// Subscribe to new messages
const subscription = supabase
  .channel('room-123')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: 'room_id=eq.123'
  }, (payload) => {
    // Handle new message
  })
  .subscribe();
```

#### 2. Notification System
```typescript
// Auto-notify when someone posts on your profile
await createNotification(
  profileOwnerId,
  postAuthorId,
  'post',
  '/profile/username'
);
```

#### 3. Unread Count Tracking
```typescript
// Track last read timestamp per room
await supabase
  .from('chat_members')
  .update({ last_read_at: new Date().toISOString() })
  .eq('room_id', roomId)
  .eq('user_id', currentUserId);
```

---

## Key Features Implemented

### ✅ Real-time Chat System
- **1-on-1 DM**: แชทส่วนตัวระหว่างผู้ใช้สองคน
- **Group Chat**: แชทกลุ่ม (โครงสร้างรองรับแล้ว, UI ยังไม่สมบูรณ์)
- **Message History**: เก็บประวัติข้อความทั้งหมด
- **Real-time Updates**: ใช้ Supabase Realtime
- **Unread Badges**: แสดงจำนวนข้อความที่ยังไม่อ่าน
- **Image Sharing**: รองรับส่งรูปภาพผ่าน URL

### ✅ Notification System
- **Types of Notifications**:
  - `post` - มีคนโพสต์บนหน้าโปรไฟล์
  - `friend_request` - ได้รับคำขอเป็นเพื่อน
  - `friend_accept` - คำขอเป็นเพื่อนได้รับการตอบรับ
  - `tag` - ถูกแท็กในโพสต์
  - `message` - มีข้อความใหม่
- **Real-time Updates**: แจ้งเตือนทันทีเมื่อมีเหตุการณ์
- **Sound Alert**: เสียง "Ribbit!" เมื่อมีการแจ้งเตือน
- **Read/Unread Status**: ติดตามสถานะการอ่าน
- **Badge Counts**: แสดงจำนวนการแจ้งเตือนบนเมนู

### ✅ Profile System
- **Dynamic Age Calculation**: คำนวณอายุอัตโนมัติจากวันเกิด
- **Custom Themes**: สีและพื้นหลังที่ปรับแต่งได้
- **Background Music**: YouTube player แบบซ่อน
- **Visitor Tracking**: แสดงผู้เยี่ยมชม 10 คนล่าสุด
- **Profile Wall**: โพสต์บนหน้าโปรไฟล์

---

## Database Design Highlights

### Chat Schema
```sql
chat_rooms
├── id (UUID)
├── name (VARCHAR) - สำหรับแชตกลุ่ม
├── is_group (BOOLEAN)
└── created_by (UUID)

chat_members
├── room_id (UUID) → chat_rooms
├── user_id (UUID) → users
└── last_read_at (TIMESTAMP) - ใช้คำนวณ unread count

messages
├── id (UUID)
├── room_id (UUID) → chat_rooms
├── sender_id (UUID) → users
├── message_text (TEXT)
├── image_url (TEXT)
└── created_at (TIMESTAMP)
```

### Notification Schema
```sql
notifications
├── id (UUID)
├── receiver_id (UUID) → users
├── sender_id (UUID) → users
├── type (VARCHAR) - post/friend_request/etc
├── is_read (BOOLEAN)
├── link_url (TEXT)
└── content (TEXT)
```

---

## Next Steps for Production

### 1. Authentication
- ต้อง implement Supabase Auth
- เปลี่ยน `MOCK_USER_ID` เป็น session จริง
- เพิ่ม Login/Register pages

### 2. Image Upload
- ใช้ Supabase Storage หรือ
- ใช้ third-party service (Imgur, ImageKit, Cloudinary)

### 3. Group Chat Management
- UI สำหรับสร้างกลุ่ม
- เพิ่ม/ลบสมาชิกกลุ่ม
- เปลี่ยนชื่อกลุ่ม

### 4. Advanced Features
- Typing indicators
- Read receipts
- Voice messages
- Reactions/Likes
- Comments บนโพสต์
- Search functionality

---

## Performance Optimization Tips

### 1. Database Indexes
- ใช้ indexes ที่มีอยู่แล้วใน schema
- Monitor slow queries ใน Supabase Dashboard

### 2. Real-time Subscriptions
- Unsubscribe เมื่อ component unmount
- ใช้ filters ให้เฉพาะเจาะจง

### 3. Image Loading
- ใช้ Next.js Image component
- Lazy load images
- ใช้ CDN สำหรับ user-uploaded images

### 4. Pagination
- Implement infinite scroll สำหรับ feeds
- Limit query results (ปัจจุบันใช้ LIMIT 50)

---

## Deployment Checklist

### Vercel Deployment
- [ ] Push code to GitHub
- [ ] Import project to Vercel
- [ ] Set environment variables
- [ ] Deploy

### Environment Variables (Production)
```
NEXT_PUBLIC_SUPABASE_URL=your_production_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_key
```

### Supabase Production Setup
- [ ] Enable Row Level Security
- [ ] Review RLS policies
- [ ] Set up backups
- [ ] Monitor usage

---

## Known Limitations

1. **No File Uploads**: ใช้ URL เท่านั้น (ประหยัด storage)
2. **No Email Verification**: ยังไม่มี auth system
3. **Basic Group Chat**: โครงสร้างรองรับแล้ว แต่ UI ยังไม่สมบูรณ์
4. **No Moderation Tools**: ยังไม่มีระบบ report/block
5. **Limited Media Support**: รองรับแค่รูปภาพ ไม่มี video/voice

---

## Support & Resources

- **Next.js Docs**: https://nextjs.org/docs
- **Supabase Docs**: https://supabase.com/docs
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Lucide Icons**: https://lucide.dev

---

## License
MIT License - Free to use and modify

Created with ❤️ for Roleplaying Communities
