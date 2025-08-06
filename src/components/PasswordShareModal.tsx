import { useState, useEffect } from 'react';
import { passwordManagerService, PasswordEntry, SharePermission } from '../lib/password-manager-service';
import { userService } from '../lib/supabase-secure';

interface PasswordShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: PasswordEntry | null;
  onSave: (entryId: string, permissions: SharePermission[]) => void;
}

export const PasswordShareModal: React.FC<PasswordShareModalProps> = ({
  isOpen,
  onClose,
  entry,
  onSave
}) => {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<{[key: string]: {selected: boolean, canEdit: boolean}}>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      if (entry?.shared_users) {
        const initialSelected: {[key: string]: {selected: boolean, canEdit: boolean}} = {};
        entry.shared_users.forEach(sharedUser => {
          initialSelected[sharedUser.user_id] = {
            selected: true,
            canEdit: sharedUser.can_edit
          };
        });
        setSelectedUsers(initialSelected);
      }
    }
  }, [isOpen, entry]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await userService.getAllUsers();
      if (error) {
        console.error('Failed to load users:', error);
      } else {
        // Filter out administrators and the current user
        const availableUsers = (data || []).filter(user => 
          user.role !== 'administrator' && 
          user.id !== entry?.created_by
        );
        setUsers(availableUsers);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserToggle = (userId: string) => {
    setSelectedUsers(prev => ({
      ...prev,
      [userId]: {
        selected: !prev[userId]?.selected,
        canEdit: prev[userId]?.canEdit || false
      }
    }));
  };

  const handleEditToggle = (userId: string) => {
    setSelectedUsers(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        canEdit: !prev[userId]?.canEdit
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!entry) return;

    setSaving(true);
    try {
      const permissions: SharePermission[] = Object.entries(selectedUsers)
        .filter(([_, data]) => data.selected)
        .map(([userId, data]) => ({
          user_id: userId,
          can_edit: data.canEdit
        }));

      await onSave(entry.id, permissions);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setSelectedUsers({});
      onClose();
    }
  };

  if (!isOpen || !entry) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Share Password Entry: {entry.name}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Select users who can access this password entry
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No users available to share with</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h4 className="text-sm font-medium text-blue-900">Sharing Permissions</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      Users with "View Only" can see the password details. Users with "Can Edit" can modify the password entry.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className={`border rounded-lg p-4 transition-all ${
                      selectedUsers[user.id]?.selected
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={selectedUsers[user.id]?.selected || false}
                          onChange={() => handleUserToggle(user.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">
                              {user.first_name?.[0]}{user.last_name?.[0]}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {user.first_name} {user.last_name}
                            </p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              user.role === 'pharmacist' 
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {user.role || 'staff'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {selectedUsers[user.id]?.selected && (
                        <div className="flex items-center space-x-2">
                          <label className="flex items-center space-x-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selectedUsers[user.id]?.canEdit || false}
                              onChange={() => handleEditToggle(user.id)}
                              className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                            />
                            <span className="text-gray-700">Can Edit</span>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-6 mt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {saving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                'Update Sharing'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};