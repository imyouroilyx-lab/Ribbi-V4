# 🐸 Ribbi v2 - Quick Start (Windows)

## เริ่มใช้งานภายใน 10 นาที!

### ขั้นที่ 1: ติดตั้งโปรแกรม (5 นาที)
1. ดาวน์โหลดและติดตั้ง **Node.js**: https://nodejs.org/
2. ดาวน์โหลดและติดตั้ง **VS Code**: https://code.visualstudio.com/

### ขั้นที่ 2: แตกไฟล์ (1 นาที)
```bash
# คลิกขวา ribbi-v2.tar.gz → Extract Here
# หรือใช้ 7-Zip
```

### ขั้นที่ 3: เปิดโปรเจค (1 นาที)
```bash
cd ribbi-v2
code .
```

### ขั้นที่ 4: ติดตั้ง Packages (2-3 นาที)
```bash
npm install
```

### ขั้นที่ 5: ตั้งค่า Supabase (ดูใน WINDOWS_INSTALLATION_GUIDE.md)

### ขั้นที่ 6: รัน!
```bash
npm run dev
```

เปิดเบราว์เซอร์: http://localhost:3000

---

## ✨ ฟีเจอร์ใหม่

✅ **Login/Register** - ระบบสมัครสมาชิกจริง
✅ **ลบโพสต์** - ลบโพสต์ตัวเองได้
✅ **แก้ไขโปรไฟล์** - เปลี่ยนชื่อ, สี, เพลง
✅ **Read Receipts** - แสดงว่าอ่านแล้วเมื่อไหร่
✅ **Push Notifications** - แจ้งเตือนจริงผ่านเบราว์เซอร์

---

## 📁 โครงสร้างโปรเจค

```
ribbi-v2/
├── src/
│   ├── app/                    # Pages
│   │   ├── login/             # หน้า Login
│   │   ├── register/          # หน้า Register
│   │   ├── profile/           # หน้า Profile
│   │   │   ├── [username]/   # ดูโปรไฟล์คนอื่น
│   │   │   └── edit/         # แก้ไขโปรไฟล์ตัวเอง
│   │   ├── messages/          # แชท
│   │   └── notifications/     # การแจ้งเตือน
│   ├── components/            # Components
│   └── lib/                   # Libraries
├── public/                    # Static files
├── .env.local                 # Config (ต้องสร้างเอง!)
└── package.json
```

---

## 🔑 ไฟล์สำคัญ

### `.env.local` (ต้องสร้างเอง!)
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## 🆘 เจอปัญหา?

เปิดไฟล์ `WINDOWS_INSTALLATION_GUIDE.md` เพื่อดูคำแนะนำแบบละเอียด!

หรือถามผมได้เลย! 🐸
