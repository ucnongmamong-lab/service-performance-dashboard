# Service Performance Dashboard

Dashboard สำหรับข้อมูลผลงานบริการและการเงิน โดยใช้ Google Sheet Published CSV เป็นแหล่งข้อมูลหลัก

## ฟังก์ชัน
- 📊 KPI Dashboard
- 📈 กราฟแนวโน้มรายเดือน
- 📅 ปีงบประมาณ ต.ค. – ก.ย.
- 🔎 Search ทุกคอลัมน์
- 📋 ตารางข้อมูลครบ
- 🏆 จัดอันดับผลงานสูงสุด/ต่ำสุด
- ⚠️ รายการที่ควรติดตามจากข้อมูลที่ขาด/ค่าผิดปกติ
- 📱 Responsive สำหรับมือถือ
- 📟 Tablet
- 💻 Desktop
- 🔄 อ่านข้อมูลจาก Published CSV โดยตรง
- ✏️ CRUD ผ่าน Google Apps Script API
- 📈 วิเคราะห์เปรียบเทียบรายปีงบประมาณ

## ปีงบประมาณ
ระบบคำนวณดังนี้:
- ต.ค. 2568 → ปีงบประมาณ 2569
- พ.ย. 2568 → ปีงบประมาณ 2569
- ธ.ค. 2568 → ปีงบประมาณ 2569
- ม.ค. 2569 – ก.ย. 2569 → ปีงบประมาณ 2569

ลำดับเดือน:
ต.ค. → พ.ย. → ธ.ค. → ม.ค. → ก.พ. → มี.ค. → เม.ย. → พ.ค. → มิ.ย. → ก.ค. → ส.ค. → ก.ย.

## ไฟล์
- index.html
- styles.css
- app.js
- Code.gs

## CRUD
`app.js` ตั้งค่า Apps Script Web App URL ที่ deploy ไว้แล้ว
และ `Code.gs` ใช้ชีต `กรอกข้อมูล`

### Deploy Apps Script
1. เปิด Apps Script
2. วาง Code.gs
3. Save
4. Deploy → Manage deployments
5. Edit Web app
6. Execute as: Me
7. ตั้งสิทธิ์ตามนโยบายของหน่วยงาน
8. Deploy
9. หากมีการแก้ Code.gs ให้ Deploy เวอร์ชันใหม่

### GitHub Pages
อัปโหลด 3 ไฟล์:
- index.html
- styles.css
- app.js

จากนั้นเปิด GitHub Pages

## หมายเหตุ
Published CSV ใช้สำหรับอ่านข้อมูล
CRUD ใช้ Apps Script Web App แยกต่างหาก

ก่อนใช้งานจริงกับข้อมูลอ่อนไหว ควรเพิ่ม authentication/authorization และกำหนดสิทธิ์การเขียนข้อมูลให้เหมาะสม
