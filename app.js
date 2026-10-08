:root {
  --primary: #4e73df;
  --success: #1cc88a;
  --info: #36b9cc;
  --warning: #f6c23e;
  --danger: #e74a3b;
  --dark: #5a5c69;
  --bg: #f8f9fc;
}
body {
  background-color: var(--bg);
  color: var(--dark);
  font-family: 'Prompt', -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.navbar {
  background: linear-gradient(90deg, #4e73df 0%, #224abe 100%) !important;
}

/* เอฟเฟกต์การ์ด และเงา */
.card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 .5rem 1rem rgba(0,0,0,.08)!important;
}
.shadow-sm {
  box-shadow: 0 0.15rem 1.75rem 0 rgba(58, 59, 69, 0.1) !important;
}

/* ตกแต่งการ์ด KPI */
.kpi {
  border-left: 4px solid var(--primary) !important;
}
.kpi-color-0 { border-left-color: var(--primary) !important; }
.kpi-color-1 { border-left-color: var(--success) !important; }
.kpi-color-2 { border-left-color: var(--info) !important; }
.kpi-color-3 { border-left-color: var(--warning) !important; }
.kpi-color-4 { border-left-color: var(--danger) !important; }
.kpi-color-5 { border-left-color: #858796 !important; }

.kpi .label {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  margin-bottom: 0.25rem;
}
.kpi-color-0 .label { color: var(--primary); }
.kpi-color-1 .label { color: var(--success); }
.kpi-color-2 .label { color: var(--info); }
.kpi-color-3 .label { color: var(--warning); }
.kpi-color-4 .label { color: var(--danger); }
.kpi-color-5 .label { color: #858796; }

.kpi .value {
  font-size: 1.6rem;
  font-weight: 700;
  color: #5a5c69;
  margin-bottom: 0.2rem;
}
.kpi .sub {
  font-size: 0.75rem;
  color: #858796;
}

/* กราฟ และ ตาราง */
.chart-wrap {
  position: relative;
  height: 300px;
  width: 100%;
}
.table-responsive {
  max-height: 60vh;
  overflow-y: auto;
}
.table thead th {
  position: sticky;
  top: 0;
  background: #f8f9fc;
  color: #858796;
  font-weight: 700;
  font-size: 0.8rem;
  z-index: 2;
  border-bottom: 2px solid #e3e6f0;
  white-space: nowrap;
}
.table tbody td {
  font-size: 0.85rem;
  color: #5a5c69;
  vertical-align: middle;
  white-space: nowrap;
}

/* ปุ่ม และตัวช่วยตกแต่ง */
.nav-btn {
  border-radius: 20px;
  padding: 0.4rem 1.2rem;
  font-size: 0.9rem;
  font-weight: 500;
}
.nav-btn:not(.active) {
  color: var(--primary);
}
.delta-up { color: var(--success); font-weight: 600; }
.delta-down { color: var(--danger); font-weight: 600; }
.delta-flat { color: #858796; font-weight: 600; }
.rank-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.7rem 0;
  border-bottom: 1px solid #e3e6f0;
  font-size: 0.95rem;
}
.rank-row:last-child { border-bottom: none; }
.small-note { font-size: 0.8rem; color: #858796; text-align: center; padding: 1rem 0; }

/* Scrollbar สำหรับ Webkit */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

/* ปรับมุมมองสำหรับมือถือ */
@media(max-width: 767px) {
  .chart-wrap { height: 260px; }
  .kpi .value { font-size: 1.35rem; }
  .table-responsive { max-height: 50vh; }
}
