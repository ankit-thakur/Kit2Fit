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
      setMessage('Missing invite token.');
      return;
    }
    joinViaInvite(token)
      .then(({ alreadyMember }) => {
        setStatus('done');
        setMessage(alreadyMember ? 'You are already in this group!' : 'You joined the group!');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Failed to join group');
      });
  }, [searchParams]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-kit-light px-6 text-center">
      <h1 className="mb-2 text-2xl font-extrabold text-kit-dark">Kit2Fit</h1>
      <p className="mb-6 text-gray-600">{status === 'joining' ? 'Joining group...' : message}</p>
      {status !== 'joining' && (
        <button
          onClick={() => navigate('/')}
          className="rounded-lg bg-kit px-4 py-2 font-semibold text-white hover:bg-kit-dark"
        >
          Go to dashboard
        </button>
      )}
    </div>
  );
}
