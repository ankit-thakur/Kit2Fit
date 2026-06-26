export type DayStatus = 'none' | 'partial' | 'full';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function parseISODate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatRangeLabel(dates: string[]): string {
  const start = parseISODate(dates[0]);
  const end = parseISODate(dates[dates.length - 1]);
  const startLabel = `${MONTH_LABELS[start.getMonth()]} ${start.getDate()}`;
  const endLabel =
    start.getMonth() === end.getMonth()
      ? `${end.getDate()}`
      : `${MONTH_LABELS[end.getMonth()]} ${end.getDate()}`;
  return `${startLabel}–${endLabel}`;
}

function dotClass(status: DayStatus, isSelected: boolean): string {
  if (status === 'full') return isSelected ? 'bg-white' : 'bg-kit';
  if (status === 'partial') return isSelected ? 'bg-white/60' : 'bg-yellow-400';
  return isSelected ? 'bg-white/20' : 'bg-gray-200';
}

export function WeekStrip({
  dates,
  selectedDate,
  onSelect,
  statusByDate,
  onPrevWeek,
  onNextWeek,
  canGoNext,
  isCurrentWeek,
  isLoading,
}: {
  dates: string[];
  selectedDate: string;
  onSelect: (date: string) => void;
  statusByDate: Record<string, DayStatus>;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  canGoNext: boolean;
  isCurrentWeek: boolean;
  isLoading?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white p-2 shadow">
      <div className="mb-1 flex items-center justify-between px-1">
        <button
          onClick={onPrevWeek}
          disabled={isLoading}
          aria-label="Previous week"
          className="px-2 py-1 text-lg text-gray-400 hover:text-kit-dark disabled:opacity-30"
        >
          ‹
        </button>
        <span className="text-xs font-semibold text-gray-500">
          {isCurrentWeek ? 'This week' : formatRangeLabel(dates)}
        </span>
        <button
          onClick={onNextWeek}
          disabled={!canGoNext || isLoading}
          aria-label="Next week"
          className="px-2 py-1 text-lg text-gray-400 hover:text-kit-dark disabled:opacity-30"
        >
          ›
        </button>
      </div>
      <div className="flex justify-between gap-1">
        {dates.map((date) => {
          const d = parseISODate(date);
          const isSelected = date === selectedDate;
          const status = statusByDate[date] ?? 'none';
          return (
            <button
              key={date}
              onClick={() => onSelect(date)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-xs transition ${
                isSelected ? 'bg-kit text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>{WEEKDAY_LABELS[d.getDay()]}</span>
              <span className="font-semibold">{d.getDate()}</span>
              <span className={`h-1.5 w-1.5 rounded-full ${dotClass(status, isSelected)}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
