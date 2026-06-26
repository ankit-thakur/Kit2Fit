import { calculateDurationPoints } from '@shared/points';

interface WorkoutFormProps {
  minutesWorkedOut: number;
  description: string;
  onMinutesChange: (minutes: number) => void;
  onDescriptionChange: (description: string) => void;
  heading?: string;
}

export function WorkoutForm({
  minutesWorkedOut,
  description,
  onMinutesChange,
  onDescriptionChange,
  heading = "Today's workout",
}: WorkoutFormProps) {
  const previewPoints = calculateDurationPoints(minutesWorkedOut);

  return (
    <div className="rounded-2xl bg-white p-4 shadow">
      <h2 className="mb-3 text-lg font-bold text-gray-800">{heading}</h2>
      <div className="mb-3">
        <label className="mb-1 block text-sm font-medium text-gray-700">Minutes worked out</label>
        <input
          type="number"
          min={0}
          value={minutesWorkedOut}
          onChange={(e) => onMinutesChange(Number(e.target.value))}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-kit focus:outline-none"
        />
      </div>
      <div className="mb-3">
        <label className="mb-1 block text-sm font-medium text-gray-700">What did you do?</label>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={3}
          placeholder="e.g. 30 min jog + jump rope finisher"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-kit focus:outline-none"
        />
      </div>
      <div className="flex items-center justify-between rounded-lg bg-kit-light px-3 py-2">
        <span className="text-sm text-gray-600">Duration points (live preview)</span>
        <span className="text-lg font-bold text-kit-dark">{previewPoints}</span>
      </div>
      <p className="mt-2 text-xs text-gray-400">
        Goal + challenge bonus points are calculated on submit per group.
      </p>
    </div>
  );
}
