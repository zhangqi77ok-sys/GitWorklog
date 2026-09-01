import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { Dialog } from './Dialog';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  isDanger = false,
}) => {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          {isDanger ? (
            <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-red-600">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full bg-[#D96B27]/15 flex items-center justify-center text-[#D96B27]">
              <Info className="w-3.5 h-3.5" />
            </div>
          )}
          <span>{title}</span>
        </div>
      }
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            title="取消操作 (Esc)"
            className="px-3.5 py-1.5 rounded-lg border border-[#E6DFD5] bg-white text-[#3D3A36] hover:bg-[#FAF8F5] text-xs font-medium transition-colors cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            title="确认执行"
            className={`px-4 py-1.5 rounded-lg text-white text-xs font-medium transition-colors shadow-xs cursor-pointer ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[#D96B27] hover:bg-[#BF5A1B]'
            }`}
          >
            {confirmText}
          </button>
        </>
      }
    >
      <div className="py-2 text-[#3D3A36] leading-relaxed text-xs">
        {message}
      </div>
    </Dialog>
  );
};
