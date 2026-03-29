'use client';

import { Suspense } from 'react';
import NavLayout from '@/components/NavLayout';
import MessagesPage from '@/components/MessagesPage';

export default function Messages() {
  return (
    <NavLayout>
      {/* ใส่ Suspense ครอบ Component ที่มีการเรียกใช้ useSearchParams() ไว้ด้านใน */}
      <Suspense fallback={<div>กำลังโหลด...</div>}>
        <MessagesPage />
      </Suspense>
    </NavLayout>
  );
}
