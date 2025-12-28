const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' })); // Increase limit for cache updates

const CONFIG_FILE = '/data/config.json';
const METADATA_CACHE_FILE = '/data/metadata-cache.json';

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
    
    // Merge new metadata entries
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

// Proxy endpoint for Tautulli requests
app.get('/api/tautulli', async (req, res) => {
  try {
    // Read config to get Tautulli URL and API key
    const configData = await fs.readFile(CONFIG_FILE, 'utf8');
    const config = JSON.parse(configData);
    
    if (!config.tautulli || !config.tautulli.url || !config.tautulli.apiKey) {
      return res.status(400).json({ error: 'Tautulli not configured' });
    }

    // NORMALIZE URL - add http:// if missing
    let tautulliBaseUrl = config.tautulli.url.trim().replace(/\/$/, '');
    if (!tautulliBaseUrl.startsWith('http://') && !tautulliBaseUrl.startsWith('https://')) {
      tautulliBaseUrl = `http://${tautulliBaseUrl}`;
    }

    // Build the Tautulli URL with query parameters
    const tautulliUrl = new URL(tautulliBaseUrl);
    tautulliUrl.pathname = '/api/v2';
    
    // Forward all query parameters from the client request
    Object.keys(req.query).forEach(key => {
      tautulliUrl.searchParams.append(key, req.query[key]);
    });
    
    // Add API key
    tautulliUrl.searchParams.append('apikey', config.tautulli.apiKey);

    // Make request to Tautulli
    const response = await fetch(tautulliUrl.toString());
    
    // Check if this is an image request (pms_image_proxy returns images, not JSON)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.startsWith('image/')) {
      // Proxy the image directly
      const imageBuffer = await response.arrayBuffer();
      res.set('Content-Type', contentType);
      res.send(Buffer.from(imageBuffer));
    } else {
      // Return JSON for API calls
      const data = await response.json();
      res.json(data);
    }
  } catch (error) {
    console.error('Error proxying Tautulli request:', error);
    res.status(500).json({ error: 'Failed to fetch from Tautulli' });
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