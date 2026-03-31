'use client';

import { Suspense } from 'react';
import NavLayout from '@/components/NavLayout';
import MessagesPage from '@/components/MessagesPage';

// ✅ ใช้แค่นี้พอครับพี่ Build ผ่านแน่นอน
export const dynamic = 'force-dynamic';

export default function Messages() {
  return (
    <NavLayout>
      <Suspense fallback={<div className="flex items-center justify-center h-screen bg-white">Loading...</div>}>
        <MessagesPage />
      </Suspense>
    </NavLayout>
  );
}
