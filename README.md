# Service Performance Dashboard

เว็บแอป Dashboard สำหรับข้อมูลผลงานบริการ/การเงินจาก Google Sheet

## ฟังก์ชัน
- ดึงข้อมูลจาก Published CSV ของ Google Sheet
- แสดงข้อมูลครบ 17 คอลัมน์ของแผ่นงาน `แผ่น1`
- ตัวกรอง ปี / เดือน / ค้นหาทุกคอลัมน์ / ตัวชี้วัด
- KPI: OP visit, NCD visit, Non NCD visit, คงเหลือรับ, Bed rate, CMI
- กราฟแนวโน้มและสัดส่วน OP/NCD/Non NCD
- วิเคราะห์เปรียบเทียบรายปีและ % เปลี่ยนแปลงจากเดือน/ปีก่อน
- ตารางข้อมูลทั้งหมดพร้อมแก้ไข/ลบ และเพิ่มข้อมูลผ่าน Apps Script Web App
- รองรับมือถือ

## การติดตั้ง
1. เปิด `index.html` ผ่านเว็บเซิร์ฟเวอร์ เช่น GitHub Pages, Netlify หรือ Vercel
2. หากต้องการ CRUD ให้เปิด Google Apps Script ของไฟล์ Google Sheet เดียวกัน แล้วใส่ `Code.gs`
3. Deploy > New deployment > Web app
4. ตั้ง Execute as: Me และกำหนด Who has access ตามนโยบายของหน่วยงาน
5. คัดลอก Web App URL ไปใส่ใน `app.js` ตัวแปร `API_URL`
6. อัปโหลด/Deploy ไฟล์หน้าเว็บใหม่

## หมายเหตุด้านความปลอดภัย
- Published CSV เหมาะสำหรับอ่านข้อมูลแบบสาธารณะ/อ่านอย่างเดียว
- CRUD ควรใช้ Apps Script Web App และกำหนดสิทธิ์การเข้าถึงให้เหมาะสม
- ก่อนใช้จริงควรเพิ่ม authentication/authorization หากข้อมูลเป็นข้อมูลผู้ป่วยหรือข้อมูลอ่อนไหว
- เวอร์ชันนี้ใช้เลขแถวสำหรับ update/delete จึงควรป้องกันการแก้ไขพร้อมกันหลายคน หากนำไปใช้เป็นระบบ production
