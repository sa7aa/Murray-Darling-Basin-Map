// Refresh local organisation logos from public website metadata. No dependencies.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const records = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/MDB_Community_Data_v5_PLAY.json'), 'utf8'));
const output = path.join(__dirname, '../assets/img/organisation-logos');
fs.mkdirSync(output, { recursive: true });
const manifestPath = path.join(__dirname, 'data/organisation-logos.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
const decode = value => String(value || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(m => [m[1].toLowerCase(), decode(m[2] ?? m[3] ?? m[4])]));
const absolute = (value, base) => { try { const u = new URL(decode(value), base); return /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; } };
async function request(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(7000), headers: { 'User-Agent': 'MDB-Map-Logo-Discovery/1.0', Accept: 'text/html,image/*;q=0.9,*/*;q=0.5' } });
  if (!response.ok) throw Error('HTTP ' + response.status);
  const declared = Number(response.headers.get('content-length'));
  if (declared > 3000000) throw Error('Response too large');
  const reader = response.body.getReader(); let size = 0; const chunks = [];
  while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 3000000) { await reader.cancel(); throw Error('Response too large'); } chunks.push(Buffer.from(value)); }
  return { body: Buffer.concat(chunks), url: response.url, type: response.headers.get('content-type') || '' };
}
function candidates(html, base) {
  const result = [];
  const add = (url, kind) => { const value = absolute(url, base); if (value) result.push({ url: value, kind }); };
  for (const block of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = value => { if (!value || typeof value !== 'object') return; if (value.logo) add(typeof value.logo === 'string' ? value.logo : value.logo.url || value.logo.contentUrl, 'logo'); Object.values(value).forEach(v => { if (typeof v === 'object') Array.isArray(v) ? v.forEach(walk) : walk(v); }); };
      walk(JSON.parse(block[1]));
    } catch { /* Ignore malformed structured metadata. */ }
  }
  for (const tag of html.matchAll(/<img\b[^>]*>/gi)) {
    const a = attrs(tag[0]);
    if (/logo/i.test([a.alt, a.id, a.class, a.src].join(' ')) && !/footer|partner|sponsor|payment/i.test([a.alt, a.class].join(' '))) add(a['data-src'] || a.src, 'logo');
  }
  for (const tag of html.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(tag[0]); if (/^(?:shortcut\s+)?icon$|apple-touch-icon/i.test(a.rel || '')) add(a.href, 'icon');
  }
  return result;
}
function extension(buffer, type) {
  if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if (buffer[0] === 255 && buffer[1] === 216) return 'jpg';
  if (buffer.toString('ascii', 0, 3) === 'GIF') return 'gif';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buffer.readUInt32LE(0) === 65536) return 'ico';
  const text = buffer.toString('utf8');
  if ((type.includes('svg') || /^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(text)) && /<svg\b/i.test(text) && !/<script|\bon\w+\s*=|<foreignObject|<!ENTITY/i.test(text)) return 'svg';
  return null;
}
const hostCache = new Map();
async function discover(website) {
  if (manifest[website]?.path && fs.existsSync(path.join(__dirname, '..', manifest[website].path))) return;
  const home = new URL(website).origin;
  let promise = hostCache.get(home);
  if (!promise) {
    promise = (async () => {
      let found = [];
      const pages = [...new Set([home.replace(/^http:/, 'https:'), home, website])];
      for (const url of pages) {
        try {
          const page = await request(url);
          if (page.type.includes('html')) found.push(...candidates(page.body.toString('utf8'), page.url));
          if (found.some(candidate => candidate.kind === 'logo')) break;
        } catch { /* Try the supplied page or conventional icon below. */ }
      }
      found.push({ url: home + '/favicon.ico', kind: 'icon' });
      const seen = new Set();
      for (const candidate of found.slice(0, 8)) {
        if (seen.has(candidate.url)) continue; seen.add(candidate.url);
        try {
          const image = await request(candidate.url);
          if (image.body.length < 16) continue;
          const ext = extension(image.body, image.type); if (!ext) continue;
          const name = crypto.createHash('sha256').update(image.body).digest('hex').slice(0, 20) + '.' + ext;
          fs.writeFileSync(path.join(output, name), image.body);
          return { path: 'assets/img/organisation-logos/' + name, source: candidate.url, kind: candidate.kind };
        } catch { /* Try the next declared logo or icon. */ }
      }
      return { path: null, reason: 'No downloadable logo or icon found' };
    })();
    hostCache.set(home, promise);
  }
  manifest[website] = await promise;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}
async function main() {
  const urls = [...new Set(records.map(r => r['dc:identifier']).filter(u => /^https?:\/\//i.test(u || '')))];
  let next = 0, completed = 0;
  await Promise.all(Array.from({ length: 8 }, async () => { while (next < urls.length) { const url = urls[next++]; try { await discover(url); } catch (error) { manifest[url] = { path: null, reason: error.message }; } completed++; if (completed % 25 === 0) console.log(`${completed}/${urls.length} websites checked`); } }));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`${Object.values(manifest).filter(v => v.path).length}/${urls.length} websites have a local logo or icon.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
