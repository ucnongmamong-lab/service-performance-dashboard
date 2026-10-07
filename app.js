const CSV_URL='https://docs.google.com/spreadsheets/d/e/2PACX-1vQAFcBJvDUqxyx0xJmsqoGjG1XCbX8zNUory4qCmndR0gjxQSwQhtGN8OFk9uB8Co2VkD9AdsyOHFKX/pub?gid=638479938&single=true&output=csv';
const API_URL='https://script.google.com/macros/s/AKfycbzBGl_rPjtlGPOOcvPbhGMIWhxUJG0QKTu9HhCNaGbkwfIovEOW31sdsSI5gbPt7-BP-w/exec';

const cols=['ที่','เดือน','OP visit','NCD visit','Non NCD visit','Bed rate','Active bed','Sum AdjRW','CMI','Fixed cost','LC(OT)','ยอดพิจารณาจ่าย IP','อัตราจ่าย/Adj.','หักเงินเดือน','คงเหลือรับ','ผู้รายงาน','วันที่รายงาน'];
const crudCols=cols.slice(1);
const numericCols=['OP visit','NCD visit','Non NCD visit','Bed rate','Active bed','Sum AdjRW','Sum AdjRWที่จ่าย','CMI','Fixed cost','LC(OT)','ยอดพิจารณาจ่าย IP','อัตราจ่าย/Adj.','หักเงินเดือน','คงเหลือรับ'];
const monthNames=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

const money=new Intl.NumberFormat('th-TH',{maximumFractionDigits:2});
const integer=new Intl.NumberFormat('th-TH',{maximumFractionDigits:0});

let rows=[];
let trendChart,visitChart,changeChart,metricChart;
let editingIndex=null;

const $=id=>document.getElementById(id);

function n(v){
  if(v===null || v===undefined || String(v).trim()==='') return null;
  const x=Number(String(v).replace(/,/g,'').trim());
  return Number.isFinite(x)?x:null;
}

function escapeHtml(v){
  return String(v??'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

function parseCSV(text){
  const out=[];
  let row=[],cell='',q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i],nx=text[i+1];
    if(c==='"' && q && nx==='"'){cell+='"';i++;continue}
    if(c==='"'){q=!q;continue}
    if(c===',' && !q){row.push(cell);cell='';continue}
    if((c==='\n'||c==='\r')&&!q){
      if(c==='\r'&&nx==='\n') i++;
      row.push(cell);cell='';
      if(row.some(x=>x.trim()!=='')) out.push(row);
      row=[];
      continue;
    }
    cell+=c;
  }
  if(cell!==''||row.length){row.push(cell);out.push(row)}
  return out;
}

function parseRows(text){
  const a=parseCSV(text),h=a[0]||[];
  return a.slice(1)
    .map(r=>Object.fromEntries(h.map((k,i)=>[k,(r[i]??'').trim()])))
    .filter(r=>r['เดือน']);
}

function thaiYear(r){
  const m=(r['เดือน']||'').match(/(25\d{2}|20\d{2})$/);
  return m?m[1]:'';
}

function monthIndex(s){
  return monthNames.findIndex(x=>(s||'').startsWith(x));
}

function sortRows(a){
  return [...a].sort((x,y)=>{
    const k=(thaiYear(x)||'0000')+'-'+String(monthIndex(x['เดือน'])).padStart(2,'0');
    const l=(thaiYear(y)||'0000')+'-'+String(monthIndex(y['เดือน'])).padStart(2,'0');
    return k.localeCompare(l);
  });
}

function sum(d,k){return d.reduce((s,r)=>s+(n(r[k])||0),0)}
function avg(d,k){return d.length?sum(d,k)/d.length:0}
function pct(a,b){
  if(a==null || b==null) return null;
  return b===0?(a===0?0:null):((a-b)/Math.abs(b))*100;
}

function fmt(v,k){
  if(v==null||v==='') return '—';
  return numericCols.includes(k)?money.format(n(v)):escapeHtml(v);
}

function setStatus(t){
  if($('status')) $('status').textContent=t;
}

async function fetchCsvRows(){
  const res=await fetch(CSV_URL,{cache:'no-store'});
  if(!res.ok) throw new Error('โหลดข้อมูล Google Sheet ไม่สำเร็จ');
  return sortRows(parseRows(await res.text()));
}

async function load(){
  try{
    setStatus('กำลังโหลดข้อมูล...');
    rows=await fetchCsvRows();
    initFilters();
    render();
    setStatus(`โหลดข้อมูลแล้ว ${rows.length} รายการ • อัปเดตจาก Published CSV`);
  }catch(e){
    setStatus(e.message||'โหลดข้อมูลไม่สำเร็จ');
    throw e;
  }
}

function initFilters(){
  const years=[...new Set(rows.map(thaiYear).filter(Boolean))]
    .sort((a,b)=>Number(a)-Number(b));

  if($('yearFilter')){
    $('yearFilter').innerHTML='<option value="all">ทุกปี</option>'+
      years.map(y=>`<option value="${escapeHtml(y)}">${escapeHtml(y)}</option>`).join('');
  }

  if($('monthFilter')){
    $('monthFilter').innerHTML='<option value="all">ทุกเดือน</option>'+
      monthNames.map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join('');
  }

  if($('metricFilter')){
    $('metricFilter').innerHTML=numericCols
      .map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join('');
  }
}

function filtered(){
  const y=$('yearFilter')?.value||'all';
  const m=$('monthFilter')?.value||'all';
  const q=($('search')?.value||'').trim().toLowerCase();

  return sortRows(rows.filter(r=>
    (y==='all'||thaiYear(r)===y) &&
    (m==='all'||(r['เดือน']||'').startsWith(m)) &&
    (!q||Object.values(r).join(' ').toLowerCase().includes(q))
  ));
}

function render(){
  const d=filtered();
  if($('count')) $('count').textContent=`${d.length} รายการ`;
  renderKPI(d);
  renderCharts(d);
  renderRank(d);
  renderAnalysis(d);
  renderTable(d);
}

function renderKPI(d){
  const latest=d[d.length-1];
  const previous=d.length>1?d[d.length-2]:null;

  const cards=[
    ['OP visit',sum(d,'OP visit'),'ครั้ง'],
    ['NCD visit',sum(d,'NCD visit'),'ครั้ง'],
    ['Non NCD visit',sum(d,'Non NCD visit'),'ครั้ง'],
    ['คงเหลือรับ',sum(d,'คงเหลือรับ'),'บาท'],
    ['Bed rate',avg(d,'Bed rate'),'%'],
    ['CMI',avg(d,'CMI'),'เฉลี่ย']
  ];

  if(!$('kpis')) return;

  $('kpis').innerHTML=cards.map(([k,v,u])=>{
    const pv=previous?n(previous[k]):null;
    const lv=latest?n(latest[k]):null;
    const ch=pct(lv,pv);

    return `<div class="col-6 col-xl-2">
      <div class="card shadow-sm kpi">
        <div class="card-body">
          <div class="label">${escapeHtml(k)}</div>
          <div class="value">${money.format(v)}</div>
          <div class="sub">${escapeHtml(u)}${ch==null?'':` • เดือนล่าสุด ${ch>=0?'+':''}${ch.toFixed(1)}%`}</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function destroyChart(c){
  try{c?.destroy()}catch(e){}
}

function renderCharts(d){
  const labels=d.map(x=>x['เดือน']);
  const vals=k=>d.map(x=>n(x[k])||0);
  const metric=$('metricFilter')?.value||'OP visit';

  destroyChart(trendChart);
  destroyChart(visitChart);

  if($('trendChart')){
    trendChart=new Chart($('trendChart'),{
      type:'line',
      data:{
        labels,
        datasets:[{
          label:metric,
          data:vals(metric),
          tension:.25
        }]
      },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        plugins:{legend:{position:'bottom'}},
        scales:{x:{ticks:{maxRotation:60,minRotation:20}}}
      }
    });
  }

  if($('visitChart')){
    visitChart=new Chart($('visitChart'),{
      type:'bar',
      data:{
        labels:['OP visit','NCD visit','Non NCD visit'],
        datasets:[{
          label:'รวม',
          data:[
            sum(d,'OP visit'),
            sum(d,'NCD visit'),
            sum(d,'Non NCD visit')
          ]
        }]
      },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        plugins:{legend:{display:false}}
      }
    });
  }
}

function renderRank(d){
  const metric=$('metricFilter')?.value||'OP visit';
  const scored=d.map(r=>({...r,_v:n(r[metric])||0}))
    .sort((a,b)=>b._v-a._v);

  const make=a=>a.slice(0,5).map((r,i)=>
    `<div class="rank-row">
      <span>${i+1}. ${escapeHtml(r['เดือน'])}</span>
      <b>${money.format(r._v)}</b>
    </div>`
  ).join('')||'<div class="small-note">ไม่มีข้อมูล</div>';

  if($('topTable')) $('topTable').innerHTML=make(scored);
  if($('bottomTable')) $('bottomTable').innerHTML=make([...scored].reverse());
}

function renderAnalysis(d){
  const metric=$('metricFilter')?.value||'OP visit';
  const years=[...new Set(d.map(thaiYear).filter(Boolean))]
    .sort((a,b)=>Number(a)-Number(b));

  let html='<thead><tr>'+
    '<th>ปี</th><th>จำนวนเดือน</th><th>OP visit</th><th>NCD visit</th>'+
    '<th>Non NCD</th><th>คงเหลือรับ</th><th>Bed rate เฉลี่ย</th>'+
    '<th>CMI เฉลี่ย</th><th>เปลี่ยนแปลง '+escapeHtml(metric)+'</th>'+
    '</tr></thead><tbody>';

  let prev=null;

  for(const y of years){
    const yd=d.filter(r=>thaiYear(r)===y);
    const v=sum(yd,metric);
    const ch=pct(v,prev);

    html+=`<tr>
      <td>${escapeHtml(y)}</td>
      <td>${yd.length}</td>
      <td>${integer.format(sum(yd,'OP visit'))}</td>
      <td>${integer.format(sum(yd,'NCD visit'))}</td>
      <td>${integer.format(sum(yd,'Non NCD visit'))}</td>
      <td>${money.format(sum(yd,'คงเหลือรับ'))}</td>
      <td>${money.format(avg(yd,'Bed rate'))}</td>
      <td>${money.format(avg(yd,'CMI'))}</td>
      <td class="${ch>0?'delta-up':ch<0?'delta-down':'delta-flat'}">
        ${ch==null?'—':`${ch>=0?'+':''}${ch.toFixed(1)}%`}
      </td>
    </tr>`;

    prev=v;
  }

  html+='</tbody>';

  if($('yearTable')) $('yearTable').innerHTML=html;

  const latest=d[d.length-1];
  const prevM=d.length>1?d[d.length-2]:null;
  const ch=pct(n(latest?.[metric]),n(prevM?.[metric]));

  if($('analysisCards')){
    $('analysisCards').innerHTML=[
      ['ตัวชี้วัด',metric],
      ['เดือนล่าสุด',latest?.['เดือน']||'—'],
      ['ค่าเดือนล่าสุด',money.format(n(latest?.[metric])||0)],
      ['เทียบเดือนก่อน',ch==null?'—':`${ch>=0?'+':''}${ch.toFixed(1)}%`]
    ].map(x=>`<div class="col-6 col-xl-3">
      <div class="card shadow-sm kpi">
        <div class="card-body">
          <div class="label">${escapeHtml(x[0])}</div>
          <div class="value">${escapeHtml(x[1])}</div>
        </div>
      </div>
    </div>`).join('');
  }

  destroyChart(changeChart);
  destroyChart(metricChart);

  if($('changeChart')){
    changeChart=new Chart($('changeChart'),{
      type:'bar',
      data:{
        labels:d.map(x=>x['เดือน']),
        datasets:[{
          label:'% เปลี่ยนแปลงจากเดือนก่อน',
          data:d.map((r,i)=>i?pct(n(r[metric]),n(d[i-1][metric]))||0:0)
        }]
      },
      options:{responsive:true,maintainAspectRatio:false}
    });
  }

  if($('metricChart')){
    metricChart=new Chart($('metricChart'),{
      type:'line',
      data:{
        labels:d.map(x=>x['เดือน']),
        datasets:[{
          label:metric,
          data:d.map(x=>n(x[metric])||0),
          tension:.25
        }]
      },
      options:{responsive:true,maintainAspectRatio:false}
    });
  }
}

function renderTable(d){
  if(!$('dataTable')) return;

  $('dataTable').innerHTML=
    '<thead><tr>'+
    cols.map(c=>`<th>${escapeHtml(c)}</th>`).join('')+
    '<th>จัดการ</th></tr></thead>'+
    '<tbody>'+
    d.map(r=>{
      const idx=rows.indexOf(r);

      return '<tr>'+
        cols.map(c=>`<td>${fmt(r[c],c)}</td>`).join('')+
        `<td>
          <button class="btn btn-sm btn-outline-primary me-1" onclick="editRow(${idx})">แก้ไข</button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteRow(${idx})">ลบ</button>
        </td>`+
      '</tr>';
    }).join('')+
    '</tbody>';
}

function buildForm(r={}){
  if(!$('formGrid')) return;

  $('formGrid').innerHTML=crudCols.map(c=>{
    const value=String(r[c]??'')
      .replace(/&/g,'&amp;')
      .replace(/"/g,'&quot;');

    const isNumber=numericCols.includes(c);
    const type=isNumber?'number':'text';
    const step=isNumber?'any':undefined;

    return `<div class="col-12 col-md-6">
      <label class="form-label small fw-bold">${escapeHtml(c)}</label>
      <input
        class="form-control"
        data-field="${escapeHtml(c)}"
        type="${type}"
        ${step?`step="${step}"`:''}
        value="${value}">
    </div>`;
  }).join('');
}

function openModal(idx=null){
  editingIndex=idx;
  if($('modalTitle')) $('modalTitle').textContent=idx==null?'เพิ่มข้อมูล':'แก้ไขข้อมูล';
  buildForm(idx==null?{}:rows[idx]);
  new bootstrap.Modal($('rowModal')).show();
}

async function postApi(payload){
  if(!API_URL) throw new Error('ยังไม่ได้ตั้งค่า Apps Script Web App URL ใน app.js');

  const res=await fetch(API_URL,{
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify(payload)
  });

  const text=await res.text();
  let out;

  try{
    out=JSON.parse(text);
  }catch(e){
    throw new Error('Apps Script ส่งผลลัพธ์ที่ไม่ใช่ JSON');
  }

  if(!out.ok) throw new Error(out.error||'Apps Script ทำรายการไม่สำเร็จ');
  return out;
}

async function saveRow(){
  const fields=[...document.querySelectorAll('#formGrid [data-field]')];

  const obj=Object.fromEntries(
    fields.map(x=>[x.dataset.field,x.value.trim()])
  );

  if(!obj['เดือน']){
    alert('กรุณาระบุเดือน');
    return;
  }

  if(editingIndex!==null && editingIndex!==undefined){
    if(!rows[editingIndex]){
      throw new Error('ไม่พบรายการที่กำลังแก้ไข');
    }
  }

  const action=editingIndex==null?'append':'update';

  const payload={
    action,
    values:crudCols.map(c=>obj[c]||'')
  };

  if(action==='update'){
    payload.month=rows[editingIndex]['เดือน'];
  }

  setStatus(action==='append'?'กำลังเพิ่มข้อมูล...':'กำลังแก้ไขข้อมูล...');

  const out=await postApi(payload);

  // อัปเดต local state ทันที เพื่อไม่ต้องรอ Published CSV
  if(action==='append'){
    const newRow=Object.fromEntries(
      crudCols.map((c,i)=>[c,payload.values[i]||''])
    );
    newRow['ที่']='';
    rows=sortRows([...rows,newRow]);
  }else{
    rows[editingIndex]=Object.fromEntries(
      crudCols.map((c,i)=>[c,payload.values[i]||''])
    );
    rows[editingIndex]['ที่']=rows[editingIndex]['ที่']||'';
    rows=sortRows(rows);
  }

  initFilters();
  render();

  const modal=bootstrap.Modal.getInstance($('rowModal'));
  if(modal) modal.hide();

  setStatus(out.message||'บันทึกข้อมูลสำเร็จ');

  // Published CSV อาจอัปเดตช้ากว่า Apps Script
  setTimeout(async()=>{
    try{
      const fresh=await fetchCsvRows();
      if(fresh.length>=rows.length-1) {
        rows=fresh;
        initFilters();
        render();
      }
    }catch(e){}
  },5000);
}

async function deleteRow(idx){
  if(!rows[idx]) return;

  const month=rows[idx]['เดือน'];

  if(!confirm(`ยืนยันลบรายการ “${month}” ?`)) return;

  setStatus('กำลังลบข้อมูล...');

  const out=await postApi({
    action:'delete',
    month
  });

  // ลบจากหน้าจอทันที
  rows.splice(idx,1);
  initFilters();
  render();

  setStatus(out.message||'ลบข้อมูลสำเร็จ');

  setTimeout(async()=>{
    try{
      const fresh=await fetchCsvRows();
      rows=fresh;
      initFilters();
      render();
    }catch(e){}
  },5000);
}

window.editRow=openModal;
window.deleteRow=deleteRow;

document.querySelectorAll('.nav-btn').forEach(b=>{
  b.onclick=()=>{
    document.querySelectorAll('.nav-btn')
      .forEach(x=>x.classList.remove('active'));

    b.classList.add('active');

    ['dashboard','analysis','data'].forEach(v=>{
      const el=$('view-'+v);
      if(el) el.classList.toggle('d-none',v!==b.dataset.view);
    });
  };
});

['yearFilter','monthFilter','search','metricFilter'].forEach(id=>{
  const el=$(id);
  if(el) el.addEventListener('input',render);
});

if($('refresh')){
  $('refresh').onclick=()=>load().catch(e=>setStatus(e.message));
}

if($('reset')){
  $('reset').onclick=()=>{
    if($('yearFilter')) $('yearFilter').value='all';
    if($('monthFilter')) $('monthFilter').value='all';
    if($('search')) $('search').value='';
    render();
  };
}

if($('addBtn')) $('addBtn').onclick=()=>openModal();

if($('saveBtn')){
  $('saveBtn').onclick=()=>saveRow().catch(e=>{
    alert(e.message||'บันทึกข้อมูลไม่สำเร็จ');
    setStatus(e.message||'บันทึกข้อมูลไม่สำเร็จ');
  });
}

load().catch(e=>setStatus(e.message||'โหลดข้อมูลไม่สำเร็จ'));
