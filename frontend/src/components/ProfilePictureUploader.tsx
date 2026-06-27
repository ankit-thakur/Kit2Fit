import { useRef, useState } from 'react';
import { uploadProfilePicture, updateMe } from '../api/users';

interface ProfilePictureUploaderProps {
  profilePictureUrl?: string;
  onUploaded: (key: string) => void;
}

export function ProfilePictureUploader({ profilePictureUrl, onUploaded }: ProfilePictureUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setError(null);
    try {
      const key = await uploadProfilePicture(file);
      await updateMe({ profilePictureKey: key });
      onUploaded(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload picture');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="h-24 w-24 overflow-hidden rounded-full border-2 border-coral bg-coral-pale"
      >
        {profilePictureUrl ? (
          <img src={profilePictureUrl} alt="Profile" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-3xl">{'\u{1F4F8}'}</span>
        )}
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <span className="text-xs text-gray-400">{isUploading ? 'Uploading...' : 'Tap for a glow-up'}</span>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
