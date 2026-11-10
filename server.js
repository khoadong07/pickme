// Photo Picker — server không cần thư viện ngoài (Node 18+)
// Chạy: npm start  →  http://localhost:3456/admin
// Biến môi trường:
//   ADMIN_PASSWORD  mật khẩu trang quản lý (nếu bỏ trống sẽ tự tạo và lưu ở data/admin-password.txt)
//   GOOGLE_API_KEY  (tuỳ chọn) dùng Drive API thay vì đọc trang công khai — ổn định hơn với thư mục lớn
//   PUBLIC_URL      (tuỳ chọn) địa chỉ public khi deploy, vd https://chonanh.studio.vn

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ZipWriter } = require('./zip');

// Đọc cấu hình từ file .env cạnh server.js (nếu có) — tiện cho Windows, khỏi phải đặt biến môi trường.
// Biến môi trường đặt sẵn từ hệ thống được ưu tiên hơn file .env.
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
} catch {}

const PORT = process.env.PORT || 3456;
const API_KEY = process.env.GOOGLE_API_KEY || '';
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?|avif|cr2|cr3|nef|arw|dng|raf|orf|rw2)$/i;
const MAX_DEPTH = 3;

fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------------- Mật khẩu admin ----------------
let ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const PW_FILE = path.join(DATA_DIR, 'admin-password.txt');
if (!ADMIN_PASSWORD) {
  if (fs.existsSync(PW_FILE)) ADMIN_PASSWORD = fs.readFileSync(PW_FILE, 'utf8').trim();
  else { ADMIN_PASSWORD = crypto.randomBytes(6).toString('base64url'); fs.writeFileSync(PW_FILE, ADMIN_PASSWORD); }
}
const ADMIN_COOKIE = crypto.createHmac('sha256', ADMIN_PASSWORD).update('photo-picker-admin').digest('hex');

// ---------------- Lưu trữ JSON ----------------
let db = { galleries: {} };
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch {}

function saveDb() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
  try { fs.renameSync(tmp, DB_FILE); }
  catch { fs.writeFileSync(DB_FILE, fs.readFileSync(tmp)); fs.rmSync(tmp, { force: true }); } // Windows: file bị antivirus/indexer khoá
}

// ---------------- Google Drive ----------------
function extractFolderId(input) {
  const s = String(input || '').trim();
  const m =
    s.match(/\/folders\/([a-zA-Z0-9_-]{10,})/) ||
    s.match(/[?&]id=([a-zA-Z0-9_-]{10,})/) ||
    s.match(/^([a-zA-Z0-9_-]{10,})$/);
  return m ? m[1] : null;
}

function decodeHtml(str) {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

async function listViaApi(folderId, depth = 0, prefix = '') {
  const out = [];
  let pageToken = '';
  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&key=${API_KEY}` +
      `&fields=nextPageToken,files(id,name,mimeType)&pageSize=1000&orderBy=name` +
      `&supportsAllDrives=true&includeItemsFromAllDrives=true` +
      (pageToken ? `&pageToken=${pageToken}` : '');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Drive API lỗi ${res.status}. Kiểm tra quyền chia sẻ thư mục.`);
    const data = await res.json();
    for (const f of data.files || []) {
      if (f.mimeType === 'application/vnd.google-apps.folder') {
        if (depth < MAX_DEPTH) out.push(...await listViaApi(f.id, depth + 1, prefix + f.name + '/'));
      } else if (f.mimeType.startsWith('image/') || IMAGE_EXT.test(f.name)) {
        out.push({ id: f.id, name: f.name, folder: prefix });
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

async function listViaEmbed(folderId, depth = 0, prefix = '') {
  const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${folderId}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 PhotoPicker', 'Accept-Language': 'en' },
  });
  if (!res.ok) throw new Error(`Không đọc được thư mục (HTTP ${res.status}). Hãy để quyền "Bất kỳ ai có đường liên kết".`);
  const html = await res.text();
  const out = [];
  const entryRe = /<div class="flip-entry" id="entry-([a-zA-Z0-9_-]+)"[\s\S]*?<a href="([^"]+)"[\s\S]*?<div class="flip-entry-title">([\s\S]*?)<\/div>/g;
  let m;
  while ((m = entryRe.exec(html))) {
    const [, id, href, rawTitle] = m;
    const name = decodeHtml(rawTitle.replace(/<[^>]*>/g, '').trim());
    if (href.includes('/folders/')) {
      if (depth < MAX_DEPTH) out.push(...await listViaEmbed(id, depth + 1, prefix + name + '/'));
    } else if (IMAGE_EXT.test(name)) {
      out.push({ id, name, folder: prefix });
    }
  }
  if (depth === 0 && out.length === 0 && !html.includes('flip-entries')) {
    throw new Error('Không truy cập được thư mục. Kiểm tra lại quyền chia sẻ công khai.');
  }
  return out;
}

async function listDriveImages(driveUrl) {
  const folderId = extractFolderId(driveUrl);
  if (!folderId) throw new Error('Link Google Drive không hợp lệ.');
  const files = API_KEY ? await listViaApi(folderId) : await listViaEmbed(folderId);
  files.sort((a, b) => (a.folder + a.name).localeCompare(b.folder + b.name, undefined, { numeric: true }));
  if (!files.length) throw new Error('Không tìm thấy ảnh nào trong thư mục (hoặc thư mục chưa được chia sẻ công khai).');
  return { folderId, files };
}

// ---------------- Tiện ích HTTP ----------------
function sendJson(res, code, obj, headers = {}) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 2e6) { reject(new Error('Body quá lớn')); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('JSON không hợp lệ')); } });
    req.on('error', reject);
  });
}
function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim().split('=')).filter(p => p[0]));
}
function isAdmin(req) {
  const c = cookies(req).pp_admin || '';
  return c.length === ADMIN_COOKIE.length && crypto.timingSafeEqual(Buffer.from(c), Buffer.from(ADMIN_COOKIE));
}
function serveFile(res, file) {
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

// ---------------- Logic gallery ----------------
function status(g) {
  if (g.revoked) return 'revoked';
  if (g.expiresAt && Date.now() > new Date(g.expiresAt).getTime()) return 'expired';
  if (g.submittedAt) return g.changedAfterSubmit ? 'changed' : 'submitted';
  return 'active';
}
function adminView(g) {
  const { files, export: _oldExport, ...rest } = g;
  const byId = new Map(files.map(f => [f.id, f]));
  const toFiles = ids => ids.map(id => byId.get(id)).filter(Boolean);
  const sent = g.submitted || (g.submittedAt ? { picks: g.picks, clientNote: g.clientNote } : null);
  return {
    ...rest, status: status(g), fileCount: files.length,
    draftFiles: toFiles(g.picks),                       // lựa chọn hiện tại (có thể chưa gửi)
    sentFiles: sent ? toFiles(sent.picks) : null,       // bản khách gửi gần nhất
    sentNote: sent ? sent.clientNote : null,
  };
}
function clientView(g) {
  return {
    title: g.title, clientName: g.clientName, note: g.note, maxPicks: g.maxPicks, expiresAt: g.expiresAt,
    files: g.files, picks: g.picks, clientNote: g.clientNote, submittedAt: g.submittedAt,
    changedAfterSubmit: !!g.changedAfterSubmit, submitCount: g.submitCount || 0, status: status(g),
  };
}
function cleanPicks(g, picks) {
  const valid = new Set(g.files.map(f => f.id));
  const out = [...new Set(Array.isArray(picks) ? picks : [])].filter(id => valid.has(id));
  if (g.maxPicks > 0 && out.length > g.maxPicks) throw new Error(`Chỉ được chọn tối đa ${g.maxPicks} ảnh.`);
  return out;
}
function str(v, max = 500) { return String(v ?? '').trim().slice(0, max); }

// ---------------- API admin ----------------
async function adminApi(req, res, url, parts) {
  if (parts[0] === 'login' && req.method === 'POST') {
    const { password } = await readBody(req);
    if (password !== ADMIN_PASSWORD) return sendJson(res, 401, { error: 'Sai mật khẩu' });
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': `pp_admin=${ADMIN_COOKIE}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000` });
  }
  if (parts[0] === 'logout') return sendJson(res, 200, { ok: true }, { 'Set-Cookie': 'pp_admin=; Path=/; Max-Age=0' });
  if (!isAdmin(req)) return sendJson(res, 401, { error: 'Chưa đăng nhập' });
  if (parts[0] === 'me') return sendJson(res, 200, { ok: true, publicUrl: process.env.PUBLIC_URL || null });

  if (parts[0] !== 'galleries') return sendJson(res, 404, { error: 'Not found' });
  const token = parts[1];

  if (!token && req.method === 'GET') {
    const list = Object.values(db.galleries).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(adminView);
    return sendJson(res, 200, { galleries: list });
  }
  if (!token && req.method === 'POST') {
    const b = await readBody(req);
    const { folderId, files } = await listDriveImages(b.driveUrl);
    const t = crypto.randomBytes(9).toString('base64url');
    const g = db.galleries[t] = {
      token: t, driveUrl: str(b.driveUrl), folderId,
      title: str(b.title, 120) || 'Album ảnh', clientName: str(b.clientName, 120), phone: str(b.phone, 40), note: str(b.note, 1000),
      maxPicks: Math.max(0, parseInt(b.maxPicks) || 0),
      expiresAt: b.expiresAt ? new Date(b.expiresAt).toISOString() : null,
      revoked: false, createdAt: new Date().toISOString(),
      files, picks: [], clientNote: '', updatedAt: null, submittedAt: null,
    };
    saveDb();
    return sendJson(res, 201, { gallery: adminView(g) });
  }

  const g = db.galleries[token];
  if (!g) return sendJson(res, 404, { error: 'Không tìm thấy link' });

  if (req.method === 'DELETE') { delete db.galleries[token]; saveDb(); return sendJson(res, 200, { ok: true }); }
  if (req.method === 'GET' && parts[2] === 'zip') return handleZip(req, res, g, url);
  if (req.method === 'POST' && parts[2] === 'refresh') {
    const { files } = await listDriveImages(g.driveUrl);
    g.files = files; g.picks = g.picks.filter(id => files.some(f => f.id === id));
    saveDb(); return sendJson(res, 200, { gallery: adminView(g) });
  }
  if (req.method === 'PATCH') {
    const b = await readBody(req);
    if ('revoked' in b) g.revoked = !!b.revoked;
    if ('expiresAt' in b) g.expiresAt = b.expiresAt ? new Date(b.expiresAt).toISOString() : null;
    if ('maxPicks' in b) g.maxPicks = Math.max(0, parseInt(b.maxPicks) || 0);
    for (const k of ['title', 'clientName', 'phone', 'note']) if (k in b) g[k] = str(b[k], k === 'note' ? 1000 : 120);
    saveDb(); return sendJson(res, 200, { gallery: adminView(g) });
  }
  sendJson(res, 405, { error: 'Method not allowed' });
}

// ---------------- API khách ----------------
const CLOSED_MSG = {
  revoked: 'Link chọn ảnh này đã bị thu hồi. Vui lòng liên hệ photographer.',
  expired: 'Link chọn ảnh này đã hết hạn. Vui lòng liên hệ photographer để gia hạn.',
};
async function clientApi(req, res, url, parts) {
  const g = db.galleries[parts[0]];
  if (!g) return sendJson(res, 404, { error: 'Link không tồn tại.' });
  const st = status(g);
  if (CLOSED_MSG[st]) return sendJson(res, 410, { error: CLOSED_MSG[st], status: st });

  if (!parts[1] && req.method === 'GET') return sendJson(res, 200, clientView(g));

  if ((parts[1] === 'picks' && req.method === 'PUT') || (parts[1] === 'submit' && req.method === 'POST')) {
    // Link còn hạn → khách luôn được sửa, kể cả sau khi đã gửi
    const b = await readBody(req);
    g.picks = cleanPicks(g, b.picks);
    g.clientNote = str(b.clientNote, 2000);
    g.updatedAt = new Date().toISOString();
    if (parts[1] === 'submit') {
      if (!g.picks.length) return sendJson(res, 400, { error: 'Bạn chưa chọn ảnh nào.' });
      g.submittedAt = g.updatedAt;
      g.submitCount = (g.submitCount || 0) + 1;
      g.submitted = { picks: [...g.picks], clientNote: g.clientNote };
    }
    // Có khác so với lần gửi gần nhất không?
    g.changedAfterSubmit = !!g.submitted && (
      g.submitted.clientNote !== g.clientNote ||
      g.submitted.picks.length !== g.picks.length ||
      g.submitted.picks.some(id => !g.picks.includes(id)));
    saveDb();
    return sendJson(res, 200, clientView(g));
  }
  sendJson(res, 405, { error: 'Method not allowed' });
}

// Proxy ảnh — chỉ phục vụ ảnh thuộc một link hợp lệ
async function handleImg(req, res, url) {
  const id = url.searchParams.get('id');
  const g = db.galleries[url.searchParams.get('g')];
  const allowed = g && g.files.some(f => f.id === id) && (isAdmin(req) || !CLOSED_MSG[status(g)]);
  if (!allowed) { res.writeHead(403); return res.end(); }
  const sz = Math.min(parseInt(url.searchParams.get('sz')) || 600, 2400);
  const sources = [
    `https://lh3.googleusercontent.com/d/${id}=w${sz}`,
    `https://drive.google.com/thumbnail?id=${id}&sz=w${sz}`,
  ];
  for (const src of sources) {
    try {
      const r = await fetch(src, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } });
      const type = r.headers.get('content-type') || '';
      if (!r.ok || !type.startsWith('image/')) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'private, max-age=86400' });
      return res.end(buf);
    } catch { /* thử nguồn tiếp theo */ }
  }
  res.writeHead(404); res.end();
}

// ---------------- Tải ZIP ảnh khách đã chọn ----------------
// Tải file GỐC từ Drive công khai (không cần đăng nhập). Nếu chủ thư mục tắt quyền tải xuống,
// dùng bản xem trước độ phân giải cao nhất Google cho phép và ghi chú lại trong danh sách.
async function fetchOriginal(id) {
  const tries = [
    ...(API_KEY ? [`https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${API_KEY}`] : []),
    `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`,
  ];
  for (const u of tries) {
    try {
      const r = await fetch(u, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (r.ok && !(r.headers.get('content-type') || '').includes('text/html')) return { data: Buffer.from(await r.arrayBuffer()), original: true };
    } catch {}
  }
  try {
    const r = await fetch(`https://lh3.googleusercontent.com/d/${id}=s0`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (r.ok && (r.headers.get('content-type') || '').startsWith('image/')) return { data: Buffer.from(await r.arrayBuffer()), original: false };
  } catch {}
  return null;
}

async function handleZip(req, res, g, url) {
  const draft = url.searchParams.get('v') === 'draft';
  const ids = draft || !g.submitted ? g.picks : g.submitted.picks;
  if (!ids.length) return sendJson(res, 400, { error: 'Khách chưa chọn ảnh nào.' });
  const byId = new Map(g.files.map(f => [f.id, f]));
  const files = ids.map(id => byId.get(id)).filter(Boolean);

  const base = `${g.clientName || g.title}-${files.length}-anh${draft ? '-ban-nhap' : ''}`.replace(/[\\/:*?"<>|]+/g, '-');
  res.writeHead(200, {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="photos.zip"; filename*=UTF-8''${encodeURIComponent(base)}.zip`,
    'Cache-Control': 'no-store',
  });
  let aborted = false;
  res.on('close', () => { if (!res.writableFinished) aborted = true; });
  const write = buf => new Promise((resolve, reject) => {
    if (aborted) return reject(new Error('client đã huỷ tải'));
    res.write(buf) ? resolve() : res.once('drain', resolve);
  });
  const zip = new ZipWriter(write);

  // Tải trước 3 file song song, ghi vào ZIP theo đúng thứ tự
  const pending = new Map();
  const start = i => { if (i < files.length && !pending.has(i)) pending.set(i, fetchOriginal(files[i].id)); };
  const failed = [], previews = [];
  try {
    for (let i = 0; i < files.length; i++) {
      for (let k = i; k < i + 3; k++) start(k);
      const f = files[i], got = await pending.get(i); pending.delete(i);
      if (!got) { failed.push(f.folder + f.name); continue; }
      if (!got.original) previews.push(f.folder + f.name);
      await zip.addFile(f.folder + f.name, got.data);
    }
    const vn = t => t ? new Date(t).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '';
    const when = draft || !g.submittedAt ? `bản nháp (cập nhật ${vn(g.updatedAt)})` : `bản khách gửi lúc ${vn(g.submittedAt)}`;
    const note = (draft || !g.submitted) ? g.clientNote : g.submitted.clientNote;
    const txt = [
      `Album: ${g.title}`, `Khách: ${g.clientName || ''} ${g.phone || ''}`.trim(), `Lựa chọn: ${when}`, `Số ảnh: ${files.length}`,
      note ? `\nGhi chú của khách:\n${note}` : '',
      `\nDanh sách (Lightroom):\n${files.map(f => f.name.replace(/\.[^.]+$/, '')).join(', ')}`,
      `\nDanh sách file:\n${files.map(f => f.folder + f.name).join('\n')}`,
      previews.length ? `\n⚠ Không tải được bản gốc (thư mục chặn tải xuống?) — đã dùng bản xem trước:\n${previews.join('\n')}` : '',
      failed.length ? `\n⚠ Không tải được:\n${failed.join('\n')}` : '',
    ].filter(Boolean).join('\n');
    await zip.addFile('_danh-sach-anh.txt', Buffer.from(txt, 'utf8'));
    await zip.finish();
    res.end();
    g.lastZipAt = new Date().toISOString(); saveDb();
  } catch (e) {
    res.destroy();
  }
}

// ---------------- Router ----------------
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;
  try {
    if (p === '/' ) { res.writeHead(302, { Location: '/admin' }); return res.end(); }
    if (p === '/admin') return serveFile(res, path.join(PUBLIC_DIR, 'admin.html'));
    if (/^\/g\/[\w-]+\/?$/.test(p)) return serveFile(res, path.join(PUBLIC_DIR, 'gallery.html'));
    if (p === '/img') return await handleImg(req, res, url);
    if (p.startsWith('/api/admin/')) return await adminApi(req, res, url, p.slice(11).split('/').filter(Boolean));
    if (p.startsWith('/api/g/')) return await clientApi(req, res, url, p.slice(7).split('/').filter(Boolean));
    res.writeHead(404); res.end('Not found');
  } catch (e) {
    sendJson(res, 400, { error: e.message });
  }
}).on('error', e => {
  if (e.code === 'EADDRINUSE') console.error(`\n❌ Cổng ${PORT} đang bị chương trình khác dùng (có thể server đã chạy sẵn ở cửa sổ khác).\n   Tắt chương trình đó, hoặc đổi PORT trong file .env\n`);
  else console.error(e);
  process.exit(1);
}).listen(PORT, () => {
  console.log(`📷 Photo Picker`);
  console.log(`   Trang quản lý: ${process.env.PUBLIC_URL || 'http://localhost:' + PORT}/admin`);
  console.log(`   Mật khẩu:      ${process.env.ADMIN_PASSWORD ? '(từ ADMIN_PASSWORD)' : ADMIN_PASSWORD + '  (lưu ở data/admin-password.txt)'}`);
  console.log(`   Nguồn ảnh:     ${API_KEY ? 'Drive API' : 'trang Drive công khai'}`);
});
