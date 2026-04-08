import { TautulliConfig } from "@/types/tautulli";
import { AdminSettings, EmailSettings, UserPassword } from "./adminStorage";

export const DEFAULT_EMAIL_TEMPLATE = `Hi {{friendlyName}},

Your Plex Wrapped for {{serverName}} is ready!

Visit {{appUrl}} to see your personalized viewing statistics.

Enjoy reliving your year in entertainment!

Best regards,
The {{serverName}} Team`;

export interface PlexUserMappingOverride {
  plexUsername: string;
  tautulliUserId: number;
  tautulliUsername: string;
  friendlyName: string;
}

export interface PlexAuthConfig {
  enabled: boolean;
  appName: string;
  adminPlexUsername: string;
  userMappingOverrides: PlexUserMappingOverride[];
}

export interface ServerConfig {
  tautulli?: TautulliConfig;
  adminPasswordHash?: string;
  adminSettings: AdminSettings;
  emailSettings: EmailSettings;
  userPasswords: UserPassword[];
  plexAuth: PlexAuthConfig;
}

export interface PublicBootstrap {
  authEnabled: boolean;
  hasAdmin: boolean;
  tautulliConfigured: boolean;
  setupComplete: boolean;
  adminSettings: AdminSettings;
}

export interface AuthSession {
  authenticated: boolean;
  isAdmin: boolean;
  plexUsername: string | null;
  plexUserId: string | null;
  tautulliUserId: number | null;
  tautulliUsername: string | null;
  friendlyName: string | null;
}

const PLACEHOLDER_TAUTULLI_CONFIG: TautulliConfig = {
  url: "",
  apiKey: "",
};

const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  discreetMode: false,
  passwordProtectUsers: false,
  normalizeTautulliAnomalies: false,
  useCustomTitle: false,
  customTitle: "Plex Wrapped",
  useCustomLogo: false,
  logoMaxHeight: 80,
  enableGeolocation: false,
  allowAllUsersInDiscreetMode: false,
  showLeaderboard: true,
};

const DEFAULT_SERVER_CONFIG: ServerConfig = {
  adminSettings: DEFAULT_ADMIN_SETTINGS,
  emailSettings: {
    appUrl: "",
    serverName: "Plex Server",
    emailTemplate: DEFAULT_EMAIL_TEMPLATE,
  },
  userPasswords: [],
  plexAuth: {
    enabled: true,
    appName: "Plex Wrapped",
    adminPlexUsername: "",
    userMappingOverrides: [],
  },
};

const EMPTY_AUTH_SESSION: AuthSession = {
  authenticated: false,
  isAdmin: false,
  plexUsername: null,
  plexUserId: null,
  tautulliUserId: null,
  tautulliUsername: null,
  friendlyName: null,
};

let configCache: ServerConfig | null = null;
let publicBootstrapCache: PublicBootstrap | null = null;
let authSessionCache: AuthSession | null = null;

const normalizeAdminSettings = (settings: Partial<AdminSettings> | undefined): AdminSettings => ({
  discreetMode: settings?.discreetMode || false,
  passwordProtectUsers: settings?.passwordProtectUsers || false,
  normalizeTautulliAnomalies: settings?.normalizeTautulliAnomalies || false,
  useCustomTitle: settings?.useCustomTitle || false,
  customTitle: settings?.customTitle || "Plex Wrapped",
  useCustomLogo: settings?.useCustomLogo || false,
  logoMaxHeight: settings?.logoMaxHeight || 80,
  enableGeolocation: settings?.enableGeolocation || false,
  allowAllUsersInDiscreetMode: settings?.allowAllUsersInDiscreetMode || false,
  showLeaderboard: settings?.showLeaderboard !== false,
});

const normalizeEmailSettings = (settings: Partial<EmailSettings> | undefined): EmailSettings => ({
  appUrl: settings?.appUrl || window.location.origin,
  serverName: settings?.serverName || "Plex Server",
  emailTemplate: settings?.emailTemplate || DEFAULT_EMAIL_TEMPLATE,
});

const normalizePlexAuthConfig = (config: Partial<PlexAuthConfig> | undefined): PlexAuthConfig => ({
  enabled: config?.enabled !== false,
  appName: config?.appName || "Plex Wrapped",
  adminPlexUsername: config?.adminPlexUsername || "",
  userMappingOverrides: Array.isArray(config?.userMappingOverrides) ? config.userMappingOverrides : [],
});

const normalizeServerConfig = (config: Partial<ServerConfig>): ServerConfig => {
  const normalized: ServerConfig = {
    ...DEFAULT_SERVER_CONFIG,
    ...config,
    adminSettings: normalizeAdminSettings(config.adminSettings),
    emailSettings: normalizeEmailSettings(config.emailSettings),
    plexAuth: normalizePlexAuthConfig(config.plexAuth),
    userPasswords: Array.isArray(config.userPasswords) ? config.userPasswords : [],
  };

  if (!config.tautulli?.url || !config.tautulli?.apiKey) {
    delete normalized.tautulli;
  }

  return normalized;
};

const configFromBootstrap = (bootstrap: PublicBootstrap): ServerConfig => {
  const config: ServerConfig = {
    ...DEFAULT_SERVER_CONFIG,
    adminSettings: normalizeAdminSettings(bootstrap.adminSettings),
    plexAuth: {
      ...DEFAULT_SERVER_CONFIG.plexAuth,
      enabled: bootstrap.authEnabled,
      adminPlexUsername: bootstrap.hasAdmin ? "configured" : "",
    },
  };

  if (bootstrap.tautulliConfigured) {
    config.tautulli = PLACEHOLDER_TAUTULLI_CONFIG;
  }

  return config;
};

const normalizeBootstrap = (bootstrap: Partial<PublicBootstrap>): PublicBootstrap => ({
  authEnabled: bootstrap.authEnabled !== false,
  hasAdmin: !!bootstrap.hasAdmin,
  tautulliConfigured: !!bootstrap.tautulliConfigured,
  setupComplete: !!bootstrap.setupComplete,
  adminSettings: normalizeAdminSettings(bootstrap.adminSettings),
});

const normalizeAuthSession = (session: Partial<AuthSession> | undefined): AuthSession => ({
  authenticated: !!session?.authenticated,
  isAdmin: !!session?.isAdmin,
  plexUsername: session?.plexUsername || null,
  plexUserId: session?.plexUserId || null,
  tautulliUserId: Number.isFinite(session?.tautulliUserId) ? Number(session?.tautulliUserId) : null,
  tautulliUsername: session?.tautulliUsername || null,
  friendlyName: session?.friendlyName || null,
});

const ensureAdminConfigLoaded = async (): Promise<ServerConfig> => {
  if (configCache?.tautulli && configCache.tautulli.apiKey) {
    return configCache;
  }

  return loadAdminConfig();
};

export const loadPublicBootstrap = async (): Promise<PublicBootstrap> => {
  const response = await fetch("/api/public/bootstrap", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load public application state");
  }

  const bootstrap = normalizeBootstrap(await response.json());
  publicBootstrapCache = bootstrap;
  configCache = configFromBootstrap(bootstrap);
  return bootstrap;
};

export const loadAdminConfig = async (): Promise<ServerConfig> => {
  const response = await fetch("/api/config", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load admin config");
  }

  const config = normalizeServerConfig(await response.json());
  configCache = config;
  publicBootstrapCache = {
    authEnabled: config.plexAuth.enabled,
    hasAdmin: !!config.plexAuth.adminPlexUsername,
    tautulliConfigured: !!config.tautulli,
    setupComplete: !!config.plexAuth.adminPlexUsername && !!config.tautulli,
    adminSettings: config.adminSettings,
  };
  return config;
};

export const saveServerConfig = async (config: ServerConfig): Promise<ServerConfig> => {
  const response = await fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    throw new Error("Failed to save config");
  }

  const data = await response.json();
  const savedConfig = normalizeServerConfig(data.config || config);
  configCache = savedConfig;
  publicBootstrapCache = {
    authEnabled: savedConfig.plexAuth.enabled,
    hasAdmin: !!savedConfig.plexAuth.adminPlexUsername,
    tautulliConfigured: !!savedConfig.tautulli,
    setupComplete: !!savedConfig.plexAuth.adminPlexUsername && !!savedConfig.tautulli,
    adminSettings: savedConfig.adminSettings,
  };
  return savedConfig;
};

export const initializeConfig = async (): Promise<ServerConfig> => {
  const bootstrap = await loadPublicBootstrap();
  return configFromBootstrap(bootstrap);
};

export const getConfig = (): ServerConfig => {
  return configCache || { ...DEFAULT_SERVER_CONFIG };
};

export const getPublicBootstrap = (): PublicBootstrap | null => {
  return publicBootstrapCache;
};

export const getTautulliConfig = (): TautulliConfig | undefined => {
  return getConfig().tautulli;
};

export const setTautulliConfig = async (tautulli: TautulliConfig): Promise<void> => {
  const config = await ensureAdminConfigLoaded();
  config.tautulli = tautulli;
  await saveServerConfig(config);
};

export const clearTautulliConfig = async (): Promise<void> => {
  const config = await ensureAdminConfigLoaded();
  delete config.tautulli;
  await saveServerConfig(config);
};

export const getServerAdminSettings = (): AdminSettings => {
  return normalizeAdminSettings(getConfig().adminSettings);
};

export const saveServerAdminSettings = async (settings: AdminSettings): Promise<void> => {
  const config = await ensureAdminConfigLoaded();
  config.adminSettings = normalizeAdminSettings(settings);
  await saveServerConfig(config);
};

export const getServerEmailSettings = (): EmailSettings => {
  return normalizeEmailSettings(getConfig().emailSettings);
};

export const saveServerEmailSettings = async (settings: EmailSettings): Promise<void> => {
  const config = await ensureAdminConfigLoaded();
  config.emailSettings = normalizeEmailSettings(settings);
  await saveServerConfig(config);
};

export const getPlexAuthConfig = (): PlexAuthConfig => {
  return normalizePlexAuthConfig(getConfig().plexAuth);
};

export const savePlexUserMappingOverrides = async (overrides: PlexUserMappingOverride[]): Promise<void> => {
  const config = await ensureAdminConfigLoaded();
  config.plexAuth.userMappingOverrides = Array.isArray(overrides) ? overrides : [];
  await saveServerConfig(config);
};

export const getAuthSession = async (): Promise<AuthSession> => {
  const response = await fetch("/api/auth/session", { cache: "no-store" });
  if (!response.ok) {
    authSessionCache = { ...EMPTY_AUTH_SESSION };
    return authSessionCache;
  }

  authSessionCache = normalizeAuthSession(await response.json());
  return authSessionCache;
};

export const getCachedAuthSession = (): AuthSession => {
  return authSessionCache || { ...EMPTY_AUTH_SESSION };
};

export const clearAuthSessionCache = (): void => {
  authSessionCache = { ...EMPTY_AUTH_SESSION };
};

export const startPlexLogin = async (): Promise<void> => {
  const response = await fetch("/api/auth/plex/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error("Failed to start Plex sign-in");
  }

  const data = await response.json();
  if (!data.authUrl) {
    throw new Error("Plex sign-in URL was not returned");
  }

  window.location.assign(data.authUrl);
};

export const logoutPlexSession = async (): Promise<AuthSession> => {
  const response = await fetch("/api/auth/logout", { method: "POST" });
  if (!response.ok) {
    throw new Error("Failed to logout");
  }

  authSessionCache = { ...EMPTY_AUTH_SESSION };
  return authSessionCache;
};

export const uploadLogo = async (file: File): Promise<{ success: boolean; error?: string }> => {
  try {
    const formData = new FormData();
    formData.append("logo", file);

    const response = await fetch("/api/logo", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      return { success: true };
    }

    const data = await response.json();
    return { success: false, error: data.error || "Failed to upload logo" };
  } catch (error) {
    console.error("Error uploading logo:", error);
    return { success: false, error: "Failed to upload logo" };
  }
};

export const deleteLogo = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await fetch("/api/logo", { method: "DELETE" });
    if (response.ok) {
      return { success: true };
    }

    const data = await response.json();
    return { success: false, error: data.error || "Failed to delete logo" };
  } catch (error) {
    console.error("Error deleting logo:", error);
    return { success: false, error: "Failed to delete logo" };
  }
};

export const checkLogoExists = async (): Promise<boolean> => {
  try {
    const response = await fetch("/api/logo/exists", { cache: "no-store" });
    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return !!data.exists;
  } catch {
    return false;
  }
};

export const getLogoUrl = (): string => {
  return `/api/logo?t=${Date.now()}`;
};