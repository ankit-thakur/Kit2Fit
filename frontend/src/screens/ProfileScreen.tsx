import { useEffect, useState } from 'react';
import { getMe, updateMe, type Me } from '../api/users';
import { listMyGroups, type MyGroup } from '../api/groups';
import { ProfilePictureUploader } from '../components/ProfilePictureUploader';
import { CreateGroupForm } from '../components/CreateGroupForm';
import { MyGroupCard } from '../components/MyGroupCard';
import { useAuth } from '../auth/AuthContext';

export function ProfileScreen() {
  const { signOut } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [groups, setGroups] = useState<MyGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', nickname: '', phoneNumber: '' });
  const [isSaving, setIsSaving] = useState(false);

  async function refresh() {
    setIsLoading(true);
    setError(null);
    try {
      const [meRes, groupsRes] = await Promise.all([getMe(), listMyGroups()]);
      setMe(meRes);
      setGroups(groupsRes.groups);
      setEditForm({ name: meRes.name, nickname: meRes.nickname, phoneNumber: meRes.phoneNumber });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSaveProfile() {
    setIsSaving(true);
    try {
      await updateMe(editForm);
      setIsEditing(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading && !me) {
    return <div className="p-4 text-center text-gray-400">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-kit-dark">Profile</h1>
        <button onClick={signOut} className="text-sm text-gray-400">
          Sign out
        </button>
      </div>

      {error && <p className="text-center text-red-500">{error}</p>}

      {me && (
        <div className="space-y-3 rounded-2xl bg-white p-4 shadow">
          <ProfilePictureUploader profilePictureUrl={me.profilePictureUrl} onUploaded={refresh} />

          {isEditing ? (
            <div className="space-y-2">
              <input
                value={editForm.name}
                onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
              <input
                value={editForm.nickname}
                onChange={(e) => setEditForm((p) => ({ ...p, nickname: e.target.value }))}
                placeholder="Nickname"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
              <input
                value={editForm.phoneNumber}
                onChange={(e) => setEditForm((p) => ({ ...p, phoneNumber: e.target.value }))}
                placeholder="Phone number"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex-1 rounded-lg border border-gray-300 py-2 font-semibold text-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="flex-1 rounded-lg bg-kit py-2 font-semibold text-white hover:bg-kit-dark disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-lg font-bold text-gray-800">{me.nickname}</p>
              <p className="text-sm text-gray-500">{me.name}</p>
              <p className="text-sm text-gray-400">{me.email}</p>
              <p className="text-sm text-gray-400">{me.phoneNumber}</p>
              <button onClick={() => setIsEditing(true)} className="mt-2 text-sm font-semibold text-kit-dark">
                Edit profile
              </button>
            </div>
          )}
        </div>
      )}

      <h2 className="text-lg font-bold text-gray-800">My groups</h2>
      {me &&
        groups.map((group) => (
          <MyGroupCard key={group.groupId} group={group} currentUserId={me.userId} onChanged={refresh} />
        ))}

      <CreateGroupForm onCreated={refresh} />
    </div>
  );
}
