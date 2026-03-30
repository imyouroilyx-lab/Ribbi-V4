'use client';

import React from 'react';

/**
 * TypingIndicator Component
 * แสดงจุดไข่ปลาเด้งๆ เมื่อมีคนกำลังพิมพ์
 * ✅ ใช้ React.memo เพื่อป้องกันการ Re-render ไร้สาระในหน้าแชท
 */
const TypingIndicator = React.memo(() => {
  return (
    <div 
      className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300 mb-4"
      role="status"
      aria-label="Someone is typing..."
    >
      {/* Bubble Container */}
      <div className="flex gap-1.5 px-4 py-3 bg-gray-100 rounded-2xl rounded-bl-sm shadow-sm border border-gray-200/50">
        <span 
          className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" 
          style={{ animationDuration: '1s', animationDelay: '0ms' }} 
        />
        <span 
          className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" 
          style={{ animationDuration: '1s', animationDelay: '150ms' }} 
        />
        <span 
          className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" 
          style={{ animationDuration: '1s', animationDelay: '300ms' }} 
        />
      </div>

      {/* Typing Text */}
      <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] animate-pulse">
        Someone is typing
      </span>
    </div>
  );
});

// ตั้งชื่อให้แสดงใน React DevTools ได้ถูกต้อง
TypingIndicator.displayName = 'TypingIndicator';

export default TypingIndicator;
