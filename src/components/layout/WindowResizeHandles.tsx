import React, { useEffect, useState } from 'react';

/**
 * WindowResizeHandles:
 * Invisible interactive edge & corner grips for frameless desktop windows.
 * Provides instant mouse cursor feedback and drag-resizing via the desktop host bridge.
 */
export const WindowResizeHandles: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let mounted = true;
    const checkState = async () => {
      try {
        const res = await fetch('/api/window/state');
        if (res.ok && mounted) {
          const data = await res.json();
          setIsMaximized(!!data.maximized);
        }
      } catch (e) {}
    };

    checkState();
    const interval = setInterval(checkState, 2000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (isMaximized) return null;

  const handleStartResize = (direction: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.screenX;
    const startY = e.screenY;
    const startWidth = window.outerWidth || window.innerWidth;
    const startHeight = window.outerHeight || window.innerHeight;

    let animFrame: number | null = null;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (animFrame) cancelAnimationFrame(animFrame);
      animFrame = requestAnimationFrame(() => {
        const deltaX = moveEvent.screenX - startX;
        const deltaY = moveEvent.screenY - startY;

        let newWidth = startWidth;
        let newHeight = startHeight;

        if (direction.includes('right')) newWidth = Math.max(startWidth + deltaX, 900);
        if (direction.includes('left')) newWidth = Math.max(startWidth - deltaX, 900);
        if (direction.includes('bottom')) newHeight = Math.max(startHeight + deltaY, 560);
        if (direction.includes('top')) newHeight = Math.max(startHeight - deltaY, 560);

        fetch(`/api/window/resize?width=${Math.round(newWidth)}&height=${Math.round(newHeight)}`).catch(() => {});
      });
    };

    const onMouseUp = () => {
      if (animFrame) cancelAnimationFrame(animFrame);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className="pointer-events-auto select-none">
      {/* 4 Edges */}
      <div
        onMouseDown={handleStartResize('top')}
        className="fixed top-0 left-3 right-3 h-1.5 cursor-ns-resize z-50 hover:bg-[#D96B27]/20 transition-colors"
        title="拖动调整窗口高度"
      />
      <div
        onMouseDown={handleStartResize('bottom')}
        className="fixed bottom-0 left-3 right-3 h-1.5 cursor-ns-resize z-50 hover:bg-[#D96B27]/20 transition-colors"
        title="拖动调整窗口高度"
      />
      <div
        onMouseDown={handleStartResize('left')}
        className="fixed top-3 bottom-3 left-0 w-1.5 cursor-ew-resize z-50 hover:bg-[#D96B27]/20 transition-colors"
        title="拖动调整窗口宽度"
      />
      <div
        onMouseDown={handleStartResize('right')}
        className="fixed top-3 bottom-3 right-0 w-1.5 cursor-ew-resize z-50 hover:bg-[#D96B27]/20 transition-colors"
        title="拖动调整窗口宽度"
      />

      {/* 4 Corners */}
      <div
        onMouseDown={handleStartResize('top-left')}
        className="fixed top-0 left-0 w-3.5 h-3.5 cursor-nwse-resize z-50 hover:bg-[#D96B27]/30 transition-colors"
      />
      <div
        onMouseDown={handleStartResize('top-right')}
        className="fixed top-0 right-0 w-3.5 h-3.5 cursor-nesw-resize z-50 hover:bg-[#D96B27]/30 transition-colors"
      />
      <div
        onMouseDown={handleStartResize('bottom-left')}
        className="fixed bottom-0 left-0 w-3.5 h-3.5 cursor-nesw-resize z-50 hover:bg-[#D96B27]/30 transition-colors"
      />
      <div
        onMouseDown={handleStartResize('bottom-right')}
        className="fixed bottom-0 right-0 w-3.5 h-3.5 cursor-nwse-resize z-50 hover:bg-[#D96B27]/30 transition-colors"
      />
    </div>
  );
};
