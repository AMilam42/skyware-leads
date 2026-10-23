/**
 * Skyware Leads -> Google Sheet receiver.
 *
 * Setup (once):
 * 1. Create a Google Sheet. Open Extensions > Apps Script, delete what's there, paste this whole file.
 * 2. Deploy > New deployment > type "Web app". Execute as: Me. Who has access: Anyone. Deploy, approve.
 * 3. Copy the web app URL (ends in /exec) into config.js (sheetUrl).
 *
 * The app sends batches of leads. Each lead is matched on Lead ID: an existing row is updated
 * (e.g. a note was added later), a new Lead ID is added as a new row.
 */
const SECRET = 'gYcYznlIRiUP5Wk0qaZhKi6T';   // must match sheetSecret in the app's config.js
const SHEET_NAME = 'Leads';

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);   // one batch at a time, so two iPads never write over each other
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.secret !== SECRET) return reply({ ok: false, error: 'bad secret' });
    const headers = body.headers, leads = body.leads || [];
    const sheet = getSheet(headers);
    const ids = sheet.getLastRow() > 1
      ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().map(r => String(r[0]))
      : [];
    const saved = [];
    leads.forEach(lead => {
      // Leading apostrophe keeps values as text (phone numbers, and anything starting with = + - @).
      const row = headers.map(h => {
        const v = lead[h] == null ? '' : String(lead[h]);
        return /^[=+\-@]/.test(v) ? "'" + v : v;
      });
      const at = ids.indexOf(String(lead['Lead ID']));
      if (at >= 0) {
        // Keep anything the sales team typed into Follow Up Status / Assigned To in the sheet.
        const current = sheet.getRange(at + 2, 1, 1, headers.length).getValues()[0];
        headers.forEach((h, i) => {
          if ((h === 'Follow Up Status' || h === 'Assigned To') && current[i] !== '' && current[i] !== 'New') row[i] = current[i];
        });
        sheet.getRange(at + 2, 1, 1, headers.length).setValues([row]);
      } else {
        sheet.appendRow(row);
        ids.push(String(lead['Lead ID']));
        if (lead['Possible Duplicate']) sheet.getRange(sheet.getLastRow(), 1, 1, headers.length).setBackground('#FDE9D6');
      }
      saved.push(lead['Lead ID']);
    });
    return reply({ ok: true, saved: saved });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return reply({ ok: true, app: 'Skyware Leads receiver' });
}

function getSheet(headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.getSheets()[0];
    sheet.setName(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#175B86');
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).createFilter();
    sheet.getRange('A:Z').setNumberFormat('@');   // plain text, so phone numbers aren't turned into numbers
    sheet.setColumnWidths(1, headers.length, 160);
  }
  return sheet;
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
