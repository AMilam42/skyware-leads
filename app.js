const CFG = window.SKY_CONFIG;
const KEY = 'skyware_leads_v1', EVENT_KEY = 'skyware_event', EXPORT_KEY = 'skyware_last_export';
const HEADERS = ['Lead ID', 'Submission Timestamp', 'Event Name', 'Collected By', ...CFG.fields.map(f => f.label),
  'Possible Duplicate', 'Follow Up Status', 'Assigned To', 'Notes'];
const WIDTHS = { 'Collected By': 16, 'Lead ID': 14, 'Submission Timestamp': 21, 'Event Name': 22, 'Email': 32,
  'Possible Duplicate': 40, 'Follow Up Status': 16, 'Assigned To': 16, 'Notes': 40 };
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
  await loadLeads();   // pick up anything saved from another tab
  lead['Possible Duplicate'] = findDupes(lead);
  lead['Follow Up Status'] = 'New'; lead['Assigned To'] = ''; lead['Notes'] = '';
  leads.push(lead);
  const ok = await saveLeads();
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
  [formCard, $('loginView'), $('setupView'), $('staffView')].forEach(v => v.classList.toggle('hidden', v !== view));
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
  $('loginSub').textContent = mode === 'start' ? 'Sign in to set up the booth.' : 'Enter your password to see the leads.';
  $('loginCancel').classList.toggle('hidden', mode === 'start');
  if (mode === 'unlock' && signedIn) $('loginUser').value = signedIn;
  showOnly($('loginView'));
  (mode === 'unlock' && signedIn ? $('loginPass') : $('loginUser')).focus();
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
  if (loginMode === 'start') showSetup(); else showLeads();
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
let pickedBrand = null;
document.querySelectorAll('[data-brand-pick]').forEach(btn => btn.onclick = () => {
  pickedBrand = btn.dataset.brandPick; lsSet(BRAND_KEY, pickedBrand); applyBrand(); $('setupErr').textContent = '';
});
function recentEvents() { try { return JSON.parse(lsGet(RECENT_KEY) || '[]'); } catch { return []; } }
function showSetup() {
  pickedBrand = null;
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
  lsSet(EVENT_KEY, ev);
  lsSet(RECENT_KEY, JSON.stringify([ev, ...recentEvents().filter(e => e !== ev)].slice(0, 5)));
  document.activeElement.blur();
  showOnly(formCard); resetForm();
};
$('eventInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('startBtn').click(); } });

// Leads list (password again, so visitors can't open it from the form)
$('staffLink').onclick = () => showLogin('unlock');
async function showLeads() { await loadLeads(); renderStaff(); showOnly($('staffView')); }
function renderStaff() {
  $('count').textContent = leads.length;
  $('whoAmI').textContent = signedIn || '';
  $('eventNow').textContent = eventName();
  // On screen, Notes, Name and Property come first so they're easy to reach; the Excel column order is unchanged.
  const first = ['Name', 'Property Name'];
  const shown = [...first, ...HEADERS.filter(h => h !== 'Notes' && !first.includes(h))];
  $('thead').innerHTML = `<tr><th>Notes</th>${shown.map(h => `<th>${esc(h)}</th>`).join('')}</tr>`;
  $('rows').innerHTML = [...leads].reverse().map(l => `<tr class="${l['Possible Duplicate'] ? 'dup' : ''}">
    <td class="note-cell"><button type="button" class="note-btn${l.Notes ? ' has-note' : ''}" data-note="${esc(l['Lead ID'])}">${l.Notes ? 'Edit note' : '+ Add note'}</button>${l.Notes ? `<div class="note-snippet">${esc(l.Notes)}</div>` : ''}</td>
    ${shown.map(h => `<td>${esc(l[h])}</td>`).join('')}</tr>`).join('');
  $('rows').querySelectorAll('[data-note]').forEach(b => b.onclick = () => openNote(b.dataset.note));
  const last = JSON.parse(lsGet(EXPORT_KEY) || 'null');
  const notExported = last ? leads.length - last.count : leads.length;
  $('exportInfo').textContent = last
    ? `Last export: ${last.at} (${last.count} leads).` + (notExported > 0 ? ` ${notExported} new since then.` : ' Everything is exported.')
    : (leads.length ? 'Not exported yet. Export at the end of each day.' : '');
}
$('backBtn').onclick = () => { showOnly(formCard); resetForm(); };

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
  await loadLeads();   // pick up anything saved since the list was drawn
  const l = leads.find(x => x['Lead ID'] === id);
  if (l) { l.Notes = text; await saveLeads(); }
  closeNote(); renderStaff();
};
$('changeSetupBtn').onclick = showSetup;
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
  const warn = !last || last.count < leads.length ? '\n\nSome leads have NOT been exported yet.' : '';
  const typed = prompt(`This permanently removes all ${leads.length} leads from this device.${warn}\n\nType CLEAR to confirm.`);
  if (typed !== 'CLEAR') return;
  leads = []; await saveLeads();
  try { localStorage.removeItem(EXPORT_KEY); } catch {}
  renderStaff();
};

// ---------- Offline support ----------
applyBrand();
showLogin('start');
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
loadLeads();
