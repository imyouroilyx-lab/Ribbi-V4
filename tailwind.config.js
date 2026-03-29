/** @type {import('tailwindcss').Config} */
module.exports = {
  // 1. เพิ่มบรรทัดนี้เพื่อเปิดใช้งาน Dark Mode แบบใช้ Class
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#fdfcfb',
          100: '#faf8f5',
          200: '#f5f1ea',
          300: '#ede7dc',
        },
        frog: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#9de5a8', // สีหลัก Ribbi
        },
        // เพิ่มสีพื้นหลังสำหรับ Dark Mode
        dark: {
          bg: '#121212', // พื้นหลังมืดสนิท
          card: '#1e1e1e', // สีการ์ด
          border: '#2d2d2d',
          text: '#f5f5f5',
        },
        pastel: {
          pink: '#ffc9d9',
          blue: '#a8d8ff',
          purple: '#d4b5ff',
          yellow: '#fff5b8',
        }
      },
      fontFamily: {
        sans: ['Google Sans', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.06)',
        'soft-lg': '0 4px 16px rgba(0, 0, 0, 0.08)',
        'dark-soft': '0 4px 12px rgba(0, 0, 0, 0.3)',
      }
    },
  },
  plugins: [],
};
