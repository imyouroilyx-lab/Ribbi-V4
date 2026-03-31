'use client';

import { Suspense } from 'react';
import NavLayout from '@/components/NavLayout';
import MessagesPage from '@/components/MessagesPage';

// ✅ บังคับให้ Next.js/Vercel ไม่เก็บแคชหน้านี้เด็ดขาด (แก้ This page couldn't load)
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export default function Messages() {
  return (
    <NavLayout>
      <Suspense fallback={
        <div className="flex items-center justify-center h-screen bg-white">
          <div className="text-frog-500 font-black animate-pulse">RIBBI SYSTEM LOADING...</div>
        </div>
      }>
        <MessagesPage />
      </Suspense>
    </NavLayout>
  );
}
