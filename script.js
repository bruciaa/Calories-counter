// Daily Calories Tracker — no backend required.
// Data model in localStorage under key 'calTrackV1'.
// Structure: { goals: number, entriesByDate: { 'YYYY-MM-DD': [ {id, name, cal, qty} ] } }

const $ = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));
const KEY = 'calTrackV1';
const todayISO = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

const state = loadState();
const datePicker = $('#datePicker');
const entriesTbody = $('#entriesTbody');
const progressBar = $('#progressBar');
const calSummary = $('#calSummary');
const pctSummary = $('#pctSummary');
const goalInput = $('#goalInput');
const saveGoalBtn = $('#saveGoalBtn');
const addForm = $('#addForm');
const importFile = $('#importFile');
const exportJsonBtn = $('#exportJsonBtn');
const exportCsvBtn = $('#exportCsvBtn');
const resetDayBtn = $('#resetDayBtn');
const themeToggle = $('#themeToggle');
const themeLabel = $('#themeLabel');

let weeklyChart;

init();

function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { goals: 2400, entriesByDate: {} };
}

function saveState() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function init() {
  // Theme
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const storedTheme = localStorage.getItem('theme') || (prefersDark ? 'dark' : 'light');
  document.documentElement.classList.toggle('dark', storedTheme === 'dark');
  themeLabel.textContent = storedTheme === 'dark' ? 'Light' : 'Dark';
  themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeLabel.textContent = isDark ? 'Light' : 'Dark';
  });

  datePicker.value = todayISO();
  goalInput.value = state.goals || 2400;

  datePicker.addEventListener('change', renderAll);
  saveGoalBtn.addEventListener('click', () => {
    const v = Number(goalInput.value) || 0;
    state.goals = v;
    saveState();
    renderAll();
  });

  // Quick-add
  $$('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const data = JSON.parse(btn.dataset.quick);
      addEntry(data.name, data.cal, data.qty);
    });
  });

  // Add
  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#foodName').value.trim();
    const cal = Number($('#foodCalories').value);
    const qty = Number($('#foodQty').value);
    if (!name || cal <= 0 || qty <= 0) return;
    addEntry(name, cal, qty);
    addForm.reset();
    $('#foodQty').value = 1;
    $('#foodName').focus();
  });

  // Import/Export
  exportJsonBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `calories-backup-${Date.now()}.json`);
  });

  exportCsvBtn.addEventListener('click', () => {
    const csv = toCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadBlob(blob, `calories-${Date.now()}.csv`);
  });

  importFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const obj = JSON.parse(text);
      if (!obj.entriesByDate) throw new Error('Invalid file');
      localStorage.setItem(KEY, JSON.stringify(obj));
      Object.assign(state, obj);
      alert('Import successful!');
      renderAll();
    } catch (err) {
      alert('Import failed: ' + err.message);
    } finally {
      importFile.value = '';
    }
  });

  resetDayBtn.addEventListener('click', () => {
    const d = datePicker.value;
    if (confirm(`Clear all entries for ${d}?`)) {
      state.entriesByDate[d] = [];
      saveState();
      renderAll();
    }
  });

  renderAll();
}

function addEntry(name, cal, qty) {
  const d = datePicker.value;
  const arr = state.entriesByDate[d] || (state.entriesByDate[d] = []);
  arr.push({ id: crypto.randomUUID(), name, cal, qty });
  saveState();
  renderAll();
}

function deleteEntry(id) {
  const d = datePicker.value;
  const arr = state.entriesByDate[d] || [];
  const idx = arr.findIndex(e => e.id === id);
  if (idx >= 0) arr.splice(idx, 1);
  saveState();
  renderAll();
}

function updateQty(id, newQty) {
  const d = datePicker.value;
  const arr = state.entriesByDate[d] || [];
  const it = arr.find(e => e.id === id);
  if (it) {
    it.qty = Math.max(1, Number(newQty)||1);
    saveState();
    renderAll();
  }
}

function getTotalsFor(dateStr) {
  const arr = state.entriesByDate[dateStr] || [];
  const total = arr.reduce((s, e) => s + e.cal * e.qty, 0);
  return { total, arr };
}

function renderAll() {
  renderTable();
  renderSummary();
  renderChart();
}

function renderTable() {
  const d = datePicker.value;
  const { arr } = getTotalsFor(d);
  entriesTbody.innerHTML = '';

  if (arr.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="py-4 opacity-60" colspan="5">No entries yet. Add something above.</td>`;
    entriesTbody.appendChild(tr);
    return;
  }

  for (const it of arr) {
    const tr = document.createElement('tr');
    tr.className = "border-t border-white/40 dark:border-white/10";
    tr.innerHTML = `
      <td class="py-3 font-medium">${escapeHtml(it.name)}</td>
      <td class="py-3">${it.cal}</td>
      <td class="py-3">
        <button class="px-2 rounded-lg border border-white/40 dark:border-white/10" data-dec="${it.id}">−</button>
        <input data-qty="${it.id}" class="w-14 mx-1 text-center px-2 py-1 rounded-lg bg-white/70 dark:bg-white/5 border border-white/40 dark:border-white/10" value="${it.qty}" />
        <button class="px-2 rounded-lg border border-white/40 dark:border-white/10" data-inc="${it.id}">+</button>
      </td>
      <td class="py-3">${it.cal * it.qty}</td>
      <td class="py-3 text-right">
        <button class="px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700" data-del="${it.id}">Delete</button>
      </td>
    `;
    entriesTbody.appendChild(tr);
  }

  // Wire controls
  $$('[data-del]').forEach(b => b.addEventListener('click', () => deleteEntry(b.dataset.del)));
  $$('[data-inc]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.inc; const input = $(`[data-qty="${id}"]`);
    input.value = Number(input.value) + 1; updateQty(id, input.value);
  }));
  $$('[data-dec]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.dec; const input = $(`[data-qty="${id}"]`);
    input.value = Math.max(1, Number(input.value) - 1); updateQty(id, input.value);
  }));
  $$('[data-qty]').forEach(inp => inp.addEventListener('change', () => updateQty(inp.dataset.qty, inp.value)));
}

function renderSummary() {
  const d = datePicker.value;
  const { total } = getTotalsFor(d);
  const goal = Number(state.goals) || 0;
  const pct = goal ? Math.min(100, Math.round((total / goal) * 100)) : 0;
  progressBar.style.width = `${pct}%`;
  calSummary.textContent = `${total} / ${goal} kcal`;
  pctSummary.textContent = `${pct}%`;
}

function renderChart() {
  const labels = [];
  const data = [];
  const today = new Date(datePicker.value);
  // Build last 7 days including selected date
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const key = d.toLocaleDateString('en-CA');
    labels.push(key.slice(5)); // MM-DD
    data.push(getTotalsFor(key).total);
  }
  const ctx = document.getElementById('weeklyChart');
  if (weeklyChart) weeklyChart.destroy();
  weeklyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'kcal', data }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}

function toCSV() {
  const rows = [['date','name','kcal','qty','total']];
  for (const [date, arr] of Object.entries(state.entriesByDate)) {
    for (const it of arr) {
      rows.push([date, it.name, it.cal, it.qty, it.cal*it.qty]);
    }
  }
  return rows.map(r => r.map(s => `"${String(s).replace(/"/g,'""')}"`).join(',')).join('\n');
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// PWA lite: cache static files for offline use
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}
