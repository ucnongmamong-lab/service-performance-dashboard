/*******************************************************
 * Service Performance Dashboard - Google Apps Script API
 * Sheet สำหรับ CRUD: "กรอกข้อมูล"
 *******************************************************/

const SPREADSHEET_ID='1vyb2hIfwCU1AeB8RASRt6HKLiQNQ75lfsPdYMQsIQc4';
const SHEET_NAME='กรอกข้อมูล';

const HEADERS=[
  'เดือน','OP visit','NCD visit','Non NCD visit','Bed rate','Active bed',
  'Sum AdjRW','Sum AdjRWที่จ่าย','CMI','Fixed cost','LC(OT)',
  'ยอดพิจารณาจ่าย IP','อัตราจ่าย/Adj.','หักเงินเดือน','คงเหลือรับ','วันที่รายงาน'
];

const NUMERIC_INDEXES=[1,2,3,4,5,6,7,8,9,10,11,12,13,14];

function doGet(){
  return json({
    ok:true,
    service:'Service Performance Dashboard API',
    sheet:SHEET_NAME,
    status:'online',
    time:new Date().toISOString()
  });
}

function doPost(e){
  const lock=LockService.getScriptLock();

  try{
    lock.waitLock(30000);

    let raw='';
    if(e && e.parameter && e.parameter.payload){
      raw=e.parameter.payload;
    }else if(e && e.postData && e.postData.contents){
      raw=e.postData.contents;
    }

    if(!raw)throw new Error('ไม่พบข้อมูลที่ส่งมาจาก Dashboard');

    let p;
    try{p=JSON.parse(raw)}
    catch(err){throw new Error('รูปแบบข้อมูลไม่ถูกต้อง: '+err.message)}

    if(!p.action)throw new Error('ไม่พบ action');

    const sh=SpreadsheetApp
      .openById(SPREADSHEET_ID)
      .getSheetByName(SHEET_NAME);

    if(!sh)throw new Error('ไม่พบชีต '+SHEET_NAME);

    validateHeaders(sh);

    if(p.action==='append')return appendRow(sh,p.values);
    if(p.action==='update')return updateRow(sh,p.month,p.values);
    if(p.action==='delete')return deleteRow(sh,p.month);

    throw new Error('ไม่รู้จัก action: '+p.action);

  }catch(err){
    return json({
      ok:false,
      error:String(err && err.message ? err.message : err)
    });
  }finally{
    try{lock.releaseLock()}catch(e){}
  }
}

function appendRow(sh,values){
  validateValues(values);

  const month=String(values[0]||'').trim();

  if(findRowByMonth(sh,month)){
    throw new Error('มีข้อมูลเดือน "'+month+'" อยู่แล้ว');
  }

  sh.appendRow(normalizeValues(values));
  SpreadsheetApp.flush();

  return json({
    ok:true,
    action:'append',
    month:month,
    message:'เพิ่มข้อมูลสำเร็จ'
  });
}

function updateRow(sh,month,values){
  const oldMonth=String(month||'').trim();

  if(!oldMonth)throw new Error('ไม่พบเดือนที่ต้องการแก้ไข');

  validateValues(values);

  const row=findRowByMonth(sh,oldMonth);
  if(!row)throw new Error('ไม่พบข้อมูลเดือน "'+oldMonth+'"');

  const newMonth=String(values[0]||'').trim();

  if(newMonth!==oldMonth){
    const duplicate=findRowByMonth(sh,newMonth);
    if(duplicate && duplicate!==row){
      throw new Error('มีข้อมูลเดือน "'+newMonth+'" อยู่แล้ว');
    }
  }

  sh.getRange(row,1,1,HEADERS.length)
    .setValues([normalizeValues(values)]);

  SpreadsheetApp.flush();

  return json({
    ok:true,
    action:'update',
    oldMonth:oldMonth,
    newMonth:newMonth,
    row:row,
    message:'แก้ไขข้อมูลสำเร็จ'
  });
}

function deleteRow(sh,month){
  const target=String(month||'').trim();

  if(!target)throw new Error('ไม่พบเดือนที่ต้องการลบ');

  const row=findRowByMonth(sh,target);
  if(!row)throw new Error('ไม่พบข้อมูลเดือน "'+target+'"');

  sh.deleteRow(row);
  SpreadsheetApp.flush();

  return json({
    ok:true,
    action:'delete',
    month:target,
    row:row,
    message:'ลบข้อมูลสำเร็จ'
  });
}

function findRowByMonth(sh,month){
  const last=sh.getLastRow();
  if(last<2)return null;

  const values=sh.getRange(2,1,last-1,1).getDisplayValues();
  const target=String(month||'').trim();

  for(let i=0;i<values.length;i++){
    if(String(values[i][0]||'').trim()===target)return i+2;
  }

  return null;
}

function validateHeaders(sh){
  const actual=sh.getRange(1,1,1,HEADERS.length).getDisplayValues()[0];

  for(let i=0;i<HEADERS.length;i++){
    const expected=String(HEADERS[i]).trim();
    const current=String(actual[i]||'').trim();

    if(expected!==current){
      throw new Error(
        'หัวตารางคอลัมน์ '+(i+1)+
        ' ไม่ตรงกัน: ต้องเป็น "'+expected+
        '" แต่พบ "'+current+'"'
      );
    }
  }
}

function validateValues(values){
  if(!Array.isArray(values))
    throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');

  if(values.length!==HEADERS.length)
    throw new Error(
      'ข้อมูลต้องมี '+HEADERS.length+
      ' คอลัมน์ แต่ได้รับ '+values.length
    );

  if(!String(values[0]||'').trim())
    throw new Error('กรุณาระบุเดือน');

  NUMERIC_INDEXES.forEach(function(i){
    const value=values[i];

    if(value===null||value===undefined||String(value).trim()==='')return;

    const cleaned=String(value).replace(/,/g,'').trim();

    if(Number.isNaN(Number(cleaned))){
      throw new Error(
        'คอลัมน์ "'+HEADERS[i]+'" ต้องเป็นตัวเลข'
      );
    }
  });
}

function normalizeValues(values){
  return values.map(function(value,index){
    if(value===null||value===undefined)return '';

    if(NUMERIC_INDEXES.indexOf(index)!==-1){
      const text=String(value).replace(/,/g,'').trim();
      if(text==='')return '';

      const n=Number(text);
      if(!Number.isNaN(n))return n;
    }

    return String(value).trim();
  });
}

function json(obj){
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
