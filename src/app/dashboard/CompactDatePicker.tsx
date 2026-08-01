// src/app/dashboard/CompactDatePicker.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface CompactDatePickerProps {
  value: string; // "YYYY-MM-DD" or ""
  onChange: (val: string) => void;
  placeholder?: string;
  label?: string;
}

export default function CompactDatePicker({ value, onChange, placeholder = 'Pick date', label }: CompactDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Parse initial date or default to current date
  const parsedDate = value ? new Date(value + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState(parsedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsedDate.getMonth());

  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [value]);

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popoverHeight = 295;
      const spaceBelow = window.innerHeight - rect.bottom;
      
      let top = rect.bottom + 6;
      if (spaceBelow < popoverHeight && rect.top > popoverHeight) {
        top = rect.top - popoverHeight - 6;
      }
      
      let left = rect.left;
      if (left + 256 > window.innerWidth - 16) {
        left = window.innerWidth - 256 - 16;
      }
      if (left < 16) left = 16;

      setPopoverPos({ top, left });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    }
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        popoverRef.current && !popoverRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const selectedStr = `${viewYear}-${m}-${d}`;
    onChange(selectedStr);
    setIsOpen(false);
  };

  const handleToday = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    onChange(`${y}-${m}-${d}`);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  // Calendar math
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const prevDays = Array.from({ length: firstDayIndex }, (_, i) => daysInPrevMonth - firstDayIndex + 1 + i);
  const currentDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const totalCells = prevDays.length + currentDays.length;
  const nextDaysCount = totalCells > 35 ? 42 - totalCells : 35 - totalCells;
  const nextDays = Array.from({ length: nextDaysCount }, (_, i) => i + 1);

  const todayDate = new Date();
  const isCurrentMonthToday = todayDate.getFullYear() === viewYear && todayDate.getMonth() === viewMonth;
  const todayDay = todayDate.getDate();

  const selectedDateObj = value ? new Date(value + 'T00:00:00') : null;
  const isSelectedMonthYear = selectedDateObj && selectedDateObj.getFullYear() === viewYear && selectedDateObj.getMonth() === viewMonth;
  const selectedDay = selectedDateObj ? selectedDateObj.getDate() : null;

  // Format trigger display string
  const formatDisplay = () => {
    if (!value) return placeholder;
    const d = new Date(value + 'T00:00:00');
    if (isNaN(d.getTime())) return placeholder;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {label && <span className="block text-[9px] text-zinc-400 font-mono uppercase tracking-wider mb-1">{label}</span>}
      
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!isOpen) updatePosition();
          setIsOpen(!isOpen);
        }}
        className="w-full bg-zinc-50 border border-zinc-200 hover:border-zinc-400 text-zinc-900 text-xs rounded-xl px-2.5 py-2 outline-none font-medium transition-all flex items-center justify-between gap-1.5 shadow-2xs group"
      >
        <div className="flex items-center gap-2 truncate">
          <Calendar className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-950 transition-colors shrink-0" />
          <span className={`truncate text-xs ${value ? 'text-zinc-950 font-bold' : 'text-zinc-400 font-normal'}`}>
            {formatDisplay()}
          </span>
        </div>
      </button>

      {/* Modern Compact Calendar Popover Rendered via Portal to document.body */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div 
          ref={popoverRef}
          style={{ top: `${popoverPos.top}px`, left: `${popoverPos.left}px` }}
          className="compact-date-picker-popover fixed z-[99999] w-64 bg-white border border-zinc-200 rounded-2xl shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-bold text-zinc-950 font-sans">
              {monthNames[viewMonth]} <span className="text-zinc-500 font-semibold">{viewYear}</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-zinc-100 text-zinc-600 hover:text-zinc-950 transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-zinc-100 text-zinc-600 hover:text-zinc-950 transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Day Names Header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dayName, idx) => (
              <span key={idx} className="text-[10px] font-bold font-mono text-zinc-400 py-1">
                {dayName}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Previous Month Days */}
            {prevDays.map((d) => (
              <span key={`prev-${d}`} className="w-7 h-7 flex items-center justify-center text-[11px] font-mono text-zinc-300 select-none mx-auto">
                {d}
              </span>
            ))}

            {/* Current Month Days */}
            {currentDays.map((d) => {
              const isSelected = isSelectedMonthYear && selectedDay === d;
              const isToday = isCurrentMonthToday && todayDay === d;

              return (
                <button
                  key={`curr-${d}`}
                  type="button"
                  onClick={() => handleSelectDay(d)}
                  className={`w-7 h-7 flex items-center justify-center text-xs rounded-xl font-semibold transition-all mx-auto ${
                    isSelected
                      ? 'bg-zinc-950 text-white shadow-xs font-bold scale-105'
                      : isToday
                      ? 'border border-zinc-950 text-zinc-950 font-bold hover:bg-zinc-100'
                      : 'text-zinc-800 hover:bg-zinc-100 hover:text-zinc-950'
                  }`}
                >
                  {d}
                </button>
              );
            })}

            {/* Next Month Days */}
            {nextDays.map((d) => (
              <span key={`next-${d}`} className="w-7 h-7 flex items-center justify-center text-[11px] font-mono text-zinc-300 select-none mx-auto">
                {d}
              </span>
            ))}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-zinc-100 px-1">
            <button
              type="button"
              onClick={handleClear}
              className="text-[10px] font-semibold text-zinc-400 hover:text-zinc-800 transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="text-[10px] font-bold text-zinc-950 hover:underline transition-all"
            >
              Today
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
