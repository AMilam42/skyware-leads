// Business card reading, entirely on the phone (Tesseract OCR, files in ./ocr so it works offline).
// CardOCR.prepare(file) -> { photo: JPEG data URL to keep, ocrCanvas }
// CardOCR.read(canvas, onProgress) -> raw text
// CardOCR.parse(text) -> { name, title, company, phone, email, website, lines }
(function () {
  let workerP = null;
  function getWorker() {
    if (!workerP) {
      const base = new URL('ocr/', location.href).href;
      workerP = Tesseract.createWorker('eng', 1, {
        workerPath: base + 'worker.min.js',
        corePath: base,
        langPath: base.replace(/\/$/, ''),
        workerBlobURL: false,
        logger: m => workerP && workerP.onProgress && workerP.onProgress(m),
      }).catch(err => { workerP = null; throw err; });
    }
    return workerP;
  }

  function loadImage(file) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error("couldn't open that photo"));
      img.src = URL.createObjectURL(file);
    });
  }
  function drawScaled(img, maxSide) {
    const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  async function prepare(file) {
    const img = await loadImage(file);
    const photo = drawScaled(img, 1400).toDataURL('image/jpeg', 0.72);   // ~150 KB copy kept with the lead
    // OCR copy: grayscale with stretched contrast, which helps on glossy or colored cards.
    const c = drawScaled(img, 2000), ctx = c.getContext('2d');
    const d = ctx.getImageData(0, 0, c.width, c.height), p = d.data;
    let lo = 255, hi = 0;
    for (let i = 0; i < p.length; i += 4) {
      const g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
      p[i] = g; if (g < lo) lo = g; if (g > hi) hi = g;
    }
    const k = 255 / Math.max(1, hi - lo);
    for (let i = 0; i < p.length; i += 4) { const g = (p[i] - lo) * k; p[i] = p[i + 1] = p[i + 2] = g; }
    ctx.putImageData(d, 0, 0);
    URL.revokeObjectURL(img.src);
    return { photo, ocrCanvas: c };
  }

  async function read(canvas, onProgress) {
    const w = await getWorker();
    workerP.onProgress = m => { if (m.status === 'recognizing text' && onProgress) onProgress(m.progress); };
    const { data } = await w.recognize(canvas);
    return data.text || '';
  }

  // ---------- Turning card text into fields ----------
  const TITLE_WORDS = /\b(owner|president|ceo|cfo|coo|cto|founder|partner|principal|director|manager|gm|vp|vice|chief|head|lead|officer|supervisor|coordinator|executive|exec|sales|marketing|operations|account|consultant|specialist|representative|rep|associate|administrator|admin|agent|broker|controller|engineer|analyst|assistant|general|regional|national|senior|sr\.?|jr\.?)\b/i;
  const COMPANY_WORDS = /\b(inc|llc|l\.l\.c|ltd|corp|corporation|co\.|company|group|holdings|hotel|hotels|resort|resorts|inn|suites|lodge|motel|hospitality|rv|park|parks|campground|campgrounds|camping|camp|koa|marina|properties|management|partners|solutions|systems|services|technologies|tech|enterprises|association|club|village|retreat)\b/i;
  const ADDRESS = /\b(\d{1,6}\s+\w+.*\b(st|street|ave|avenue|rd|road|blvd|dr|drive|ln|lane|hwy|highway|way|ct|court|pkwy|suite|ste)\b|p\.?o\.? box|\b[A-Z]{2}\s+\d{5}(-\d{4})?\b)/i;
  const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
  const WEB = /\b((?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|us|biz|info|co|io|travel|camp|rv|ca)(?:\/\S*)?)\b/i;
  const PHONE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?:\s*(?:x|ext\.?)\s*\d+)?/gi;

  const clean = s => s.replace(/[|_~`•·»«©®™]+/g, ' ').replace(/\s+/g, ' ').trim();
  const titleCase = s => s === s.toUpperCase() && /[A-Z]{3}/.test(s)
    ? s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()) : s;

  function parse(text) {
    const lines = text.split(/\n+/).map(clean).filter(l => l.length > 1 && /[A-Za-z0-9]{2}/.test(l));
    const out = { name: '', title: '', company: '', phone: '', email: '', website: '', lines };
    const used = new Set();

    // Email (OCR often reads "@" fine but adds spaces around dots)
    for (const [i, l] of lines.entries()) {
      const m = l.replace(/\s*([@.])\s*/g, '$1').match(EMAIL);
      if (m) { out.email = m[0].replace(/[.,;]+$/, '').toLowerCase(); used.add(i); break; }
    }
    // Phones: prefer direct / mobile / cell, skip fax
    const phones = [];
    lines.forEach((l, i) => {
      const found = l.match(PHONE); if (!found) return;
      const lab = l.toLowerCase();
      if (/\bfax\b|\bf[:.]/.test(lab) && found.length === 1) { used.add(i); return; }
      const score = /\b(cell|mobile|mob|direct|dir|c[:.]|m[:.]|d[:.])/.test(lab) ? 2 : /\b(office|main|tel|phone|o[:.]|p[:.]|t[:.])/.test(lab) ? 1 : 1;
      found.forEach(f => phones.push({ f, score }));
      used.add(i);
    });
    phones.sort((a, b) => b.score - a.score);
    if (phones[0]) out.phone = phones[0].f.trim();

    // Website
    for (const [i, l] of lines.entries()) {
      if (EMAIL.test(l)) continue;
      const m = l.match(WEB);
      if (m) { out.website = m[1].replace(/^https?:\/\//, '').replace(/[.,;]+$/, '').toLowerCase(); used.add(i); break; }
    }
    lines.forEach((l, i) => { if (ADDRESS.test(l)) used.add(i); });

    // Title
    for (const [i, l] of lines.entries()) {
      if (used.has(i) || /\d/.test(l) || l.length > 60) continue;
      if (TITLE_WORDS.test(l) && !COMPANY_WORDS.test(l)) { out.title = titleCase(l); used.add(i); break; }
    }
    // Company
    for (const [i, l] of lines.entries()) {
      if (used.has(i) || l.length > 60) continue;
      if (COMPANY_WORDS.test(l)) { out.company = titleCase(l); used.add(i); break; }
    }
    // Name: 2-4 words, letters only, each starting with a capital
    const nameLike = l => /^[A-Za-z][A-Za-z'.-]*(\s+[A-Za-z][A-Za-z'.,-]*){1,3}$/.test(l)
      && l.split(/\s+/).every(w => /^[A-Z]/.test(w)) && !TITLE_WORDS.test(l) && !COMPANY_WORDS.test(l);
    for (const [i, l] of lines.entries()) {
      if (used.has(i)) continue;
      if (nameLike(l)) { out.name = titleCase(l).replace(/,$/, ''); used.add(i); break; }
    }
    // Company fallback: the email or website domain ("sunnyacresrv.com" -> "Sunnyacresrv")
    if (!out.company) {
      const dom = (out.email.split('@')[1] || out.website || '').replace(/^www\./, '').split('.')[0];
      if (dom && !/^(gmail|yahoo|hotmail|outlook|aol|icloud|me|live|msn|comcast|att)$/.test(dom)) {
        out.company = dom.charAt(0).toUpperCase() + dom.slice(1);
      }
    }
    // Name fallback: "john.smith@" -> "John Smith"
    if (!out.name && out.email) {
      const local = out.email.split('@')[0];
      if (/^[a-z]+[._][a-z]+$/.test(local)) out.name = local.split(/[._]/).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
    }
    return out;
  }

  window.CardOCR = { prepare, read, parse, warmUp: () => getWorker().catch(() => {}) };
})();
