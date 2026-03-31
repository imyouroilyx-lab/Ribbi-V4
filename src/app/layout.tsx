import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import PresenceClient from "@/components/PresenceClient"; // ✅ เพิ่มการเชื่อมต่อระบบเช็กสถานะออนไลน์

// ✅ ตั้งค่า Google Sans แบบ Variable Font ตามที่พี่ตั้งไว้
const googleSans = localFont({
  src: [
    {
      path: "./fonts/GoogleSans-VariableFont_GRAD,opsz,wght.ttf",
      style: "normal",
    },
    {
      path: "./fonts/GoogleSans-Italic-VariableFont_GRAD,opsz,wght.ttf",
      style: "italic",
    },
  ],
  variable: "--font-google-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ribbi - RoleplayTH",
  description: "เว็บไซต์โซเชียลมีเดียเฉพาะสำหรับสมาชิก RoleplayTH",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={googleSans.variable}>
      <body className="antialiased">
        {/* ส่วนเนื้อหาของหน้าเว็บ */}
        {children}

        {/* ✅ ระบบ Global Presence 
           วางไว้ตรงนี้เพื่อให้มันเริ่มทำงานทันทีที่เข้าเว็บ 
           ไม่ว่าจะอยู่หน้าไหน จุดเขียวก็จะซิงก์ตรงความจริงครับ
        */}
        <PresenceClient />
      </body>
    </html>
  );
}
