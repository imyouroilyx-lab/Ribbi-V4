'use client';

import { X } from 'lucide-react';
import { useEffect } from 'react';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  buttonText?: string;
  variant?: 'success' | 'error' | 'info';
}

export default function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  buttonText = 'ตลอด',
  variant = 'success'
}: AlertModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const variantStyles = {
    success: {
      icon: '✅',
      buttonBg: 'bg-green-500 hover:bg-green-600',
      iconBg: 'bg-green-100',
    },
    error: {
      icon: '❌',
      buttonBg: 'bg-red-500 hover:bg-red-600',
      iconBg: 'bg-red-100',
    },
    info: {
      icon: 'ℹ️',
      buttonBg: 'bg-blue-500 hover:bg-blue-600',
      iconBg: 'bg-blue-100',
    }
  };

  const style = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl ${style.iconBg} flex items-center justify-center flex-shrink-0`}>
              <span className="text-2xl">{style.icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{message}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action */}
        <div className="p-6 pt-0">
          <button
            onClick={onClose}
            className={`w-full px-4 py-3 ${style.buttonBg} text-white rounded-xl font-medium transition`}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}