import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import PresenceClient from "@/components/PresenceClient";
import InvertToggle from "@/components/InvertToggle";

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
      <head>
        {/* ✅ Anti-flash: อ่าน localStorage ก่อน hydrate เพื่อกัน flicker */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.getItem('ribbi-invert-mode') === 'true') {
                  document.documentElement.classList.add('inverted');
                }
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body className="antialiased">
        {children}
        {/* ✅ Floating invert toggle — ออกทุกหน้าโดยไม่ต้องแตะ page ใดเลย */}
        <InvertToggle />
        <PresenceClient />
      </body>
    </html>
  );
}
