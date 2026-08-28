import React, { useState, useEffect, useRef } from "react";
import { Copy, Scissors, Clipboard, CheckSquare, Trash2, Check } from "lucide-react";

interface MenuPosition {
  x: number;
  y: number;
}

export const CustomContextMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState("");
  const [isEditableTarget, setIsEditableTarget] = useState(false);
  const [activeTarget, setActiveTarget] = useState<HTMLElement | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 1500);
  };

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault(); // 彻底禁用浏览器默认的刷新/另存为/打印右键菜单

      const selection = window.getSelection()?.toString() || "";
      setSelectedText(selection);

      const target = e.target as HTMLElement;
      setActiveTarget(target);
      const isEditable =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      setIsEditableTarget(isEditable);

      // 计算菜单位置，防止溢出屏幕边缘
      const menuWidth = 170;
      const menuHeight = 160;
      const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
      const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);

      setPosition({ x, y });
      setIsOpen(true);
    };

    const handleGlobalClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleScroll = () => {
      setIsOpen(false);
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("click", handleGlobalClick);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("click", handleGlobalClick);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, []);

  // 剪切 (Cut)
  const handleCut = async () => {
    if (!selectedText) return;
    try {
      await navigator.clipboard.writeText(selectedText);
      if (isEditableTarget && activeTarget) {
        if (
          activeTarget instanceof HTMLInputElement ||
          activeTarget instanceof HTMLTextAreaElement
        ) {
          const start = activeTarget.selectionStart || 0;
          const end = activeTarget.selectionEnd || 0;
          const val = activeTarget.value;
          activeTarget.value = val.slice(0, start) + val.slice(end);
          activeTarget.setSelectionRange(start, start);
          activeTarget.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
      showToast("已剪切");
    } catch (e) {
      document.execCommand("cut");
    }
    setIsOpen(false);
  };

  // 复制 (Copy)
  const handleCopy = async () => {
    if (!selectedText) return;
    try {
      await navigator.clipboard.writeText(selectedText);
      showToast("已复制到剪贴板");
    } catch (e) {
      document.execCommand("copy");
    }
    setIsOpen(false);
  };

  // 粘贴 (Paste)
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;

      if (isEditableTarget && activeTarget) {
        if (
          activeTarget instanceof HTMLInputElement ||
          activeTarget instanceof HTMLTextAreaElement
        ) {
          const start = activeTarget.selectionStart || 0;
          const end = activeTarget.selectionEnd || 0;
          const val = activeTarget.value;
          activeTarget.value = val.slice(0, start) + text + val.slice(end);
          const newPos = start + text.length;
          activeTarget.setSelectionRange(newPos, newPos);
          activeTarget.dispatchEvent(new Event("input", { bubbles: true }));
          activeTarget.focus();
        }
      } else {
        // 如果当前不在输入框，寻找主对话输入框粘贴
        const mainTextarea = document.querySelector("textarea") as HTMLTextAreaElement;
        if (mainTextarea) {
          const start = mainTextarea.selectionStart || mainTextarea.value.length;
          const val = mainTextarea.value;
          mainTextarea.value = val.slice(0, start) + text + val.slice(start);
          mainTextarea.dispatchEvent(new Event("input", { bubbles: true }));
          mainTextarea.focus();
        }
      }
      showToast("已粘贴");
    } catch (err) {
      console.warn("Paste error:", err);
    }
    setIsOpen(false);
  };

  // 全选 (Select All)
  const handleSelectAll = () => {
    if (
      activeTarget instanceof HTMLInputElement ||
      activeTarget instanceof HTMLTextAreaElement
    ) {
      activeTarget.select();
    } else {
      const range = document.createRange();
      range.selectNodeContents(document.body);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    setIsOpen(false);
  };

  // 清空选区或输入内容
  const handleDelete = () => {
    if (
      isEditableTarget &&
      (activeTarget instanceof HTMLInputElement ||
        activeTarget instanceof HTMLTextAreaElement)
    ) {
      const start = activeTarget.selectionStart || 0;
      const end = activeTarget.selectionEnd || 0;
      if (start !== end) {
        const val = activeTarget.value;
        activeTarget.value = val.slice(0, start) + val.slice(end);
        activeTarget.setSelectionRange(start, start);
        activeTarget.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
    setIsOpen(false);
  };

  if (!isOpen && !toastMsg) return null;

  return (
    <>
      {/* 浮动右键菜单 */}
      {isOpen && (
        <div
          ref={menuRef}
          style={{ left: `${position.x}px`, top: `${position.y}px` }}
          className="fixed z-[9999] w-44 bg-white/95 backdrop-blur-md border border-[#e5dfd8] rounded-xl shadow-xl p-1 flex flex-col gap-0.5 text-xs text-[#1e1b18] select-none animate-in fade-in zoom-in-95 duration-100"
        >
          {/* 1. 剪切 */}
          <button
            type="button"
            onClick={handleCut}
            disabled={!selectedText || !isEditableTarget}
            className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-[#faf8f5] text-[#334155] hover:text-[#0f172a] disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer transition-colors disabled:cursor-default"
          >
            <div className="flex items-center gap-2">
              <Scissors size={13} className="text-[#64748b]" />
              <span className="font-medium">剪切</span>
            </div>
            <span className="text-[10px] text-[#94a3b8] font-mono">Ctrl+X</span>
          </button>

          {/* 2. 复制 */}
          <button
            type="button"
            onClick={handleCopy}
            disabled={!selectedText}
            className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-[#faf8f5] text-[#334155] hover:text-[#0f172a] disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer transition-colors disabled:cursor-default"
          >
            <div className="flex items-center gap-2">
              <Copy size={13} className="text-[#64748b]" />
              <span className="font-medium">复制</span>
            </div>
            <span className="text-[10px] text-[#94a3b8] font-mono">Ctrl+C</span>
          </button>

          {/* 3. 粘贴 */}
          <button
            type="button"
            onClick={handlePaste}
            className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-[#faf8f5] text-[#334155] hover:text-[#0f172a] cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2">
              <Clipboard size={13} className="text-[#64748b]" />
              <span className="font-medium">粘贴</span>
            </div>
            <span className="text-[10px] text-[#94a3b8] font-mono">Ctrl+V</span>
          </button>

          <div className="w-full h-[1px] bg-[#f1f5f9] my-0.5" />

          {/* 4. 全选 */}
          <button
            type="button"
            onClick={handleSelectAll}
            className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-[#faf8f5] text-[#334155] hover:text-[#0f172a] cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2">
              <CheckSquare size={13} className="text-[#64748b]" />
              <span className="font-medium">全选</span>
            </div>
            <span className="text-[10px] text-[#94a3b8] font-mono">Ctrl+A</span>
          </button>

          {/* 5. 删除 (选区删除) */}
          {selectedText && isEditableTarget && (
            <button
              type="button"
              onClick={handleDelete}
              className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-[#fee2e2] text-[#ef4444] cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <Trash2 size={13} />
                <span className="font-medium">删除</span>
              </div>
              <span className="text-[10px] text-[#f87171] font-mono">Del</span>
            </button>
          )}
        </div>
      )}

      {/* 简短操作反馈气泡 */}
      {toastMsg && (
        <div className="fixed bottom-12 right-6 z-[10000] bg-[#1e293b] text-white text-xs px-3 py-1.5 rounded-lg shadow-xl flex items-center gap-1.5 animate-in fade-in slide-in-from-bottom-2">
          <Check size={12} className="text-[#10b981]" />
          <span>{toastMsg}</span>
        </div>
      )}
    </>
  );
};
