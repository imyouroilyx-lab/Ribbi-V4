import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// ✅ ตั้งค่า Google Sans แบบ Variable Font
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
  // เนื่องจากเป็น Variable Font เราไม่ต้องระบุ weight แยกทีละอัน
  // ระบบจะดึงความหนาได้ตั้งแต่ 100 - 900 อัตโนมัติ
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
        {children}
      </body>
    </html>
  );
}
