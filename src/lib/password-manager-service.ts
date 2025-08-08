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

export interface PhoneNumber {
  id?: string;
  phone_number: string;
  phone_label: string;
  is_primary: boolean;
}

export interface EmailAddress {
  id?: string;
  email_address: string;
  email_label: string;
  is_primary: boolean;
}

export interface CustomField {
  id?: string;
  field_name: string;
  field_value: string;
  field_type: 'text' | 'password' | 'email' | 'url' | 'number' | 'date' | 'boolean';
  is_encrypted: boolean;
  field_order: number;
}

export interface PasswordEntry {
  id: string;
  folder_id: string;
  name: string;
  website_url?: string;
  website_name?: string;
  email?: string; // Backward compatibility - will be moved to email_addresses array
  username?: string;
  password?: string; // Decrypted password for display
  password_encrypted?: string; // Encrypted password for storage
  phone_number?: string; // Backward compatibility - will be moved to phone_numbers array
  authenticator_key?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  folder_name?: string;
  folder_color?: string;
  can_edit?: boolean;
  can_manage?: boolean;
  // Enhanced fields
  phone_numbers?: PhoneNumber[];
  email_addresses?: EmailAddress[];
  custom_fields?: CustomField[];
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
        // Only encrypt and store password if it's not empty
        password_encrypted: entry.password && entry.password.trim() ? encryptPassword(entry.password.trim()) : null,
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

      // Extract enhanced fields that should be saved separately
      const enhancedFields = {
        phone_numbers: updates.phone_numbers,
        email_addresses: updates.email_addresses,
        custom_fields: updates.custom_fields
      };

      // Remove enhanced fields from the main update (they don't belong in password_entries table)
      delete (updatesToSave as any).phone_numbers;
      delete (updatesToSave as any).email_addresses;
      delete (updatesToSave as any).custom_fields;
      delete (updatesToSave as any).shared_users; // This is also not a column in password_entries
      delete (updatesToSave as any).folder_name; // This is from a join, not a column
      delete (updatesToSave as any).folder_color; // This is from a join, not a column
      delete (updatesToSave as any).can_edit; // This is computed, not a column
      delete (updatesToSave as any).can_manage; // This is computed, not a column

      // Encrypt password if provided and not empty, otherwise set to null
      if ('password' in updates) {
        if (updates.password && updates.password.trim()) {
          (updatesToSave as any).password_encrypted = encryptPassword(updates.password.trim());
        } else {
          (updatesToSave as any).password_encrypted = null;
        }
        delete (updatesToSave as any).password;
      }

      // Update the main password entry
      const { data, error } = await supabase
        .from('password_entries')
        .update(updatesToSave)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { data: null, error };
      }

      // Save enhanced fields separately if any were provided
      if (enhancedFields.phone_numbers !== undefined || enhancedFields.email_addresses !== undefined || enhancedFields.custom_fields !== undefined) {
        console.log('Saving enhanced fields for entry:', id, enhancedFields);
        const { error: enhancedError } = await this.saveEnhancedFields(id, enhancedFields);
        if (enhancedError) {
          console.error('Enhanced fields save error:', enhancedError);
          return { data: null, error: enhancedError };
        }
      }

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
  },

  // Enhanced field management
  async getPasswordEntryWithEnhancedFields(entryId: string): Promise<{ data: PasswordEntry | null; error: any }> {
    try {
      // Try to use the full details view first, fall back to manual queries if view doesn't exist
      let { data, error } = await supabase
        .from('password_entries_full_details')
        .select('*')
        .eq('id', entryId)
        .single();

      // If view doesn't exist, build the data manually
      if (error && error.message?.includes('does not exist')) {
        // Get basic entry data
        const { data: entryData, error: entryError } = await supabase
          .from('password_entries')
          .select(`
            *,
            password_folders!inner(name, color)
          `)
          .eq('id', entryId)
          .single();

        if (entryError) return { data: null, error: entryError };

        // Get phone numbers
        const { data: phoneData } = await supabase
          .from('password_entry_phones')
          .select('*')
          .eq('password_entry_id', entryId)
          .order('is_primary', { ascending: false })
          .order('phone_label');

        // Get email addresses
        const { data: emailData } = await supabase
          .from('password_entry_emails')
          .select('*')
          .eq('password_entry_id', entryId)
          .order('is_primary', { ascending: false })
          .order('email_label');

        // Get custom fields
        const { data: customFieldData } = await supabase
          .from('password_entry_custom_fields')
          .select('*')
          .eq('password_entry_id', entryId)
          .order('field_order')
          .order('field_name');

        // Combine the data
        data = {
          ...entryData,
          folder_name: entryData.password_folders?.name,
          folder_color: entryData.password_folders?.color,
          phone_numbers: phoneData || [],
          email_addresses: emailData || [],
          custom_fields: customFieldData || []
        };
        error = null;
      }

      if (data && data.password_encrypted) {
        data.password = decryptPassword(data.password_encrypted);
      }

      // Decrypt custom field values if they're encrypted
      if (data && data.custom_fields) {
        data.custom_fields = data.custom_fields.map((field: any) => ({
          ...field,
          field_value: field.is_encrypted ? decryptPassword(field.field_value) : field.field_value
        }));
      }

      // Log the enhanced fields structure for debugging
      console.log('Loaded enhanced fields for entry:', entryId, {
        phone_numbers: data?.phone_numbers,
        email_addresses: data?.email_addresses,
        custom_fields: data?.custom_fields
      });

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Phone number management
  async addPhoneNumber(entryId: string, phoneData: Omit<PhoneNumber, 'id'>): Promise<{ data: any; error: any }> {
    try {
      const { data, error } = await supabase
        .from('password_entry_phones')
        .insert([{
          password_entry_id: entryId,
          ...phoneData
        }])
        .select()
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async updatePhoneNumber(phoneId: string, phoneData: Partial<PhoneNumber>): Promise<{ data: any; error: any }> {
    try {
      const { data, error } = await supabase
        .from('password_entry_phones')
        .update(phoneData)
        .eq('id', phoneId)
        .select()
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async deletePhoneNumber(phoneId: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('password_entry_phones')
        .delete()
        .eq('id', phoneId);

      return { error };
    } catch (error) {
      return { error };
    }
  },

  // Email address management
  async addEmailAddress(entryId: string, emailData: Omit<EmailAddress, 'id'>): Promise<{ data: any; error: any }> {
    try {
      const { data, error } = await supabase
        .from('password_entry_emails')
        .insert([{
          password_entry_id: entryId,
          ...emailData
        }])
        .select()
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async updateEmailAddress(emailId: string, emailData: Partial<EmailAddress>): Promise<{ data: any; error: any }> {
    try {
      const { data, error } = await supabase
        .from('password_entry_emails')
        .update(emailData)
        .eq('id', emailId)
        .select()
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async deleteEmailAddress(emailId: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('password_entry_emails')
        .delete()
        .eq('id', emailId);

      return { error };
    } catch (error) {
      return { error };
    }
  },

  // Custom field management
  async addCustomField(entryId: string, fieldData: Omit<CustomField, 'id'>): Promise<{ data: any; error: any }> {
    try {
      const fieldToInsert = {
        password_entry_id: entryId,
        ...fieldData,
        // Encrypt the field value if it's marked as encrypted
        field_value: fieldData.is_encrypted ? encryptPassword(fieldData.field_value) : fieldData.field_value
      };

      const { data, error } = await supabase
        .from('password_entry_custom_fields')
        .insert([fieldToInsert])
        .select()
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async updateCustomField(fieldId: string, fieldData: Partial<CustomField>): Promise<{ data: any; error: any }> {
    try {
      const updateData = { ...fieldData };
      
      // Encrypt the field value if it's marked as encrypted
      if ('field_value' in fieldData && fieldData.is_encrypted) {
        updateData.field_value = encryptPassword(fieldData.field_value as string);
      }

      const { data, error } = await supabase
        .from('password_entry_custom_fields')
        .update(updateData)
        .eq('id', fieldId)
        .select()
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async deleteCustomField(fieldId: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('password_entry_custom_fields')
        .delete()
        .eq('id', fieldId);

      return { error };
    } catch (error) {
      return { error };
    }
  },

  // Bulk management for enhanced fields
  async saveEnhancedFields(entryId: string, enhancedData: {
    phone_numbers?: PhoneNumber[];
    email_addresses?: EmailAddress[];
    custom_fields?: CustomField[];
  }): Promise<{ error: any }> {
    try {
      const errors: any[] = [];

      // Handle phone numbers
      if (enhancedData.phone_numbers !== undefined) {
        // Get existing phone numbers from database
        const { data: existingPhones } = await supabase
          .from('password_entry_phones')
          .select('*')
          .eq('password_entry_id', entryId);

        const currentPhones = enhancedData.phone_numbers || [];
        const existingPhoneIds = (existingPhones || []).map((p: any) => p.id);
        const currentPhoneIds = currentPhones.filter(p => p.id).map(p => p.id);

        console.log('Phone sync details:', {
          existingPhones: existingPhones || [],
          currentPhones,
          existingPhoneIds,
          currentPhoneIds
        });

        // Delete removed phone numbers
        const phonesToDelete = existingPhoneIds.filter((id: string) => !currentPhoneIds.includes(id));
        console.log('Phones to delete:', phonesToDelete);
        for (const phoneId of phonesToDelete) {
          console.log('Deleting phone:', phoneId);
          const { error } = await this.deletePhoneNumber(phoneId);
          if (error) {
            console.error('Error deleting phone:', phoneId, error);
            errors.push(error);
          } else {
            console.log('Successfully deleted phone:', phoneId);
          }
        }

        // Add or update current phone numbers
        for (const phone of currentPhones) {
          if (phone.id) {
            const { error } = await this.updatePhoneNumber(phone.id, phone);
            if (error) errors.push(error);
          } else {
            const { error } = await this.addPhoneNumber(entryId, phone);
            if (error) errors.push(error);
          }
        }
      }

      // Handle email addresses
      if (enhancedData.email_addresses !== undefined) {
        // Get existing email addresses from database
        const { data: existingEmails } = await supabase
          .from('password_entry_emails')
          .select('*')
          .eq('password_entry_id', entryId);

        const currentEmails = enhancedData.email_addresses || [];
        const existingEmailIds = (existingEmails || []).map((e: any) => e.id);
        const currentEmailIds = currentEmails.filter(e => e.id).map(e => e.id);

        // Delete removed email addresses
        const emailsToDelete = existingEmailIds.filter((id: string) => !currentEmailIds.includes(id));
        for (const emailId of emailsToDelete) {
          const { error } = await this.deleteEmailAddress(emailId);
          if (error) errors.push(error);
        }

        // Add or update current email addresses
        for (const email of currentEmails) {
          if (email.id) {
            const { error } = await this.updateEmailAddress(email.id, email);
            if (error) errors.push(error);
          } else {
            const { error } = await this.addEmailAddress(entryId, email);
            if (error) errors.push(error);
          }
        }
      }

      // Handle custom fields
      if (enhancedData.custom_fields !== undefined) {
        // Get existing custom fields from database
        const { data: existingFields } = await supabase
          .from('password_entry_custom_fields')
          .select('*')
          .eq('password_entry_id', entryId);

        const currentFields = enhancedData.custom_fields || [];
        const existingFieldIds = (existingFields || []).map((f: any) => f.id);
        const currentFieldIds = currentFields.filter(f => f.id).map(f => f.id);

        // Delete removed custom fields
        const fieldsToDelete = existingFieldIds.filter((id: string) => !currentFieldIds.includes(id));
        for (const fieldId of fieldsToDelete) {
          const { error } = await this.deleteCustomField(fieldId);
          if (error) errors.push(error);
        }

        // Add or update current custom fields
        for (const field of currentFields) {
          if (field.id) {
            const { error } = await this.updateCustomField(field.id, field);
            if (error) errors.push(error);
          } else {
            const { error } = await this.addCustomField(entryId, field);
            if (error) errors.push(error);
          }
        }
      }

      return { error: errors.length > 0 ? errors : null };
    } catch (error) {
      return { error };
    }
  }
};