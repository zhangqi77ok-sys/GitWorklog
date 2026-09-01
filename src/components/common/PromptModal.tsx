import React, { useState, useEffect, useRef } from 'react';
import { Dialog } from './Dialog';

export interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  description?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
}

export const PromptModal: React.FC<PromptModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  description,
  defaultValue = '',
  placeholder = '',
  confirmText = '确定',
}) => {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, defaultValue]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
      onClose();
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            title="取消输入 (Esc)"
            className="px-3.5 py-1.5 rounded-lg border border-[#E6DFD5] bg-white text-[#3D3A36] hover:bg-[#FAF8F5] text-xs font-medium transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={!value.trim()}
            title="确认提交 (Enter)"
            className="px-4 py-1.5 rounded-lg bg-[#D96B27] hover:bg-[#BF5A1B] disabled:opacity-50 text-white text-xs font-medium transition-colors shadow-xs cursor-pointer"
          >
            {confirmText}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="py-1">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3.5 py-2 bg-white border border-[#E6DFD5] focus:border-[#D96B27] focus:ring-2 focus:ring-[#D96B27]/15 rounded-lg text-xs text-[#1E1C1A] outline-none transition-all"
        />
      </form>
    </Dialog>
  );
};
