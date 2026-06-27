import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signUp, confirmSignUp } from '../auth/cognito';

export function SignupScreen() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'details' | 'confirm'>('details');
  const [form, setForm] = useState({
    email: '',
    password: '',
    phoneNumber: '',
    name: '',
    nickname: '',
  });
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await signUp(form);
      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await confirmSignUp(form.email, code);
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm account');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-6">
      <h1 className="mb-1 font-display text-3xl font-bold text-navy">Kit2Fit</h1>
      <p className="mb-8 text-gray-500">
        {step === 'details'
          ? "Pick a nickname. Choose wisely — it's basically permanent."
          : "We emailed you a code. Yes, check spam. It's always spam."}
      </p>

      {step === 'details' ? (
        <form onSubmit={handleSignUp} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow">
          <Field label="Name" value={form.name} onChange={(v) => update('name', v)} />
          <Field label="Nickname" value={form.nickname} onChange={(v) => update('nickname', v)} />
          <Field label="Email" type="email" value={form.email} onChange={(v) => update('email', v)} />
          <Field
            label="Phone number"
            type="tel"
            placeholder="+15551234567"
            value={form.phoneNumber}
            onChange={(v) => update('phoneNumber', v)}
          />
          <Field
            label="Password"
            type="password"
            value={form.password}
            onChange={(v) => update('password', v)}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-orange py-2 font-semibold text-white transition hover:bg-orange-dark disabled:opacity-50"
          >
            {isSubmitting ? 'Building your legend...' : 'Sign up'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleConfirm} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow">
          <Field label="Confirmation code" value={code} onChange={setCode} />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-orange py-2 font-semibold text-white transition hover:bg-orange-dark disabled:opacity-50"
          >
            {isSubmitting ? 'Confirming...' : 'Confirm account'}
          </button>
        </form>
      )}

      <p className="mt-4 text-sm text-gray-500">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-navy">
          Sign in
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        required
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue focus:outline-none"
      />
    </div>
  );
}
