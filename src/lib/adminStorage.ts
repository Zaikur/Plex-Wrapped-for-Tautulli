// Admin panel storage utilities

const ADMIN_PASSWORD_KEY = 'plex-wrapped-admin-password';
const ADMIN_SETTINGS_KEY = 'plex-wrapped-admin-settings';
const USER_PASSWORDS_KEY = 'plex-wrapped-user-passwords';
const EMAIL_SETTINGS_KEY = 'plex-wrapped-email-settings';

export interface AdminSettings {
  discreetMode: boolean;
  passwordProtectUsers: boolean;
  normalizeTautulliAnomalies: boolean;
  useCustomTitle: boolean;
  customTitle: string;
}

export interface EmailSettings {
  appUrl: string;
  serverName: string;
  emailTemplate: string;
}

export interface UserPassword {
  userId: number;
  username: string;
  friendlyName: string;
  email?: string;
  password: string;
}

export const DEFAULT_EMAIL_TEMPLATE = `Hi {{friendlyName}},

Your Plex Wrapped for {{serverName}} is ready!

Visit {{appUrl}} to see your personalized viewing statistics.

Your login details:
Username: {{username}}
Password: {{password}}

Enjoy reliving your year in entertainment!

Best regards,
The {{serverName}} Team`;

// Simple hash function for password storage (not cryptographically secure, but suitable for local app)
const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
};

// Generate a random password
export const generatePassword = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// Admin password functions
export const isAdminPasswordSet = (): boolean => {
  return localStorage.getItem(ADMIN_PASSWORD_KEY) !== null;
};

export const setAdminPassword = (password: string): void => {
  localStorage.setItem(ADMIN_PASSWORD_KEY, simpleHash(password));
};

export const verifyAdminPassword = (password: string): boolean => {
  const stored = localStorage.getItem(ADMIN_PASSWORD_KEY);
  if (!stored) return false;
  return simpleHash(password) === stored;
};

export const resetAdminPassword = (): void => {
  localStorage.removeItem(ADMIN_PASSWORD_KEY);
};

// Admin settings functions
export const getAdminSettings = (): AdminSettings => {
  const stored = localStorage.getItem(ADMIN_SETTINGS_KEY);
  if (!stored) {
    return {
      discreetMode: false,
      passwordProtectUsers: false,
      normalizeTautulliAnomalies: false,
      useCustomTitle: false,
      customTitle: 'Plex Wrapped',
    };
  }
  try {
    const parsed = JSON.parse(stored);
    return {
      discreetMode: parsed.discreetMode || false,
      passwordProtectUsers: parsed.passwordProtectUsers || false,
      normalizeTautulliAnomalies: parsed.normalizeTautulliAnomalies || false,
      useCustomTitle: parsed.useCustomTitle || false,
      customTitle: parsed.customTitle || 'Plex Wrapped',
    };
  } catch {
    return {
      discreetMode: false,
      passwordProtectUsers: false,
      normalizeTautulliAnomalies: false,
      useCustomTitle: false,
      customTitle: 'Plex Wrapped',
    };
  }
};

export const saveAdminSettings = (settings: AdminSettings): void => {
  localStorage.setItem(ADMIN_SETTINGS_KEY, JSON.stringify(settings));
};

// User password functions
export const getUserPasswords = (): UserPassword[] => {
  const stored = localStorage.getItem(USER_PASSWORDS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

export const saveUserPasswords = (passwords: UserPassword[]): void => {
  localStorage.setItem(USER_PASSWORDS_KEY, JSON.stringify(passwords));
};

export const getUserPassword = (userId: number): string | null => {
  const passwords = getUserPasswords();
  const user = passwords.find(p => p.userId === userId);
  return user?.password || null;
};

export const setUserPassword = (userId: number, username: string, friendlyName: string, password: string, email?: string): void => {
  const passwords = getUserPasswords();
  const existingIndex = passwords.findIndex(p => p.userId === userId);
  
  if (existingIndex >= 0) {
    passwords[existingIndex] = { userId, username, friendlyName, password, email };
  } else {
    passwords.push({ userId, username, friendlyName, password, email });
  }
  
  saveUserPasswords(passwords);
};

export const verifyUserPassword = (userId: number, password: string): boolean => {
  const storedPassword = getUserPassword(userId);
  return storedPassword === password;
};

export const generatePasswordsForAllUsers = (users: { userId: number; username: string; friendlyName: string; email?: string }[]): void => {
  const existingPasswords = getUserPasswords();
  
  users.forEach(user => {
    const existing = existingPasswords.find(p => p.userId === user.userId);
    if (!existing) {
      setUserPassword(user.userId, user.username, user.friendlyName, generatePassword(), user.email);
    }
  });
};

// Email settings functions
export const getEmailSettings = (): EmailSettings => {
  const stored = localStorage.getItem(EMAIL_SETTINGS_KEY);
  if (!stored) {
    return {
      appUrl: window.location.origin,
      serverName: 'Plex Server',
      emailTemplate: DEFAULT_EMAIL_TEMPLATE,
    };
  }
  try {
    return JSON.parse(stored);
  } catch {
    return {
      appUrl: window.location.origin,
      serverName: 'Plex Server',
      emailTemplate: DEFAULT_EMAIL_TEMPLATE,
    };
  }
};

export const saveEmailSettings = (settings: EmailSettings): void => {
  localStorage.setItem(EMAIL_SETTINGS_KEY, JSON.stringify(settings));
};

export const updateUserEmail = (userId: number, email: string): void => {
  const passwords = getUserPasswords();
  const existingIndex = passwords.findIndex(p => p.userId === userId);
  
  if (existingIndex >= 0) {
    passwords[existingIndex].email = email;
    saveUserPasswords(passwords);
  }
};

export const getEmailForUser = (userId: number, username: string, friendlyName: string, password: string, emailSettings: EmailSettings): string => {
  return emailSettings.emailTemplate
    .replace(/\{\{friendlyName\}\}/g, friendlyName)
    .replace(/\{\{username\}\}/g, username)
    .replace(/\{\{password\}\}/g, password)
    .replace(/\{\{appUrl\}\}/g, emailSettings.appUrl)
    .replace(/\{\{serverName\}\}/g, emailSettings.serverName);
};