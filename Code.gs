/* =========================================================
   Service Performance Dashboard
   Code.gs - FINAL
   CRUD ใช้ Google Sheet: แผ่น1 (gid=0)
   ========================================================= */

const SPREADSHEET_ID =
  '1vyb2hIfwCU1AeB8RASRt6HKLiQNQ75lfsPdYMQsIQc4';

const SHEET_NAME = 'แผ่น1';

const HEADERS = [
  'ที่','เดือน','OP visit','NCD visit','Non NCD visit','Bed rate','Active bed',
  'Sum AdjRW','Sum AdjRWที่จ่าย','CMI','Fixed cost','LC(OT)','ยอดพิจารณาจ่าย IP',
  'อัตราจ่าย/Adj.','หักเงินเดือน','คงเหลือรับ','ผู้รายงาน','วันที่รายงาน'
];

const CRUD_HEADERS = [
  'เดือน','OP visit','NCD visit','Non NCD visit','Bed rate','Active bed',
  'Sum AdjRW','Sum AdjRWที่จ่าย','CMI','Fixed cost','LC(OT)',
  'ยอดพิจารณาจ่าย IP','อัตราจ่าย/Adj.','หักเงินเดือน','คงเหลือรับ','วันที่รายงาน'
];

const NUMERIC_INDEXES = [1,2,3,4,5,6,7,8,9,10,11,12,13,14];

/* ---------- GET ---------- */

function doGet() {
  return json({
    ok:true,
    service:'Service Performance Dashboard API',
    sheet:SHEET_NAME,
    gid:'0',
    status:'online',
    time:new Date().toISOString()
  });
}

/* ---------- POST ---------- */

function doPost(e) {
  const lock=LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    let raw='';
    if(e && e.parameter && e.parameter.payload) {
      raw=e.parameter.payload;
    } else if(e && e.postData && e.postData.contents) {
      raw=e.postData.contents;
    }

    if(!raw) throw new Error('ไม่พบข้อมูลที่ส่งมาจาก Dashboard');

    let p;
    try {
      p=JSON.parse(raw);
    } catch(err) {
      throw new Error('รูปแบบข้อมูลไม่ถูกต้อง: '+err.message);
    }

    if(!p.action) throw new Error('ไม่พบ action');

    const ss=SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh=ss.getSheetByName(SHEET_NAME);

    if(!sh) throw new Error('ไม่พบชีต "'+SHEET_NAME+'"');

    validateHeaders(sh);

    if(p.action==='append') return appendRow(sh,p.values);
    if(p.action==='update') return updateRow(sh,p.month,p.values);
    if(p.action==='delete') return deleteRow(sh,p.month);

    throw new Error('ไม่รู้จัก action: '+p.action);

  } catch(err) {
    return json({
      ok:false,
      error:String(err && err.message ? err.message : err)
    });
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

/* ---------- APPEND ---------- */

function appendRow(sh,values) {
  validateValues(values);

  const month=String(values[0]||'').trim();
  if(!month) throw new Error('กรุณาระบุเดือน');

  if(findRowByMonth(sh,month)) {
    throw new Error('มีข้อมูลเดือน "'+month+'" อยู่แล้ว');
  }

  const nextNo=getNextNo(sh);
  const row=buildSheetRow(values,nextNo,'');

  sh.getRange(sh.getLastRow()+1,1,1,HEADERS.length).setValues([row]);
  SpreadsheetApp.flush();

  return json({
    ok:true,
    action:'append',
    row:sh.getLastRow(),
    no:nextNo,
    month:month,
    sheet:SHEET_NAME,
    gid:'0',
    message:'เพิ่มข้อมูลสำเร็จและบันทึกลงชีตแผ่น1แล้ว'
  });
}

/* ---------- UPDATE ---------- */

function updateRow(sh,oldMonth,values) {
  const targetMonth=String(oldMonth||'').trim();
  if(!targetMonth) throw new Error('ไม่พบเดือนที่ต้องการแก้ไข');

  validateValues(values);

  const rowNumber=findRowByMonth(sh,targetMonth);
  if(!rowNumber) throw new Error('ไม่พบข้อมูลเดือน "'+targetMonth+'"');

  const newMonth=String(values[0]||'').trim();
  if(!newMonth) throw new Error('กรุณาระบุเดือน');

  if(newMonth!==targetMonth) {
    const duplicate=findRowByMonth(sh,newMonth);
    if(duplicate && duplicate!==rowNumber) {
      throw new Error('มีข้อมูลเดือน "'+newMonth+'" อยู่แล้ว');
    }
  }

  const oldRow=sh.getRange(rowNumber,1,1,HEADERS.length).getValues()[0];
  const no=oldRow[0];
  const reporter=oldRow[15];

  const newRow=buildSheetRow(values,no,reporter);

  sh.getRange(rowNumber,1,1,HEADERS.length).setValues([newRow]);
  SpreadsheetApp.flush();

  return json({
    ok:true,
    action:'update',
    row:rowNumber,
    oldMonth:targetMonth,
    newMonth:newMonth,
    no:no,
    sheet:SHEET_NAME,
    gid:'0',
    message:'แก้ไขข้อมูลสำเร็จ'
  });
}

/* ---------- DELETE ---------- */

function deleteRow(sh,month) {
  const target=String(month||'').trim();
  if(!target) throw new Error('ไม่พบเดือนที่ต้องการลบ');

  const rowNumber=findRowByMonth(sh,target);
  if(!rowNumber) throw new Error('ไม่พบข้อมูลเดือน "'+target+'"');

  sh.deleteRow(rowNumber);
  SpreadsheetApp.flush();

  return json({
    ok:true,
    action:'delete',
    row:rowNumber,
    month:target,
    sheet:SHEET_NAME,
    gid:'0',
    message:'ลบข้อมูลสำเร็จ'
  });
}

/* ---------- BUILD 18 COLUMNS ---------- */

function buildSheetRow(values,no,reporter) {
  /*
   * CRUD 16 ช่อง:
   * 0 เดือน
   * 1 OP visit
   * 2 NCD visit
   * 3 Non NCD visit
   * 4 Bed rate
   * 5 Active bed
   * 6 Sum AdjRW
   * 7 Sum AdjRWที่จ่าย
   * 8 CMI
   * 9 Fixed cost
   * 10 LC(OT)
   * 11 ยอดพิจารณาจ่าย IP
   * 12 อัตราจ่าย/Adj.
   * 13 หักเงินเดือน
   * 14 คงเหลือรับ
   * 15 วันที่รายงาน
   */

  const row=[
    no,
    normalizeText(values[0]),
    normalizeNumber(values[1]),
    normalizeNumber(values[2]),
    normalizeNumber(values[3]),
    normalizeNumber(values[4]),
    normalizeNumber(values[5]),
    normalizeNumber(values[6]),
    normalizeNumber(values[7]),
    normalizeNumber(values[8]),
    normalizeNumber(values[9]),
    normalizeNumber(values[10]),
    normalizeNumber(values[11]),
    normalizeNumber(values[12]),
    normalizeNumber(values[13]),
    normalizeNumber(values[14]),
    reporter || '',
    normalizeDate(values[15])
  ];

  if(row.length!==HEADERS.length) {
    throw new Error('จำนวนคอลัมน์ไม่ถูกต้อง: '+row.length+' / '+HEADERS.length);
  }

  return row;
}

/* ---------- NUMBER ---------- */

function getNextNo(sh) {
  const lastRow=sh.getLastRow();
  if(lastRow<2) return 1;

  const values=sh.getRange(2,1,lastRow-1,1).getValues();
  let maxNo=0;

  values.forEach(r=>{
    const n=Number(String(r[0]||'').replace(/,/g,'').trim());
    if(Number.isFinite(n) && n>maxNo) maxNo=n;
  });

  return maxNo+1;
}

/* ---------- FIND BY MONTH ---------- */

function findRowByMonth(sh,month) {
  const lastRow=sh.getLastRow();
  if(lastRow<2) return null;

  const values=sh.getRange(2,2,lastRow-1,1).getDisplayValues();
  const target=String(month||'').trim();

  for(let i=0;i<values.length;i++) {
    if(String(values[i][0]||'').trim()===target) return i+2;
  }

  return null;
}

/* ---------- VALIDATE HEADERS ---------- */

function validateHeaders(sh) {
  const actual=sh.getRange(1,1,1,HEADERS.length).getDisplayValues()[0];

  for(let i=0;i<HEADERS.length;i++) {
    const expected=String(HEADERS[i]).trim();
    const current=String(actual[i]||'').trim();

    if(expected!==current) {
      throw new Error(
        'หัวตารางคอลัมน์ '+(i+1)+
        ' ไม่ตรงกัน: ต้องเป็น "'+expected+
        '" แต่พบ "'+current+'"'
      );
    }
  }
}

/* ---------- VALIDATE VALUES ---------- */

function validateValues(values) {
  if(!Array.isArray(values)) throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');

  if(values.length!==CRUD_HEADERS.length) {
    throw new Error(
      'ข้อมูลต้องมี '+CRUD_HEADERS.length+
      ' คอลัมน์ แต่ได้รับ '+values.length
    );
  }

  if(!String(values[0]||'').trim()) {
    throw new Error('กรุณาระบุเดือน');
  }

  NUMERIC_INDEXES.forEach(i=>{
    const value=values[i];
    if(value===null || value===undefined || String(value).trim()==='') return;

    const cleaned=String(value).replace(/,/g,'').trim();
    if(Number.isNaN(Number(cleaned))) {
      throw new Error('คอลัมน์ "'+CRUD_HEADERS[i]+'" ต้องเป็นตัวเลข');
    }
  });
}

/* ---------- NORMALIZE ---------- */

function normalizeNumber(value) {
  if(value===null || value===undefined) return '';
  const text=String(value).replace(/,/g,'').trim();
  if(text==='') return '';

  const n=Number(text);
  if(Number.isNaN(n)) throw new Error('ค่าตัวเลขไม่ถูกต้อง: '+text);

  return n;
}

function normalizeText(value) {
  return value===null || value===undefined ? '' : String(value).trim();
}

function normalizeDate(value) {
  if(value===null || value===undefined || String(value).trim()==='') {
    return new Date();
  }

  const text=String(value).trim();

  /*
   * รองรับ:
   * 15/11/2567
   * 15/11/2026
   * 2026-11-15
   */
  let m=text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if(m) {
    let y=Number(m[3]);
    if(y>2400) y-=543;

    const d=new Date(y,Number(m[2])-1,Number(m[1]));
    if(!Number.isNaN(d.getTime())) return d;
  }

  const date=new Date(text);
  return Number.isNaN(date.getTime()) ? text : date;
}

/* ---------- JSON ---------- */

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
