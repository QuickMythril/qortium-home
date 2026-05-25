import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

type PopoverTriggerProps = {
  close: () => void;
  contentId: string;
  isOpen: boolean;
  toggle: () => void;
};

type PopoverProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  contentId: string;
  contentLabel: string;
  renderTrigger: (props: PopoverTriggerProps) => ReactNode;
};

export function Popover({
  children,
  className,
  contentClassName,
  contentId,
  contentLabel,
  renderTrigger,
}: PopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function closeOnOutsidePointerDown(event: PointerEvent) {
      if (!(event.target instanceof Node)) {
        return;
      }

      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePointerDown);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointerDown);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const popoverClassName = ['popover-panel', contentClassName].filter(Boolean).join(' ');

  return (
    <div className={className} ref={containerRef}>
      {renderTrigger({
        close: () => setIsOpen(false),
        contentId,
        isOpen,
        toggle: () => setIsOpen((current) => !current),
      })}

      {isOpen ? (
        <section className={popoverClassName} id={contentId} role="dialog" aria-label={contentLabel}>
          {children}
        </section>
      ) : null}
    </div>
  );
}
