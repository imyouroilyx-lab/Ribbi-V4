import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="th">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
