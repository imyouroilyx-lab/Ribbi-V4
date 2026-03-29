'use client';

export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1 px-4 py-3 bg-gray-100 rounded-2xl rounded-bl-sm">
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}