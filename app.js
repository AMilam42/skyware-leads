const CFG = window.SKY_CONFIG;
const KEY = 'skyware_leads_v1', EVENT_KEY = 'skyware_event', EXPORT_KEY = 'skyware_last_export';
const HEADERS = ['Lead ID', 'Submission Timestamp', 'Event Name', 'Collected By', ...CFG.fields.map(f => f.label),
  'Possible Duplicate', 'Follow Up Status', 'Assigned To', 'Notes', 'Source', 'Title', 'Website', 'Card Photo'];
const WIDTHS = { 'Collected By': 16, 'Lead ID': 14, 'Submission Timestamp': 21, 'Event Name': 22, 'Email': 32,
  'Possible Duplicate': 40, 'Follow Up Status': 16, 'Assigned To': 16, 'Notes': 40,
  'Source': 11, 'Title': 22, 'Website': 26, 'Card Photo': 30 };
const emailRe = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;
const $ = id => document.getElementById(id);

// ---------- Storage: localStorage plus an IndexedDB mirror, so one copy survives if the other is lost ----------
let leads = [];
const idb = new Promise(res => {
  try {
    const req = indexedDB.open('skyware', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => res(req.result);
    req.onerror = () => res(null);
  } catch { res(null); }
});
async function idbGet(k) {
  const db = await idb; if (!db) return null;
  return new Promise(res => { const r = db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => res(null); });
}
async function idbSet(k, v) {
  const db = await idb; if (!db) return;
  return new Promise(res => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = t.onerror = () => res(); });
}
function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } }

async function loadLeads() {
  let a = []; try { a = JSON.parse(lsGet(KEY) || '[]'); } catch {}
  const b = (await idbGet(KEY)) || [];
  const byId = new Map([...b, ...a].map(l => [l['Lead ID'], l]));   // merge both copies
  leads = [...byId.values()].sort((x, y) => x['Submission Timestamp'].localeCompare(y['Submission Timestamp']));
}
// Every change to the lead list goes through this, one at a time, so a sync finishing
// while a visitor submits can never overwrite the new lead.
let leadsQueue = Promise.resolve();
function withLeads(fn) { const p = leadsQueue.then(async () => { await loadLeads(); return fn(); }); leadsQueue = p.catch(() => {}); return p; }
async function saveLeads() {
  const json = JSON.stringify(leads);
  const ok = lsSet(KEY, json);
  await idbSet(KEY, leads);
  return ok;
}
const eventName = () => lsGet(EVENT_KEY) || CFG.defaultEvent;
const BRAND_KEY = 'skyware_brand';
function applyBrand() {
  const key = CFG.brands[lsGet(BRAND_KEY)] ? lsGet(BRAND_KEY) : 'hotel';
  const b = CFG.brands[key];
  document.documentElement.dataset.brand = key;
  document.querySelectorAll('.brand-logo').forEach(img => { img.src = b.logo; img.alt = b.alt; });
  $('headline').textContent = b.headline;
  $('footContact').innerHTML = b.footer;
  const prop = $('property_name'); if (prop) prop.placeholder = b.propertyPlaceholder;
  document.querySelectorAll('[data-brand-pick]').forEach(btn => {
    const on = btn.dataset.brandPick === key;
    btn.classList.toggle('active', on); btn.setAttribute('aria-pressed', on);
  });
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist();

// ---------- Form ----------
const form = $('leadForm');
form.innerHTML = CFG.fields.map(f => `
  <div class="field">
    <label for="${f.key}">${f.label}${f.required ? ' <span class="req">*</span>' : ''}</label>
    <input id="${f.key}" name="${f.key}" type="${f.type === 'email' ? 'email' : f.type === 'phone' ? 'tel' : 'text'}"
      ${f.type === 'email' ? 'inputmode="email" autocapitalize="off" autocorrect="off" spellcheck="false"' : ''}
      ${f.type === 'phone' ? 'inputmode="tel"' : ''} ${f.type === 'text' ? 'autocapitalize="words"' : ''}
      data-type="${f.type}" data-label="${f.label}" ${f.required ? 'data-required="1"' : ''} placeholder="${f.placeholder || ''}">
    <div class="err" aria-live="polite"></div>
  </div>`).join('') + '<button class="btn" id="submitBtn" type="submit">Let\'s Talk</button>';
const inputs = [...form.querySelectorAll('input')];

function check(input) {
  const v = input.value.trim(), t = input.dataset.type;
  if (input.dataset.required && !v) return input.dataset.label + ' is required.';
  if (v && t === 'email' && !emailRe.test(v)) return 'Please enter a valid email, like name@hotel.com.';
  if (v && t === 'phone') { const d = v.replace(/\D/g, ''); if (d.length < 10 || d.length > 15) return 'Please enter a phone number with at least 10 digits.'; }
  return '';
}
function show(input, msg) {
  const box = input.closest('.field');
  box.classList.toggle('invalid', !!msg);
  box.querySelector('.err').textContent = msg;
}
function formatPhone(v) {
  const d = v.replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1') return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return v;
}
inputs.forEach(i => {
  i.addEventListener('blur', () => { if (i.dataset.type === 'phone') i.value = formatPhone(i.value); show(i, check(i)); });
  i.addEventListener('input', () => { if (i.closest('.field').classList.contains('invalid')) show(i, check(i)); });
});

const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
function findDupes(lead) {
  const email = norm(lead.Email), prop = norm(lead['Property Name']);
  return leads.map(l => {
    if (email && norm(l.Email) === email) return `same email as ${l['Lead ID']}`;
    if (prop && norm(l['Property Name']) === prop) return `same property as ${l['Lead ID']}`;
    return '';
  }).filter(Boolean).join('; ');
}
const pad = n => String(n).padStart(2, '0');
function stamp(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function newId() {
  const b = crypto.getRandomValues(new Uint8Array(3));
  return 'SKY-' + [...b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}

let timer;
function resetForm() {
  clearInterval(timer);
  form.reset(); inputs.forEach(i => show(i, ''));
  $('thanksView').classList.add('hidden');
  $('formView').classList.remove('hidden');
  $('submitBtn').disabled = false;
  window.scrollTo(0, 0);
}
$('againBtn').onclick = resetForm;

form.addEventListener('submit', async e => {
  e.preventDefault();
  let first = null;
  inputs.forEach(i => { const m = check(i); show(i, m); if (m && !first) first = i; });
  if (first) { first.focus(); return; }
  $('submitBtn').disabled = true;
  const lead = { 'Lead ID': newId(), 'Submission Timestamp': stamp(), 'Event Name': eventName(), 'Collected By': signedIn || '' };
  CFG.fields.forEach(f => {
    const i = $(f.key);
    lead[f.label] = f.type === 'phone' ? formatPhone(i.value.trim()) : i.value.trim();
  });
  const ok = await withLeads(() => {
    lead['Possible Duplicate'] = findDupes(lead);
    lead['Follow Up Status'] = 'New'; lead['Assigned To'] = ''; lead['Notes'] = ''; lead.Source = 'Kiosk';
    lead._v = 1;   // version: goes up on every edit; the sheet is up to date when _sv (synced version) matches
    leads.push(lead);
    return saveLeads();
  });
  syncSoon();
  if (!ok) alert('Warning: this device is almost out of storage. Please ask a Skyware team member to export the leads.');
  document.activeElement.blur();
  $('formView').classList.add('hidden');
  $('thanksView').classList.remove('hidden');
  let s = CFG.resetSeconds; $('secs').textContent = s;
  timer = setInterval(() => { s--; $('secs').textContent = s; if (s <= 0) resetForm(); }, 1000);
});

// ---------- Screens: sign in -> set up the show -> form -> (password) -> leads ----------
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const WHO_KEY = 'skyware_staff_user', RECENT_KEY = 'skyware_recent_events';
const formCard = document.querySelector('main.card:not([id])');
let signedIn = null;        // staff member signed in this session (cleared when the app is closed)
let loginMode = 'start';    // 'start' = opening the app, 'unlock' = leaving the form for the leads list

function showOnly(view) {
  [formCard, $('loginView'), $('setupView'), $('staffView'), $('scanView')].forEach(v => v.classList.toggle('hidden', v !== view));
  document.body.classList.toggle('admin', view === $('staffView'));
  window.scrollTo(0, 0);
}
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function showLogin(mode) {
  loginMode = mode;
  $('loginForm').reset(); $('loginErr').textContent = '';
  $('loginPass').closest('.field').classList.remove('invalid');
  $('loginTitle').textContent = mode === 'start' ? 'Staff sign in' : 'Staff only';
  $('loginSub').textContent = mode === 'start' ? 'Sign in to set up the booth.' : mode === 'scan' ? 'Enter your password to scan a business card.' : 'Enter your password to see the leads.';
  $('loginCancel').classList.toggle('hidden', mode === 'start');
  if (mode !== 'start' && signedIn) $('loginUser').value = signedIn;
  showOnly($('loginView'));
  (mode !== 'start' && signedIn ? $('loginPass') : $('loginUser')).focus();
}
$('loginCancel').onclick = () => { showOnly(formCard); resetForm(); };
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const user = $('loginUser').value.trim().toLowerCase(), pass = $('loginPass').value;
  const hash = await sha256(`${user}:${pass}`);
  const ok = (CFG.staffLogins || []).some(l => l.username.toLowerCase() === user && l.passwordHash === hash);
  if (!ok) {
    $('loginErr').textContent = 'That username and password don\'t match. Please try again.';
    $('loginPass').closest('.field').classList.add('invalid');
    $('loginPass').value = ''; $('loginPass').focus();
    return;
  }
  signedIn = user; lsSet(WHO_KEY, user);
  document.activeElement.blur();
  if (loginMode === 'start') showSetup(); else if (loginMode === 'scan') showScan(true); else showLeads();
});
function signOut() { signedIn = null; showLogin('start'); }

// Set up this show: pick the logo, enter the event, start
$('brandTiles').innerHTML = Object.entries(CFG.brands).map(([key, b]) => `
  <button type="button" class="brand-tile" data-brand-pick="${key}" aria-pressed="false">
    <span class="tile-check" aria-hidden="true">&#10003;</span>
    <span class="tile-logo"><img src="${b.logo}" alt=""></span>
    <span class="tile-name">${b.name}</span>
    <span class="tile-blurb">${b.blurb}</span>
  </button>`).join('');
let pickedBrand = null, pickedMode = null;
const MODE_KEY = 'skyware_mode';
const mode = () => lsGet(MODE_KEY) === 'scan' ? 'scan' : 'kiosk';
document.querySelectorAll('[data-mode-pick]').forEach(btn => btn.onclick = () => {
  pickedMode = btn.dataset.modePick; $('modeErr').textContent = '';
  document.querySelectorAll('[data-mode-pick]').forEach(b => { const on = b === btn; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on); });
  if (pickedMode === 'scan') CardOCR.warmUp();   // download the card reader now, while there's internet
});
document.querySelectorAll('[data-brand-pick]').forEach(btn => btn.onclick = () => {
  pickedBrand = btn.dataset.brandPick; lsSet(BRAND_KEY, pickedBrand); applyBrand(); $('setupErr').textContent = '';
});
function recentEvents() { try { return JSON.parse(lsGet(RECENT_KEY) || '[]'); } catch { return []; } }
function showSetup() {
  pickedBrand = null; pickedMode = null; $('modeErr').textContent = '';
  document.querySelectorAll('[data-mode-pick]').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', false); });
  document.querySelectorAll('[data-brand-pick]').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', false); });
  $('setupWho').textContent = signedIn;
  $('eventInput').value = '';
  $('setupErr').textContent = '';
  $('recentEvents').innerHTML = recentEvents().map(e => `<button type="button" class="chip" data-event="${esc(e)}">${esc(e)}</button>`).join('');
  $('recentEvents').querySelectorAll('[data-event]').forEach(b => b.onclick = () => { $('eventInput').value = b.dataset.event; $('setupErr').textContent = ''; });
  showOnly($('setupView'));
}
$('setupSignOut').onclick = signOut;
$('startBtn').onclick = () => {
  const ev = $('eventInput').value.trim();
  if (!pickedBrand) { $('setupErr').textContent = 'Tap the logo to use for this show.'; return; }
  if (!ev) { $('setupErr').textContent = 'Enter the event name.'; $('eventInput').focus(); return; }
  if (!pickedMode) { $('modeErr').textContent = 'Choose Booth iPad or Quick scan.'; return; }
  lsSet(EVENT_KEY, ev); lsSet(MODE_KEY, pickedMode);
  lsSet(RECENT_KEY, JSON.stringify([ev, ...recentEvents().filter(e => e !== ev)].slice(0, 5)));
  document.activeElement.blur();
  goCollect();
};
function goCollect() { if (mode() === 'scan') showScan(); else { showOnly(formCard); resetForm(); } }
$('eventInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('startBtn').click(); } });

// Leads list (password again, so visitors can't open it from the form)
$('staffLink').onclick = () => showLogin('unlock');
$('staffScanLink').onclick = () => showScan(true);   // no password: scanning only adds leads, it can't show or change any
async function showLeads() { await loadLeads(); renderStaff(); showOnly($('staffView')); }
function renderStaff() {
  $('count').textContent = leads.length;
  renderSync();
  $('whoAmI').textContent = signedIn || '';
  $('eventNow').textContent = eventName();
  // On screen, Notes, Name and Property come first so they're easy to reach; the Excel column order is unchanged.
  const first = ['Name', 'Property Name'];
  const shown = [...first, ...HEADERS.filter(h => h !== 'Notes' && !first.includes(h))];
  $('thead').innerHTML = `<tr><th>Notes</th>${shown.map(h => `<th>${esc(h)}</th>`).join('')}</tr>`;
  $('rows').innerHTML = [...leads].reverse().map(l => `<tr class="${l['Possible Duplicate'] ? 'dup' : ''}">
    <td class="note-cell"><button type="button" class="note-btn${l.Notes ? ' has-note' : ''}" data-note="${esc(l['Lead ID'])}">${l.Notes ? 'Edit note' : '+ Add note'}</button>${l.Notes ? `<div class="note-snippet">${esc(l.Notes)}</div>` : ''}</td>
    ${shown.map(h => h === 'Card Photo'
      ? `<td data-photo-cell="${esc(l['Lead ID'])}">${l['Card Photo'] ? `<a href="${esc(l['Card Photo'])}" target="_blank">Drive</a>` : ''}</td>`
      : `<td>${esc(l[h])}</td>`).join('')}</tr>`).join('');
  $('rows').querySelectorAll('[data-note]').forEach(b => b.onclick = () => openNote(b.dataset.note));
  $('backBtn').textContent = mode() === 'scan' ? 'Back to scanning' : 'Back to form';
  leads.filter(l => l._photo).forEach(async l => {
    const cell = $('rows').querySelector(`[data-photo-cell="${CSS.escape(l['Lead ID'])}"]`); if (!cell) return;
    const src = await idbGet('photo:' + l['Lead ID']);
    if (src) { cell.innerHTML = `<img class="photo-thumb" src="${src}" alt="Card">`; cell.firstChild.onclick = () => { $('photoBig').src = src; $('photoDialog').classList.remove('hidden'); }; }
  });
  const last = JSON.parse(lsGet(EXPORT_KEY) || 'null');
  const notExported = last ? leads.length - last.count : leads.length;
  $('exportInfo').textContent = last
    ? `Last export: ${last.at} (${last.count} leads).` + (notExported > 0 ? ` ${notExported} new since then.` : ' Everything is exported.')
    : (leads.length ? 'Not exported yet. Export at the end of each day.' : '');
}
$('backBtn').onclick = goCollect;

// Notes on a lead (saved on the device and exported in the Notes column)
let noteFor = null;
function openNote(id) {
  const l = leads.find(x => x['Lead ID'] === id); if (!l) return;
  noteFor = id;
  $('noteTitle').textContent = l.Name || 'Lead';
  $('noteMeta').textContent = [l['Property Name'], l['Phone Number'], l.Email].filter(Boolean).join(' · ');
  $('noteText').value = l.Notes || '';
  $('noteDialog').classList.remove('hidden');
  $('noteText').focus();
}
function closeNote() { noteFor = null; $('noteDialog').classList.add('hidden'); document.activeElement.blur(); }
$('noteCancel').onclick = closeNote;
$('noteDialog').addEventListener('click', e => { if (e.target === $('noteDialog')) closeNote(); });
$('noteSave').onclick = async () => {
  const text = $('noteText').value.trim(), id = noteFor;
  await withLeads(() => {
    const l = leads.find(x => x['Lead ID'] === id);
    if (l && l.Notes !== text) { l.Notes = text; l._v = (l._v || 1) + 1; return saveLeads(); }
  });
  closeNote(); renderStaff(); syncSoon();
};
$('changeSetupBtn').onclick = showSetup;
$('photoClose').onclick = () => $('photoDialog').classList.add('hidden');
$('photoDialog').addEventListener('click', e => { if (e.target === $('photoDialog')) $('photoDialog').classList.add('hidden'); });
$('signOutBtn').onclick = signOut;

function exportName() {
  const d = new Date();
  return `Skyware Leads - ${eventName().replace(/[\\/:*?"<>|]/g, '')} - ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.xlsx`;
}
$('exportBtn').onclick = async () => {
  await loadLeads();
  const bytes = buildXlsx(HEADERS, leads, { widths: WIDTHS, dupColumn: 'Possible Duplicate' });
  const name = exportName();
  const type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const file = new File([bytes], name, { type });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: name });   // iPad: Save to Files, Dropbox, Mail, AirDrop
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return;   // share sheet closed without saving
    alert('Export failed: ' + err.message);
    return;
  }
  lsSet(EXPORT_KEY, JSON.stringify({ at: stamp(), count: leads.length }));
  renderStaff();
};
$('clearBtn').onclick = async () => {
  await loadLeads();
  const last = JSON.parse(lsGet(EXPORT_KEY) || 'null');
  const unsynced = CFG.sheetUrl ? pendingLeads().length : leads.length;
  const unexported = !last || last.count < leads.length;
  const warn = unsynced && unexported
    ? `\n\n${unsynced} lead(s) are NOT in the Google Sheet or an Excel export yet.` : '';
  const typed = prompt(`This permanently removes all ${leads.length} leads from this device.${warn}\n\nType CLEAR to confirm.`);
  if (typed !== 'CLEAR') return;
  await withLeads(async () => { for (const l of leads) if (l._photo) await idbSet('photo:' + l['Lead ID'], null); leads = []; return saveLeads(); });
  try { localStorage.removeItem(EXPORT_KEY); } catch {}
  renderStaff();
};

// ---------- Google Sheet sync ----------
const SYNC_KEY = 'skyware_last_sync';
const pendingLeads = () => leads.filter(l => (l._v || 1) !== l._sv);
let syncing = false, syncTimer = null, lastSyncError = '';
function syncSoon() { clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, 1500); }
async function syncNow() {
  if (!CFG.sheetUrl || syncing) return;
  if (!navigator.onLine) { renderSync(); return; }
  syncing = true;
  try {
    for (let round = 0; round < 20; round++) {
      await loadLeads();
      const pend = pendingLeads();
      const batch = pend.some(l => l._photo && !l['Card Photo']) ? pend.slice(0, 5) : pend.slice(0, 50);
      if (!batch.length) break;
      const sent = new Map(batch.map(l => [l['Lead ID'], l._v || 1]));
      const photos = {};
      for (const l of batch) if (l._photo && !l['Card Photo']) { const p = await idbGet('photo:' + l['Lead ID']); if (p) photos[l['Lead ID']] = p; }
      const res = await fetch(CFG.sheetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // keeps it a "simple" request Google accepts
        body: JSON.stringify({ secret: CFG.sheetSecret, headers: HEADERS,
          leads: batch.map(l => Object.fromEntries(HEADERS.map(h => [h, l[h] ?? '']))), photos }),
      });
      const out = await res.json();
      if (!out.ok) throw new Error(out.error || 'the sheet refused the leads');
      await withLeads(() => {
        (out.saved || []).forEach(id => { const l = leads.find(x => x['Lead ID'] === id); if (l) l._sv = sent.get(id); });
        Object.entries(out.photoUrls || {}).forEach(([id, url]) => { const l = leads.find(x => x['Lead ID'] === id); if (l) l['Card Photo'] = url; });
        return saveLeads();
      });
      lsSet(SYNC_KEY, stamp());
      lastSyncError = '';
    }
  } catch (err) {
    lastSyncError = !navigator.onLine ? '' : err instanceof TypeError ? "can't reach the sheet" : (err.message || "can't reach the sheet");
  } finally {
    syncing = false;
    renderSync();
  }
}
function renderSync() {
  const box = $('syncInfo'); if (!box) return;
  if (!CFG.sheetUrl) { box.className = 'sync-info'; box.textContent = 'Google Sheet: not connected. Use Export Excel to save leads.'; return; }
  const waiting = pendingLeads().length, last = lsGet(SYNC_KEY);
  let cls = 'ok', msg;
  if (!waiting) msg = `Google Sheet: all ${leads.length} lead${leads.length === 1 ? '' : 's'} saved${last ? ` (last sync ${last.slice(11, 16)})` : ''}.`;
  else if (!navigator.onLine) { cls = 'wait'; msg = `Google Sheet: ${waiting} waiting for internet. They'll send automatically.`; }
  else if (lastSyncError) { cls = 'err'; msg = `Google Sheet: ${waiting} not sent yet (${lastSyncError}). Retrying.`; }
  else { cls = 'wait'; msg = `Google Sheet: sending ${waiting}...`; }
  box.className = 'sync-info ' + cls; box.textContent = msg;
  $('openSheet').classList.toggle('hidden', !CFG.sheetViewUrl);
}
window.addEventListener('online', syncNow);
window.addEventListener('offline', renderSync);
setInterval(syncNow, 60000);
$('syncBtn').onclick = syncNow;
$('openSheet').onclick = () => window.open(CFG.sheetViewUrl, '_blank');

// ---------- Scan business cards (phone) ----------
const cardInputs = [...$('cardForm').querySelectorAll('input, textarea')];
let cardPhoto = null, ocrRun = 0, targetField = null;
function scanCount() {
  const ev = eventName(), mine = leads.filter(l => l['Event Name'] === ev && l.Source === 'Card scan').length;
  $('scanCount').textContent = mine ? `${mine} card${mine === 1 ? '' : 's'} scanned at this show` : '';
}
let scanFromKiosk = false;   // true when a staff member jumped in from the booth form's footer
async function showScan(fromKiosk = false) {
  scanFromKiosk = fromKiosk;
  $('scanBackBtn').classList.toggle('hidden', !fromKiosk);
  $('scanLeadsBtn').classList.toggle('hidden', fromKiosk);
  await loadLeads();
  $('scanEvent').textContent = eventName();
  resetCard(); scanCount(); showOnly($('scanView'));
  CardOCR.warmUp();
}
function resetCard() {
  ocrRun++; cardPhoto = null; targetField = null;
  $('cardForm').reset(); $('cardErr').textContent = '';
  cardInputs.forEach(i => i.closest('.field').classList.remove('target', 'invalid'));
  $('scanForm').classList.add('hidden'); $('photoWrap').classList.add('hidden');
  $('ocrLinesWrap').classList.add('hidden'); $('ocrStatus').textContent = '';
  $('scanBtnLabel').classList.remove('hidden', 'busy'); $('manualBtn').classList.remove('hidden');
  $('cardFile').value = '';
}
function openCardForm() {
  $('scanBtnLabel').classList.add('hidden'); $('manualBtn').classList.add('hidden');
  $('scanForm').classList.remove('hidden');
}
$('manualBtn').onclick = () => { openCardForm(); $('c_name').focus(); };
$('retakeBtn').onclick = () => $('cardFile').click();
$('cardCancel').onclick = () => { if (!hasCardData() || confirm('Discard this card?')) resetCard(); };
const hasCardData = () => cardPhoto || cardInputs.some(i => i.value.trim());
$('cardFile').addEventListener('change', async () => {
  const file = $('cardFile').files[0]; if (!file) return;
  const run = ++ocrRun;
  $('scanBtnLabel').classList.add('busy');
  let prepared;
  try { prepared = await CardOCR.prepare(file); }
  catch (err) { alert('Sorry, ' + err.message + '. Try again.'); resetCard(); return; }
  cardPhoto = prepared.photo;
  $('cardPhoto').src = cardPhoto; $('photoWrap').classList.remove('hidden');
  openCardForm();
  $('ocrLinesWrap').classList.add('hidden');
  $('ocrStatus').textContent = 'Reading card...';
  try {
    const text = await CardOCR.read(prepared.ocrCanvas, p => { if (run === ocrRun) $('ocrStatus').textContent = `Reading card... ${Math.round(p * 100)}%`; });
    if (run !== ocrRun) return;
    const f = CardOCR.parse(text);
    const set = (id, v) => { if (v && !$(id).value.trim()) $(id).value = v; };
    set('c_name', f.name); set('c_title', f.title); set('c_company', f.company);
    set('c_phone', f.phone && formatPhone(f.phone)); set('c_email', f.email); set('c_web', f.website);
    $('ocrStatus').textContent = f.lines.length ? 'Check the fields below and fix anything the card reader got wrong.' : "Couldn't read text from this photo. Type the details in, or retake it closer and in good light.";
    $('ocrLines').innerHTML = f.lines.map((l, i) => `<button type="button" class="chip" data-line="${i}">${esc(l)}</button>`).join('');
    $('ocrLines').querySelectorAll('[data-line]').forEach(b => b.onclick = () => {
      const t = targetField || cardInputs.find(i => !i.value.trim() && i.id !== 'c_note') || $('c_note');
      const line = f.lines[+b.dataset.line];
      t.value = t.tagName === 'TEXTAREA' && t.value ? t.value + '\n' + line : (t.dataset.type === 'phone' ? formatPhone(line) : line);
    });
    $('ocrLinesWrap').classList.toggle('hidden', !f.lines.length);
  } catch (err) {
    if (run !== ocrRun) return;
    $('ocrStatus').textContent = navigator.onLine ? "The card reader didn't work this time. Type the details in; the photo is still saved."
      : "The card reader hasn't downloaded to this phone yet (open the app once with internet). Type the details in; the photo is still saved.";
  }
  $('scanBtnLabel').classList.remove('busy');
});
cardInputs.forEach(i => i.addEventListener('focus', () => {
  targetField = i; cardInputs.forEach(x => x.closest('.field').classList.toggle('target', x === i));
}));
$('c_phone').addEventListener('blur', () => { $('c_phone').value = formatPhone($('c_phone').value); });
$('cardForm').addEventListener('submit', async e => {
  e.preventDefault();
  const v = id => $(id).value.trim();
  if (!v('c_name') && !v('c_company') && !v('c_email') && !v('c_phone')) { $('cardErr').textContent = 'Add at least a name, company, phone or email.'; return; }
  if (v('c_email') && !emailRe.test(v('c_email'))) { $('cardErr').textContent = 'That email doesn\'t look right. Check it or clear it.'; $('c_email').focus(); return; }
  $('cardErr').textContent = ''; $('cardSave').disabled = true;
  const lead = { 'Lead ID': newId(), 'Submission Timestamp': stamp(), 'Event Name': eventName(), 'Collected By': signedIn || '' };
  cardInputs.forEach(i => { lead[i.dataset.col] = i.dataset.type === 'phone' ? formatPhone(i.value.trim()) : i.value.trim(); });
  lead.Source = 'Card scan'; lead['Card Photo'] = '';
  if (cardPhoto) { await idbSet('photo:' + lead['Lead ID'], cardPhoto); lead._photo = true; }
  const ok = await withLeads(() => {
    lead['Possible Duplicate'] = findDupes(lead);
    lead['Follow Up Status'] = 'New'; lead['Assigned To'] = ''; lead._v = 1;
    leads.push(lead);
    return saveLeads();
  });
  $('cardSave').disabled = false;
  syncSoon();
  if (!ok) alert('Warning: this phone is almost out of storage. Export your leads soon.');
  document.activeElement.blur();
  resetCard(); scanCount(); window.scrollTo(0, 0);
  $('savedToast').classList.remove('hidden'); setTimeout(() => $('savedToast').classList.add('hidden'), 1600);
});
$('scanBackBtn').onclick = () => { if (hasCardData() && !confirm('Leave this card without saving?')) return; showOnly(formCard); resetForm(); };
$('scanLeadsBtn').onclick = () => { if (hasCardData() && !confirm('Leave this card without saving?')) return; showLeads(); };

// ---------- Offline support ----------
applyBrand();
showLogin('start');
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
loadLeads().then(syncNow);
