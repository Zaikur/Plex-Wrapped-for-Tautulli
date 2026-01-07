// server.js - Updated with better error handling for Tautulli connections

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');

const app = express();
app.use(express.json({ limit: '10mb' }));

const CONFIG_FILE = '/data/config.json';
const METADATA_CACHE_FILE = '/data/metadata-cache.json';
const LOGO_FILE = '/data/custom-logo.png';
const GEOLOCATION_CACHE_FILE = '/data/geolocation-cache.json';

// Configure multer for logo upload
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
  }
});

// Ensure data directory exists
fs.mkdir('/data', { recursive: true }).catch(() => {});

// API endpoint to get config
app.get('/api/config', async (req, res) => {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.json({});
    } else {
      console.error('Error reading config:', error);
      res.status(500).json({ error: 'Failed to read config' });
    }
  }
});

// API endpoint to save config
app.post('/api/config', async (req, res) => {
  try {
    await fs.writeFile(CONFIG_FILE, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving config:', error);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

// API endpoint to upload logo
app.post('/api/logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    await fs.writeFile(LOGO_FILE, req.file.buffer);
    res.json({ 
      success: true, 
      message: 'Logo uploaded successfully',
      filename: 'custom-logo.png'
    });
  } catch (error) {
    console.error('Error uploading logo:', error);
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

// API endpoint to get logo
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

// API endpoint to check if logo exists
app.get('/api/logo/exists', async (req, res) => {
  try {
    await fs.access(LOGO_FILE);
    res.json({ exists: true });
  } catch {
    res.json({ exists: false });
  }
});

// API endpoint to delete logo
app.delete('/api/logo', async (req, res) => {
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

// API endpoint to get metadata cache
app.get('/api/cache/metadata', async (req, res) => {
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

// API endpoint to update metadata cache (merge new entries)
app.post('/api/cache/metadata', async (req, res) => {
  try {
    let existingCache = { version: 1, metadata: {} };
    
    try {
      const data = await fs.readFile(METADATA_CACHE_FILE, 'utf8');
      existingCache = JSON.parse(data);
    } catch (e) {
      // File doesn't exist yet, use default
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

// API endpoint to clear metadata cache
app.delete('/api/cache/metadata', async (req, res) => {
  try {
    await fs.writeFile(METADATA_CACHE_FILE, JSON.stringify({ version: 1, metadata: {} }, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing metadata cache:', error);
    res.status(500).json({ error: 'Failed to clear metadata cache' });
  }
});

// ============ GEOLOCATION CACHE ENDPOINTS ============

// API endpoint to get geolocation cache
app.get('/api/cache/geolocation', async (req, res) => {
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

// API endpoint to update geolocation cache (merge new entries)
app.post('/api/cache/geolocation', async (req, res) => {
  try {
    let existingCache = { version: 1, locations: {} };
    
    try {
      const data = await fs.readFile(GEOLOCATION_CACHE_FILE, 'utf8');
      existingCache = JSON.parse(data);
    } catch (e) {
      // File doesn't exist yet, use default
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

// API endpoint to clear geolocation cache
app.delete('/api/cache/geolocation', async (req, res) => {
  try {
    await fs.writeFile(GEOLOCATION_CACHE_FILE, JSON.stringify({ version: 1, locations: {} }, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing geolocation cache:', error);
    res.status(500).json({ error: 'Failed to clear geolocation cache' });
  }
});

// ============ END GEOLOCATION CACHE ENDPOINTS ============

// Proxy endpoint for Tautulli requests - UPDATED WITH BETTER ERROR HANDLING
app.get('/api/tautulli', async (req, res) => {
  try {
    const configData = await fs.readFile(CONFIG_FILE, 'utf8');
    const config = JSON.parse(configData);
    
    if (!config.tautulli || !config.tautulli.url || !config.tautulli.apiKey) {
      return res.status(400).json({ error: 'Tautulli not configured' });
    }

    let tautulliBaseUrl = config.tautulli.url.trim().replace(/\/$/, '');
    if (!tautulliBaseUrl.startsWith('http://') && !tautulliBaseUrl.startsWith('https://')) {
      tautulliBaseUrl = `http://${tautulliBaseUrl}`;
    }

    const tautulliUrl = new URL(tautulliBaseUrl);
    tautulliUrl.pathname = '/api/v2';
    
    Object.keys(req.query).forEach(key => {
      tautulliUrl.searchParams.append(key, req.query[key]);
    });
    
    tautulliUrl.searchParams.append('apikey', config.tautulli.apiKey);

    // Log the request URL (with masked API key for security)
    console.log('[Tautulli Proxy] Requesting:', tautulliUrl.toString().replace(config.tautulli.apiKey, '***'));

    const response = await fetch(tautulliUrl.toString());
    
    // Check if response is OK
    if (!response.ok) {
      console.error('[Tautulli Proxy] HTTP Error:', response.status, response.statusText);
      return res.status(response.status).json({ 
        error: `Tautulli returned HTTP ${response.status}: ${response.statusText}`,
        hint: 'Check that Tautulli is running and accessible at the configured URL'
      });
    }
    
    const contentType = response.headers.get('content-type');
    console.log('[Tautulli Proxy] Response Content-Type:', contentType);
    
    // Handle images
    if (contentType && contentType.startsWith('image/')) {
      const imageBuffer = await response.arrayBuffer();
      res.set('Content-Type', contentType);
      res.send(Buffer.from(imageBuffer));
      return;
    }
    
    // Handle JSON
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      res.json(data);
      return;
    }
    
    // Handle unexpected content (HTML, text, etc.)
    const text = await response.text();
    console.error('[Tautulli Proxy] Unexpected response type:', contentType);
    console.error('[Tautulli Proxy] Response preview:', text.substring(0, 500));
    
    // Check if it's an HTML error page
    if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
      return res.status(502).json({ 
        error: 'Tautulli returned an HTML page instead of JSON. This usually means the URL or API key is incorrect, or Tautulli requires authentication.',
        hint: 'Verify: 1) URL is correct (e.g., http://192.168.1.5:8181) 2) API key is valid 3) Tautulli Web Interface authentication is disabled or API access is allowed 4) HTTP Root in Tautulli settings is blank or /',
        receivedContentType: contentType || 'text/html'
      });
    }
    
    // Generic unexpected response
    return res.status(502).json({ 
      error: 'Unexpected response from Tautulli',
      contentType: contentType || 'unknown',
      preview: text.substring(0, 200),
      hint: 'The response was not in the expected JSON format'
    });
    
  } catch (error) {
    console.error('[Tautulli Proxy] Error:', error);
    
    let errorMessage = 'Failed to fetch from Tautulli';
    let troubleshooting = '';
    let statusCode = 500;
    
    if (error.code === 'EHOSTUNREACH') {
      troubleshooting = ' The Tautulli server is unreachable from this Docker container. If using Docker, try using host.docker.internal:PORT or your host machine\'s network IP address instead of localhost.';
      statusCode = 503;
    } else if (error.code === 'ECONNREFUSED') {
      troubleshooting = ' Connection refused. Check that Tautulli is running and the port is correct.';
      statusCode = 503;
    } else if (error.code === 'ENOTFOUND') {
      troubleshooting = ' Hostname could not be resolved. Verify the URL is correct.';
      statusCode = 503;
    } else if (error.code === 'ETIMEDOUT') {
      troubleshooting = ' Connection timed out. Check your network connection and Tautulli accessibility.';
      statusCode = 504;
    } else if (error.message && error.message.includes('JSON')) {
      troubleshooting = ' Tautulli returned HTML instead of JSON. Check your URL, API key, and Tautulli authentication settings.';
      statusCode = 502;
    }
    
    res.status(statusCode).json({ 
      error: errorMessage + troubleshooting,
      code: error.code,
      message: error.message
    });
  }
});

// Serve static files from dist
app.use(express.static(path.join(__dirname, 'dist')));

// Serve index.html for all other routes (SPA support)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 2025;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Plex Wrapped server running on port ${PORT}`);
});