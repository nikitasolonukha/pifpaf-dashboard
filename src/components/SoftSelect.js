'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

/**
 * Custom select matching cabinet soft UI (no native OS blue dropdown).
 * Menu is portaled + fixed so it doesn't stretch or get clipped by parents.
 */
export default function SoftSelect({
  value,
  onChange,
  options = [],
  disabled = false,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  id,
  'aria-label': ariaLabel,
  align = 'left',
}) {
  const [open, setOpen] = useState(false);
  const [menuBox, setMenuBox] = useState(null);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value) || options[0];

  function updateMenuPosition() {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const gap = 6;
    const maxH = 240;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUp = spaceBelow < 120 && spaceAbove > spaceBelow;
    setMenuBox({
      top: openUp ? undefined : rect.bottom + gap,
      bottom: openUp ? window.innerHeight - rect.top + gap : undefined,
      left: align === 'right' ? undefined : rect.left,
      right: align === 'right' ? window.innerWidth - rect.right : undefined,
      width: Math.ceil(rect.width),
      maxHeight: Math.min(maxH, openUp ? spaceAbove : spaceBelow),
    });
  }

  useLayoutEffect(() => {
    if (!open) {
      setMenuBox(null);
      return undefined;
    }
    updateMenuPosition();
    function onReposition() {
      updateMenuPosition();
    }
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when open/align change
  }, [open, align, options.length]);

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(e) {
      const t = e.target;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const menu = open && menuBox && typeof document !== 'undefined'
    ? createPortal(
      <ul
        ref={menuRef}
        id={listId}
        role="listbox"
        aria-label={ariaLabel}
        className={`fixed z-[100] py-1 rounded-[var(--radius)] border border-[var(--border-soft)] shadow-[var(--shadow-soft)] overflow-auto ${menuClassName}`}
        style={{
          background: 'var(--surface)',
          top: menuBox.top,
          bottom: menuBox.bottom,
          left: menuBox.left,
          right: menuBox.right,
          minWidth: menuBox.width,
          width: 'max-content',
          maxWidth: 'min(20rem, calc(100vw - 1.5rem))',
          maxHeight: menuBox.maxHeight,
        }}
      >
        {options.map((opt) => {
          const isActive = opt.value === (selected?.value ?? value);
          return (
            <li key={opt.value} role="option" aria-selected={isActive}>
              <button
                type="button"
                className={`w-full whitespace-nowrap text-left px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'font-semibold bg-[var(--lavender)]'
                    : 'font-medium hover:bg-[var(--pink-bg)]'
                }`}
                style={{ color: 'var(--text-primary)' }}
                onClick={() => {
                  onChange?.(opt.value);
                  setOpen(false);
                }}
              >
                {opt.label}
              </button>
            </li>
          );
        })}
      </ul>,
      document.body,
    )
    : null;

  return (
    <div ref={rootRef} className={`relative inline-flex max-w-full ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`inline-flex max-w-full items-center justify-between gap-2 px-3 py-2 rounded-[var(--radius-btn)] border border-[var(--border-soft)] bg-white/90 text-sm font-medium hover:bg-white disabled:opacity-60 disabled:cursor-not-allowed transition-colors ${buttonClassName}`}
        style={{ color: 'var(--text-primary)' }}
      >
        <span className="truncate text-left">{selected?.label ?? '—'}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: 'var(--text-secondary)' }}
        />
      </button>
      {menu}
    </div>
  );
}
