'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { PromptStore } = require('./lib/store');
const { validatePrompt } = require('./lib/validate');

const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY_BYTES = 1024 * 1024; // refuse request bodies larger than 1 MB
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

// An error that carries the HTTP status code we want to send back.
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function sendJson(res, status, data) {
  const payload = data === undefined ? '' : JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

// Collects the request body and parses it as JSON.
function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, 'Request body is too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new HttpError(400, 'Request body must be valid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Handles every URL that starts with /api.
async function handleApi(req, res, url, store) {
  const [, , resource, id, action] = url.pathname.split('/'); // ['', 'api', 'prompts', ':id', 'copy']
  const method = req.method;

  if (resource === 'health' && method === 'GET') {
    return sendJson(res, 200, { status: 'ok', prompts: store.items.length });
  }

  if (resource === 'tags' && method === 'GET') {
    return sendJson(res, 200, store.tags());
  }

  if (resource !== 'prompts') throw new HttpError(404, 'Route not found');

  // /api/prompts
  if (!id) {
    if (method === 'GET') {
      const q = url.searchParams.get('q') || '';
      const tag = url.searchParams.get('tag') || '';
      return sendJson(res, 200, store.list({ q, tag }));
    }
    if (method === 'POST') {
      const { errors, value } = validatePrompt(await readJson(req));
      if (errors.length) throw new HttpError(400, 'Invalid prompt', errors);
      return sendJson(res, 201, store.create(value));
    }
    throw new HttpError(405, 'Method not allowed');
  }

  // /api/prompts/:id/copy  (records that a prompt was used)
  if (action === 'copy') {
    if (method !== 'POST') throw new HttpError(405, 'Method not allowed');
    const prompt = store.recordUse(id);
    if (!prompt) throw new HttpError(404, 'Prompt not found');
    return sendJson(res, 200, prompt);
  }

  // /api/prompts/:id
  if (method === 'GET') {
    const prompt = store.get(id);
    if (!prompt) throw new HttpError(404, 'Prompt not found');
    return sendJson(res, 200, prompt);
  }
  if (method === 'PUT') {
    const { errors, value } = validatePrompt(await readJson(req));
    if (errors.length) throw new HttpError(400, 'Invalid prompt', errors);
    const prompt = store.update(id, value);
    if (!prompt) throw new HttpError(404, 'Prompt not found');
    return sendJson(res, 200, prompt);
  }
  if (method === 'DELETE') {
    if (!store.remove(id)) throw new HttpError(404, 'Prompt not found');
    return sendJson(res, 204);
  }
  throw new HttpError(405, 'Method not allowed');
}

// Serves the files in /public (the web page).
function serveStatic(req, res, url) {
  if (req.method !== 'GET') throw new HttpError(405, 'Method not allowed');

  const requested = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const filePath = path.join(PUBLIC_DIR, requested);

  // Block paths like /../server.js that try to escape the public folder.
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) throw new HttpError(403, 'Forbidden');

  fs.readFile(filePath, (err, content) => {
    if (err) return sendJson(res, 404, { error: 'File not found' });
    const type = MIME_TYPES[path.extname(filePath)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(content);
  });
}

function createServer(store) {
  return http.createServer(async (req, res) => {
    const started = Date.now();
    res.on('finish', () => {
      if (process.env.NODE_ENV !== 'test') {
        console.log(`${req.method} ${req.url} ${res.statusCode} ${Date.now() - started}ms`);
      }
    });

    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      if (url.pathname.startsWith('/api/')) await handleApi(req, res, url, store);
      else serveStatic(req, res, url);
    } catch (err) {
      if (err instanceof HttpError) {
        return sendJson(res, err.status, { error: err.message, details: err.details });
      }
      console.error(err);
      sendJson(res, 500, { error: 'Something went wrong on the server' });
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const store = new PromptStore(path.join(__dirname, 'data', 'prompts.json')).load();
  createServer(store).listen(port, () => {
    console.log(`PromptVault running at http://localhost:${port}`);
  });
}

module.exports = { createServer };
