# 🐸 Ribbi v3 - Complete Social Media Platform

**พร้อมใช้งานทันที! แตกไฟล์ → npm install → รัน**

---

## ✨ ฟีเจอร์ครบทุกอย่าง

### v3 Features (ใหม่!):
- ✅ **Group Chat** - สร้างกลุ่ม ใส่รูป ชื่อ คำอธิบาย
- ✅ **Poll** - โพลโหวต แสดงผลแบบ Real-time
- ✅ **Feeling/Activity** - แสดงอารมณ์และกิจกรรม
- ✅ **Check-in** - แนบสถานที่
- ✅ **Relationship Status** - สถานะความสัมพันธ์
- ✅ **Hobbies** - งานอดิเรก
- ✅ **Google Sans Font** - ฟอนต์สวยทั้งเว็บ

### v2 Features (มีอยู่แล้ว):
- ✅ Login/Register
- ✅ โพสต์ + รูป
- ✅ ลบโพสต์ตัวเอง
- ✅ แก้ไขโปรไฟล์
- ✅ แชท Real-time
- ✅ Read Receipts
- ✅ Push Notifications

---

## 🚀 เริ่มใช้งาน (3 ขั้นตอน)

### 1. แตกไฟล์
```bash
tar -xzf ribbi-v3-complete.tar.gz
cd ribbi-v3-complete
```

### 2. ติดตั้ง
```bash
npm install
```

### 3. ตั้งค่า Supabase
- สร้าง Project: https://supabase.com
- Run SQL: `supabase-schema.sql`
- เปิด Email auth
- สร้าง `.env.local`
- ใส่ URL และ KEY

### 4. รัน!
```bash
npm run dev
```

http://localhost:3000

---

## 📝 คำแนะนำสำคัญ

### ไฟล์ที่ต้องสร้างเอง:
```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key-here
```

### SQL ที่ต้อง Run:
- เปิด `supabase-schema.sql`
- Copy ทั้งหมด
- Paste ใน Supabase SQL Editor
- กด Run

---

## 🎨 ฟีเจอร์พิเศษ

### 📊 โพล
- ตั้งคำถาม
- เพิ่มตัวเลือก 2-10 ข้อ
- โหวตได้
- ดูผลแบบ Real-time

### 👥 Group Chat
- สร้างกลุ่ม
- ตั้งชื่อ + รูป
- เพิ่มเพื่อน
- Admin จัดการสมาชิก

### 😊 Feeling & Activity
- เลือกอารมณ์: 😊😢🤩🥰🙏🤪
- เลือกกิจกรรม: 🍽️📺🎮📖🎵✈️
- ใส่รายละเอียด

### 💑 Relationship
- เลือกสถานะ
- ใส่ชื่อคู่
- Link โปรไฟล์คู่ได้

### 🎯 Hobbies
- เพิ่มได้หลายอัน
- แสดงเป็น tags
- มี emoji

---

## 🗄️ Database (v3 Schema)

### Tables ใหม่:
- `post_tags` - แท็กเพื่อน
- `poll_votes` - โหวต

### Fields ใหม่:
- **posts**: poll_data, feeling, activity, location_name
- **users**: relationship_status, hobbies
- **chat_rooms**: group_image_url, group_description
- **chat_members**: role (admin/member)

---

## 🔧 การใช้งาน

### สร้างโพล:
1. สร้างโพสต์
2. กด 📊
3. ใส่คำถาม + ตัวเลือก
4. โพสต์

### สร้างกลุ่ม:
1. Messages → + → Create Group
2. ใส่ชื่อ, รูป, คำอธิบาย
3. เลือกเพื่อน
4. สร้าง

### เพิ่ม Feeling:
1. สร้างโพสต์
2. กด 😊
3. เลือกอารมณ์/กิจกรรม
4. โพสต์

---

## ✅ Checklist

- [ ] แตกไฟล์
- [ ] `npm install`
- [ ] สร้าง Supabase Project
- [ ] Run `supabase-schema.sql`
- [ ] สร้าง `.env.local`
- [ ] `npm run dev`
- [ ] สมัครสมาชิก
- [ ] ทดสอบทุกฟีเจอร์

---

Made with ❤️ + 🐸  
**พร้อมใช้งานแล้ว!**
"# ribbi-v3" 
