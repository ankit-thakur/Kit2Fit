import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { joinViaInvite } from '../api/groups';

export function JoinScreen() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'joining' | 'done' | 'error'>('joining');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage("That invite link is broken or missing. Ask whoever sent it to try again.");
      return;
    }
    joinViaInvite(token)
      .then(({ alreadyMember }) => {
        setStatus('done');
        setMessage(
          alreadyMember
            ? "Relax, you're already in. Overachiever."
            : "Welcome aboard. Bring your competitive side — it's required.",
        );
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Failed to join group');
      });
  }, [searchParams]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 text-center">
      <h1 className="mb-2 font-display text-2xl font-bold text-ink">Kit2Fit</h1>
      <p className="mb-6 text-gray-600">{status === 'joining' ? 'Hold on, sneaking you in...' : message}</p>
      {status !== 'joining' && (
        <button
          onClick={() => navigate('/')}
          className="rounded-lg bg-teal px-4 py-2 font-semibold text-white hover:bg-teal-dark"
        >
          Go to dashboard
        </button>
      )}
    </div>
  );
}
