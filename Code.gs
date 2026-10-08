/* =========================================================
 Service Performance Dashboard - CRUD API
 Google Sheet: แผ่น1 / gid=0
 REAL sheet layout A:R:
 A ที่
 B เดือน
 C OP visit
 D NCD visit
 E Non NCD visit
 F Bed rate
 G Active bed
 H Sum AdjRW
 I CMI
 J Sum AdjRWที่จ่าย
 K Fixed cost
 L LC(OT)
 M ยอดพิจารณาจ่าย IP
 N อัตราจ่าย/Adj.
 O หักเงินเดือน
 P คงเหลือรับ
 Q ผู้รายงาน
 R วันที่รายงาน
 ========================================================= */

const SPREADSHEET_ID = '1vyb2hIfwCU1AeB8RASRt6HKLiQNQ75lfsPdYMQsIQc4';
const SHEET_NAME = 'แผ่น1';
const EXPECTED_GID = 0;

const SHEET_HEADERS = [
  'ที่','เดือน','OP visit','NCD visit','Non NCD visit','Bed rate','Active bed',
  'Sum AdjRW','CMI','Sum AdjRWที่จ่าย','Fixed cost','LC(OT)',
  'ยอดพิจารณาจ่าย IP','อัตราจ่าย/Adj.','หักเงินเดือน','คงเหลือรับ','ผู้รายงาน','วันที่รายงาน'
];

// Values sent by Dashboard exclude the automatic "ที่" column.
const CRUD_HEADERS = [
  'เดือน','OP visit','NCD visit','Non NCD visit','Bed rate','Active bed',
  'Sum AdjRW','CMI','Sum AdjRWที่จ่าย','Fixed cost','LC(OT)',
  'ยอดพิจารณาจ่าย IP','อัตราจ่าย/Adj.','หักเงินเดือน','คงเหลือรับ','วันที่รายงาน'
];

const NUMERIC_INDEXES = [1,2,3,4,5,6,7,8,9,10,11,12,13,14];

function getSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('ไม่พบชีต "' + SHEET_NAME + '"');
  if (Number(sh.getSheetId()) !== EXPECTED_GID) {
    throw new Error('ชีต "' + SHEET_NAME + '" มี gid=' + sh.getSheetId() + ' แต่ระบบคาดว่า gid=0');
  }
  validateHeaders_(sh);
  return sh;
}

function doGet(e) {
  const callback = String((e && e.parameter && e.parameter.callback) || '').trim();
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'status').trim().toLowerCase();
    let result;
    if (action === 'data') {
      result = getData_();
    } else if (action === 'ping') {
      result = {
        ok:true,
        service:'Service Performance Dashboard API',
        sheet:SHEET_NAME,
        gid:String(EXPECTED_GID),
        status:'online',
        time:new Date().toISOString()
      };
    } else {
      result = getStatus_();
    }
    return callback ? jsonp_(callback, result) : json_(result);
  } catch (err) {
    const result = {ok:false, error:errorMessage_(err), time:new Date().toISOString()};
    return callback ? jsonp_(callback, result) : json_(result);
  }
}

function getStatus_() {
  const sh = getSheet_();
  const lastRow = sh.getLastRow();
  const dataRows = Math.max(0, lastRow - 1);
  const lastMonth = dataRows ? String(sh.getRange(lastRow, 2).getDisplayValue() || '').trim() : '';
  return {
    ok:true,
    service:'Service Performance Dashboard API',
    sheet:SHEET_NAME,
    gid:String(sh.getSheetId()),
    status:'online',
    lastRow,
    dataRows,
    lastMonth,
    headers:SHEET_HEADERS,
    time:new Date().toISOString()
  };
}

function getData_() {
  const sh = getSheet_();
  const lastRow = sh.getLastRow();
  const rows = [];
  if (lastRow >= 2) {
    const values = sh.getRange(2, 1, lastRow - 1, SHEET_HEADERS.length).getDisplayValues();
    values.forEach((row) => {
      if (row.every(v => String(v || '').trim() === '')) return;
      const obj = {};
      SHEET_HEADERS.forEach((h, i) => obj[h] = String(row[i] == null ? '' : row[i]).trim());
      if (obj['เดือน']) rows.push(obj);
    });
  }
  return {
    ok:true,
    service:'Service Performance Dashboard API',
    sheet:SHEET_NAME,
    gid:String(sh.getSheetId()),
    headers:SHEET_HEADERS,
    rows,
    dataRows:rows.length,
    lastRow,
    time:new Date().toISOString()
  };
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    let raw = '';
    if (e && e.parameter && e.parameter.payload) raw = e.parameter.payload;
    else if (e && e.postData && e.postData.contents) raw = e.postData.contents;
    if (!raw) throw new Error('ไม่พบข้อมูลที่ส่งมาจาก Dashboard');

    let p;
    try { p = JSON.parse(raw); }
    catch (err) { throw new Error('รูปแบบข้อมูลไม่ถูกต้อง: ' + err.message); }
    if (!p.action) throw new Error('ไม่พบ action');

    const sh = getSheet_();
    let result;
    if (p.action === 'append') result = appendRow_(sh, p.values);
    else if (p.action === 'update') result = updateRow_(sh, p.month, p.values);
    else if (p.action === 'delete') result = deleteRow_(sh, p.month);
    else throw new Error('ไม่รู้จัก action: ' + p.action);

    return json_(result);
  } catch (err) {
    return json_({ok:false, error:errorMessage_(err)});
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function appendRow_(sh, values) {
  validateValues_(values);
  const month = String(values[0] || '').trim();
  if (findRowByMonth_(sh, month)) throw new Error('มีข้อมูลเดือน "' + month + '" อยู่แล้ว');

  const targetRow = Math.max(2, sh.getLastRow() + 1);
  const number = nextNumber_(sh);
  const reporter = Session.getActiveUser().getEmail() || '';
  const row = buildSheetRow_(number, values, reporter);
  sh.getRange(targetRow, 1, 1, SHEET_HEADERS.length).setValues([row]);
  SpreadsheetApp.flush();
  verifyRow_(sh, targetRow, month);

  return {ok:true, action:'append', row:targetRow, number, month, sheet:SHEET_NAME, gid:String(sh.getSheetId()), message:'เพิ่มข้อมูลสำเร็จ'};
}

function updateRow_(sh, oldMonth, values) {
  const targetMonth = String(oldMonth || '').trim();
  if (!targetMonth) throw new Error('ไม่พบเดือนที่ต้องการแก้ไข');
  validateValues_(values);

  const rowNumber = findRowByMonth_(sh, targetMonth);
  if (!rowNumber) throw new Error('ไม่พบข้อมูลเดือน "' + targetMonth + '"');

  const newMonth = String(values[0] || '').trim();
  if (!newMonth) throw new Error('กรุณาระบุเดือน');
  if (newMonth !== targetMonth) {
    const duplicate = findRowByMonth_(sh, newMonth);
    if (duplicate && duplicate !== rowNumber) throw new Error('มีข้อมูลเดือน "' + newMonth + '" อยู่แล้ว');
  }

  // Preserve A=ที่ and Q=ผู้รายงาน from the existing row.
  const oldRow = sh.getRange(rowNumber, 1, 1, SHEET_HEADERS.length).getValues()[0];
  const number = oldRow[0] || rowNumber - 1;
  const reporter = oldRow[16] || Session.getActiveUser().getEmail() || '';
  const newRow = buildSheetRow_(number, values, reporter);
  sh.getRange(rowNumber, 1, 1, SHEET_HEADERS.length).setValues([newRow]);
  SpreadsheetApp.flush();
  verifyRow_(sh, rowNumber, newMonth);

  return {ok:true, action:'update', row:rowNumber, number, oldMonth:targetMonth, newMonth, sheet:SHEET_NAME, gid:String(sh.getSheetId()), message:'แก้ไขข้อมูลสำเร็จ'};
}

function deleteRow_(sh, month) {
  const target = String(month || '').trim();
  if (!target) throw new Error('ไม่พบเดือนที่ต้องการลบ');
  const rowNumber = findRowByMonth_(sh, target);
  if (!rowNumber) throw new Error('ไม่พบข้อมูลเดือน "' + target + '"');
  sh.deleteRow(rowNumber);
  SpreadsheetApp.flush();

  const stillExists = findRowByMonth_(sh, target);
  if (stillExists) throw new Error('ลบแล้วแต่ยังพบข้อมูลเดือน "' + target + '"');
  return {ok:true, action:'delete', row:rowNumber, month:target, sheet:SHEET_NAME, gid:String(sh.getSheetId()), message:'ลบข้อมูลสำเร็จ'};
}

// CRUD 16 values -> actual B:R, while A is automatic "ที่".
// B month, C OP, D NCD, E NonNCD, F Bed, G Active,
// H SumAdjRW, I CMI, J SumAdjRWที่จ่าย, K Fixed, L LCOT,
// M IP, N rate, O salary, P remaining, Q reporter, R report date.
function buildSheetRow_(number, values, reporter) {
  return [
    number,
    normalizeText_(values[0]),
    normalizeNumber_(values[1]),
    normalizeNumber_(values[2]),
    normalizeNumber_(values[3]),
    normalizeNumber_(values[4]),
    normalizeNumber_(values[5]),
    normalizeNumber_(values[6]),
    normalizeNumber_(values[7]),
    normalizeNumber_(values[8]),
    normalizeNumber_(values[9]),
    normalizeNumber_(values[10]),
    normalizeNumber_(values[11]),
    normalizeNumber_(values[12]),
    normalizeNumber_(values[13]),
    normalizeNumber_(values[14]),
    reporter || '',
    normalizeDate_(values[15])
  ];
}

function nextNumber_(sh) {
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return 1;
  const vals = sh.getRange(2, 1, lastRow - 1, 1).getValues();
  let max = 0;
  vals.forEach(r => {
    const n = Number(r[0]);
    if (Number.isFinite(n) && n > max) max = n;
  });
  return max + 1;
}

function findRowByMonth_(sh, month) {
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return null;
  const values = sh.getRange(2, 2, lastRow - 1, 1).getDisplayValues(); // B = เดือน
  const target = String(month || '').trim();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === target) return i + 2;
  }
  return null;
}

function verifyRow_(sh, rowNumber, expectedMonth) {
  const check = sh.getRange(rowNumber, 1, 1, SHEET_HEADERS.length).getDisplayValues()[0];
  if (String(check[1] || '').trim() !== expectedMonth) {
    throw new Error('บันทึกแล้วแต่ตรวจสอบคอลัมน์ B (เดือน) ไม่ตรงกัน');
  }
}

function validateHeaders_(sh) {
  const actual = sh.getRange(1, 1, 1, SHEET_HEADERS.length).getDisplayValues()[0];
  for (let i = 0; i < SHEET_HEADERS.length; i++) {
    const expected = String(SHEET_HEADERS[i]).trim();
    const current = String(actual[i] || '').trim();
    if (expected !== current) {
      throw new Error('หัวตารางคอลัมน์ ' + (i + 1) + ' ไม่ตรงกัน: ต้องเป็น "' + expected + '" แต่พบ "' + current + '"');
    }
  }
}

function validateValues_(values) {
  if (!Array.isArray(values)) throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');
  if (values.length !== CRUD_HEADERS.length) throw new Error('ข้อมูลต้องมี ' + CRUD_HEADERS.length + ' คอลัมน์ แต่ได้รับ ' + values.length);
  if (!String(values[0] || '').trim()) throw new Error('กรุณาระบุเดือน');
  NUMERIC_INDEXES.forEach(i => {
    const value = values[i];
    if (value === null || value === undefined || String(value).trim() === '') return;
    if (Number.isNaN(Number(String(value).replace(/,/g, '').trim()))) {
      throw new Error('คอลัมน์ "' + CRUD_HEADERS[i] + '" ต้องเป็นตัวเลข');
    }
  });
}

function normalizeNumber_(value) {
  if (value === null || value === undefined) return '';
  const text = String(value).replace(/,/g, '').trim();
  if (text === '') return '';
  const n = Number(text);
  if (Number.isNaN(n)) throw new Error('ค่าตัวเลขไม่ถูกต้อง: ' + text);
  return n;
}
function normalizeText_(value) { return value === null || value === undefined ? '' : String(value).trim(); }
function normalizeDate_(value) {
  if (value === null || value === undefined || String(value).trim() === '') return new Date();
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) return value;
  const text = String(value).trim();
  const m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    let y = Number(m[3]); if (y > 2400) y -= 543;
    const d = new Date(y, Number(m[2]) - 1, Number(m[1]));
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date(text);
  if (!Number.isNaN(d.getTime())) return d;
  throw new Error('วันที่รายงานไม่ถูกต้อง: ' + text);
}
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function jsonp_(callback,obj) {
  if (!/^[A-Za-z_$][A-Za-z0-9_$\.]*$/.test(callback)) throw new Error('callback ไม่ถูกต้อง');
  // Escape characters that could terminate a script context when values came
  // from a spreadsheet cell. This keeps the JSONP response valid JavaScript.
  const safe = JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  return ContentService.createTextOutput(callback+'('+safe+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}
function errorMessage_(err) { return String(err && err.message ? err.message : err); }
