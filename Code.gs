/*******************************************************
 * Service Performance Dashboard
 * Google Apps Script API
 *
 * CRUD ใช้ชีต "แผ่น1"
 * ซึ่งเป็นชีตเดียวกับที่ Dashboard อ่าน Published CSV
 *******************************************************/

const SPREADSHEET_ID =
  '1vyb2hIfwCU1AeB8RASRt6HKLiQNQ75lfsPdYMQsIQc4';

const SHEET_NAME = 'แผ่น1';

/*
 * โครงสร้างจริงของชีตแผ่น1
 */
const HEADERS = [
  'ที่',
  'เดือน',
  'OP visit',
  'NCD visit',
  'Non NCD visit',
  'Bed rate',
  'Active bed',
  'Sum AdjRW',
  'CMI',
  'Fixed cost',
  'LC(OT)',
  'ยอดพิจารณาจ่าย IP',
  'อัตราจ่าย/Adj.',
  'หักเงินเดือน',
  'คงเหลือรับ',
  'ผู้รายงาน',
  'วันที่รายงาน'
];

/*
 * โครงสร้างข้อมูลจากฟอร์ม CRUD
 *
 * ไม่มี:
 * - ที่
 * - ผู้รายงาน
 *
 * เนื่องจากระบบจัดการ 2 ช่องนี้เอง
 */
const CRUD_HEADERS = [
  'เดือน',
  'OP visit',
  'NCD visit',
  'Non NCD visit',
  'Bed rate',
  'Active bed',
  'Sum AdjRW',
  'Sum AdjRWที่จ่าย',
  'CMI',
  'Fixed cost',
  'LC(OT)',
  'ยอดพิจารณาจ่าย IP',
  'อัตราจ่าย/Adj.',
  'หักเงินเดือน',
  'คงเหลือรับ',
  'วันที่รายงาน'
];

/*
 * ตำแหน่งคอลัมน์ตัวเลขใน CRUD
 *
 * index:
 * 0 = เดือน
 * 1 = OP visit
 * ...
 * 15 = วันที่รายงาน
 */
const NUMERIC_INDEXES = [
  1, 2, 3, 4, 5, 6, 7, 8,
  9, 10, 11, 12, 13, 14
];


/* =====================================================
   GET
   ===================================================== */

function doGet() {

  return json({
    ok: true,
    service: 'Service Performance Dashboard API',
    sheet: SHEET_NAME,
    status: 'online',
    time: new Date().toISOString()
  });

}


/* =====================================================
   POST
   ===================================================== */

function doPost(e) {

  const lock =
    LockService.getScriptLock();

  try {

    /*
     * ป้องกันการเขียนข้อมูลพร้อมกัน
     */
    lock.waitLock(30000);


    /*
     * รับข้อมูลจาก Dashboard
     *
     * รองรับทั้ง:
     * e.parameter.payload
     *
     * และ
     *
     * e.postData.contents
     */
    let raw = '';

    if (
      e &&
      e.parameter &&
      e.parameter.payload
    ) {

      raw =
        e.parameter.payload;

    } else if (
      e &&
      e.postData &&
      e.postData.contents
    ) {

      raw =
        e.postData.contents;
    }


    if (!raw) {

      throw new Error(
        'ไม่พบข้อมูลที่ส่งมาจาก Dashboard'
      );
    }


    /*
     * แปลง JSON
     */
    let p;

    try {

      p =
        JSON.parse(raw);

    } catch (err) {

      throw new Error(
        'รูปแบบข้อมูลไม่ถูกต้อง: ' +
        err.message
      );
    }


    if (!p.action) {

      throw new Error(
        'ไม่พบ action'
      );
    }


    /*
     * เปิด Spreadsheet
     */
    const ss =
      SpreadsheetApp.openById(
        SPREADSHEET_ID
      );


    /*
     * เปิดชีตแผ่น1
     */
    const sh =
      ss.getSheetByName(
        SHEET_NAME
      );


    if (!sh) {

      throw new Error(
        'ไม่พบชีต "' +
        SHEET_NAME +
        '"'
      );
    }


    /*
     * ตรวจสอบหัวตาราง
     */
    validateHeaders(sh);


    /*
     * แยก action
     */

    if (p.action === 'append') {

      return appendRow(
        sh,
        p.values
      );

    }


    if (p.action === 'update') {

      return updateRow(
        sh,
        p.month,
        p.values
      );

    }


    if (p.action === 'delete') {

      return deleteRow(
        sh,
        p.month
      );

    }


    throw new Error(
      'ไม่รู้จัก action: ' +
      p.action
    );


  } catch (err) {

    return json({

      ok: false,

      error:
        String(
          err &&
          err.message
            ? err.message
            : err
        )

    });


  } finally {

    try {

      lock.releaseLock();

    } catch (e) {}

  }

}


/* =====================================================
   APPEND
   เพิ่มข้อมูลใหม่
   ===================================================== */

function appendRow(
  sh,
  values
) {

  /*
   * ตรวจสอบข้อมูล
   */
  validateValues(values);


  /*
   * เดือนอยู่ช่องแรกของ CRUD
   */
  const month =
    String(
      values[0] || ''
    ).trim();


  if (!month) {

    throw new Error(
      'กรุณาระบุเดือน'
    );
  }


  /*
   * ป้องกันเดือนซ้ำ
   */
  const existingRow =
    findRowByMonth(
      sh,
      month
    );


  if (existingRow) {

    throw new Error(
      'มีข้อมูลเดือน "' +
      month +
      '" อยู่แล้ว'
    );
  }


  /*
   * สร้างเลขที่ใหม่
   */
  const nextNo =
    getNextNo(sh);


  /*
   * สร้างข้อมูล 17 คอลัมน์
   */
  const row =
    buildSheetRow(
      sh,
      values,
      nextNo,
      null
    );


  /*
   * เพิ่มแถวใหม่
   */
  sh.appendRow(row);


  SpreadsheetApp.flush();


  return json({

    ok: true,

    action: 'append',

    row: sh.getLastRow(),

    no: nextNo,

    month: month,

    sheet: SHEET_NAME,

    message:
      'เพิ่มข้อมูลสำเร็จและบันทึกลงชีตแผ่น1แล้ว'

  });

}


/* =====================================================
   UPDATE
   แก้ไขข้อมูล
   ===================================================== */

function updateRow(
  sh,
  oldMonth,
  values
) {

  const targetMonth =
    String(
      oldMonth || ''
    ).trim();


  if (!targetMonth) {

    throw new Error(
      'ไม่พบเดือนที่ต้องการแก้ไข'
    );
  }


  /*
   * ตรวจสอบค่าที่ส่งมา
   */
  validateValues(values);


  /*
   * ค้นหาแถวเดิม
   */
  const rowNumber =
    findRowByMonth(
      sh,
      targetMonth
    );


  if (!rowNumber) {

    throw new Error(
      'ไม่พบข้อมูลเดือน "' +
      targetMonth +
      '"'
    );
  }


  /*
   * เดือนใหม่
   */
  const newMonth =
    String(
      values[0] || ''
    ).trim();


  if (!newMonth) {

    throw new Error(
      'กรุณาระบุเดือน'
    );
  }


  /*
   * ถ้าเปลี่ยนเดือน
   * ต้องตรวจสอบว่าเดือนใหม่ซ้ำหรือไม่
   */
  if (newMonth !== targetMonth) {

    const duplicateRow =
      findRowByMonth(
        sh,
        newMonth
      );


    if (
      duplicateRow &&
      duplicateRow !== rowNumber
    ) {

      throw new Error(
        'มีข้อมูลเดือน "' +
        newMonth +
        '" อยู่แล้ว'
      );
    }
  }


  /*
   * อ่านข้อมูลเดิม
   * เพื่อรักษา:
   *
   * - ที่
   * - ผู้รายงาน
   */
  const oldRow =
    sh.getRange(
      rowNumber,
      1,
      1,
      HEADERS.length
    ).getValues()[0];


  const no =
    oldRow[0];


  const reporter =
    oldRow[15];


  /*
   * สร้างข้อมูลใหม่
   */
  const newRow =
    buildSheetRow(
      sh,
      values,
      no,
      reporter
    );


  /*
   * เขียนกลับ 17 คอลัมน์
   */
  sh.getRange(
    rowNumber,
    1,
    1,
    HEADERS.length
  )
  .setValues([
    newRow
  ]);


  SpreadsheetApp.flush();


  return json({

    ok: true,

    action: 'update',

    row: rowNumber,

    oldMonth:
      targetMonth,

    newMonth:
      newMonth,

    no:
      no,

    sheet:
      SHEET_NAME,

    message:
      'แก้ไขข้อมูลสำเร็จ'

  });

}


/* =====================================================
   DELETE
   ลบข้อมูล
   ===================================================== */

function deleteRow(
  sh,
  month
) {

  const target =
    String(
      month || ''
    ).trim();


  if (!target) {

    throw new Error(
      'ไม่พบเดือนที่ต้องการลบ'
    );
  }


  /*
   * ค้นหาแถว
   */
  const rowNumber =
    findRowByMonth(
      sh,
      target
    );


  if (!rowNumber) {

    throw new Error(
      'ไม่พบข้อมูลเดือน "' +
      target +
      '"'
    );
  }


  /*
   * ลบแถว
   */
  sh.deleteRow(
    rowNumber
  );


  SpreadsheetApp.flush();


  return json({

    ok: true,

    action: 'delete',

    row:
      rowNumber,

    month:
      target,

    sheet:
      SHEET_NAME,

    message:
      'ลบข้อมูลสำเร็จ'

  });

}


/* =====================================================
   สร้างข้อมูล 17 คอลัมน์
   ===================================================== */

function buildSheetRow(
  sh,
  values,
  no,
  reporter
) {

  /*
   * values จาก CRUD มี 16 ช่อง
   *
   * [0] เดือน
   * [1] OP visit
   * [2] NCD visit
   * [3] Non NCD visit
   * [4] Bed rate
   * [5] Active bed
   * [6] Sum AdjRW
   * [7] Sum AdjRWที่จ่าย
   * [8] CMI
   * [9] Fixed cost
   * [10] LC(OT)
   * [11] ยอดพิจารณาจ่าย IP
   * [12] อัตราจ่าย/Adj.
   * [13] หักเงินเดือน
   * [14] คงเหลือรับ
   * [15] วันที่รายงาน
   */


  const row = [];


  /*
   * 1. ที่
   */
  row.push(
    no
  );


  /*
   * 2-15
   *
   * ข้อมูลจาก CRUD
   *
   * แต่ต้องจัดการ
   * Sum AdjRWที่จ่าย
   *
   * เพราะในแผ่น1ไม่มีคอลัมน์นี้
   */

  row.push(
    normalizeText(
      values[0]
    )
  );

  row.push(
    normalizeNumber(
      values[1]
    )
  );

  row.push(
    normalizeNumber(
      values[2]
    )
  );

  row.push(
    normalizeNumber(
      values[3]
    )
  );

  row.push(
    normalizeNumber(
      values[4]
    )
  );

  row.push(
    normalizeNumber(
      values[5]
    )
  );

  row.push(
    normalizeNumber(
      values[6]
    )
  );

  /*
   * CMI
   *
   * CRUD index 8
   */
  row.push(
    normalizeNumber(
      values[8]
    )
  );

  /*
   * Fixed cost
   *
   * CRUD index 9
   */
  row.push(
    normalizeNumber(
      values[9]
    )
  );

  /*
   * LC(OT)
   *
   * CRUD index 10
   */
  row.push(
    normalizeNumber(
      values[10]
    )
  );

  /*
   * ยอดพิจารณาจ่าย IP
   *
   * CRUD index 11
   */
  row.push(
    normalizeNumber(
      values[11]
    )
  );

  /*
   * อัตราจ่าย/Adj.
   *
   * CRUD index 12
   */
  row.push(
    normalizeNumber(
      values[12]
    )
  );

  /*
   * หักเงินเดือน
   *
   * CRUD index 13
   */
  row.push(
    normalizeNumber(
      values[13]
    )
  );

  /*
   * คงเหลือรับ
   *
   * CRUD index 14
   */
  row.push(
    normalizeNumber(
      values[14]
    )
  );

  /*
   * ผู้รายงาน
   *
   * รักษาค่าเดิมถ้ามี
   */
  row.push(
    reporter || ''
  );

  /*
   * วันที่รายงาน
   *
   * CRUD index 15
   */
  row.push(
    normalizeDate(
      values[15]
    )
  );


  /*
   * ต้องได้ 17 คอลัมน์
   */
  if(
    row.length !==
    HEADERS.length
  ){

    throw new Error(
      'จำนวนคอลัมน์ไม่ถูกต้อง: ' +
      row.length +
      ' / ' +
      HEADERS.length
    );
  }


  return row;
}


/* =====================================================
   หาเลขที่ถัดไป
   ===================================================== */

function getNextNo(sh) {

  const lastRow =
    sh.getLastRow();


  /*
   * ถ้ามีแค่หัวตาราง
   */
  if(lastRow < 2){

    return 1;
  }


  /*
   * อ่านคอลัมน์ "ที่"
   */
  const values =
    sh
      .getRange(
        2,
        1,
        lastRow - 1,
        1
      )
      .getValues();


  let maxNo = 0;


  values.forEach(
    row => {

      const n =
        Number(
          String(
            row[0] || ''
          )
          .replace(/,/g,'')
          .trim()
        );


      if(
        Number.isFinite(n) &&
        n > maxNo
      ){

        maxNo = n;
      }

    }
  );


  return maxNo + 1;
}


/* =====================================================
   ค้นหาแถวจากเดือน
   ===================================================== */

function findRowByMonth(
  sh,
  month
) {

  const lastRow =
    sh.getLastRow();


  if(lastRow < 2){

    return null;
  }


  /*
   * เดือนอยู่คอลัมน์ 2
   */
  const values =
    sh
      .getRange(
        2,
        2,
        lastRow - 1,
        1
      )
      .getDisplayValues();


  const target =
    String(
      month || ''
    ).trim();


  for(
    let i=0;
    i<values.length;
    i++
  ){

    const current =
      String(
        values[i][0] || ''
      ).trim();


    if(
      current === target
    ){

      return i + 2;
    }
  }


  return null;
}


/* =====================================================
   ตรวจหัวตาราง
   ===================================================== */

function validateHeaders(sh) {

  const actual =
    sh
      .getRange(
        1,
        1,
        1,
        HEADERS.length
      )
      .getDisplayValues()[0];


  for(
    let i=0;
    i<HEADERS.length;
    i++
  ){

    const expected =
      String(
        HEADERS[i]
      ).trim();


    const current =
      String(
        actual[i] || ''
      ).trim();


    if(
      expected !== current
    ){

      throw new Error(

        'หัวตารางคอลัมน์ ' +
        (i + 1) +

        ' ไม่ตรงกัน: ต้องเป็น "' +
        expected +

        '" แต่พบ "' +
        current +
        '"'

      );
    }
  }
}


/* =====================================================
   ตรวจข้อมูลจาก CRUD
   ===================================================== */

function validateValues(values) {

  if(!Array.isArray(values)){

    throw new Error(
      'รูปแบบข้อมูลไม่ถูกต้อง'
    );
  }


  if(
    values.length !==
    CRUD_HEADERS.length
  ){

    throw new Error(

      'ข้อมูลต้องมี ' +
      CRUD_HEADERS.length +
      ' คอลัมน์ แต่ได้รับ ' +
      values.length

    );
  }


  /*
   * เดือนต้องมี
   */
  if(
    !String(
      values[0] || ''
    ).trim()
  ){

    throw new Error(
      'กรุณาระบุเดือน'
    );
  }


  /*
   * ตรวจตัวเลข
   */
  NUMERIC_INDEXES.forEach(
    function(i){

      const value =
        values[i];


      /*
       * ช่องว่างอนุญาต
       */
      if(
        value === null ||
        value === undefined ||
        String(value).trim() === ''
      ){

        return;
      }


      const cleaned =
        String(value)
          .replace(/,/g,'')
          .trim();


      if(
        Number.isNaN(
          Number(cleaned)
        )
      ){

        throw new Error(

          'คอลัมน์ "' +
          CRUD_HEADERS[i] +
          '" ต้องเป็นตัวเลข'

        );
      }

    }
  );

}


/* =====================================================
   Normalize Number
   ===================================================== */

function normalizeNumber(value) {

  if(
    value === null ||
    value === undefined
  ){

    return '';
  }


  const text =
    String(value)
      .replace(/,/g,'')
      .trim();


  if(text === ''){

    return '';
  }


  const n =
    Number(text);


  if(
    Number.isNaN(n)
  ){

    throw new Error(
      'ค่าตัวเลขไม่ถูกต้อง: ' +
      text
    );
  }


  return n;
}


/* =====================================================
   Normalize Text
   ===================================================== */

function normalizeText(value) {

  if(
    value === null ||
    value === undefined
  ){

    return '';
  }


  return String(
    value
  ).trim();
}


/* =====================================================
   Normalize Date
   ===================================================== */

function normalizeDate(value) {

  /*
   * ถ้าไม่ได้กรอกวันที่
   * ให้ใช้วันที่ปัจจุบัน
   */
  if(
    value === null ||
    value === undefined ||
    String(value).trim() === ''
  ){

    return new Date();
  }


  const text =
    String(value).trim();


  /*
   * ถ้าเป็นวันที่ที่ JavaScript
   * แปลงได้
   */
  const date =
    new Date(text);


  if(
    !Number.isNaN(
      date.getTime()
    )
  ){

    return date;
  }


  /*
   * ถ้าแปลงไม่ได้
   * เก็บเป็นข้อความ
   */
  return text;
}


/* =====================================================
   JSON Response
   ===================================================== */

function json(obj) {

  return ContentService
    .createTextOutput(
      JSON.stringify(obj)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}
