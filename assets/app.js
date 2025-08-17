
const API = {
  search: async (q) => {
    const url = `/.netlify/functions/scp?q=${encodeURIComponent(q)}&withImage=1`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Search failed: ${r.status}`);
    return r.json();
  },
  product: async (id) => {
    const url = `/.netlify/functions/scp?id=${encodeURIComponent(id)}&withImage=1`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Lookup failed: ${r.status}`);
    return r.json();
  },
  zip: async ({ csv, filename = "inventory.csv", imageUrls = [] }) => {
    const r = await fetch('/.netlify/functions/zip', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ csv, filename, imageUrls })
    });
    if (!r.ok) throw new Error(`ZIP export failed: ${r.status}`);
    const blob = await r.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'export.zip';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }
};

// --- Storage helpers ---
const ST_KEYS = {
  inventory: 'shazbot_inventory',
  settings:  'shazbot_settings'
};

let state = {
  inv: [], // [{id, data: product, qty, gradeKey, image}]
  settings: {
    storageOn: true
  }
};

function canUseStorage(){
  try {
    const k = '__shazbot__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch { return false; }
}

function loadState(){
  const ok = canUseStorage();
  state.settings.storageOn = ok;
  if (!ok) return;
  const invRaw = localStorage.getItem(ST_KEYS.inventory);
  const stRaw = localStorage.getItem(ST_KEYS.settings);
  if (stRaw) try { state.settings = JSON.parse(stRaw); } catch {}
  if (invRaw) try { state.inv = JSON.parse(invRaw); } catch {}
}

function saveState(){
  if (!state.settings.storageOn) return;
  try {
    localStorage.setItem(ST_KEYS.inventory, JSON.stringify(state.inv));
    localStorage.setItem(ST_KEYS.settings, JSON.stringify(state.settings));
  } catch {}
}

function formatMoney(cents){
  if (cents == null || isNaN(cents)) return '—';
  return `$${(Number(cents)/100).toFixed(2)}`;
}

function productUnitFromGrade(p, gradeKey){
  const keys = [gradeKey, 'graded-price', 'bgs-10-price', 'loose-price', 'new-price'];
  for (const k of keys){
    if (k && p[k] != null && Number(p[k]) > 0) return Number(p[k]);
  }
  return 0;
}

function proxiedImg(u){
  if (!u) return '/images/placeholder-card.svg';
  return `/.netlify/functions/img?src=${encodeURIComponent(u)}`;
}

function renderCounts(){
  const items = state.inv.length;
  const qty = state.inv.reduce((s, it)=> s + (Number(it.qty)||0), 0);
  document.getElementById('counts').textContent = `— Items: ${items} • Qty: ${qty}`;
}

function renderInventory(){
  const tbody = document.getElementById('invBody');
  tbody.innerHTML = '';
  let total = 0;
  for (const it of state.inv){
    const p = it.data || {};
    const unit = productUnitFromGrade(p, it.gradeKey);
    const line = unit * (Number(it.qty)||0);
    total += line;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="cell-thumb"><img class="thumb" src="${proxiedImg(it.image)}" alt=""></td>
      <td>
        <div><strong>${p['product-name']||'Unknown'}</strong></div>
        <div class="muted">${p['console-name']||''}</div>
        <div class="muted" style="font-size:11px">ID: ${p.id||it.id}</div>
      </td>
      <td>
        <select class="select gradeSel">
          ${['graded-price','bgs-10-price','loose-price','new-price'].map(k=> `<option value="${k}" ${it.gradeKey===k?'selected':''}>${k}</option>`).join('')}
        </select>
      </td>
      <td><input type="number" min="1" class="qty" value="${it.qty||1}" /></td>
      <td class="right">${formatMoney(unit)}</td>
      <td class="right">${formatMoney(line)}</td>
      <td><button class="btn secondary removeBtn">Remove</button></td>
    `;
    tr.querySelector('.gradeSel').addEventListener('change', e=>{
      it.gradeKey = e.target.value;
      saveState(); renderInventory();
    });
    tr.querySelector('.qty').addEventListener('input', e=>{
      it.qty = Math.max(1, Number(e.target.value)||1);
      saveState(); renderInventory();
    });
    tr.querySelector('.removeBtn').addEventListener('click', ()=>{
      state.inv = state.inv.filter(x=> x !== it);
      saveState(); renderInventory();
    });
    tbody.appendChild(tr);
  }
  const invStatus = document.getElementById('invStatus');
  invStatus.innerHTML = `<span class="muted">Total Inventory Value:</span> <strong>${formatMoney(total)}</strong>`;
  renderCounts();
}

function renderResults(products){
  const wrap = document.getElementById('results');
  wrap.innerHTML = '';
  for (const p of products){
    const img = proxiedImg(p.image || p.thumb || p.image_url);
    const el = document.createElement('div');
    el.className = 'result';
    el.innerHTML = `
      <img class="thumb" loading="lazy" referrerpolicy="no-referrer" src="${img}" alt="">
      <div>
        <div><strong>${p['product-name']}</strong></div>
        <div class="muted">${p['console-name']||''}</div>
        <div class="muted" style="font-size:11px">ID: ${p.id}</div>
      </div>
      <div class="add">
        <button class="btn">Add</button>
      </div>
    `;
    el.querySelector('.btn').addEventListener('click', ()=>{
      const it = {
        id: p.id,
        data: p,
        qty: 1,
        gradeKey: 'graded-price',
        image: p.image || p.thumb || p.image_url || ''
      };
      // Avoid dupes: if exists, bump qty
      const existing = state.inv.find(x=> String(x.id) === String(it.id));
      if (existing){ existing.qty += 1; }
      else { state.inv.push(it); }
      saveState(); renderInventory();
    });
    wrap.appendChild(el);
  }
}

async function doSearch(){
  const q = document.getElementById('q').value.trim();
  const status = document.getElementById('searchStatus');
  if (!q){ status.textContent = 'Enter a query to search.'; return; }
  status.textContent = 'Searching…';
  try {
    const data = await API.search(q);
    const products = data.products || [];
    status.textContent = `${products.length} result(s)`;
    renderResults(products);
  } catch (err){
    status.innerHTML = `<span class="error">${String(err)}</span>`;
  }
}

async function refreshPrices(){
  const status = document.getElementById('invStatus');
  status.textContent = 'Refreshing prices…';
  for (const it of state.inv){
    try {
      const data = await API.product(it.id);
      const p = (data && data.product) ? data.product : data;
      if (p) {
        it.data = p;
        if (!it.image) it.image = p.image || p.thumb || p.image_url || '';
      }
    } catch {}
  }
  saveState(); renderInventory();
  status.innerHTML = `<span class="success">Prices updated.</span>`;
}

function toCSV(){
  const rows = [['id','qty','grade']];
  for (const it of state.inv){
    rows.push([it.id, it.qty, it.gradeKey]);
  }
  return rows.map(r => r.join(',')).join('\n');
}

function downloadCSV(name, text){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type:'text/csv'}));
  a.download = name;
  a.click();
  setTimeout(()=> URL.revokeObjectURL(a.href), 5000);
}

async function importCSV(file){
  const text = await file.text();
  const lines = text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const [h, ...rows] = lines;
  const heads = h.split(',').map(s=>s.trim().toLowerCase());
  const idxId = heads.indexOf('id');
  const idxQty = heads.indexOf('qty');
  const idxGrade = heads.indexOf('grade');
  for (const row of rows){
    const cols = row.split(',');
    const id = cols[idxId];
    const qty = Math.max(1, Number(cols[idxQty]||1));
    const grade = cols[idxGrade] || 'graded-price';
    try {
      const data = await API.product(id);
      const p = (data && data.product) ? data.product : data;
      state.inv.push({
        id, data: p, qty, gradeKey: grade, image: p.image || p.thumb || p.image_url || ''
      });
    } catch {}
  }
  saveState(); renderInventory();
}

function gatherImageUrls(){
  const urls = [];
  for (const it of state.inv){
    const u = it.image || (it.data && (it.data.image || it.data.thumb || it.data.image_url));
    if (u) urls.push(`/.netlify/functions/img?src=${encodeURIComponent(u)}`);
  }
  return urls;
}

// --- Wire up UI ---
document.getElementById('searchBtn').addEventListener('click', doSearch);
document.getElementById('q').addEventListener('keydown', (e)=> { if (e.key === 'Enter') doSearch(); });
document.getElementById('refreshBtn').addEventListener('click', refreshPrices);
document.getElementById('exportCsvBtn').addEventListener('click', ()=> downloadCSV('inventory.csv', toCSV()));
document.getElementById('exportZipBtn').addEventListener('click', ()=> API.zip({ csv: toCSV(), imageUrls: gatherImageUrls() }));
document.getElementById('importCsvBtn').addEventListener('click', ()=> document.getElementById('csvFile').click());
document.getElementById('csvFile').addEventListener('change', (e)=> { if (e.target.files[0]) importCSV(e.target.files[0]); });

// Storage toggle
const storageToggle = document.getElementById('storageToggle');
const storageState = document.getElementById('storageState');
storageToggle.addEventListener('change', ()=>{
  state.settings.storageOn = storageToggle.checked && canUseStorage();
  storageState.textContent = state.settings.storageOn ? 'On' : 'Off';
  if (!state.settings.storageOn){
    // Don't wipe existing, just stop saving
  } else {
    saveState();
  }
});

// init
loadState();
storageToggle.checked = state.settings.storageOn;
storageState.textContent = state.settings.storageOn ? 'On' : 'Off';
renderInventory();
