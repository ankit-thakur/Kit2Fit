export type DayStatus = 'none' | 'partial' | 'full';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseISODate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
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
}: {
  dates: string[];
  selectedDate: string;
  onSelect: (date: string) => void;
  statusByDate: Record<string, DayStatus>;
}) {
  return (
    <div className="flex justify-between gap-1 rounded-2xl bg-white p-2 shadow">
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
  );
}
