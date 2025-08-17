(() => {
  const $ = (sel, el=document) => el.querySelector(sel);
  const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));
  const fmt = (n) => `$${(+n||0).toLocaleString()}`;

  const KEY = "shazbot:collection:v2";
  function loadCollection() {
    try {
      const v2 = localStorage.getItem(KEY);
      if (v2) return JSON.parse(v2);
      const v1 = localStorage.getItem("collection") || localStorage.getItem("cards");
      if (v1) { localStorage.setItem(KEY, v1); return JSON.parse(v1); }
    } catch {}
    return {};
  }
  function saveCollection(state) { localStorage.setItem(KEY, JSON.stringify(state)); }
  let COLLECTION = loadCollection();

  function storageBadge() {
    try {
      const used = new Blob([localStorage.getItem(KEY)||""]).size;
      const pct = (used/5_000_000*100).toFixed(1);
      $("#storageBadge").textContent = `Storage: ${used.toLocaleString()} / 5,000,000 bytes (${pct}%)`;
    } catch { $("#storageBadge").textContent = "Storage: —"; }
  }

  async function doSearch() {
    const q = $("#query").value.trim();
    if (!q) return;
    $("#searchStatus").textContent = "Searching…";
    $("#results").innerHTML = "";
    try {
      const url = `/.netlify/functions/scp?path=/api/products&q=${encodeURIComponent(q)}&withImage=1&imageLimit=60`;
      const r = await fetch(url);
      const data = await r.json();
      const items = Array.isArray(data.products) ? data.products : [];
      $("#searchStatus").textContent = `${items.length} result(s)`;
      renderResults(items);
    } catch (e) {
      $("#searchStatus").textContent = "Search failed.";
      console.error(e);
    }
  }

  function renderResults(items) {
    const tbody = $("#results");
    tbody.innerHTML = "";
    for (const p of items) {
      const tr = document.createElement("tr");

      // Thumbnail
      const thumb = p.thumb || p["image-url"] || "";
      const thumbTd = document.createElement("td");
      thumbTd.innerHTML = thumb
        ? `<img class="thumb" alt="" loading="lazy" src="/.netlify/functions/img?url=${encodeURIComponent(thumb)}">`
        : `<div class="thumb fallback">?</div>`;
      tr.appendChild(thumbTd);

      // Card cell
      const cardTd = document.createElement("td");
      const title = p["product-name"] || "—";
      const sub = p["console-name"] || "";
      const pageUrl = p.pageUrl || "#";
      cardTd.innerHTML = `<div class="card-cell">
        ${thumb ? "" : ""}
        <div>
          <a href="${pageUrl}" target="_blank" rel="noreferrer">${title}</a>
          <div class="muted small">${sub}</div>
        </div>
      </div>`;
      tr.appendChild(cardTd);

      // Prices
      const loose = p["loose-price"] ?? 0;
      const np = p["new-price"] ?? 0;
      const graded = p["graded-price"] ?? 0;
      for (const v of [loose, np, graded]) {
        const td = document.createElement("td");
        td.className = "num";
        td.textContent = fmt(v);
        tr.appendChild(td);
      }

      // Sales
      const salesTd = document.createElement("td");
      salesTd.className = "num";
      salesTd.textContent = (p["sales-volume"] ?? "—").toString();
      tr.appendChild(salesTd);

      // Action
      const act = document.createElement("td");
      const btn = document.createElement("button");
      btn.textContent = "Add";
      btn.onclick = () => addToInventory(p);
      act.appendChild(btn);
      tr.appendChild(act);

      tbody.appendChild(tr);
    }
  }

  function addToInventory(p) {
    const id = String(p.id || "");
    if (!id) return;
    const prev = COLLECTION[id] || { id, qty: 0, grade: "graded-price" };
    COLLECTION[id] = {
      ...prev,
      qty: prev.qty + 1,
      title: p["product-name"],
      consoleName: p["console-name"],
      thumb: p.thumb || p["image-url"] || "",
      pageUrl: p.pageUrl || "",
      // stash prices so inventory can be valued without another search
      prices: {
        "loose-price": p["loose-price"] ?? 0,
        "new-price": p["new-price"] ?? 0,
        "graded-price": p["graded-price"] ?? 0,
        "bgs-10-price": p["bgs-10-price"] ?? 0
      }
    };
    saveCollection(COLLECTION);
    renderInventory();
  }

  function renderInventory() {
    const tbody = $("#inventory");
    tbody.innerHTML = "";
    let grand = 0;

    const keys = Object.keys(COLLECTION);
    for (const id of keys) {
      const it = COLLECTION[id];
      const tr = document.createElement("tr");

      // thumb
      const thumbTd = document.createElement("td");
      thumbTd.innerHTML = it.thumb
        ? `<img class="thumb" alt="" loading="lazy" src="/.netlify/functions/img?url=${encodeURIComponent(it.thumb)}">`
        : `<div class="thumb fallback">?</div>`;
      tr.appendChild(thumbTd);

      // card info
      const cardTd = document.createElement("td");
      cardTd.innerHTML = `<div class="card-cell">
        <div>
          <a href="${it.pageUrl || "#"}" target="_blank" rel="noreferrer">${it.title || id}</a>
          <div class="muted small">${it.consoleName || ""} · <span class="muted small">ID ${id}</span></div>
        </div>
      </div>`;
      tr.appendChild(cardTd);

      // qty
      const qtyTd = document.createElement("td");
      qtyTd.className = "num";
      qtyTd.innerHTML = `<input class="qty" type="number" min="0" value="${it.qty}" />`;
      const qtyInput = $("input", qtyTd);
      qtyInput.onchange = () => {
        const n = Math.max(0, parseInt(qtyInput.value || "0", 10));
        it.qty = n; if (n === 0) delete COLLECTION[id];
        saveCollection(COLLECTION); renderInventory();
      };
      tr.appendChild(qtyTd);

      // grade key override
      const gradeTd = document.createElement("td");
      gradeTd.innerHTML = `<select class="select">
        ${["graded-price","bgs-10-price","loose-price","new-price"].map(k => `<option ${it.grade===k?"selected":""} value="${k}">${k}</option>`).join("")}
      </select>`;
      const gradeSelect = $("select", gradeTd);
      gradeSelect.onchange = () => { it.grade = gradeSelect.value; saveCollection(COLLECTION); renderInventory(); };
      tr.appendChild(gradeTd);

      // unit + total
      const unit = (it.prices?.[it.grade] ?? 0);
      const total = unit * (it.qty || 0);
      grand += total;

      const unitTd = document.createElement("td"); unitTd.className = "num"; unitTd.textContent = fmt(unit); tr.appendChild(unitTd);
      const totalTd = document.createElement("td"); totalTd.className = "num"; totalTd.textContent = fmt(total); tr.appendChild(totalTd);

      // remove
      const rmTd = document.createElement("td");
      const rm = document.createElement("button");
      rm.className = "btn remove";
      rm.textContent = "Remove";
      rm.onclick = () => { delete COLLECTION[id]; saveCollection(COLLECTION); renderInventory(); };
      rmTd.appendChild(rm);
      tr.appendChild(rmTd);

      tbody.appendChild(tr);
    }
    $("#grandTotal").textContent = fmt(grand);
    storageBadge();
  }

  function exportZip() {
    const ids = Object.keys(COLLECTION);
    if (!ids.length) { alert("No items in inventory."); return; }
    const name = "inventory";
    const a = document.createElement("a");
    a.href = `/.netlify/functions/zip?ids=${encodeURIComponent(ids.join(","))}&name=${encodeURIComponent(name)}`;
    a.download = `${name}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function importCsv(file) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return;
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    const idxId = headers.indexOf("id");
    const idxQty = headers.indexOf("qty");
    const idxGrade = headers.indexOf("grade");
    for (let i=1;i<lines.length;i++) {
      const cols = lines[i].split(",");
      const id = (cols[idxId]||"").trim();
      if (!id) continue;
      const qty = parseInt((cols[idxQty]||"1").trim(), 10) || 1;
      const grade = (cols[idxGrade]||"graded-price").trim();
      const prev = COLLECTION[id] || { id, qty: 0, grade };
      COLLECTION[id] = { ...prev, qty: (prev.qty + qty), grade };
    }
    saveCollection(COLLECTION);
    renderInventory();
  }

  // Events
  $("#searchForm").addEventListener("submit", (e) => { e.preventDefault(); doSearch(); });
  $("#exportZip").addEventListener("click", exportZip);
  $("#clearInv").addEventListener("click", () => { if (confirm("Clear inventory?")) { COLLECTION = {}; saveCollection(COLLECTION); renderInventory(); }});
  $("#csvInput").addEventListener("change", (e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ""; });

  // init
  storageBadge();
  renderInventory();
})();
