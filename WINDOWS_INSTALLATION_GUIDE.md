# 🐸 Ribbi v2 - คู่มือติดตั้งสำหรับ Windows (ฉบับสมบูรณ์)

## 🎯 สิ่งใหม่ในเวอร์ชัน 2

### ✨ ฟีเจอร์ใหม่:
- ✅ **ระบบ Login/Register** พร้อม Supabase Auth
- ✅ **ลบโพสต์** ของตัวเองได้
- ✅ **หน้า Edit Profile** แยกต่างหาก - ตกแต่งธีม + เปลี่ยนเพลง
- ✅ **Read Receipts** - แสดง "อ่านแล้วเมื่อ..."
- ✅ **Push Notifications** จริง (ใช้ Web Push API)
- ✅ ใช้ **URL รูปภาพ** เท่านั้น (ไม่มี upload)
- ✅ **Tailwind Config** เวอร์ชันล่าสุด (.js)

---

## 📌 สิ่งที่ต้องเตรียมก่อน (Windows)

### 1. ติดตั้ง Node.js

1. ไปที่ https://nodejs.org/
2. ดาวน์โหลด **LTS version** (แนะนำ v20.x.x)
3. เปิดไฟล์ `.msi` ที่ดาวน์โหลด
4. กด Next ไปเรื่อยๆ (ติ๊กถูกทุกอัน)
5. รอติดตั้งเสร็จ (2-3 นาที)

### 2. ติดตั้ง VS Code

1. ไปที่ https://code.visualstudio.com/
2. ดาวน์โหลด **Windows version**
3. ติดตั้งตามปกติ
4. เปิด VS Code

### 3. ติดตั้ง Git (ถ้ายังไม่มี)

1. ไปที่ https://git-scm.com/download/win
2. ดาวน์โหลดและติดตั้ง
3. ใช้ค่า default ทั้งหมด

### 4. ตรวจสอบว่าติดตั้งสำเร็จ

เปิด **Command Prompt** (กด Win+R → พิมพ์ `cmd` → Enter)

```bash
node --version
# ควรเห็น: v20.x.x

npm --version
# ควรเห็น: 10.x.x

git --version
# ควรเห็น: git version 2.x.x
```

✅ เห็นตัวเลขทั้ง 3 อัน = พร้อมแล้ว!

---

## 📦 ขั้นตอนที่ 1: แตกไฟล์โปรเจค

### วิธี 1: ใช้ 7-Zip (แนะนำ)

1. ดาวน์โหลด 7-Zip: https://www.7-zip.org/
2. ติดตั้ง 7-Zip
3. คลิกขวาที่ `ribbi-v2.tar.gz`
4. เลือก **7-Zip → Extract Here**
5. จะได้โฟลเดอร์ `ribbi-v2`

### วิธี 2: ใช้ Command Prompt

```bash
# ไปที่โฟลเดอร์ที่มีไฟล์ (เช่น Downloads)
cd C:\Users\YourName\Downloads

# แตกไฟล์ (ถ้ามี tar command)
tar -xzf ribbi-v2.tar.gz
```

---

## 🚀 ขั้นตอนที่ 2: เปิดโปรเจคใน VS Code

### วิธี 1: ใช้ VS Code

1. เปิด VS Code
2. กด **File → Open Folder**
3. เลือกโฟลเดอร์ `ribbi-v2`
4. กด **Select Folder**
5. ถ้าถาม "Do you trust..." → กด **Yes**

### วิธี 2: ใช้ Command Prompt

```bash
# ไปที่โฟลเดอร์โปรเจค
cd C:\Users\YourName\Downloads\ribbi-v2

# เปิดด้วย VS Code
code .
```

---

## 📥 ขั้นตอนที่ 3: ติดตั้ง Dependencies

1. ใน VS Code กด **Terminal → New Terminal** (หรือ Ctrl+`)
2. พิมพ์คำสั่ง:

```bash
npm install
```

3. รอ 2-5 นาที (ขึ้นอยู่กับเน็ต)
4. เห็น `added 300+ packages` = สำเร็จ! ✅

**หากเจอ Error:**
```bash
# ลองอันนี้แทน
npm install --legacy-peer-deps
```

---

## 🗄️ ขั้นตอนที่ 4: ตั้งค่า Supabase

### 4.1 สร้างบัญชี Supabase

1. ไปที่ https://supabase.com
2. กด **Start your project**
3. Sign in with GitHub (หรือสร้าง account)

### 4.2 สร้าง Project

1. กด **New Project**
2. กรอกข้อมูล:

```
Name: ribbi-v2
Database Password: [ตั้งรหัสที่จำได้ง่าย เช่น Ribbi2024!]
Region: Southeast Asia (Singapore)
Plan: Free
```

3. กด **Create new project**
4. **รอ 2-3 นาที** (จะมี loading bar)

### 4.3 สร้าง Database Tables

1. เมื่อ project พร้อม → คลิก **SQL Editor** (ซ้ายมือ ไอคอน ⚡)
2. กด **+ New query**
3. เปิดไฟล์ `supabase-schema-v2.sql` ในโฟลเดอร์โปรเจค
4. Copy โค้ด**ทั้งหมด** (Ctrl+A → Ctrl+C)
5. Paste ใน SQL Editor (Ctrl+V)
6. กด **Run** (หรือ Ctrl+Enter)
7. เห็น **"Success. No rows returned"** = สำเร็จ! ✅

### 4.4 ตั้งค่า Authentication

1. คลิกเมนู **Authentication** (ซ้ายมือ ไอคอน 🔐)
2. ไปที่ tab **Providers**
3. เปิด **Email** provider
4. ตั้งค่า:
   - ✅ Enable Email provider
   - ✅ Confirm email: **OFF** (สำหรับทดสอบ)
   - กด **Save**

### 4.5 เอา API Keys

1. คลิกเมนู **Settings** (ล่างซ้าย ไอคอน ⚙️)
2. คลิก **API**
3. เลื่อนลงหา:
   - **Project URL**: คัดลอก (เช่น `https://abc123.supabase.co`)
   - **anon public** key: คัดลอก (ยาวมาก!)
4. เก็บไว้ใน Notepad ก่อน

---

## 🔑 ขั้นตอนที่ 5: ตั้งค่า Environment Variables

### วิธีที่ 1: ใช้ VS Code (แนะนำ)

1. ใน VS Code ขวาคลิกที่ไฟล์ `.env.example`
2. เลือก **Rename**
3. เปลี่ยนชื่อเป็น `.env.local`
4. เปิดไฟล์ `.env.local`
5. แก้ไข:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# แทนที่ด้วย URL และ Key ของคุณ!
```

6. บันทึก (Ctrl+S)

### วิธีที่ 2: ใช้ Command Prompt

```bash
# Copy ไฟล์
copy .env.example .env.local

# เปิดด้วย Notepad
notepad .env.local
```

แล้วแก้ไขตามข้างบน

---

## 🎉 ขั้นตอนที่ 6: รันเว็บไซต์!

1. ใน Terminal พิมพ์:

```bash
npm run dev
```

2. เห็นข้อความ:

```
▲ Next.js 14.2.0
- Local:        http://localhost:3000
- ready started server on [::]:3000
```

3. เปิดเบราว์เซอร์ → ไปที่ **http://localhost:3000**
4. เห็นหน้า Login! 🎉

---

## 👤 ขั้นตอนที่ 7: สมัครสมาชิกและทดสอบ

### สมัครผู้ใช้แรก

1. ที่หน้า Login กด **Sign Up**
2. กรอก:
   - **Username**: `testuser`
   - **Display Name**: `ผู้ใช้ทดสอบ`
   - **Email**: `test@test.com`
   - **Password**: `Test1234!`
3. กด **Sign Up**
4. เข้าสู่ระบบอัตโนมัติ!

### ทดสอบฟีเจอร์

✅ **โพสต์**:
- ไปที่หน้า Profile
- เขียนโพสต์อะไรก็ได้
- กด "โพสต์"

✅ **ลบโพสต์**:
- เห็นปุ่มถังขยะ (🗑️) ที่โพสต์ตัวเอง
- กดเพื่อลบ

✅ **แก้ไขโปรไฟล์**:
- กด "แก้ไขโปรไฟล์"
- เปลี่ยนชื่อ, Bio, วันเกิด
- เปลี่ยนสีธีม
- ใส่ YouTube URL สำหรับเพลง
- กด "บันทึก"

✅ **แชท**:
- สร้างผู้ใช้คนที่ 2 (ใช้อีเมลอื่น)
- เพิ่มเป็นเพื่อน
- ส่งข้อความ
- เห็น "อ่านแล้ว" เมื่ออีกฝ่ายเปิดอ่าน!

---

## 🔔 ขั้นตอนที่ 8: ตั้งค่า Push Notifications

### เปิดใช้งาน Push Notifications

1. เปิดเว็บใน **Chrome** หรือ **Edge**
2. เมื่อเข้าสู่ระบบ จะมีป๊อปอัพถาม:
   ```
   ribbi-v2 wants to show notifications
   ```
3. กด **Allow**
4. เสร็จแล้ว! 🔔

### ทดสอบ

1. เปิดเว็บ 2 tabs (หรือ 2 เบราว์เซอร์)
2. Login คนละ account
3. ส่งข้อความจาก tab 1
4. tab 2 จะได้ push notification!

### ถ้าไม่ขึ้น Notification:

**Windows 10/11:**
1. กด **Win + I** → Settings
2. ไปที่ **System → Notifications**
3. เปิด **Notifications**
4. หา **Chrome** หรือ **Edge** → เปิด

**Browser:**
1. ที่ Address bar กดไอคอน 🔒
2. ไปที่ **Notifications**
3. เปลี่ยนเป็น **Allow**

---

## 🎨 ขั้นตอนที่ 9: ตกแต่งโปรไฟล์

### เปลี่ยนธีม

1. ไปที่ Profile → กด **แก้ไขโปรไฟล์**
2. เลือก **Theme Color** (เลือกสีที่ชอบ)
3. เลือก **Background Style**:
   - Solid (สีทึบ)
   - Gradient (ไล่สี)
   - Dots (จุดๆ)
   - Stripes (ลายทาง)
4. กด **บันทึก**
5. หน้า Profile จะเปลี่ยนสีตามที่เลือก!

### เพิ่มเพลงพื้นหลัง

1. ไปที่ YouTube → เลือกเพลงที่ชอบ
2. Copy URL (เช่น `https://www.youtube.com/watch?v=dQw4w9WgXcQ`)
3. ไปที่ **แก้ไขโปรไฟล์**
4. วาง URL ในช่อง **Music URL**
5. กด **บันทึก**
6. กลับไปที่ Profile → จะเห็นปุ่ม Play/Pause มุมล่างขวา! 🎵

---

## 🚨 แก้ปัญหาที่อาจเจอ (Windows)

### ปัญหา: `npm` is not recognized

**สาเหตุ**: Node.js ติดตั้งไม่สมบูรณ์

**แก้:**
1. ถอน Node.js: Settings → Apps → Node.js → Uninstall
2. ติดตั้งใหม่จาก nodejs.org
3. **Restart คอมพิวเตอร์**
4. เปิด Command Prompt ใหม่
5. ลอง `node --version` อีกครั้ง

### ปัญหา: Cannot find module

**แก้:**
```bash
# ลบ node_modules
rd /s /q node_modules

# ลบ package-lock.json
del package-lock.json

# ติดตั้งใหม่
npm install
```

### ปัญหา: Port 3000 already in use

**แก้:**
```bash
# หา process ที่ใช้ port 3000
netstat -ano | findstr :3000

# จะเห็นเลข PID เช่น 12345
# ปิด process
taskkill /PID 12345 /F

# รันใหม่
npm run dev
```

### ปัญหา: Supabase connection error

**ตรวจสอบ:**
1. `.env.local` มีไฟล์หรือยัง?
2. URL และ KEY ถูกต้องไหม? (ไม่มีช่องว่างข้างหน้า/หลัง)
3. ลอง restart dev server:
   ```bash
   # กด Ctrl+C
   npm run dev  # รันใหม่
   ```

### ปัญหา: Push Notifications ไม่ทำงาน

**Windows:**
1. เช็ค Settings → Notifications → เปิดไหม?
2. Browser → Settings → Privacy → Notifications → Allow

**HTTPS Required:**
- Push Notifications ต้องใช้ HTTPS
- localhost ใช้ได้ (ทดสอบ)
- Production ต้อง Deploy ขึ้น Vercel (จะเป็น HTTPS อัตโนมัติ)

---

## 📝 เคล็ดลับการใช้งาน

### Keyboard Shortcuts (Windows)

| คีย์ | ฟังก์ชัน |
|-----|----------|
| `Ctrl + S` | บันทึกไฟล์ |
| `Ctrl + C` | หยุด dev server |
| `Ctrl + `` | เปิด/ปิด Terminal |
| `Ctrl + Shift + P` | Command Palette |
| `Ctrl + P` | หาไฟล์ |

### Command Prompt Shortcuts

```bash
# ไปที่โฟลเดอร์โปรเจค
cd C:\path\to\ribbi-v2

# ดูไฟล์ในโฟลเดอร์
dir

# Clear screen
cls

# เปิด VS Code
code .
```

---

## 🚀 ขั้นตอนถัดไป

### 1. Deploy ขึ้น Vercel (ให้คนอื่นเข้าได้)

1. สมัคร Vercel: https://vercel.com
2. Login with GitHub
3. Import โปรเจค
4. ใส่ Environment Variables (URL + KEY)
5. Deploy!

### 2. เพิ่มฟีเจอร์

- ✨ Group Chat Management
- 📸 Stickers/GIFs
- 🎮 Mini Games
- 🌙 Dark Mode

---

## 📚 เอกสารเพิ่มเติม

- **Next.js**: https://nextjs.org/docs
- **Supabase**: https://supabase.com/docs
- **Supabase Auth**: https://supabase.com/docs/guides/auth
- **Web Push API**: https://developer.mozilla.org/en-US/docs/Web/API/Push_API

---

## ✅ Checklist สรุป

- [ ] ติดตั้ง Node.js, VS Code, Git
- [ ] แตกไฟล์ `ribbi-v2.tar.gz`
- [ ] `npm install`
- [ ] สร้าง Supabase Project
- [ ] Run SQL Schema
- [ ] ตั้งค่า Authentication ใน Supabase
- [ ] สร้างไฟล์ `.env.local`
- [ ] `npm run dev`
- [ ] สมัครสมาชิก
- [ ] ทดสอบโพสต์/ลบโพสต์
- [ ] ทดสอบแก้ไขโปรไฟล์
- [ ] ตั้งค่า Push Notifications
- [ ] ทดสอบแชท + Read Receipts

เรียบร้อย! 🎉

---

## 💬 ต้องการความช่วยเหลือ?

เจอปัญหาไหม? บอกผมได้เลย:
1. Screenshot error
2. บอกว่าทำถึงขั้นตอนไหน
3. Copy error message

ผมจะช่วยแก้ให้! 🐸✨
