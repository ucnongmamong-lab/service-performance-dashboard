/*
 * Service Performance Dashboard enhancements
 * 1) Adds a dedicated annual KPI comparison view using the same fiscal-month
 *    period for every fiscal year.
 * 2) Shows percentage labels directly on the service-share doughnut chart.
 *
 * Install: upload this file to the repository root and include it BEFORE app.js:
 * <script src="annual-comparison-enhancement.js"></script>
 */

(function () {
  'use strict';

  const annualMetrics = [
    'OP visit', 'NCD visit', 'Non NCD visit', 'Bed rate', 'Active bed',
    'Sum AdjRW', 'CMI', 'Sum AdjRWที่จ่าย', 'Fixed cost', 'LC(OT)',
    'ยอดพิจารณาจ่าย IP', 'อัตราจ่าย/Adj.', 'หักเงินเดือน', 'คงเหลือรับ'
  ];
  const averageMetrics = new Set(['Bed rate', 'Active bed', 'CMI', 'อัตราจ่าย/Adj.']);
  let annualChart = null;

  function addStyles() {
    if (document.getElementById('annual-comparison-enhancement-styles')) return;
    const style = document.createElement('style');
    style.id = 'annual-comparison-enhancement-styles';
    style.textContent = `
      .annual-filter-panel{padding:18px 20px}
      .annual-filter-grid{display:grid;grid-template-columns:2fr 1fr 1fr;gap:13px}
      .annual-hint{margin:12px 0 0;color:var(--muted,#687386);font-size:.73rem}
      .annual-hint i{color:var(--primary,#0f5bd7);margin-right:4px}
      .annual-table-note{font-size:.72rem;color:var(--muted,#687386)}
      .annual-change-up{color:#0ca678;font-weight:700}
      .annual-change-down{color:#e03131;font-weight:700}
      .annual-change-flat{color:#687386}
      @media(max-width:900px){
        .annual-filter-grid{grid-template-columns:1fr 1fr}
        .annual-filter-grid .filter-item:first-child{grid-column:1/-1}
      }
      @media(max-width:600px){
        .page-nav{grid-template-columns:1fr 1fr!important}
        .annual-filter-grid{grid-template-columns:1fr 1fr;gap:9px}
        .annual-filter-grid .filter-item:first-child{grid-column:1/-1}
      }
    `;
    document.head.appendChild(style);
  }

  function addAnnualView() {
    if (document.querySelector('.nav-tab[data-view="annual"]')) return;

    const nav = document.querySelector('.page-nav');
    const dataView = document.getElementById('view-data');
    if (!nav || !dataView) return;

    const button = document.createElement('button');
    button.className = 'nav-tab';
    button.dataset.view = 'annual';
    button.innerHTML = '<i class="bi bi-calendar2-range"></i><span>เปรียบเทียบรายปี</span>';
    nav.insertBefore(button, nav.querySelector('[data-view="data"]'));

    const section = document.createElement('section');
    section.id = 'view-annual';
    section.className = 'view-section d-none';
    section.innerHTML = `
      <div class="section-title-row">
        <div>
          <span class="section-kicker">YEAR-OVER-YEAR KPI</span>
          <h1>🗓️ เปรียบเทียบรายปี</h1>
          <p class="section-desc">เปรียบเทียบ KPI ในช่วงเดือนเดียวกันของแต่ละปีงบประมาณ (ต.ค.–ก.ย.)</p>
        </div>
      </div>
      <article class="panel annual-filter-panel mb-4">
        <div class="annual-filter-grid">
          <div class="filter-item">
            <label for="annualMetric"><i class="bi bi-speedometer2"></i> KPI ที่ต้องการเปรียบเทียบ</label>
            <select id="annualMetric"></select>
          </div>
          <div class="filter-item">
            <label for="annualStartMonth"><i class="bi bi-calendar-month"></i> เดือนเริ่มต้น</label>
            <select id="annualStartMonth"></select>
          </div>
          <div class="filter-item">
            <label for="annualEndMonth"><i class="bi bi-calendar-month"></i> เดือนสิ้นสุด</label>
            <select id="annualEndMonth"></select>
          </div>
        </div>
        <p class="annual-hint"><i class="bi bi-info-circle"></i> เลือกช่วงเดือน เช่น ต.ค.–มี.ค. ระบบจะรวม/เฉลี่ย KPI จากช่วงเดียวกันของทุกปีงบประมาณ และแสดงร้อยละการเปลี่ยนแปลงเทียบปีก่อน</p>
      </article>
      <div id="annualCards" class="analysis-kpi-grid"></div>
      <article class="panel mb-4">
        <div class="panel-header">
          <div>
            <h3><i class="bi bi-bar-chart-fill"></i> เปรียบเทียบ KPI ตามปีงบประมาณ</h3>
            <p>ยอดรวมใช้ผลรวมตามช่วงเดือน ส่วน Bed rate, Active bed, CMI และอัตราจ่าย/Adj. ใช้ค่าเฉลี่ย</p>
          </div>
        </div>
        <div class="chart-wrap chart-main"><canvas id="annualChart"></canvas></div>
      </article>
      <article class="panel mb-4">
        <div class="panel-header">
          <div>
            <h3><i class="bi bi-table"></i> ตารางเปรียบเทียบรายปี</h3>
            <p>แสดงค่า KPI, จำนวนเดือนที่มีข้อมูล และ % เปลี่ยนแปลงจากปีก่อน</p>
          </div>
        </div>
        <div class="table-scroll"><table class="data-table compact-table" id="annualTable"></table></div>
      </article>
    `;
    dataView.parentNode.insertBefore(section, dataView);

    const months = fyMonths.map((name, index) =>
      `<option value="${index}">${monthShort[name]}</option>`
    ).join('');
    document.getElementById('annualMetric').innerHTML = annualMetrics.map(key =>
      `<option value="${escapeHtml(key)}">${escapeHtml(key)}</option>`
    ).join('');
    document.getElementById('annualStartMonth').innerHTML = months;
    document.getElementById('annualEndMonth').innerHTML = months;
    document.getElementById('annualMetric').value = 'OP visit';
    document.getElementById('annualStartMonth').value = '0';
    document.getElementById('annualEndMonth').value = '11';

    document.getElementById('annualMetric').addEventListener('change', renderAnnualComparison);
    document.getElementById('annualStartMonth').addEventListener('change', function () {
      const start = Number(this.value);
      const end = document.getElementById('annualEndMonth');
      if (Number(end.value) < start) end.value = this.value;
      renderAnnualComparison();
    });
    document.getElementById('annualEndMonth').addEventListener('change', function () {
      const end = Number(this.value);
      const start = document.getElementById('annualStartMonth');
      if (end < Number(start.value)) start.value = this.value;
      renderAnnualComparison();
    });
  }

  function installDoughnutPercentLabels() {
    if (!window.Chart || Chart.registry.plugins.get('spdDoughnutPercentLabels')) return;
    Chart.register({
      id: 'spdDoughnutPercentLabels',
      afterDatasetsDraw(chart) {
        if (chart.config.type !== 'doughnut') return;
        const values = (chart.data.datasets[0]?.data || []).map(value => Number(value) || 0);
        const total = values.reduce((a, b) => a + b, 0);
        if (!total) return;

        const arcs = chart.getDatasetMeta(0).data;
        const ctx = chart.ctx;
        ctx.save();
        ctx.font = '600 12px Prompt, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = 'rgba(0,0,0,.3)';
        ctx.shadowBlur = 2;
        arcs.forEach((arc, index) => {
          const percent = values[index] / total * 100;
          if (!arc || percent <= 0) return;
          const angle = (arc.startAngle + arc.endAngle) / 2;
          const radius = (arc.innerRadius + arc.outerRadius) / 2;
          const x = arc.x + Math.cos(angle) * radius;
          const y = arc.y + Math.sin(angle) * radius;
          ctx.fillText(`${percent.toFixed(1)}%`, x, y);
        });
        ctx.restore();
      }
    });
  }

  function aggregateMetric(data, metric) {
    if (!data.length) return null;
    return averageMetrics.has(metric) ? avg(data, metric) : sum(data, metric);
  }

  function periodLabel(start, end) {
    return start === end ? monthShort[fyMonths[start]] :
      `${monthShort[fyMonths[start]]}–${monthShort[fyMonths[end]]}`;
  }

  function renderAnnualComparison() {
    const tableElement = document.getElementById('annualTable');
    if (!tableElement || typeof rows === 'undefined' || !Array.isArray(rows)) return;

    const metric = document.getElementById('annualMetric').value || 'OP visit';
    const start = Number(document.getElementById('annualStartMonth').value || 0);
    const end = Number(document.getElementById('annualEndMonth').value || 11);
    const period = periodLabel(start, end);
    const expectedMonths = end - start + 1;
    const years = [...new Set(rows.map(fiscalYear).filter(Boolean))]
      .sort((a, b) => Number(a) - Number(b));

    const groups = years.map(year => {
      const selected = sortRows(rows.filter(row =>
        fiscalYear(row) === year &&
        monthIndex(row['เดือน']) >= start &&
        monthIndex(row['เดือน']) <= end
      ));
      return { year, rows: selected, value: aggregateMetric(selected, metric) };
    });

    const priorFor = index => groups.slice(0, index).reverse().find(group => group.rows.length);
    const lastGroup = [...groups].reverse().find(group => group.rows.length);
    const lastIndex = lastGroup ? groups.indexOf(lastGroup) : -1;
    const lastPrior = lastIndex > 0 ? priorFor(lastIndex) : null;
    const lastChange = lastGroup && lastPrior ? pct(lastGroup.value, lastPrior.value) : null;
    const isPercent = metric === 'Bed rate' || metric === 'อัตราจ่าย/Adj.';
    const showValue = value => value === null || value === undefined ? '—' :
      `${money.format(value)}${isPercent ? '%' : ''}`;

    document.getElementById('annualCards').innerHTML = [
      ['KPI ที่เลือก', metric],
      ['ช่วงเดือนที่เปรียบเทียบ', period],
      ['ปีงบประมาณที่มีข้อมูล', String(groups.filter(group => group.rows.length).length)],
      ['เปลี่ยนแปลงจากปีก่อน', lastChange === null ? '—' :
        `${lastChange > 0 ? '▲ ' : lastChange < 0 ? '▼ ' : ''}${Math.abs(lastChange).toFixed(1)}%`]
    ].map(([label, value]) =>
      `<div class="analysis-card"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`
    ).join('');

    let table = `<thead><tr><th>ปีงบประมาณ</th><th>ช่วงเวลา</th><th>จำนวนเดือนที่มีข้อมูล</th><th>${escapeHtml(metric)}</th><th>ค่าเทียบปีก่อน</th><th>% เปลี่ยนแปลงจากปีก่อน</th></tr></thead><tbody>`;
    groups.forEach((group, index) => {
      const prior = priorFor(index);
      const change = prior && group.rows.length ? pct(group.value, prior.value) : null;
      const changeClass = change === null ? 'annual-change-flat' :
        change > 0 ? 'annual-change-up' : change < 0 ? 'annual-change-down' : 'annual-change-flat';
      table += `<tr>
        <td><span class="badge text-bg-primary">FY ${escapeHtml(group.year)}</span></td>
        <td>${escapeHtml(period)}</td>
        <td>${group.rows.length}/${expectedMonths}</td>
        <td>${showValue(group.value)}</td>
        <td>${prior ? showValue(prior.value) : '—'}</td>
        <td class="${changeClass}">${change === null ? '—' : `${change > 0 ? '▲ ' : change < 0 ? '▼ ' : ''}${Math.abs(change).toFixed(1)}%`}</td>
      </tr>`;
    });
    tableElement.innerHTML = table + '</tbody>';

    if (annualChart) annualChart.destroy();
    annualChart = new Chart(document.getElementById('annualChart'), {
      type: 'bar',
      data: {
        labels: groups.map(group => `FY ${group.year}`),
        datasets: [{
          label: metric,
          data: groups.map(group => group.value),
          backgroundColor: groups.map((group, index) => index === groups.length - 1 ? '#0ca678' : '#0f5bd7'),
          borderRadius: 7,
          maxBarThickness: 54
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: context =>
            `${metric}: ${context.raw === null ? 'ไม่มีข้อมูล' : showValue(context.raw)}`
          }}
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, grid: { color: 'rgba(100,120,150,.10)' } }
        }
      }
    });
  }

  function installNavigationAndRenderHooks() {
    const originalSwitchView = switchView;
    switchView = function (view) {
      originalSwitchView(view);
      if (view === 'annual') renderAnnualComparison();
    };

    const originalRender = render;
    render = function () {
      originalRender();
      renderAnnualComparison();
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    addStyles();
    addAnnualView();
    installDoughnutPercentLabels();
    installNavigationAndRenderHooks();
    renderAnnualComparison();
  });
})();
