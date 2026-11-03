/**
 * WC 2026 Songs – sign-in backend (Google Apps Script bound to a Google Sheet).
 * One row per phone number. Same phone again = sign-in (password checked), never a duplicate row.
 * Passwords are stored as salted SHA-256 hashes, never as plain text.
 */
const SHEET = 'Users';

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);                       // stops two people creating the same row at once
  try {
    const d = JSON.parse(e.postData.contents);
    const username = String(d.username || '').trim().slice(0, 40);
    const phone = String(d.phone || '').replace(/\D/g, '').slice(-10);
    const location = String(d.location || '').trim().slice(0, 60);
    const pw = String(d.password || '');
    if (username.length < 2 || phone.length < 10 || !location || pw.length < 4) return out({ ok: false, error: 'invalid' });

    const ss = SpreadsheetApp.getActive();
    let sh = ss.getSheetByName(SHEET);
    if (!sh) {
      sh = ss.insertSheet(SHEET);
      sh.appendRow(['Registered at', 'Username', 'Phone', 'Location', 'Password (salted hash)', 'Last login', 'Logins']);
      sh.setFrozenRows(1);
      sh.getRange('C:C').setNumberFormat('@');  // keep phone numbers as text
    }
    const rows = sh.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][2]).replace(/\D/g, '').slice(-10) === phone) {
        const parts = String(rows[i][4]).split(':');
        if (hash(pw, parts[0]) !== parts[1]) return out({ ok: false, error: 'wrong_password' });
        sh.getRange(i + 1, 6).setValue(new Date());
        sh.getRange(i + 1, 7).setValue((Number(rows[i][6]) || 0) + 1);
        return out({ ok: true, username: rows[i][1], created: false });
      }
    }
    const salt = Utilities.getUuid().slice(0, 8);
    sh.appendRow([new Date(), username, phone, location, salt + ':' + hash(pw, salt), new Date(), 1]);
    return out({ ok: true, username: username, created: true });
  } catch (err) {
    return out({ ok: false, error: 'server' });
  } finally {
    lock.releaseLock();
  }
}
function doGet() { return out({ ok: true, service: 'WC 2026 Songs sign-in' }); }
function hash(pw, salt) { return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + pw)); }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
