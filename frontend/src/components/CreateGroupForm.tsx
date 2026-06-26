import { useState, type FormEvent } from 'react';
import { createGroup, type CreateGroupInput } from '../api/groups';

export function CreateGroupForm({ onCreated }: { onCreated: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<CreateGroupInput>({
    name: '',
    goalCategory: '',
    challengeStartDate: '',
    challengeEndDate: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function update<K extends keyof CreateGroupInput>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await createGroup(form);
      setForm({ name: '', goalCategory: '', challengeStartDate: '', challengeEndDate: '' });
      setIsOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full rounded-lg border-2 border-dashed border-kit py-3 font-semibold text-kit-dark"
      >
        + Create a new group
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl bg-white p-4 shadow">
      <h3 className="font-bold text-gray-800">New group</h3>
      <input
        required
        placeholder="Group name"
        value={form.name}
        onChange={(e) => update('name', e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2"
      />
      <input
        required
        placeholder="Goal category (e.g. weight loss, running)"
        value={form.goalCategory}
        onChange={(e) => update('goalCategory', e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2"
      />
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-gray-500">Start date</label>
          <input
            required
            type="date"
            value={form.challengeStartDate}
            onChange={(e) => update('challengeStartDate', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-gray-500">End date</label>
          <input
            required
            type="date"
            value={form.challengeEndDate}
            onChange={(e) => update('challengeEndDate', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="flex-1 rounded-lg border border-gray-300 py-2 font-semibold text-gray-600"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-lg bg-kit py-2 font-semibold text-white hover:bg-kit-dark disabled:opacity-50"
        >
          {isSubmitting ? 'Creating...' : 'Create'}
        </button>
      </div>
    </form>
  );
}
