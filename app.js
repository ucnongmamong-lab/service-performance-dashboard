/* =========================================================
   Service Performance Dashboard
   app.js - FINAL
   Data source: Google Sheet Published CSV (gid=0 / แผ่น1)
   CRUD API: Google Apps Script
   ========================================================= */

const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQAFcBJvDUqxyx0xJmsqoGjG1XCbX8zNUory4qCmndR0gjxQSwQhtGN8OFk9uB8Co2VkD9AdsyOHFKX/pub?gid=0&single=true&output=csv';

const API_URL =
  'https://script.google.com/macros/s/AKfycbzBGl_rPjtlGPOOcvPbhGMIWhxUJG0QKTu9HhCNaGbkwfIovEOW31sdsSI5gbPt7-BP-w/exec';

const cols = [
  'ที่','เดือน','OP visit','NCD visit','Non NCD visit','Bed rate','Active bed',
  'Sum AdjRW','Sum AdjRWที่จ่าย','CMI','Fixed cost','LC(OT)','ยอดพิจารณาจ่าย IP',
  'อัตราจ่าย/Adj.','หักเงินเดือน','คงเหลือรับ','ผู้รายงาน','วันที่รายงาน'
];

const crudCols = [
  'เดือน','OP visit','NCD visit','Non NCD visit','Bed rate','Active bed',
  'Sum AdjRW','Sum AdjRWที่จ่าย','CMI','Fixed cost','LC(OT)',
  'ยอดพิจารณาจ่าย IP','อัตราจ่าย/Adj.','หักเงินเดือน','คงเหลือรับ','วันที่รายงาน'
];

const numericCols = [
  'OP visit','NCD visit','Non NCD visit','Bed rate','Active bed',
  'Sum AdjRW','Sum AdjRWที่จ่าย','CMI','Fixed cost','LC(OT)',
  'ยอดพิจารณาจ่าย IP','อัตราจ่าย/Adj.','หักเงินเดือน','คงเหลือรับ'
];

const fyMonths = [
  'ตุลาคม','พฤศจิกายน','ธันวาคม','มกราคม','กุมภาพันธ์','มีนาคม',
  'เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน'
];

const monthShort = {
  'มกราคม':'ม.ค.','กุมภาพันธ์':'ก.พ.','มีนาคม':'มี.ค.','เมษายน':'เม.ย.',
  'พฤษภาคม':'พ.ค.','มิถุนายน':'มิ.ย.','กรกฎาคม':'ก.ค.','สิงหาคม':'ส.ค.',
  'กันยายน':'ก.ย.','ตุลาคม':'ต.ค.','พฤศจิกายน':'พ.ย.','ธันวาคม':'ธ.ค.'
};

const monthAliases = {
  'มกราคม':['มกราคม','ม.ค.','ม.ค'],
  'กุมภาพันธ์':['กุมภาพันธ์','ก.พ.','ก.พ'],
  'มีนาคม':['มีนาคม','มี.ค.','มี.ค'],
  'เมษายน':['เมษายน','เม.ย.','เม.ย'],
  'พฤษภาคม':['พฤษภาคม','พ.ค.','พ.ค'],
  'มิถุนายน':['มิถุนายน','มิ.ย.','มิ.ย'],
  'กรกฎาคม':['กรกฎาคม','ก.ค.','ก.ค'],
  'สิงหาคม':['สิงหาคม','ส.ค.','ส.ค'],
  'กันยายน':['กันยายน','ก.ย.','ก.ย'],
  'ตุลาคม':['ตุลาคม','ต.ค.','ต.ค'],
  'พฤศจิกายน':['พฤศจิกายน','พ.ย.','พ.ย'],
  'ธันวาคม':['ธันวาคม','ธ.ค.','ธ.ค']
};

const accents = ['#0f5bd7','#0ca678','#1098ad','#f59f00','#e03131','#6842d8'];

let rows = [];
let trendChart, visitChart, changeChart, metricChart;
let editingIndex = null;

const $ = id => document.getElementById(id);

const num = v => {
  const x = Number(String(v ?? '').replace(/,/g,'').trim());
  return Number.isFinite(x) ? x : null;
};

const money = new Intl.NumberFormat('th-TH',{maximumFractionDigits:2});
const integer = new Intl.NumberFormat('th-TH',{maximumFractionDigits:0});

function escapeHtml(v) {
  return String(v ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ---------- CSV ---------- */

function parseCSV(text) {
  const out=[]; let row=[]; let cell=''; let quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i], next=text[i+1];
    if(c==='"' && quoted && next==='"'){ cell+='"'; i++; continue; }
    if(c==='"'){ quoted=!quoted; continue; }
    if(c===',' && !quoted){ row.push(cell); cell=''; continue; }
    if((c==='\n'||c==='\r') && !quoted){
      if(c==='\r' && next==='\n') i++;
      row.push(cell); cell='';
      if(row.some(x=>x.trim()!=='')) out.push(row);
      row=[]; continue;
    }
    cell+=c;
  }
  if(cell!=='' || row.length){ row.push(cell); out.push(row); }
  return out;
}

function parseRows(text) {
  const a=parseCSV(text);
  const headers=(a[0]||[]).map(x=>x.trim());
  return a.slice(1)
    .map(r=>Object.fromEntries(headers.map((h,i)=>[h,(r[i]??'').trim()])))
    .filter(r=>r['เดือน']);
}

/* ---------- Month / Fiscal Year ---------- */

function monthIndex(monthText) {
  const text=String(monthText||'').trim().replace(/\s+/g,'');
  for(let i=0;i<fyMonths.length;i++){
    const full=fyMonths[i];
    const aliases=monthAliases[full]||[];
    if(text.startsWith(full) || aliases.some(a=>text.startsWith(a))) return i;
  }
  return -1;
}

function fiscalYear(row) {
  const text=String(row?.['เดือน']||'').trim();
  const match=text.match(/(\d{2,4})\s*$/);
  if(!match) return '';
  let year=Number(match[1]);
  if(year>=1900 && year<2400) year+=543;
  else if(year<100) year+=2500;
  const mi=monthIndex(text);
  if(mi<0) return '';
  if(mi<=2) year+=1; // ต.ค.-ธ.ค. อยู่ FY ถัดไป
  return String(year);
}

function sortRows(data) {
  return [...data].sort((a,b)=>{
    const ya=Number(fiscalYear(a)||0), yb=Number(fiscalYear(b)||0);
    if(ya!==yb) return ya-yb;
    return monthIndex(a['เดือน'])-monthIndex(b['เดือน']);
  });
}

function monthLabel(text) {
  const mi=monthIndex(text);
  const name=mi>=0 ? fyMonths[mi] : '';
  const y=(String(text||'').match(/(\d{2,4})$/)||[])[1]||'';
  return `${monthShort[name]||name} ${y.slice(-2)}`;
}

/* ---------- Calculations ---------- */

function sum(data,key){ return data.reduce((s,r)=>s+(num(r[key])||0),0); }
function avg(data,key){ return data.length ? sum(data,key)/data.length : 0; }

function pct(current,previous){
  if(previous===null || previous===undefined || previous===0) return null;
  return ((current-previous)/Math.abs(previous))*100;
}

function formatValue(v,key){
  if(v===null || v===undefined || v==='') return '—';
  return numericCols.includes(key) ? money.format(num(v)||0) : v;
}

/* ---------- Status ---------- */

function setStatus(text,type='ok'){
  if($('status')) $('status').textContent=text;
  if($('statusDot')) $('statusDot').className='status-dot '+(type==='error'?'error':'ok');
}

function toast(text){
  if(!$('toast')) return;
  $('toastText').textContent=text;
  $('toast').classList.add('show');
  setTimeout(()=>$('toast').classList.remove('show'),2600);
}

/* ---------- Load ---------- */

async function load(){
  setStatus('กำลังโหลดข้อมูลจาก Google Sheet...');
  try{
    const response=await fetch(CSV_URL,{cache:'no-store'});
    if(!response.ok) throw new Error('ไม่สามารถโหลด Published CSV ได้');
    const text=await response.text();
    rows=sortRows(parseRows(text));
    initFilters();
    render();
    setStatus(`เชื่อมต่อแล้ว • ${rows.length} รายการ • ${new Date().toLocaleTimeString('th-TH')}`);
  }catch(error){
    console.error(error);
    setStatus(error.message||'โหลดข้อมูลไม่สำเร็จ','error');
  }
}

function initFilters(){
  const currentYear=$('yearFilter')?.value||'all';
  const currentMonth=$('monthFilter')?.value||'all';
  const currentMetric=$('metricFilter')?.value||'OP visit';

  const years=[...new Set(rows.map(fiscalYear).filter(Boolean))]
    .sort((a,b)=>Number(a)-Number(b));

  $('yearFilter').innerHTML=
    '<option value="all">ทุกปีงบประมาณ</option>'+
    years.map(y=>`<option value="${y}">ปีงบประมาณ ${y}</option>`).join('');

  $('monthFilter').innerHTML=
    '<option value="all">ทุกเดือน</option>'+
    fyMonths.map((m,i)=>`<option value="${i}">${monthShort[m]}</option>`).join('');

  $('metricFilter').innerHTML=[
    'OP visit','NCD visit','Non NCD visit','คงเหลือรับ',
    'Bed rate','CMI','Sum AdjRW','ยอดพิจารณาจ่าย IP'
  ].map(k=>`<option value="${k}">${k}</option>`).join('');

  if([...$('yearFilter').options].some(o=>o.value===currentYear)) $('yearFilter').value=currentYear;
  if([...$('monthFilter').options].some(o=>o.value===currentMonth)) $('monthFilter').value=currentMonth;
  if([...$('metricFilter').options].some(o=>o.value===currentMetric)) $('metricFilter').value=currentMetric;
}

function filtered(){
  const y=$('yearFilter').value;
  const m=$('monthFilter').value;
  const q=$('search').value.trim().toLowerCase();

  return sortRows(rows.filter(r=>{
    const okYear=y==='all' || fiscalYear(r)===y;
    const okMonth=m==='all' || monthIndex(r['เดือน'])===Number(m);
    const okSearch=!q || Object.values(r).join(' ').toLowerCase().includes(q);
    return okYear && okMonth && okSearch;
  }));
}

/* ---------- Render ---------- */

function render(){
  const data=filtered();
  if($('count')) $('count').textContent=`${data.length} รายการ`;
  if($('countData')) $('countData').textContent=`${data.length} รายการ`;
  renderKPI(data);
  renderCharts(data);
  renderRank(data);
  renderWatchList(data);
  renderAnalysis(data);
  renderTable(data);
}

function renderKPI(data){
  const latest=data[data.length-1];
  const previous=data.length>1?data[data.length-2]:null;
  const cards=[
    ['OP visit',sum(data,'OP visit'),'ครั้ง','people-fill'],
    ['NCD visit',sum(data,'NCD visit'),'ครั้ง','heart-pulse-fill'],
    ['Non NCD visit',sum(data,'Non NCD visit'),'ครั้ง','person-check-fill'],
    ['คงเหลือรับ',sum(data,'คงเหลือรับ'),'บาท','cash-stack'],
    ['Bed rate',avg(data,'Bed rate'),'%', 'hospital'],
    ['CMI',avg(data,'CMI'),'เฉลี่ย','graph-up-arrow']
  ];
  $('kpis').innerHTML=cards.map(([key,value,unit,icon],i)=>{
    const change=pct(num(latest?.[key]),num(previous?.[key]));
    const cls=change===null?'flat':change>0?'up':change<0?'down':'flat';
    const arrow=change>0?'▲':change<0?'▼':'—';
    return `<article class="kpi-card" style="--accent:${accents[i]}">
      <div class="kpi-icon"><i class="bi bi-${icon}"></i></div>
      <div class="kpi-label">${key}</div>
      <div class="kpi-value">${money.format(value)}</div>
      <div class="kpi-unit">${unit}</div>
      <div class="kpi-change ${cls}">${change===null?'ไม่มีฐานเปรียบเทียบ':`${arrow} ${Math.abs(change).toFixed(1)}% จากเดือนก่อน`}</div>
    </article>`;
  }).join('');
}

function renderCharts(data){
  const labels=data.map(r=>monthLabel(r['เดือน']));
  const metric=$('metricFilter').value;
  const values=data.map(r=>num(r[metric])||0);

  trendChart?.destroy(); visitChart?.destroy();

  trendChart=new Chart($('trendChart'),{
    type:'line',
    data:{labels,datasets:[{
      label:metric,data:values,borderColor:'#0f5bd7',
      backgroundColor:'rgba(15,91,215,.10)',fill:true,tension:.35,
      pointRadius:data.length>40?2.5:4,pointHoverRadius:6,borderWidth:3
    }]},
    options:{
      responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:true},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${money.format(c.parsed.y)}`}}},
      scales:{x:{grid:{display:false},ticks:{maxRotation:45,font:{family:'Prompt',size:9}}},
              y:{beginAtZero:true,grid:{color:'rgba(100,120,150,.10)'},ticks:{font:{family:'Prompt',size:9}}}}
    }
  });

  visitChart=new Chart($('visitChart'),{
    type:'doughnut',
    data:{
      labels:['OP visit','NCD visit','Non NCD visit'],
      datasets:[{data:[sum(data,'OP visit'),sum(data,'NCD visit'),sum(data,'Non NCD visit')],
        backgroundColor:['#0f5bd7','#0ca678','#1098ad'],borderColor:'#fff',borderWidth:4}]
    },
    options:{responsive:true,maintainAspectRatio:false,cutout:'67%',
      plugins:{legend:{position:'bottom',labels:{font:{family:'Prompt',size:10},usePointStyle:true}},
      tooltip:{callbacks:{label:c=>`${c.label}: ${integer.format(c.raw)} ครั้ง`}}}}
  });
}

function renderRank(data){
  const metric=$('metricFilter').value;
  const scored=data.map(r=>({...r,_value:num(r[metric])||0})).sort((a,b)=>b._value-a._value);
  const renderList=(items)=>(items.length?items.slice(0,5).map((r,i)=>`
    <div class="rank-row"><span class="rank-no">${i+1}</span>
    <span class="rank-month">${monthLabel(r['เดือน'])}</span>
    <span class="rank-value">${money.format(r._value)}</span></div>`).join('')
    :'<div class="small-note">ไม่มีข้อมูล</div>');
  $('topTable').innerHTML=renderList(scored);
  $('bottomTable').innerHTML=renderList([...scored].reverse());
}

function renderWatchList(data){
  const items=[];
  data.forEach(r=>{
    const missing=numericCols.filter(k=>r[k]===''||r[k]===null||r[k]===undefined);
    if(missing.length){
      items.push({icon:'exclamation-triangle-fill',title:monthLabel(r['เดือน']),
        detail:`ข้อมูลยังไม่ครบ: ${missing.slice(0,3).join(', ')}${missing.length>3?' และอื่น ๆ':''}`});
      return;
    }
    const remain=num(r['คงเหลือรับ']);
    if(remain!==null && remain<0){
      items.push({icon:'cash-coin',title:monthLabel(r['เดือน']),detail:'คงเหลือรับติดลบ ควรตรวจสอบข้อมูลการเงิน'});
      return;
    }
    const bed=num(r['Bed rate']);
    if(bed!==null && bed<50){
      items.push({icon:'hospital-fill',title:monthLabel(r['เดือน']),
        detail:`Bed rate ${money.format(bed)}% ควรติดตาม`});
    }
  });
  const unique=items.filter((x,i,a)=>a.findIndex(y=>y.title===x.title&&y.detail===x.detail)===i).slice(0,8);
  $('watchList').innerHTML=unique.length?unique.map(x=>`
    <div class="watch-item"><div class="watch-icon"><i class="bi bi-${x.icon}"></i></div>
    <div><div class="watch-title">${x.title}</div><div class="watch-detail">${x.detail}</div></div></div>`).join('')
    :'<div class="small-note">ไม่พบรายการที่ควรติดตามจากข้อมูลปัจจุบัน</div>';
}

function renderAnalysis(data){
  const metric=$('metricFilter').value;
  const years=[...new Set(data.map(fiscalYear).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
  let prev=null;
  let html=`<thead><tr><th>ปีงบฯ</th><th>เดือน</th><th>OP visit</th><th>NCD visit</th><th>Non NCD</th><th>คงเหลือรับ</th><th>Bed rate</th><th>CMI</th><th>${metric} %</th></tr></thead><tbody>`;
  years.forEach(y=>{
    const yd=data.filter(r=>fiscalYear(r)===y), value=sum(yd,metric), change=pct(value,prev);
    html+=`<tr>
      <td><span class="badge text-bg-primary">FY ${y}</span></td><td>${yd.length}/12</td>
      <td>${integer.format(sum(yd,'OP visit'))}</td><td>${integer.format(sum(yd,'NCD visit'))}</td>
      <td>${integer.format(sum(yd,'Non NCD visit'))}</td><td>${money.format(sum(yd,'คงเหลือรับ'))}</td>
      <td>${money.format(avg(yd,'Bed rate'))}%</td><td>${money.format(avg(yd,'CMI'))}</td>
      <td class="${change>0?'delta-up':change<0?'delta-down':'delta-flat'}">${change===null?'—':`${change>0?'▲':change<0?'▼':'—'} ${Math.abs(change).toFixed(1)}%`}</td>
    </tr>`;
    prev=value;
  });
  $('yearTable').innerHTML=html+'</tbody>';

  const latest=data[data.length-1], previous=data.length>1?data[data.length-2]:null;
  const latestChange=pct(num(latest?.[metric]),num(previous?.[metric]));
  $('analysisCards').innerHTML=[
    ['ตัวชี้วัด',metric],
    ['เดือนล่าสุด',latest?monthLabel(latest['เดือน']):'—'],
    ['ค่าเดือนล่าสุด',latest?money.format(num(latest[metric])||0):'—'],
    ['เทียบเดือนก่อน',latestChange===null?'—':`${latestChange>0?'▲ ':latestChange<0?'▼ ':''}${Math.abs(latestChange).toFixed(1)}%`]
  ].map(x=>`<div class="analysis-card"><div class="label">${x[0]}</div><div class="value">${x[1]}</div></div>`).join('');

  changeChart?.destroy(); metricChart?.destroy();

  changeChart=new Chart($('changeChart'),{
    type:'bar',
    data:{labels:data.map(r=>monthLabel(r['เดือน'])),datasets:[{
      label:'% เปลี่ยนแปลงจากเดือนก่อน',
      data:data.map((r,i)=>i?pct(num(r[metric]),num(data[i-1][metric]))||0:0),
      backgroundColor:data.map((r,i)=>{
        const v=i?pct(num(r[metric]),num(data[i-1][metric]))||0:0;
        return v>=0?'#0ca678':'#e03131';
      }),borderRadius:6
    }]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{x:{grid:{display:false},ticks:{maxRotation:45,font:{family:'Prompt',size:9}}},
      y:{grid:{color:'rgba(100,120,150,.10)'},ticks:{callback:v=>`${v}%`}}}}
  });

  metricChart=new Chart($('metricChart'),{
    type:'line',
    data:{labels:data.map(r=>monthLabel(r['เดือน'])),datasets:[{
      label:metric,data:data.map(r=>num(r[metric])||0),borderColor:'#6842d8',
      backgroundColor:'rgba(104,66,216,.09)',fill:true,tension:.35,borderWidth:3
    }]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{font:{family:'Prompt',size:10}}}},
      scales:{x:{grid:{display:false},ticks:{maxRotation:45,font:{family:'Prompt',size:9}}},
      y:{grid:{color:'rgba(100,120,150,.10)'}}}}
  });
}

/* ---------- Table ---------- */

function renderTable(data){
  const head=cols.map(c=>`<th>${escapeHtml(c)}</th>`).join('');
  const body=data.map(r=>{
    const idx=rows.indexOf(r);
    const cells=cols.map(c=>`<td>${escapeHtml(formatValue(r[c],c))}</td>`).join('');
    return `<tr>${cells}<td class="action-cell">
      <button class="action-btn edit-btn" onclick="editRow(${idx})"><i class="bi bi-pencil"></i> แก้ไข</button>
      <button class="action-btn delete-btn" onclick="deleteRow(${idx})"><i class="bi bi-trash3"></i> ลบ</button>
    </td></tr>`;
  }).join('');
  $('dataTable').innerHTML=`<thead><tr>${head}<th class="action-cell">จัดการ</th></tr></thead><tbody>${body}</tbody>`;
}

/* ---------- CRUD ---------- */

function buildForm(row={}){
  $('formGrid').innerHTML=crudCols.map(c=>{
    const isDate=c==='วันที่รายงาน';
    return `<div class="form-field">
      <label>${escapeHtml(c)}</label>
      <input ${isDate?'type="text"':''} data-field="${escapeHtml(c)}" value="${escapeHtml(row[c]??'')}">
    </div>`;
  }).join('');
}

function openModal(index=null){
  editingIndex=index;
  $('modalTitle').textContent=index===null?'เพิ่มข้อมูล':'แก้ไขข้อมูล';
  buildForm(index===null?{}:rows[index]);
  bootstrap.Modal.getOrCreateInstance($('rowModal')).show();
}

function postApi(payload){
  return new Promise((resolve,reject)=>{
    if(!API_URL) return reject(new Error('ยังไม่ได้ตั้งค่า Apps Script Web App URL'));

    const frameName='appsScriptSubmitFrame';
    let frame=document.getElementById(frameName);
    if(!frame){
      frame=document.createElement('iframe');
      frame.id=frameName; frame.name=frameName; frame.style.display='none';
      document.body.appendChild(frame);
    }

    const form=document.createElement('form');
    form.method='POST'; form.action=API_URL; form.target=frameName; form.style.display='none';

    const input=document.createElement('input');
    input.type='hidden'; input.name='payload'; input.value=JSON.stringify(payload);
    form.appendChild(input); document.body.appendChild(form);

    let finished=false;
    const cleanup=()=>{try{form.remove()}catch(e){}};

    setTimeout(()=>{
      if(finished) return;
      finished=true; cleanup(); resolve({ok:true});
    },3000);

    try{ form.submit(); }
    catch(err){
      if(!finished){ finished=true; cleanup(); reject(new Error('ไม่สามารถส่งข้อมูลไป Google Apps Script ได้')); }
    }
  });
}

async function saveRow(){
  const btn=$('saveBtn');
  try{
    const values=Object.fromEntries(
      [...document.querySelectorAll('#formGrid [data-field]')].map(x=>[x.dataset.field,x.value.trim()])
    );
    if(!values['เดือน']) throw new Error('กรุณาระบุเดือน');

    const action=editingIndex===null?'append':'update';
    const payload={action,values:crudCols.map(c=>values[c]||'')};

    if(action==='update') payload.month=rows[editingIndex]['เดือน'];

    btn.disabled=true;
    btn.innerHTML='<span class="spinner-border spinner-border-sm"></span> กำลังบันทึก...';

    await postApi(payload);

    bootstrap.Modal.getInstance($('rowModal'))?.hide();
    setStatus('บันทึกคำสั่งแล้ว กำลังตรวจสอบข้อมูลใน Google Sheet...');

    /* ให้ Apps Script เขียนเสร็จก่อน แล้วโหลด Published CSV ใหม่ */
    await new Promise(r=>setTimeout(r,5000));
    await load();

    toast(action==='append'?'เพิ่มข้อมูลสำเร็จ':'แก้ไขข้อมูลสำเร็จ');
  }catch(error){
    console.error(error);
    setStatus(error.message||'บันทึกไม่สำเร็จ','error');
    alert(error.message||'บันทึกข้อมูลไม่สำเร็จ');
  }finally{
    btn.disabled=false;
    btn.innerHTML='<i class="bi bi-save2"></i> บันทึกข้อมูล';
  }
}

async function deleteRow(index){
  const row=rows[index];
  if(!row) return;
  const month=row['เดือน'];
  if(!confirm(`ยืนยันลบรายการ "${month}" ?`)) return;

  try{
    setStatus('กำลังลบข้อมูลจาก Google Sheet...');
    await postApi({action:'delete',month});
    await new Promise(r=>setTimeout(r,5000));
    await load();
    toast('ลบข้อมูลสำเร็จ');
  }catch(error){
    console.error(error);
    setStatus(error.message||'ลบข้อมูลไม่สำเร็จ','error');
    alert(error.message||'ลบข้อมูลไม่สำเร็จ');
  }
}

/* ---------- Navigation / Events ---------- */

function switchView(view){
  document.querySelectorAll('.nav-tab').forEach(btn=>btn.classList.toggle('active',btn.dataset.view===view));
  ['dashboard','analysis','data'].forEach(v=>$(`view-${v}`).classList.toggle('d-none',v!==view));
}

function bindEvents(){
  document.querySelectorAll('.nav-tab').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.view)));

  ['yearFilter','monthFilter','search','metricFilter'].forEach(id=>{
    $(id).addEventListener('input',render);
    $(id).addEventListener('change',render);
  });

  $('refresh').addEventListener('click',load);

  $('reset').addEventListener('click',()=>{
    $('yearFilter').value='all';
    $('monthFilter').value='all';
    $('search').value='';
    $('metricFilter').value='OP visit';
    render();
  });

  $('addBtn').addEventListener('click',()=>openModal());
  $('saveBtn').addEventListener('click',saveRow);

  window.editRow=openModal;
  window.deleteRow=deleteRow;
}

document.addEventListener('DOMContentLoaded',()=>{
  bindEvents();
  load();
});
