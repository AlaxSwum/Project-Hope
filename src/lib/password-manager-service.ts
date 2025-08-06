import { supabase } from './supabase-secure';

// Simple encryption/decryption functions (in production, use more robust encryption)
const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_PASSWORD_ENCRYPTION_KEY || 'your-32-character-secret-key-here';

// Simple XOR encryption for demo purposes - in production use proper encryption like AES
function encryptPassword(password: string): string {
  try {
    let encrypted = '';
    for (let i = 0; i < password.length; i++) {
      encrypted += String.fromCharCode(password.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length));
    }
    return btoa(encrypted); // Base64 encode
  } catch (error) {
    console.error('Encryption error:', error);
    return password; // Fallback to plain text in case of error
  }
}

function decryptPassword(encryptedPassword: string): string {
  try {
    const encrypted = atob(encryptedPassword); // Base64 decode
    let decrypted = '';
    for (let i = 0; i < encrypted.length; i++) {
      decrypted += String.fromCharCode(encrypted.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length));
    }
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return encryptedPassword; // Fallback to return as-is
  }
}

export interface PasswordFolder {
  id: string;
  name: string;
  description?: string;
  color: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  password_count?: number;
  shared_users?: Array<{
    user_id: string;
    user_name: string;
    can_edit: boolean;
  }>;
  can_manage?: boolean;
}

export interface PasswordEntry {
  id: string;
  folder_id: string;
  name: string;
  website_url?: string;
  website_name?: string;
  email?: string;
  username?: string;
  password?: string; // Decrypted password for display
  password_encrypted?: string; // Encrypted password for storage
  phone_number?: string;
  authenticator_key?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  folder_name?: string;
  folder_color?: string;
  can_edit?: boolean;
  can_manage?: boolean;
  shared_users?: Array<{
    user_id: string;
    user_name: string;
    can_edit: boolean;
  }>;
}

export interface SharePermission {
  user_id: string;
  can_edit: boolean;
}

export const passwordManagerService = {
  // Folder management
  async getFolders(): Promise<{ data: PasswordFolder[] | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('password_folders_with_details')
        .select('*')
        .order('name');

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async createFolder(folder: Omit<PasswordFolder, 'id' | 'created_at' | 'updated_at' | 'created_by'>): Promise<{ data: any; error: any }> {
    try {
      const { data, error } = await supabase
        .from('password_folders')
        .insert([{
          ...folder,
          created_by: (await supabase.auth.getUser()).data.user?.id
        }])
        .select()
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async updateFolder(id: string, updates: Partial<PasswordFolder>): Promise<{ data: any; error: any }> {
    try {
      const { data, error } = await supabase
        .from('password_folders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async deleteFolder(id: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('password_folders')
        .delete()
        .eq('id', id);

      return { error };
    } catch (error) {
      return { error };
    }
  },

  // Password entry management
  async getPasswordEntries(folderId?: string): Promise<{ data: PasswordEntry[] | null; error: any }> {
    try {
      let query = supabase
        .from('password_entries_with_details')
        .select('*');

      if (folderId) {
        query = query.eq('folder_id', folderId);
      }

      const { data, error } = await query.order('name');

      if (data) {
        // Decrypt passwords for display
        const decryptedData = data.map(entry => ({
          ...entry,
          password: entry.password_encrypted ? decryptPassword(entry.password_encrypted) : undefined
        }));
        return { data: decryptedData, error };
      }

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async createPasswordEntry(entry: Omit<PasswordEntry, 'id' | 'created_at' | 'updated_at' | 'created_by'>): Promise<{ data: any; error: any }> {
    try {
      const entryToInsert = {
        ...entry,
        password_encrypted: entry.password ? encryptPassword(entry.password) : undefined,
        created_by: (await supabase.auth.getUser()).data.user?.id
      };

      // Remove the plain password field before inserting
      delete (entryToInsert as any).password;

      const { data, error } = await supabase
        .from('password_entries')
        .insert([entryToInsert])
        .select()
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async updatePasswordEntry(id: string, updates: Partial<PasswordEntry>): Promise<{ data: any; error: any }> {
    try {
      const updatesToSave = { ...updates };

      // Encrypt password if provided
      if (updates.password) {
        (updatesToSave as any).password_encrypted = encryptPassword(updates.password);
        delete (updatesToSave as any).password;
      }

      const { data, error } = await supabase
        .from('password_entries')
        .update(updatesToSave)
        .eq('id', id)
        .select()
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async deletePasswordEntry(id: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('password_entries')
        .delete()
        .eq('id', id);

      return { error };
    } catch (error) {
      return { error };
    }
  },

  // Sharing management
  async sharePassword(passwordId: string, permissions: SharePermission[]): Promise<{ error: any }> {
    try {
      const currentUser = (await supabase.auth.getUser()).data.user;
      if (!currentUser) throw new Error('Not authenticated');

      // First, delete existing shares for this password
      await supabase
        .from('password_shares')
        .delete()
        .eq('password_id', passwordId);

      // Insert new shares
      if (permissions.length > 0) {
        const sharesToInsert = permissions.map(perm => ({
          password_id: passwordId,
          user_id: perm.user_id,
          can_edit: perm.can_edit,
          shared_by: currentUser.id
        }));

        const { error } = await supabase
          .from('password_shares')
          .insert(sharesToInsert);

        return { error };
      }

      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  async shareFolder(folderId: string, permissions: SharePermission[]): Promise<{ error: any }> {
    try {
      const currentUser = (await supabase.auth.getUser()).data.user;
      if (!currentUser) throw new Error('Not authenticated');

      // First, delete existing shares for this folder
      await supabase
        .from('folder_shares')
        .delete()
        .eq('folder_id', folderId);

      // Insert new shares
      if (permissions.length > 0) {
        const sharesToInsert = permissions.map(perm => ({
          folder_id: folderId,
          user_id: perm.user_id,
          can_edit: perm.can_edit,
          shared_by: currentUser.id
        }));

        const { error } = await supabase
          .from('folder_shares')
          .insert(sharesToInsert);

        return { error };
      }

      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  // Get user accessible passwords (for regular users)
  async getUserAccessiblePasswords(): Promise<{ data: PasswordEntry[] | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('user_accessible_passwords')
        .select('*')
        .order('folder_name', { ascending: true })
        .order('name', { ascending: true });

      if (data) {
        // Decrypt passwords for display
        const decryptedData = data.map((entry: any) => ({
          ...entry,
          password: entry.password_encrypted ? decryptPassword(entry.password_encrypted) : undefined
        }));
        return { data: decryptedData, error };
      }

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Utility functions
  generateStrongPassword(length: number = 16): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const allChars = lowercase + uppercase + numbers + symbols;

    let password = '';
    
    // Ensure at least one character from each set
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  },

  checkPasswordStrength(password: string): {
    score: number;
    feedback: string[];
    strength: 'weak' | 'fair' | 'good' | 'strong';
  } {
    let score = 0;
    const feedback: string[] = [];

    if (password.length >= 8) score += 1;
    else feedback.push('Use at least 8 characters');

    if (password.length >= 12) score += 1;
    else if (password.length >= 8) feedback.push('Consider using 12+ characters for better security');

    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('Include lowercase letters');

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('Include uppercase letters');

    if (/[0-9]/.test(password)) score += 1;
    else feedback.push('Include numbers');

    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    else feedback.push('Include special characters');

    const strength = score <= 2 ? 'weak' : score <= 3 ? 'fair' : score <= 4 ? 'good' : 'strong';

    return { score, feedback, strength };
  }
};