import React from 'react';
import { create } from 'zustand';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastStore {
  toasts: ToastItem[];
  show: (message: string, type?: ToastType) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  show: (message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 3500);
  },
  remove: (id: string) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

export const toast = {
  success: (msg: string) => useToastStore.getState().show(msg, 'success'),
  error: (msg: string) => useToastStore.getState().show(msg, 'error'),
  info: (msg: string) => useToastStore.getState().show(msg, 'info'),
};

export const ToastContainer: React.FC = () => {
  const { toasts, remove } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-12 right-6 z-50 flex flex-col gap-2 pointer-events-none select-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 bg-[#FAF8F5] border border-[#E6DFD5] rounded-xl shadow-lg text-xs text-[#1E1C1A] animate-in slide-in-from-top-2 duration-150 max-w-sm"
        >
          {t.type === 'success' && (
            <CheckCircle2 className="w-4 h-4 text-[#2E7D32] flex-shrink-0" />
          )}
          {t.type === 'error' && (
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          )}
          {t.type === 'info' && (
            <Info className="w-4 h-4 text-[#D96B27] flex-shrink-0" />
          )}

          <span className="flex-1 leading-snug">{t.message}</span>

          <button
            onClick={() => remove(t.id)}
            className="text-[#8A847C] hover:text-[#1E1C1A] p-0.5 rounded cursor-pointer transition-colors"
            title="关闭提示"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
