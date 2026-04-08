const crypto = require('crypto');
const express = require('express');
const fs = require('fs').promises;
const multer = require('multer');
const path = require('path');

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '10mb' }));

const CONFIG_FILE = '/data/config.json';
const SESSION_FILE = '/data/sessions.json';
const METADATA_CACHE_FILE = '/data/metadata-cache.json';
const LOGO_FILE = '/data/custom-logo.png';
const GEOLOCATION_CACHE_FILE = '/data/geolocation-cache.json';

const PLEX_API_BASE_URL = 'https://plex.tv/api/v2';
const SESSION_COOKIE_NAME = 'plex_wrapped_session';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const PENDING_AUTH_MAX_AGE_MS = 15 * 60 * 1000;

const DEFAULT_CONFIG = {
  adminSettings: {
    discreetMode: false,
    passwordProtectUsers: false,
    normalizeTautulliAnomalies: false,
    useCustomTitle: false,
    customTitle: 'Plex Wrapped',
    useCustomLogo: false,
    logoMaxHeight: 80,
    enableGeolocation: false,
    allowAllUsersInDiscreetMode: false,
    showLeaderboard: true,
  },
  emailSettings: {
    appUrl: '',
    serverName: 'Plex Server',
    emailTemplate: `Hi {{friendlyName}},

Your Plex Wrapped for {{serverName}} is ready!

Visit {{appUrl}} to see your personalized viewing statistics.

Enjoy reliving your year in entertainment!

Best regards,
The {{serverName}} Team`,
  },
  userPasswords: [],
  plexAuth: {
    enabled: true,
    appName: 'Plex Wrapped',
    clientIdentifier: '',
    adminPlexUsername: '',
    sessionSecret: '',
    userMappingOverrides: [],
  },
};

const DEFAULT_SESSIONS = {
  version: 1,
  sessions: {},
};

const TAUTULLI_COMMAND_ALLOWLIST = {
  user: new Set(['get_history', 'get_metadata', 'pms_image_proxy']),
  admin: new Set(['get_server_info', 'get_users', 'get_history', 'get_metadata', 'pms_image_proxy']),
};

const pendingPlexAuth = new Map();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PNG, JPEG, WebP, and SVG are allowed.'));
    }
  },
});

fs.mkdir('/data', { recursive: true }).catch(() => {});

const parseJson = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

const normalizeAdminSettings = (settings = {}) => ({
  discreetMode: settings.discreetMode || false,
  passwordProtectUsers: settings.passwordProtectUsers || false,
  normalizeTautulliAnomalies: settings.normalizeTautulliAnomalies || false,
  useCustomTitle: settings.useCustomTitle || false,
  customTitle: settings.customTitle || 'Plex Wrapped',
  useCustomLogo: settings.useCustomLogo || false,
  logoMaxHeight: settings.logoMaxHeight || 80,
  enableGeolocation: settings.enableGeolocation || false,
  allowAllUsersInDiscreetMode: settings.allowAllUsersInDiscreetMode || false,
  showLeaderboard: settings.showLeaderboard !== false,
});

const normalizeEmailSettings = (settings = {}) => ({
  appUrl: settings.appUrl || '',
  serverName: settings.serverName || 'Plex Server',
  emailTemplate: settings.emailTemplate || DEFAULT_CONFIG.emailSettings.emailTemplate,
});

const normalizeOverrides = (overrides = []) => {
  if (!Array.isArray(overrides)) {
    return [];
  }

  const normalized = overrides
    .filter((override) => override && typeof override === 'object')
    .map((override) => ({
      plexUsername: String(override.plexUsername || '').trim(),
      tautulliUserId: Number(override.tautulliUserId || 0),
      tautulliUsername: String(override.tautulliUsername || '').trim(),
      friendlyName: String(override.friendlyName || '').trim(),
    }))
    .filter((override) => override.plexUsername && Number.isFinite(override.tautulliUserId) && override.tautulliUserId > 0);

  return normalized.filter((override, index) => {
    return normalized.findIndex((candidate) => {
      return candidate.tautulliUserId === override.tautulliUserId || caseInsensitiveEquals(candidate.plexUsername, override.plexUsername);
    }) === index;
  });
};

const normalizePlexAuth = (plexAuth = {}) => ({
  enabled: plexAuth.enabled !== false,
  appName: plexAuth.appName || 'Plex Wrapped',
  clientIdentifier: plexAuth.clientIdentifier || '',
  adminPlexUsername: plexAuth.adminPlexUsername || '',
  sessionSecret: plexAuth.sessionSecret || '',
  userMappingOverrides: normalizeOverrides(plexAuth.userMappingOverrides),
});

const normalizeConfig = (config = {}) => {
  const normalized = {
    ...DEFAULT_CONFIG,
    ...config,
    adminSettings: normalizeAdminSettings(config.adminSettings),
    emailSettings: normalizeEmailSettings(config.emailSettings),
    plexAuth: normalizePlexAuth(config.plexAuth),
    userPasswords: Array.isArray(config.userPasswords) ? config.userPasswords : [],
  };

  if (config.tautulli && config.tautulli.url && config.tautulli.apiKey) {
    normalized.tautulli = {
      url: String(config.tautulli.url).trim(),
      apiKey: String(config.tautulli.apiKey).trim(),
    };
  } else {
    delete normalized.tautulli;
  }

  return normalized;
};

const normalizeSessions = (sessions = {}) => ({
  version: 1,
  sessions: Object.fromEntries(
    Object.entries(sessions.sessions || {}).filter(([, session]) => {
      return session && typeof session === 'object' && Number.isFinite(session.expiresAt) && session.expiresAt > Date.now();
    }),
  ),
});

const caseInsensitiveEquals = (left, right) => {
  return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
};

const getRequestOrigin = (req) => {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const protocol = forwardedProto || req.protocol || 'http';
  const host = forwardedHost || req.headers.host;
  return `${protocol}://${host}`;
};

const isSecureRequest = (req) => {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  return req.secure || forwardedProto === 'https';
};

const parseCookies = (req) => {
  const cookieHeader = req.headers.cookie || '';
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex < 0) {
        return cookies;
      }

      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});
};

const signSessionId = (sessionId, secret) => {
  return crypto.createHmac('sha256', secret).update(sessionId).digest('hex');
};

const encodeSessionCookie = (sessionId, secret) => `${sessionId}.${signSessionId(sessionId, secret)}`;

const decodeSessionCookie = (cookieValue, secret) => {
  if (!cookieValue || typeof cookieValue !== 'string') {
    return null;
  }

  const [sessionId, signature] = cookieValue.split('.');
  if (!sessionId || !signature) {
    return null;
  }

  const expectedSignature = signSessionId(sessionId, secret);
  const provided = Buffer.from(signature, 'utf8');
  const expected = Buffer.from(expectedSignature, 'utf8');

  if (provided.length !== expected.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(provided, expected)) {
    return null;
  }

  return sessionId;
};

const createSessionResponse = (session) => ({
  authenticated: true,
  isAdmin: !!session.isAdmin,
  plexUsername: session.plexUsername || null,
  plexUserId: session.plexUserId || null,
  tautulliUserId: Number.isFinite(session.tautulliUserId) ? Number(session.tautulliUserId) : null,
  tautulliUsername: session.tautulliUsername || null,
  friendlyName: session.friendlyName || session.plexUsername || null,
});

const getUnauthenticatedSession = () => ({
  authenticated: false,
  isAdmin: false,
  plexUsername: null,
  plexUserId: null,
  tautulliUserId: null,
  tautulliUsername: null,
  friendlyName: null,
});

const ensureConfigSecrets = async (config) => {
  let changed = false;

  if (!config.plexAuth.clientIdentifier) {
    config.plexAuth.clientIdentifier = crypto.randomUUID();
    changed = true;
  }

  if (!config.plexAuth.sessionSecret) {
    config.plexAuth.sessionSecret = randomToken(32);
    changed = true;
  }

  if (changed) {
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
  }

  return config;
};

const readConfig = async () => {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf8');
    return await ensureConfigSecrets(normalizeConfig(parseJson(data, {})));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return await ensureConfigSecrets(normalizeConfig(DEFAULT_CONFIG));
    }
    throw error;
  }
};

const writeConfig = async (config) => {
  const normalized = await ensureConfigSecrets(normalizeConfig(config));
  await fs.writeFile(CONFIG_FILE, JSON.stringify(normalized, null, 2));
  return normalized;
};

const readSessions = async () => {
  try {
    const data = await fs.readFile(SESSION_FILE, 'utf8');
    return normalizeSessions(parseJson(data, DEFAULT_SESSIONS));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return DEFAULT_SESSIONS;
    }
    throw error;
  }
};

const writeSessions = async (sessions) => {
  const normalized = normalizeSessions(sessions);
  await fs.writeFile(SESSION_FILE, JSON.stringify(normalized, null, 2));
  return normalized;
};

const createSession = async (config, sessionData) => {
  const sessions = await readSessions();
  const sessionId = crypto.randomUUID();
  sessions.sessions[sessionId] = {
    ...sessionData,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_MAX_AGE_MS,
    lastActivityAt: Date.now(),
  };

  await writeSessions(sessions);

  return {
    sessionId,
    cookieValue: encodeSessionCookie(sessionId, config.plexAuth.sessionSecret),
    session: sessions.sessions[sessionId],
  };
};

const destroySession = async (req) => {
  const config = await readConfig();
  const cookies = parseCookies(req);
  const cookieValue = cookies[SESSION_COOKIE_NAME];
  const sessionId = decodeSessionCookie(cookieValue, config.plexAuth.sessionSecret);
  if (!sessionId) {
    return;
  }

  const sessions = await readSessions();
  delete sessions.sessions[sessionId];
  await writeSessions(sessions);
};

const getSessionFromRequest = async (req) => {
  const config = await readConfig();
  const cookies = parseCookies(req);
  const cookieValue = cookies[SESSION_COOKIE_NAME];
  const sessionId = decodeSessionCookie(cookieValue, config.plexAuth.sessionSecret);
  if (!sessionId) {
    return null;
  }

  const sessions = await readSessions();
  const session = sessions.sessions[sessionId];
  if (!session) {
    return null;
  }

  if (!Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) {
    delete sessions.sessions[sessionId];
    await writeSessions(sessions);
    return null;
  }

  return {
    ...session,
    sessionId,
  };
};

const setSessionCookie = (req, res, cookieValue) => {
  res.cookie(SESSION_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureRequest(req),
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
  });
};

const clearSessionCookie = (req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureRequest(req),
    path: '/',
  });
};

const requireSession = async (req, res, next) => {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      clearSessionCookie(req, res);
      return res.status(401).json({ error: 'Authentication required' });
    }

    req.authSession = session;
    return next();
  } catch (error) {
    console.error('Failed to validate session:', error);
    return res.status(500).json({ error: 'Failed to validate session' });
  }
};

const requireAdmin = async (req, res, next) => {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      clearSessionCookie(req, res);
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!session.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.authSession = session;
    return next();
  } catch (error) {
    console.error('Failed to validate admin session:', error);
    return res.status(500).json({ error: 'Failed to validate admin session' });
  }
};

const normalizeTautulliUrl = (inputUrl) => {
  let tautulliBaseUrl = String(inputUrl || '').trim().replace(/\/$/, '');
  if (!tautulliBaseUrl.startsWith('http://') && !tautulliBaseUrl.startsWith('https://')) {
    tautulliBaseUrl = `http://${tautulliBaseUrl}`;
  }
  return tautulliBaseUrl;
};

const buildTautulliUrl = (config, query) => {
  const tautulliBaseUrl = normalizeTautulliUrl(config.tautulli.url);
  const tautulliUrl = new URL(tautulliBaseUrl);
  const existingPath = tautulliUrl.pathname !== '/' ? tautulliUrl.pathname : '';
  tautulliUrl.pathname = `${existingPath}/api/v2`;

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    tautulliUrl.searchParams.append(key, String(value));
  });

  tautulliUrl.searchParams.append('apikey', config.tautulli.apiKey);
  return tautulliUrl;
};

const proxyTautulliRequest = async (config, query, res) => {
  const tautulliUrl = buildTautulliUrl(config, query);
  console.log('[Tautulli Proxy] Requesting:', tautulliUrl.toString().replace(config.tautulli.apiKey, '***'));

  const response = await fetch(tautulliUrl.toString());

  if (!response.ok) {
    let hint = 'Check that Tautulli is running and accessible at the configured URL';
    if (response.status === 404) {
      hint = 'API endpoint not found. If you have an HTTP Root configured in Tautulli, include it in the configured URL.';
    }

    return res.status(response.status).json({
      error: `Tautulli returned HTTP ${response.status}: ${response.statusText}`,
      hint,
    });
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.startsWith('image/')) {
    const imageBuffer = await response.arrayBuffer();
    res.set('Content-Type', contentType);
    res.send(Buffer.from(imageBuffer));
    return;
  }

  if (contentType && contentType.includes('application/json')) {
    const data = await response.json();
    res.json(data);
    return;
  }

  const text = await response.text();
  if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
    return res.status(502).json({
      error: 'Tautulli returned an HTML page instead of JSON. This usually means the URL or API key is incorrect, or Tautulli requires authentication.',
      hint: 'Verify the Tautulli URL, API key, and HTTP Root settings.',
      receivedContentType: contentType || 'text/html',
    });
  }

  return res.status(502).json({
    error: 'Unexpected response from Tautulli',
    contentType: contentType || 'unknown',
    preview: text.substring(0, 200),
    hint: 'The response was not in the expected JSON format',
  });
};

const cleanupPendingPlexAuth = () => {
  const now = Date.now();
  for (const [state, pendingAuth] of pendingPlexAuth.entries()) {
    if (now - pendingAuth.createdAt > PENDING_AUTH_MAX_AGE_MS) {
      pendingPlexAuth.delete(state);
    }
  }
};

const getPlexHeaders = (config, authToken) => {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    'X-Plex-Product': config.plexAuth.appName,
    'X-Plex-Client-Identifier': config.plexAuth.clientIdentifier,
    'X-Plex-Device-Name': config.plexAuth.appName,
  };

  if (authToken) {
    headers['X-Plex-Token'] = authToken;
  }

  return headers;
};

const createPlexPin = async (config) => {
  const response = await fetch(`${PLEX_API_BASE_URL}/pins`, {
    method: 'POST',
    headers: getPlexHeaders(config),
    body: new URLSearchParams({ strong: 'true' }),
  });

  if (!response.ok) {
    throw new Error(`Plex PIN request failed with HTTP ${response.status}`);
  }

  return response.json();
};

const checkPlexPin = async (config, pendingAuth) => {
  const url = new URL(`${PLEX_API_BASE_URL}/pins/${pendingAuth.pinId}`);
  url.searchParams.set('code', pendingAuth.pinCode);

  const response = await fetch(url.toString(), {
    headers: getPlexHeaders(config),
  });

  if (!response.ok) {
    throw new Error(`Plex PIN verification failed with HTTP ${response.status}`);
  }

  return response.json();
};

const waitForPlexAuthToken = async (config, pendingAuth) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const pinStatus = await checkPlexPin(config, pendingAuth);
    if (pinStatus && pinStatus.authToken) {
      return pinStatus.authToken;
    }

    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  return null;
};

const fetchPlexUser = async (config, authToken) => {
  const response = await fetch(`${PLEX_API_BASE_URL}/user`, {
    headers: getPlexHeaders(config, authToken),
  });

  if (!response.ok) {
    throw new Error(`Plex user lookup failed with HTTP ${response.status}`);
  }

  const user = await response.json();
  const username = user.username || user.email || user.title;
  if (!username) {
    throw new Error('Plex user lookup did not return a username');
  }

  return {
    id: user.id || user.uuid || null,
    username,
    friendlyName: user.friendlyName || user.title || username,
    email: user.email || null,
  };
};

const buildPlexAuthUrl = (req, config, pin, state) => {
  const params = new URLSearchParams();
  const forwardUrl = new URL('/api/auth/plex/callback', getRequestOrigin(req));
  forwardUrl.searchParams.set('state', state);

  params.set('clientID', config.plexAuth.clientIdentifier);
  params.set('code', pin.code);
  params.set('forwardUrl', forwardUrl.toString());
  params.set('context[device][product]', config.plexAuth.appName);

  return `https://app.plex.tv/auth#?${params.toString()}`;
};

const fetchTautulliUsers = async (config) => {
  if (!config.tautulli || !config.tautulli.url || !config.tautulli.apiKey) {
    return [];
  }

  const tautulliUrl = buildTautulliUrl(config, { cmd: 'get_users' });
  const response = await fetch(tautulliUrl.toString());
  if (!response.ok) {
    throw new Error(`Tautulli get_users failed with HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data.response?.result !== 'success') {
    throw new Error('Tautulli get_users returned an invalid response');
  }

  return data.response.data || [];
};

const resolveTautulliUserForPlexUser = async (config, plexUser) => {
  const users = await fetchTautulliUsers(config);
  const override = config.plexAuth.userMappingOverrides.find((mapping) => {
    return caseInsensitiveEquals(mapping.plexUsername, plexUser.username);
  });

  if (override) {
    return (
      users.find((user) => Number(user.user_id) === Number(override.tautulliUserId)) ||
      users.find((user) => caseInsensitiveEquals(user.username, override.tautulliUsername)) ||
      null
    );
  }

  return users.find((user) => caseInsensitiveEquals(user.username, plexUser.username)) || null;
};

const sanitizeConfigForClient = (config) => ({
  tautulli: config.tautulli,
  adminSettings: config.adminSettings,
  emailSettings: config.emailSettings,
  plexAuth: {
    enabled: config.plexAuth.enabled,
    appName: config.plexAuth.appName,
    adminPlexUsername: config.plexAuth.adminPlexUsername || '',
    userMappingOverrides: config.plexAuth.userMappingOverrides,
  },
});

const buildPublicBootstrap = (config) => ({
  authEnabled: config.plexAuth.enabled !== false,
  hasAdmin: Boolean(config.plexAuth.adminPlexUsername),
  tautulliConfigured: Boolean(config.tautulli && config.tautulli.url && config.tautulli.apiKey),
  setupComplete: Boolean(config.plexAuth.adminPlexUsername && config.tautulli && config.tautulli.url && config.tautulli.apiKey),
  adminSettings: config.adminSettings,
});

const mergeConfigUpdate = (existingConfig, incomingConfig) => {
  const merged = normalizeConfig({
    ...existingConfig,
    adminSettings: incomingConfig.adminSettings
      ? { ...existingConfig.adminSettings, ...incomingConfig.adminSettings }
      : existingConfig.adminSettings,
    emailSettings: incomingConfig.emailSettings
      ? { ...existingConfig.emailSettings, ...incomingConfig.emailSettings }
      : existingConfig.emailSettings,
    tautulli:
      incomingConfig.tautulli === null
        ? undefined
        : incomingConfig.tautulli
          ? {
              url: String(incomingConfig.tautulli.url || '').trim(),
              apiKey: String(incomingConfig.tautulli.apiKey || '').trim(),
            }
          : existingConfig.tautulli,
    plexAuth: {
      ...existingConfig.plexAuth,
      enabled:
        incomingConfig.plexAuth && Object.prototype.hasOwnProperty.call(incomingConfig.plexAuth, 'enabled')
          ? incomingConfig.plexAuth.enabled !== false
          : existingConfig.plexAuth.enabled,
      appName: incomingConfig.plexAuth?.appName || existingConfig.plexAuth.appName,
      userMappingOverrides: Array.isArray(incomingConfig.plexAuth?.userMappingOverrides)
        ? normalizeOverrides(incomingConfig.plexAuth.userMappingOverrides)
        : existingConfig.plexAuth.userMappingOverrides,
      adminPlexUsername: existingConfig.plexAuth.adminPlexUsername,
      clientIdentifier: existingConfig.plexAuth.clientIdentifier,
      sessionSecret: existingConfig.plexAuth.sessionSecret,
    },
    adminPasswordHash: existingConfig.adminPasswordHash,
    userPasswords: Array.isArray(existingConfig.userPasswords) ? existingConfig.userPasswords : [],
  });

  if (!merged.tautulli || !merged.tautulli.url || !merged.tautulli.apiKey) {
    delete merged.tautulli;
  }

  return merged;
};

const testTautulliConnection = async (tautulliConfig) => {
  const tempConfig = normalizeConfig({ ...DEFAULT_CONFIG, tautulli: tautulliConfig });
  const fakeResponse = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return payload;
    },
    set() {
      return this;
    },
    send(payload) {
      this.payload = payload;
      return payload;
    },
  };

  await proxyTautulliRequest(tempConfig, { cmd: 'get_server_info' }, fakeResponse);

  if (fakeResponse.statusCode >= 400) {
    return { success: false, error: fakeResponse.payload?.error || 'Failed to connect to Tautulli' };
  }

  return { success: true };
};

app.get('/api/public/bootstrap', async (req, res) => {
  try {
    const config = await readConfig();
    res.json(buildPublicBootstrap(config));
  } catch (error) {
    console.error('Error reading public bootstrap:', error);
    res.status(500).json({ error: 'Failed to load application state' });
  }
});

app.get('/api/auth/session', async (req, res) => {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      clearSessionCookie(req, res);
      return res.json(getUnauthenticatedSession());
    }

    return res.json(createSessionResponse(session));
  } catch (error) {
    console.error('Error reading auth session:', error);
    return res.status(500).json({ error: 'Failed to load auth session' });
  }
});

app.post('/api/auth/plex/init', async (req, res) => {
  try {
    cleanupPendingPlexAuth();
    const config = await readConfig();
    const pin = await createPlexPin(config);
    const state = randomToken(16);

    pendingPlexAuth.set(state, {
      pinId: pin.id,
      pinCode: pin.code,
      createdAt: Date.now(),
    });

    return res.json({ authUrl: buildPlexAuthUrl(req, config, pin, state) });
  } catch (error) {
    console.error('Error initializing Plex auth:', error);
    return res.status(500).json({ error: 'Failed to initialize Plex sign-in' });
  }
});

app.get('/api/auth/plex/callback', async (req, res) => {
  const state = String(req.query.state || '');
  const redirectUrl = new URL('/', getRequestOrigin(req));

  if (!state || !pendingPlexAuth.has(state)) {
    redirectUrl.searchParams.set('authError', 'invalid_state');
    return res.redirect(redirectUrl.toString());
  }

  try {
    const config = await readConfig();
    const pendingAuth = pendingPlexAuth.get(state);
    pendingPlexAuth.delete(state);

    const authToken = await waitForPlexAuthToken(config, pendingAuth);
    if (!authToken) {
      redirectUrl.searchParams.set('authError', 'plex_auth_timeout');
      return res.redirect(redirectUrl.toString());
    }

    const plexUser = await fetchPlexUser(config, authToken);
    const isFirstAdminClaim = !config.plexAuth.adminPlexUsername;
    const isAdmin = isFirstAdminClaim || caseInsensitiveEquals(config.plexAuth.adminPlexUsername, plexUser.username);

    if (isFirstAdminClaim) {
      config.plexAuth.adminPlexUsername = plexUser.username;
    }

    let tautulliUser = null;
    if (config.tautulli && config.tautulli.url && config.tautulli.apiKey) {
      tautulliUser = await resolveTautulliUserForPlexUser(config, plexUser);
    }

    if (!isAdmin && !tautulliUser) {
      redirectUrl.searchParams.set('authError', 'no_tautulli_mapping');
      await writeConfig(config);
      return res.redirect(redirectUrl.toString());
    }

    const { cookieValue, session } = await createSession(config, {
      plexUsername: plexUser.username,
      plexUserId: plexUser.id,
      friendlyName: tautulliUser?.friendly_name || plexUser.friendlyName || plexUser.username,
      tautulliUserId: tautulliUser ? Number(tautulliUser.user_id) : null,
      tautulliUsername: tautulliUser?.username || null,
      isAdmin,
    });

    await writeConfig(config);
    setSessionCookie(req, res, cookieValue);

    redirectUrl.searchParams.set('auth', 'success');
    if (session.isAdmin && !config.tautulli) {
      redirectUrl.searchParams.set('setup', 'admin');
    }

    return res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('Error completing Plex auth callback:', error);
    pendingPlexAuth.delete(state);
    redirectUrl.searchParams.set('authError', 'callback_failed');
    return res.redirect(redirectUrl.toString());
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    await destroySession(req);
    clearSessionCookie(req, res);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error logging out:', error);
    return res.status(500).json({ error: 'Failed to logout' });
  }
});

app.get('/api/config', requireAdmin, async (req, res) => {
  try {
    const config = await readConfig();
    res.json(sanitizeConfigForClient(config));
  } catch (error) {
    console.error('Error reading config:', error);
    res.status(500).json({ error: 'Failed to read config' });
  }
});

app.post('/api/config', requireAdmin, async (req, res) => {
  try {
    const currentConfig = await readConfig();
    const updatedConfig = mergeConfigUpdate(currentConfig, req.body || {});
    const savedConfig = await writeConfig(updatedConfig);
    res.json({ success: true, config: sanitizeConfigForClient(savedConfig) });
  } catch (error) {
    console.error('Error saving config:', error);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

app.post('/api/admin/tautulli/test', requireAdmin, async (req, res) => {
  try {
    const tautulliConfig = {
      url: String(req.body?.url || '').trim(),
      apiKey: String(req.body?.apiKey || '').trim(),
    };

    if (!tautulliConfig.url || !tautulliConfig.apiKey) {
      return res.status(400).json({ error: 'Tautulli URL and API key are required' });
    }

    const result = await testTautulliConnection(tautulliConfig);
    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to connect to Tautulli' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error testing Tautulli connection:', error);
    return res.status(500).json({ error: 'Failed to test Tautulli connection' });
  }
});

app.post('/api/logo', requireAdmin, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    await fs.writeFile(LOGO_FILE, req.file.buffer);
    return res.json({
      success: true,
      message: 'Logo uploaded successfully',
      filename: 'custom-logo.png',
    });
  } catch (error) {
    console.error('Error uploading logo:', error);
    return res.status(500).json({ error: 'Failed to upload logo' });
  }
});

app.get('/api/logo', async (req, res) => {
  try {
    const logoBuffer = await fs.readFile(LOGO_FILE);
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(logoBuffer);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'No custom logo found' });
    } else {
      console.error('Error reading logo:', error);
      res.status(500).json({ error: 'Failed to read logo' });
    }
  }
});

app.get('/api/logo/exists', async (req, res) => {
  try {
    await fs.access(LOGO_FILE);
    res.json({ exists: true });
  } catch {
    res.json({ exists: false });
  }
});

app.delete('/api/logo', requireAdmin, async (req, res) => {
  try {
    await fs.unlink(LOGO_FILE);
    res.json({ success: true, message: 'Logo deleted successfully' });
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.json({ success: true, message: 'No logo to delete' });
    } else {
      console.error('Error deleting logo:', error);
      res.status(500).json({ error: 'Failed to delete logo' });
    }
  }
});

app.get('/api/cache/metadata', requireSession, async (req, res) => {
  try {
    const data = await fs.readFile(METADATA_CACHE_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.json({ version: 1, metadata: {} });
    } else {
      console.error('Error reading metadata cache:', error);
      res.status(500).json({ error: 'Failed to read metadata cache' });
    }
  }
});

app.post('/api/cache/metadata', requireSession, async (req, res) => {
  try {
    let existingCache = { version: 1, metadata: {} };

    try {
      const data = await fs.readFile(METADATA_CACHE_FILE, 'utf8');
      existingCache = JSON.parse(data);
    } catch {
      // File does not exist yet.
    }

    const newEntries = req.body.metadata || {};
    existingCache.metadata = { ...existingCache.metadata, ...newEntries };
    existingCache.lastUpdated = Date.now();

    await fs.writeFile(METADATA_CACHE_FILE, JSON.stringify(existingCache, null, 2));
    res.json({ success: true, totalEntries: Object.keys(existingCache.metadata).length });
  } catch (error) {
    console.error('Error saving metadata cache:', error);
    res.status(500).json({ error: 'Failed to save metadata cache' });
  }
});

app.delete('/api/cache/metadata', requireAdmin, async (req, res) => {
  try {
    await fs.writeFile(METADATA_CACHE_FILE, JSON.stringify({ version: 1, metadata: {} }, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing metadata cache:', error);
    res.status(500).json({ error: 'Failed to clear metadata cache' });
  }
});

app.get('/api/cache/geolocation', requireSession, async (req, res) => {
  try {
    const data = await fs.readFile(GEOLOCATION_CACHE_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.json({ version: 1, locations: {} });
    } else {
      console.error('Error reading geolocation cache:', error);
      res.status(500).json({ error: 'Failed to read geolocation cache' });
    }
  }
});

app.post('/api/cache/geolocation', requireSession, async (req, res) => {
  try {
    let existingCache = { version: 1, locations: {} };

    try {
      const data = await fs.readFile(GEOLOCATION_CACHE_FILE, 'utf8');
      existingCache = JSON.parse(data);
    } catch {
      // File does not exist yet.
    }

    const newEntries = req.body.locations || {};
    existingCache.locations = { ...existingCache.locations, ...newEntries };
    existingCache.lastUpdated = Date.now();

    await fs.writeFile(GEOLOCATION_CACHE_FILE, JSON.stringify(existingCache, null, 2));
    res.json({ success: true, totalEntries: Object.keys(existingCache.locations).length });
  } catch (error) {
    console.error('Error saving geolocation cache:', error);
    res.status(500).json({ error: 'Failed to save geolocation cache' });
  }
});

app.delete('/api/cache/geolocation', requireAdmin, async (req, res) => {
  try {
    await fs.writeFile(GEOLOCATION_CACHE_FILE, JSON.stringify({ version: 1, locations: {} }, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing geolocation cache:', error);
    res.status(500).json({ error: 'Failed to clear geolocation cache' });
  }
});

app.get('/api/tautulli', requireSession, async (req, res) => {
  try {
    const config = await readConfig();
    if (!config.tautulli || !config.tautulli.url || !config.tautulli.apiKey) {
      return res.status(400).json({ error: 'Tautulli not configured' });
    }

    const cmd = String(req.query.cmd || '').trim();
    if (!cmd) {
      return res.status(400).json({ error: 'Missing Tautulli command' });
    }

    const allowedCommands = req.authSession.isAdmin ? TAUTULLI_COMMAND_ALLOWLIST.admin : TAUTULLI_COMMAND_ALLOWLIST.user;
    if (!allowedCommands.has(cmd)) {
      return res.status(403).json({ error: 'That Tautulli command is not allowed for this session' });
    }

    if (!req.authSession.isAdmin && cmd === 'get_history' && !Number.isFinite(req.authSession.tautulliUserId)) {
      return res.status(403).json({ error: 'This Plex account is not mapped to a Tautulli user' });
    }

    const proxiedQuery = { ...req.query, cmd };
    if (!req.authSession.isAdmin && cmd === 'get_history') {
      proxiedQuery.user_id = String(req.authSession.tautulliUserId);
    }

    if (!req.authSession.isAdmin && cmd !== 'get_history' && Object.prototype.hasOwnProperty.call(proxiedQuery, 'user_id')) {
      delete proxiedQuery.user_id;
    }

    return proxyTautulliRequest(config, proxiedQuery, res);
  } catch (error) {
    console.error('[Tautulli Proxy] Error:', error);

    let troubleshooting = '';
    let statusCode = 500;
    if (error.code === 'EHOSTUNREACH') {
      troubleshooting = ' The Tautulli server is unreachable from this container.';
      statusCode = 503;
    } else if (error.code === 'ECONNREFUSED') {
      troubleshooting = ' Connection refused. Check that Tautulli is running and the port is correct.';
      statusCode = 503;
    } else if (error.code === 'ENOTFOUND') {
      troubleshooting = ' Hostname could not be resolved. Verify the configured URL is correct.';
      statusCode = 503;
    } else if (error.code === 'ETIMEDOUT') {
      troubleshooting = ' Connection timed out. Check network access to Tautulli.';
      statusCode = 504;
    }

    return res.status(statusCode).json({
      error: `Failed to fetch from Tautulli.${troubleshooting}`,
      code: error.code,
      message: error.message,
    });
  }
});

app.use(express.static(path.join(__dirname, 'dist')));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 2025;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Plex Wrapped server running on port ${PORT}`);
});