export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || 'January';
}

export function formatDateString(year: number, month: number, day: number): string {
  const m = month.toString().padStart(2, '0');
  const d = day.toString().padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export function parseDateString(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day };
}

export interface CalendarCell {
  dateStr: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  dayOfWeek: number; // 0 = Sun, 1 = Mon ...
}

export function generateCalendarGrid(year: number, month: number): CalendarCell[] {
  const cells: CalendarCell[] = [];
  const firstDay = new Date(year, month - 1, 1);
  const startingDayOfWeek = firstDay.getDay(); // 0 is Sunday
  const daysInMonth = getDaysInMonth(year, month);

  // Previous month trailing days
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);

  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const dateStr = formatDateString(prevYear, prevMonth, dayNum);
    cells.push({
      dateStr,
      dayNumber: dayNum,
      isCurrentMonth: false,
      dayOfWeek: new Date(prevYear, prevMonth - 1, dayNum).getDay(),
    });
  }

  // Current month days
  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const dateStr = formatDateString(year, month, dayNum);
    cells.push({
      dateStr,
      dayNumber: dayNum,
      isCurrentMonth: true,
      dayOfWeek: new Date(year, month - 1, dayNum).getDay(),
    });
  }

  // Next month leading days to complete 35 or 42 cells grid
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const totalCellsSoFar = cells.length;
  const targetTotal = totalCellsSoFar > 35 ? 42 : 35;
  const remainingCells = targetTotal - totalCellsSoFar;

  for (let dayNum = 1; dayNum <= remainingCells; dayNum++) {
    const dateStr = formatDateString(nextYear, nextMonth, dayNum);
    cells.push({
      dateStr,
      dayNumber: dayNum,
      isCurrentMonth: false,
      dayOfWeek: new Date(nextYear, nextMonth - 1, dayNum).getDay(),
    });
  }

  return cells;
}

export function getCurrentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
}
