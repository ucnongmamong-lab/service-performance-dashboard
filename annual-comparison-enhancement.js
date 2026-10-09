/*
 * Service Performance Dashboard enhancements
 * 1) Adds a dedicated annual KPI comparison view with monthly line series
 *    for every fiscal year (October–September).
 * 2) Shows percentage labels directly on the service-share doughnut chart.
 *
 * Install: upload this file to the repository root and include it AFTER app.js:
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
      .annual-filter-grid{display:grid;grid-template-columns:minmax(260px,520px);gap:13px}
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
    button.addEventListener('click', function () { switchView('annual'); });
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
        <div class="annual-filter-grid annual-filter-grid-single">
          <div class="filter-item">
            <label for="annualMetric"><i class="bi bi-speedometer2"></i> KPI ที่ต้องการเปรียบเทียบ</label>
            <select id="annualMetric"></select>
          </div>
        </div>
        <p class="annual-hint"><i class="bi bi-info-circle"></i> กราฟแสดงข้อมูลรายเดือนตั้งแต่ ต.ค.–ก.ย. โดยแต่ละเส้นแทนปีงบประมาณ เพื่อเปรียบเทียบเดือนเดียวกันระหว่างปี</p>
      </article>
      <div id="annualCards" class="analysis-kpi-grid"></div>
      <article class="panel mb-4">
        <div class="panel-header">
          <div>
            <h3><i class="bi bi-graph-up"></i> แนวโน้ม KPI รายเดือน เปรียบเทียบแต่ละปีงบประมาณ</h3>
            <p>แกนนอน: เดือน ต.ค.–ก.ย. • เส้นแต่ละสี: ปีงบประมาณ • เลือก KPI เพื่อเปลี่ยนกราฟ</p>
          </div>
        </div>
        <div class="chart-wrap chart-main"><canvas id="annualChart"></canvas></div>
      </article>
      <article class="panel mb-4">
        <div class="panel-header">
          <div>
            <h3><i class="bi bi-table"></i> สรุป KPI รายปี</h3>
            <p>สรุปทั้งปีงบประมาณ เพื่อประกอบการอ่านแนวโน้มรายเดือนในกราฟ</p>
          </div>
        </div>
        <div class="table-scroll"><table class="data-table compact-table" id="annualTable"></table></div>
      </article>
    `;
    dataView.parentNode.insertBefore(section, dataView);

    document.getElementById('annualMetric').innerHTML = annualMetrics.map(key =>
      `<option value="${escapeHtml(key)}">${escapeHtml(key)}</option>`
    ).join('');
    document.getElementById('annualMetric').value = 'OP visit';
    document.getElementById('annualMetric').addEventListener('change', renderAnnualComparison);
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
    const chartElement = document.getElementById('annualChart');
    if (!tableElement || !chartElement || typeof rows === 'undefined' || !Array.isArray(rows)) return;

    const metric = document.getElementById('annualMetric').value || 'OP visit';
    const years = [...new Set(rows.map(fiscalYear).filter(Boolean))]
      .sort((a, b) => Number(a) - Number(b));
    const isPercent = metric === 'Bed rate' || metric === 'อัตราจ่าย/Adj.';
    const showValue = value => value === null || value === undefined || !Number.isFinite(Number(value))
      ? '—' : `${money.format(Number(value))}${isPercent ? '%' : ''}`;

    const groups = years.map(year => {
      const yearRows = sortRows(rows.filter(row => fiscalYear(row) === year));
      return { year, rows: yearRows, value: aggregateMetric(yearRows, metric) };
    });

    const priorFor = index => groups.slice(0, index).reverse().find(group => group.rows.length);
    const lastGroup = [...groups].reverse().find(group => group.rows.length);
    const lastIndex = lastGroup ? groups.indexOf(lastGroup) : -1;
    const lastPrior = lastIndex > 0 ? priorFor(lastIndex) : null;
    const lastChange = lastGroup && lastPrior ? pct(lastGroup.value, lastPrior.value) : null;

    document.getElementById('annualCards').innerHTML = [
      ['KPI ที่เลือก', metric],
      ['รูปแบบกราฟ', 'รายเดือน ต.ค.–ก.ย.'],
      ['ปีงบประมาณที่มีข้อมูล', String(groups.filter(group => group.rows.length).length)],
      ['เปลี่ยนแปลงทั้งปีจากปีก่อน', lastChange === null ? '—' :
        `${lastChange > 0 ? '▲ ' : lastChange < 0 ? '▼ ' : ''}${Math.abs(lastChange).toFixed(1)}%`]
    ].map(([label, value]) =>
      `<div class="analysis-card"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`
    ).join('');

    let table = `<thead><tr><th>ปีงบประมาณ</th><th>จำนวนเดือนที่มีข้อมูล</th><th>${escapeHtml(metric)} (ทั้งปี)</th><th>ค่าเทียบปีก่อน</th><th>% เปลี่ยนแปลงจากปีก่อน</th></tr></thead><tbody>`;
    groups.forEach((group, index) => {
      const prior = priorFor(index);
      const change = prior && group.rows.length ? pct(group.value, prior.value) : null;
      const changeClass = change === null ? 'annual-change-flat' :
        change > 0 ? 'annual-change-up' : change < 0 ? 'annual-change-down' : 'annual-change-flat';
      table += `<tr>
        <td><span class="badge text-bg-primary">FY ${escapeHtml(group.year)}</span></td>
        <td>${group.rows.length}/12</td>
        <td>${showValue(group.value)}</td>
        <td>${prior ? showValue(prior.value) : '—'}</td>
        <td class="${changeClass}">${change === null ? '—' : `${change > 0 ? '▲ ' : change < 0 ? '▼ ' : ''}${Math.abs(change).toFixed(1)}%`}</td>
      </tr>`;
    });
    tableElement.innerHTML = table + '</tbody>';

    if (annualChart) annualChart.destroy();
    const colors = ['#0f5bd7', '#0ca678', '#6842d8', '#f59f00', '#e03131', '#1098ad', '#d63384', '#495057'];
    const monthLabels = fyMonths.map(month => monthShort[month]);
    const datasets = groups.map((group, index) => {
      const valuesByMonth = Array(12).fill(null);
      group.rows.forEach(row => {
        const indexInYear = monthIndex(row['เดือน']);
        if (indexInYear >= 0 && indexInYear < 12) {
          const value = num(row[metric]);
          valuesByMonth[indexInYear] = value === null ? null : value;
        }
      });
      const color = colors[index % colors.length];
      return {
        label: `ปีงบประมาณ ${group.year}`,
        data: valuesByMonth,
        borderColor: color,
        backgroundColor: color,
        pointBackgroundColor: color,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 3,
        tension: 0.25,
        spanGaps: false,
        fill: false
      };
    });

    annualChart = new Chart(chartElement, {
      type: 'line',
      data: { labels: monthLabels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, font: { family: 'Prompt', size: 11 } } },
          tooltip: { callbacks: { label: context =>
            `${context.dataset.label}: ${showValue(context.parsed.y)}`
          }}
        },
        scales: {
          x: { title: { display: true, text: 'เดือนในปีงบประมาณ' }, grid: { display: false } },
          y: { title: { display: true, text: metric }, grid: { color: 'rgba(100,120,150,.10)' } }
        }
      }
    });
  }

  function installNavigationAndRenderHooks() {
    const originalSwitchView = switchView;
    switchView = function (view) {
      originalSwitchView(view);

      // The original navigation only toggles the three built-in views.
      // Explicitly toggle every view so the injected annual view can appear.
      document.querySelectorAll('.view-section').forEach(section => {
        section.classList.toggle('d-none', section.id !== 'view-' + view);
      });

      if (view === 'annual') {
        // Chart.js needs a visible canvas to calculate responsive dimensions.
        requestAnimationFrame(() => renderAnnualComparison());
      }
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
