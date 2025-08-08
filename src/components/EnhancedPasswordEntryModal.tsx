import { useState, useEffect } from 'react';
import { PasswordEntry, PasswordFolder, PhoneNumber, EmailAddress, CustomField, passwordManagerService } from '../lib/password-manager-service';

interface EnhancedPasswordEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entryData: Omit<PasswordEntry, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => void;
  entry?: PasswordEntry | null;
  mode: 'create' | 'edit';
  selectedFolderId?: string;
  folders: PasswordFolder[];
}

export const EnhancedPasswordEntryModal: React.FC<EnhancedPasswordEntryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  entry,
  mode,
  selectedFolderId,
  folders
}) => {
  const [formData, setFormData] = useState({
    folder_id: selectedFolderId || '',
    name: '',
    website_url: '',
    website_name: '',
    email: '',
    username: '',
    password: '',
    authenticator_key: '',
    notes: ''
  });

  // Enhanced fields state
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [emailAddresses, setEmailAddresses] = useState<EmailAddress[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<{
    score: number;
    feedback: string[];
    strength: 'weak' | 'fair' | 'good' | 'strong';
  } | null>(null);

  const [activeTab, setActiveTab] = useState<'basic' | 'phones' | 'emails' | 'custom'>('basic');

  // Predefined phone and email labels
  const phoneLabels = ['Mobile', 'Home', 'Work', 'Emergency', 'WhatsApp', 'Viber', 'Other'];
  const emailLabels = ['Primary', 'Work', 'Personal', 'Recovery', 'Backup', 'Other'];
  const fieldTypes = ['text', 'password', 'email', 'url', 'number', 'date', 'boolean'] as const;

  useEffect(() => {
    if (mode === 'edit' && entry) {
      setFormData({
        folder_id: entry.folder_id,
        name: entry.name,
        website_url: entry.website_url || '',
        website_name: entry.website_name || '',
        email: entry.email || '',
        username: entry.username || '',
        password: entry.password || '',
        authenticator_key: entry.authenticator_key || '',
        notes: entry.notes || ''
      });

      // Set enhanced fields
      setPhoneNumbers(entry.phone_numbers || []);
      setEmailAddresses(entry.email_addresses || []);
      setCustomFields(entry.custom_fields || []);
    } else {
      // Reset form for create mode
      setFormData({
        folder_id: selectedFolderId || '',
        name: '',
        website_url: '',
        website_name: '',
        email: '',
        username: '',
        password: '',
        authenticator_key: '',
        notes: ''
      });
      setPhoneNumbers([]);
      setEmailAddresses([]);
      setCustomFields([]);
    }
  }, [mode, entry, selectedFolderId, isOpen]);

  useEffect(() => {
    if (formData.password) {
      const strength = passwordManagerService.checkPasswordStrength(formData.password);
      setPasswordStrength(strength);
    } else {
      setPasswordStrength(null);
    }
  }, [formData.password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Please enter a name for this password entry');
      return;
    }

    if (!formData.folder_id) {
      alert('Please select a folder');
      return;
    }

    setSaving(true);
    try {
      const enhancedEntry = {
        ...formData,
        phone_numbers: phoneNumbers,
        email_addresses: emailAddresses,
        custom_fields: customFields
      };
      await onSave(enhancedEntry);
    } finally {
      setSaving(false);
    }
  };

  const generatePassword = () => {
    const newPassword = passwordManagerService.generateStrongPassword(16);
    setFormData({ ...formData, password: newPassword });
  };

  // Phone number management
  const addPhoneNumber = () => {
    setPhoneNumbers([...phoneNumbers, {
      phone_number: '',
      phone_label: 'Mobile',
      is_primary: phoneNumbers.length === 0
    }]);
  };

  const updatePhoneNumber = (index: number, field: keyof PhoneNumber, value: any) => {
    const updated = [...phoneNumbers];
    updated[index] = { ...updated[index], [field]: value };
    
    // Ensure only one primary phone
    if (field === 'is_primary' && value) {
      updated.forEach((phone, i) => {
        if (i !== index) phone.is_primary = false;
      });
    }
    
    setPhoneNumbers(updated);
  };

  const removePhoneNumber = (index: number) => {
    setPhoneNumbers(phoneNumbers.filter((_, i) => i !== index));
  };

  // Email address management
  const addEmailAddress = () => {
    setEmailAddresses([...emailAddresses, {
      email_address: '',
      email_label: 'Primary',
      is_primary: emailAddresses.length === 0
    }]);
  };

  const updateEmailAddress = (index: number, field: keyof EmailAddress, value: any) => {
    const updated = [...emailAddresses];
    updated[index] = { ...updated[index], [field]: value };
    
    // Ensure only one primary email
    if (field === 'is_primary' && value) {
      updated.forEach((email, i) => {
        if (i !== index) email.is_primary = false;
      });
    }
    
    setEmailAddresses(updated);
  };

  const removeEmailAddress = (index: number) => {
    setEmailAddresses(emailAddresses.filter((_, i) => i !== index));
  };

  // Custom field management
  const addCustomField = () => {
    setCustomFields([...customFields, {
      field_name: '',
      field_value: '',
      field_type: 'text',
      is_encrypted: false,
      field_order: customFields.length
    }]);
  };

  const updateCustomField = (index: number, field: keyof CustomField, value: any) => {
    const updated = [...customFields];
    updated[index] = { ...updated[index], [field]: value };
    setCustomFields(updated);
  };

  const removeCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    if (!saving) {
      onClose();
    }
  };

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'weak': return 'text-red-600 bg-red-100';
      case 'fair': return 'text-yellow-600 bg-yellow-100';
      case 'good': return 'text-blue-600 bg-blue-100';
      case 'strong': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {mode === 'create' ? 'Create Password Entry' : 'Edit Password Entry'}
          </h2>
          
          {/* Tab Navigation */}
          <div className="mt-4 flex space-x-1 bg-gray-100 p-1 rounded-lg">
            {[
              { id: 'basic', label: 'Basic Info', icon: '📝' },
              { id: 'phones', label: `Phones (${phoneNumbers.length})`, icon: '📱' },
              { id: 'emails', label: `Emails (${emailAddresses.length})`, icon: '📧' },
              { id: 'custom', label: `Custom Fields (${customFields.length})`, icon: '⚙️' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="mr-1">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Basic Information Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              {/* Folder Selection */}
              <div>
                <label htmlFor="folder_id" className="block text-sm font-medium text-gray-700 mb-1">
                  Folder *
                </label>
                <select
                  id="folder_id"
                  value={formData.folder_id}
                  onChange={(e) => setFormData({ ...formData, folder_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select a folder...</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Entry Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Entry Name *
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Gmail Account"
                  required
                />
              </div>

              {/* Website Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="website_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Website Name
                  </label>
                  <input
                    type="text"
                    id="website_name"
                    value={formData.website_name}
                    onChange={(e) => setFormData({ ...formData, website_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Google"
                  />
                </div>
                <div>
                  <label htmlFor="website_url" className="block text-sm font-medium text-gray-700 mb-1">
                    Website URL
                  </label>
                  <input
                    type="url"
                    id="website_url"
                    value={formData.website_url}
                    onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://www.example.com"
                  />
                </div>
              </div>

              {/* Login Credentials */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Primary Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="username"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 pr-20 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter password"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="px-3 py-2 text-gray-400 hover:text-gray-600"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? '👁️‍🗨️' : '👁️'}
                    </button>
                    <button
                      type="button"
                      onClick={generatePassword}
                      className="px-3 py-2 text-blue-600 hover:text-blue-700 text-sm font-medium border-l border-gray-300"
                      title="Generate strong password"
                    >
                      Generate
                    </button>
                  </div>
                </div>
                
                {/* Password Strength Indicator */}
                {passwordStrength && (
                  <div className="mt-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">Strength:</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStrengthColor(passwordStrength.strength)}`}>
                        {passwordStrength.strength.toUpperCase()}
                      </span>
                    </div>
                    {passwordStrength.feedback.length > 0 && (
                      <div className="mt-1">
                        <ul className="text-xs text-gray-500 space-y-1">
                          {passwordStrength.feedback.map((feedback, index) => (
                            <li key={index}>• {feedback}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Authenticator Key */}
              <div>
                <label htmlFor="authenticator_key" className="block text-sm font-medium text-gray-700 mb-1">
                  Authenticator Key (2FA/TOTP)
                </label>
                <input
                  type="text"
                  id="authenticator_key"
                  value={formData.authenticator_key}
                  onChange={(e) => setFormData({ ...formData, authenticator_key: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="TOTP secret key"
                />
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Additional notes or information..."
                />
              </div>
            </div>
          )}

          {/* Phone Numbers Tab */}
          {activeTab === 'phones' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Phone Numbers</h3>
                <button
                  type="button"
                  onClick={addPhoneNumber}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                >
                  <span className="mr-1">+</span>
                  Add Phone
                </button>
              </div>

              {phoneNumbers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No phone numbers added yet.</p>
                  <p className="text-sm">Click "Add Phone" to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {phoneNumbers.map((phone, index) => (
                    <div key={index} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-md">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Phone Number
                          </label>
                          <input
                            type="tel"
                            value={phone.phone_number}
                            onChange={(e) => updatePhoneNumber(index, 'phone_number', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="+1234567890"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Label
                          </label>
                          <select
                            value={phone.phone_label}
                            onChange={(e) => updatePhoneNumber(index, 'phone_label', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            {phoneLabels.map((label) => (
                              <option key={label} value={label}>{label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={phone.is_primary}
                            onChange={(e) => updatePhoneNumber(index, 'is_primary', e.target.checked)}
                            className="mr-1"
                          />
                          <span className="text-sm text-gray-600">Primary</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removePhoneNumber(index)}
                          className="text-red-600 hover:text-red-700 p-1"
                          title="Remove phone number"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Email Addresses Tab */}
          {activeTab === 'emails' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Email Addresses</h3>
                <button
                  type="button"
                  onClick={addEmailAddress}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                >
                  <span className="mr-1">+</span>
                  Add Email
                </button>
              </div>

              {emailAddresses.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No email addresses added yet.</p>
                  <p className="text-sm">Click "Add Email" to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {emailAddresses.map((email, index) => (
                    <div key={index} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-md">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email Address
                          </label>
                          <input
                            type="email"
                            value={email.email_address}
                            onChange={(e) => updateEmailAddress(index, 'email_address', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="user@example.com"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Label
                          </label>
                          <select
                            value={email.email_label}
                            onChange={(e) => updateEmailAddress(index, 'email_label', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            {emailLabels.map((label) => (
                              <option key={label} value={label}>{label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={email.is_primary}
                            onChange={(e) => updateEmailAddress(index, 'is_primary', e.target.checked)}
                            className="mr-1"
                          />
                          <span className="text-sm text-gray-600">Primary</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeEmailAddress(index)}
                          className="text-red-600 hover:text-red-700 p-1"
                          title="Remove email address"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Custom Fields Tab */}
          {activeTab === 'custom' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Custom Fields</h3>
                <button
                  type="button"
                  onClick={addCustomField}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                >
                  <span className="mr-1">+</span>
                  Add Custom Field
                </button>
              </div>

              {customFields.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No custom fields added yet.</p>
                  <p className="text-sm">Click "Add Custom Field" to add additional information.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {customFields.map((field, index) => (
                    <div key={index} className="p-3 border border-gray-200 rounded-md">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Field Name
                          </label>
                          <input
                            type="text"
                            value={field.field_name}
                            onChange={(e) => updateCustomField(index, 'field_name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="e.g., Security Question"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Field Type
                          </label>
                          <select
                            value={field.field_type}
                            onChange={(e) => updateCustomField(index, 'field_type', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            {fieldTypes.map((type) => (
                              <option key={type} value={type}>
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-end space-x-2">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={field.is_encrypted}
                              onChange={(e) => updateCustomField(index, 'is_encrypted', e.target.checked)}
                              className="mr-1"
                            />
                            <span className="text-sm text-gray-600">Encrypt</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => removeCustomField(index)}
                            className="text-red-600 hover:text-red-700 p-2"
                            title="Remove custom field"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Field Value
                        </label>
                        <input
                          type={field.field_type === 'password' ? 'password' : field.field_type === 'email' ? 'email' : field.field_type === 'url' ? 'url' : field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                          value={field.field_value}
                          onChange={(e) => updateCustomField(index, 'field_value', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter field value"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 mt-6">
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
              disabled={saving || !formData.name.trim() || !formData.folder_id}
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
                mode === 'create' ? 'Create Entry' : 'Update Entry'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};