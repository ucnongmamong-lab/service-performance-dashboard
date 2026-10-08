/* =========================================================
   Service Performance Dashboard API
   Google Sheet: แผ่น1 / gid=0
   IMPORTANT: แผ่น1 มี 17 คอลัมน์จริง โดยไม่มีคอลัมน์ "ที่"
   ลำดับ "ที่" จะแสดงเฉพาะใน Dashboard และสร้างจากลำดับแถว
   ========================================================= */

const SPREADSHEET_ID = '1vyb2hIfwCU1AeB8RASRt6HKLiQNQ75lfsPdYMQsIQc4';
const SHEET_NAME = 'แผ่น1';
const EXPECTED_GID = 0;

// หัวตารางจริงใน Google Sheet แผ่น1 (A:Q)
const SHEET_HEADERS = [
  'เดือน','OP visit','NCD visit','Non NCD visit','Bed rate','Active bed',
  'Sum AdjRW','Sum AdjRWที่จ่าย','CMI','Fixed cost','LC(OT)','ยอดพิจารณาจ่าย IP',
  'อัตราจ่าย/Adj.','หักเงินเดือน','คงเหลือรับ','ผู้รายงาน','วันที่รายงาน'
];

// คอลัมน์ที่ Dashboard แสดง โดยเพิ่ม "ที่" เสมือนขึ้นมา
const DISPLAY_HEADERS = ['ที่', ...SHEET_HEADERS];

const CRUD_HEADERS = [
  'เดือน','OP visit','NCD visit','Non NCD visit','Bed rate','Active bed',
  'Sum AdjRW','Sum AdjRWที่จ่าย','CMI','Fixed cost','LC(OT)',
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
  try {
    const action = String(e?.parameter?.action || 'status').trim().toLowerCase();
    const callback = String(e?.parameter?.callback || '').trim();
    const result = action === 'data' ? getData_() : getStatus_();
    return callback ? jsonp_(callback, result) : json_(result);
  } catch (err) {
    const result = {ok:false, error:errorMessage_(err)};
    const callback = String(e?.parameter?.callback || '').trim();
    return callback ? jsonp_(callback, result) : json_(result);
  }
}

function getStatus_() {
  const sh = getSheet_();
  const lastRow = sh.getLastRow();
  const dataRows = Math.max(0, lastRow - 1);
  const lastMonth = dataRows ? String(sh.getRange(lastRow, 1).getDisplayValue() || '').trim() : '';
  return {
    ok:true,
    service:'Service Performance Dashboard API',
    sheet:SHEET_NAME,
    gid:String(sh.getSheetId()),
    status:'online',
    lastRow:lastRow,
    dataRows:dataRows,
    lastMonth:lastMonth,
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
    values.forEach((row, index) => {
      if (row.every(v => String(v || '').trim() === '')) return;
      const obj = {};
      SHEET_HEADERS.forEach((h, i) => obj[h] = String(row[i] ?? '').trim());
      if (!obj['เดือน']) return;
      obj['ที่'] = String(rows.length + 1);
      rows.push(obj);
    });
  }
  return {
    ok:true,
    service:'Service Performance Dashboard API',
    sheet:SHEET_NAME,
    gid:String(sh.getSheetId()),
    headers:SHEET_HEADERS,
    displayHeaders:DISPLAY_HEADERS,
    rows:rows,
    dataRows:rows.length,
    lastRow:lastRow,
    time:new Date().toISOString()
  };
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    let raw = '';
    if (e?.parameter?.payload) raw = e.parameter.payload;
    else if (e?.postData?.contents) raw = e.postData.contents;
    if (!raw) throw new Error('ไม่พบข้อมูลที่ส่งมาจาก Dashboard');

    let p;
    try { p = JSON.parse(raw); } catch (err) { throw new Error('รูปแบบข้อมูลไม่ถูกต้อง: ' + err.message); }
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
    try { lock.releaseLock(); } catch (e) {}
  }
}

function appendRow_(sh, values) {
  validateValues_(values);
  const month = normalizeText_(values[0]);
  if (findRowByMonth_(sh, month)) throw new Error('มีข้อมูลเดือน "' + month + '" อยู่แล้ว');

  const targetRow = sh.getLastRow() + 1;
  const row = buildSheetRow_(values, '');
  sh.getRange(targetRow, 1, 1, SHEET_HEADERS.length).setValues([row]);
  SpreadsheetApp.flush();

  return {
    ok:true, action:'append', row:targetRow, month:month,
    sheet:SHEET_NAME, gid:String(sh.getSheetId()),
    message:'เพิ่มข้อมูลสำเร็จและบันทึกลงชีตแผ่น1แล้ว'
  };
}

function updateRow_(sh, oldMonth, values) {
  const targetMonth = normalizeText_(oldMonth);
  if (!targetMonth) throw new Error('ไม่พบเดือนที่ต้องการแก้ไข');
  validateValues_(values);

  const rowNumber = findRowByMonth_(sh, targetMonth);
  if (!rowNumber) throw new Error('ไม่พบข้อมูลเดือน "' + targetMonth + '"');

  const newMonth = normalizeText_(values[0]);
  if (!newMonth) throw new Error('กรุณาระบุเดือน');
  if (newMonth !== targetMonth) {
    const duplicate = findRowByMonth_(sh, newMonth);
    if (duplicate && duplicate !== rowNumber) throw new Error('มีข้อมูลเดือน "' + newMonth + '" อยู่แล้ว');
  }

  const oldRow = sh.getRange(rowNumber, 1, 1, SHEET_HEADERS.length).getValues()[0];
  const reporter = oldRow[15];
  const newRow = buildSheetRow_(values, reporter);
  sh.getRange(rowNumber, 1, 1, SHEET_HEADERS.length).setValues([newRow]);
  SpreadsheetApp.flush();

  return {
    ok:true, action:'update', row:rowNumber, oldMonth:targetMonth, newMonth:newMonth,
    sheet:SHEET_NAME, gid:String(sh.getSheetId()), message:'แก้ไขข้อมูลสำเร็จ'
  };
}

function deleteRow_(sh, month) {
  const target = normalizeText_(month);
  if (!target) throw new Error('ไม่พบเดือนที่ต้องการลบ');
  const rowNumber = findRowByMonth_(sh, target);
  if (!rowNumber) throw new Error('ไม่พบข้อมูลเดือน "' + target + '"');
  sh.deleteRow(rowNumber);
  SpreadsheetApp.flush();
  return {
    ok:true, action:'delete', row:rowNumber, month:target,
    sheet:SHEET_NAME, gid:String(sh.getSheetId()), message:'ลบข้อมูลสำเร็จ'
  };
}

function buildSheetRow_(values, reporter) {
  const row = [
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
  if (row.length !== SHEET_HEADERS.length) {
    throw new Error('จำนวนคอลัมน์ไม่ถูกต้อง: ' + row.length + ' / ' + SHEET_HEADERS.length);
  }
  return row;
}

function findRowByMonth_(sh, month) {
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return null;
  const values = sh.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  const target = normalizeText_(month);
  for (let i = 0; i < values.length; i++) {
    if (normalizeText_(values[i][0]) === target) return i + 2;
  }
  return null;
}

function validateHeaders_(sh) {
  const actual = sh.getRange(1, 1, 1, SHEET_HEADERS.length).getDisplayValues()[0];
  for (let i = 0; i < SHEET_HEADERS.length; i++) {
    const expected = normalizeText_(SHEET_HEADERS[i]);
    const current = normalizeText_(actual[i]);
    if (expected !== current) {
      throw new Error('หัวตารางคอลัมน์ ' + (i + 1) + ' ไม่ตรงกัน: ต้องเป็น "' + expected + '" แต่พบ "' + current + '"');
    }
  }
}

function validateValues_(values) {
  if (!Array.isArray(values)) throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');
  if (values.length !== CRUD_HEADERS.length) throw new Error('ข้อมูลต้องมี ' + CRUD_HEADERS.length + ' คอลัมน์ แต่ได้รับ ' + values.length);
  if (!normalizeText_(values[0])) throw new Error('กรุณาระบุเดือน');
  NUMERIC_INDEXES.forEach(i => {
    const value = values[i];
    if (value === null || value === undefined || normalizeText_(value) === '') return;
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
  if (value === null || value === undefined || normalizeText_(value) === '') return new Date();
  const text = normalizeText_(value);
  const m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    let y = Number(m[3]);
    if (y > 2400) y -= 543;
    const d = new Date(y, Number(m[2]) - 1, Number(m[1]));
    if (!Number.isNaN(d.getTime())) return d;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function jsonp_(callback, obj) {
  if (!/^[A-Za-z_$][A-Za-z0-9_$\.]*$/.test(callback)) throw new Error('callback ไม่ถูกต้อง');
  return ContentService.createTextOutput(callback + '(' + JSON.stringify(obj) + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function errorMessage_(err) { return String(err && err.message ? err.message : err); }
