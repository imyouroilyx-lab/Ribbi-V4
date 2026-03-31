'use client';

import { Suspense } from 'react';
import NavLayout from '@/components/NavLayout';
import MessagesPage from '@/components/MessagesPage';

// ✅ บังคับให้ Next.js ไม่ทำ Static แคชหน้าเว็บนี้ (แก้ปัญหา This page couldn't load)
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default function Messages() {
  return (
    <NavLayout>
      <Suspense fallback={
        <div className="flex items-center justify-center h-[calc(100dvh-64px)] bg-white">
          <div className="text-gray-400 font-black text-xs animate-pulse tracking-widest uppercase">
            กำลังเชื่อมต่อระบบแชท...
          </div>
        </div>
      }>
        <MessagesPage />
      </Suspense>
    </NavLayout>
  );
}
