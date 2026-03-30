'use client';

import React from 'react';

/**
 * TypingIndicator Component
 * แสดงจุดไข่ปลาเด้งๆ เมื่อมีคนกำลังพิมพ์
 * ปรับปรุงให้ใช้การกระพริบร่วมกับการขยับเพื่อให้ดูนุ่มนวล (Smooth Animation)
 */
export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
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
      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">
        Typing...
      </span>
    </div>
  );
}
