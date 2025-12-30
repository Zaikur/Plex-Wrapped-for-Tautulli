// Server-side configuration for self-hosted Plex Wrapped
// This config is stored in a JSON file and shared across all clients
// For Docker deployment, mount a volume to persist /data/config.json

import { TautulliConfig } from "@/types/tautulli";
import { AdminSettings, EmailSettings, UserPassword } from "./adminStorage";

export const DEFAULT_EMAIL_TEMPLATE = `Hi {{friendlyName}},

Your Plex Wrapped for {{serverName}} is ready!

Visit {{appUrl}} to see your personalized viewing statistics.

Your login details:
Username: {{username}}
Password: {{password}}

Enjoy reliving your year in entertainment!

Best regards,
The {{serverName}} Team`;

export interface ServerConfig {
  tautulli?: TautulliConfig;
  adminPasswordHash?: string;
  adminSettings: AdminSettings;
  emailSettings: EmailSettings;
  userPasswords: UserPassword[];
}

const DEFAULT_CONFIG: ServerConfig = {
  adminSettings: {
    discreetMode: false,
    passwordProtectUsers: false,
    normalizeTautulliAnomalies: false,
    useCustomTitle: false,
    customTitle: 'Plex Wrapped',
    useCustomLogo: false,
    logoMaxHeight: 80,
  },
  emailSettings: {
    appUrl: "",
    serverName: "Plex Server",
    emailTemplate: DEFAULT_EMAIL_TEMPLATE,
  },
  userPasswords: [],
};

// In-memory cache of the config
let configCache: ServerConfig | null = null;

// Simple hash function for password storage
const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(36);
};

// Load config from server API
export const loadServerConfig = async (): Promise<ServerConfig> => {
  if (configCache) {
    return configCache;
  }

  try {
    const response = await fetch('/api/config', { cache: "no-store" });
    if (response.ok) {
      const config = await response.json();
      configCache = { ...DEFAULT_CONFIG, ...config };
      // Ensure new fields have defaults
      if (!configCache.adminSettings.customTitle) {
        configCache.adminSettings.customTitle = 'Plex Wrapped';
      }
      if (configCache.adminSettings.useCustomLogo === undefined) {
        configCache.adminSettings.useCustomLogo = false;
      }
      if (configCache.adminSettings.logoMaxHeight === undefined) {
        configCache.adminSettings.logoMaxHeight = 80;
      }
      return configCache;
    }
  } catch (error) {
    console.log("No server config found, using defaults");
  }

  configCache = { ...DEFAULT_CONFIG };
  return configCache;
};

// Save config to server API
export const saveServerConfig = async (config: ServerConfig): Promise<void> => {
  configCache = config;
  
  try {
    const response = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    
    if (!response.ok) {
      console.error('Failed to save config to server');
      throw new Error('Failed to save config');
    }
  } catch (error) {
    console.error('Failed to save config to server:', error);
    throw error;
  }
};

// Initialize config - load from server
export const initializeConfig = async (): Promise<ServerConfig> => {
  return await loadServerConfig();
};

// Get current cached config
export const getConfig = (): ServerConfig => {
  return configCache || { ...DEFAULT_CONFIG };
};

// Tautulli config functions
export const getTautulliConfig = (): TautulliConfig | undefined => {
  return getConfig().tautulli;
};

export const setTautulliConfig = async (tautulli: TautulliConfig): Promise<void> => {
  const config = getConfig();
  config.tautulli = tautulli;
  await saveServerConfig(config);
};

export const clearTautulliConfig = async (): Promise<void> => {
  const config = getConfig();
  delete config.tautulli;
  await saveServerConfig(config);
};

// Admin password functions
export const isServerAdminPasswordSet = (): boolean => {
  return !!getConfig().adminPasswordHash;
};

export const setServerAdminPassword = async (password: string): Promise<void> => {
  const config = getConfig();
  config.adminPasswordHash = simpleHash(password);
  await saveServerConfig(config);
};

export const verifyServerAdminPassword = (password: string): boolean => {
  const stored = getConfig().adminPasswordHash;
  if (!stored) return false;
  return simpleHash(password) === stored;
};

// Admin settings functions
export const getServerAdminSettings = (): AdminSettings => {
  const settings = getConfig().adminSettings;
  // Ensure defaults for new fields
  return {
    discreetMode: settings.discreetMode || false,
    passwordProtectUsers: settings.passwordProtectUsers || false,
    normalizeTautulliAnomalies: settings.normalizeTautulliAnomalies || false,
    useCustomTitle: settings.useCustomTitle || false,
    customTitle: settings.customTitle || 'Plex Wrapped',
    useCustomLogo: settings.useCustomLogo || false,
    logoMaxHeight: settings.logoMaxHeight || 80,
  };
};

export const saveServerAdminSettings = async (settings: AdminSettings): Promise<void> => {
  const config = getConfig();
  config.adminSettings = settings;
  await saveServerConfig(config);
};

// Logo functions
export const uploadLogo = async (file: File): Promise<{ success: boolean; error?: string }> => {
  try {
    const formData = new FormData();
    formData.append('logo', file);

    const response = await fetch('/api/logo', {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      return { success: true };
    } else {
      const data = await response.json();
      return { success: false, error: data.error || 'Failed to upload logo' };
    }
  } catch (error) {
    console.error('Error uploading logo:', error);
    return { success: false, error: 'Failed to upload logo' };
  }
};

export const deleteLogo = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await fetch('/api/logo', {
      method: 'DELETE',
    });

    if (response.ok) {
      return { success: true };
    } else {
      const data = await response.json();
      return { success: false, error: data.error || 'Failed to delete logo' };
    }
  } catch (error) {
    console.error('Error deleting logo:', error);
    return { success: false, error: 'Failed to delete logo' };
  }
};

export const checkLogoExists = async (): Promise<boolean> => {
  try {
    const response = await fetch('/api/logo/exists');
    if (response.ok) {
      const data = await response.json();
      return data.exists;
    }
    return false;
  } catch {
    return false;
  }
};

export const getLogoUrl = (): string => {
  return `/api/logo?t=${Date.now()}`; // Add timestamp to bust cache
};

// Email settings functions
export const getServerEmailSettings = (): EmailSettings => {
  const config = getConfig();
  if (!config.emailSettings.appUrl) {
    config.emailSettings.appUrl = window.location.origin;
  }
  return config.emailSettings;
};

export const saveServerEmailSettings = async (settings: EmailSettings): Promise<void> => {
  const config = getConfig();
  config.emailSettings = settings;
  await saveServerConfig(config);
};

// User password functions
export const getServerUserPasswords = (): UserPassword[] => {
  return getConfig().userPasswords;
};

export const saveServerUserPasswords = async (passwords: UserPassword[]): Promise<void> => {
  const config = getConfig();
  config.userPasswords = passwords;
  await saveServerConfig(config);
};

export const getServerUserPassword = (userId: number): string | null => {
  const passwords = getServerUserPasswords();
  const user = passwords.find((p) => p.userId === userId);
  return user?.password || null;
};

export const setServerUserPassword = async (
  userId: number,
  username: string,
  friendlyName: string,
  password: string,
  email?: string,
): Promise<void> => {
  const passwords = getServerUserPasswords();
  const existingIndex = passwords.findIndex((p) => p.userId === userId);

  if (existingIndex >= 0) {
    passwords[existingIndex] = { userId, username, friendlyName, password, email };
  } else {
    passwords.push({ userId, username, friendlyName, password, email });
  }

  await saveServerUserPasswords(passwords);
};

export const verifyServerUserPassword = (userId: number, password: string): boolean => {
  const storedPassword = getServerUserPassword(userId);
  return storedPassword === password;
};

// Generate a random password
export const generatePassword = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

export const generatePasswordsForAllServerUsers = async (
  users: { userId: number; username: string; friendlyName: string; email?: string }[],
): Promise<void> => {
  const existingPasswords = getServerUserPasswords();

  for (const user of users) {
    const existing = existingPasswords.find((p) => p.userId === user.userId);
    if (!existing) {
      await setServerUserPassword(user.userId, user.username, user.friendlyName, generatePassword(), user.email);
    }
  }
};

export const updateServerUserEmail = async (userId: number, email: string): Promise<void> => {
  const passwords = getServerUserPasswords();
  const existingIndex = passwords.findIndex((p) => p.userId === userId);

  if (existingIndex >= 0) {
    passwords[existingIndex].email = email;
    await saveServerUserPasswords(passwords);
  }
};

export const getEmailForServerUser = (
  userId: number,
  username: string,
  friendlyName: string,
  password: string,
  emailSettings: EmailSettings,
): string => {
  return emailSettings.emailTemplate
    .replace(/\{\{friendlyName\}\}/g, friendlyName)
    .replace(/\{\{username\}\}/g, username)
    .replace(/\{\{password\}\}/g, password)
    .replace(/\{\{appUrl\}\}/g, emailSettings.appUrl)
    .replace(/\{\{serverName\}\}/g, emailSettings.serverName);
};