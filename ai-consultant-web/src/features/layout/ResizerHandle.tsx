'use client';

import { useCallback, useRef } from 'react';

export interface ResizerHandleProps {
  onDrag: (deltaX: number) => void;
  className?: string;
}

export function ResizerHandle({ onDrag, className = '' }: ResizerHandleProps) {
  const startX = useRef(0);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      startX.current = e.clientX;

      const onPointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX.current;
        startX.current = moveEvent.clientX;
        onDrag(deltaX);
      };

      const onPointerUp = () => {
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };

      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    },
    [onDrag]
  );

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onPointerDown={handlePointerDown}
      className={`shrink-0 w-1.5 cursor-col-resize bg-slate-200 hover:bg-slate-300 transition-colors ${className}`}
    />
  );
}
