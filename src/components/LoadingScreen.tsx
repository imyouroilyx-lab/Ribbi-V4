export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center">
      <div className="text-center">
        <div className="mb-6 flex justify-center">
          <img 
            src="https://iili.io/qbtgKBt.png" 
            alt="Ribbi Logo" 
            className="w-32 h-32 object-contain animate-bounce"
          />
        </div>
        <p className="text-gray-600 text-lg">กำลังโหลด...</p>
      </div>
    </div>
  );
}