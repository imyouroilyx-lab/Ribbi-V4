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
    <html lang="th" suppressHydrationWarning>
      <head>
        {/* 4. เพิ่ม Inline Script เพื่อเช็คธีมทันทีที่โหลด ป้องกันหน้าขาวแวบ */}
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var theme = localStorage.getItem('theme');
                var supportDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches === true;
                if (theme === 'dark' || (!theme && supportDarkMode)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
            })();
          `,
        }} />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
