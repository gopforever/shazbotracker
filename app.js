const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const qs = new URLSearchParams(location.search);
const qEl = $("#q");
const statusEl = $("#status");
const tbody = $("#results tbody");

qEl.value = qs.get("q") || "2025 Score Rookie";

$("#go").addEventListener("click", () => doSearch());
qEl.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });

async function doSearch() {
  const q = qEl.value.trim();
  if (!q) return;
  const onlySports = $("#onlySports").checked ? 1 : 0;
  const withImage = $("#withImage").checked ? 1 : 0;
  statusEl.textContent = "Searching...";
  tbody.innerHTML = "";

  try {
    const url = `/.netlify/functions/scp?q=${encodeURIComponent(q)}&onlySports=${onlySports}&withImage=${withImage}`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Search failed (${res.status}): ${txt.slice(0,200)}`);
    }
    const data = await res.json();
    const items = data.products || [];
    statusEl.textContent = `${items.length} result(s)`;
    render(items);
  } catch (err) {
    console.error(err);
    statusEl.textContent = String(err.message || err);
  }
}

function render(items) {
  tbody.innerHTML = "";
  for (const it of items) {
    const tr = document.createElement("tr");

    const imgTd = document.createElement("td");
    const img = document.createElement("img");
    img.className = "thumb";
    img.alt = `${it['product-name']} thumbnail`;
    img.src = it.thumb ? `/.netlify/functions/img?u=${encodeURIComponent(it.thumb)}` : "/images/logo.png";
    imgTd.appendChild(img);

    const nameTd = document.createElement("td");
    nameTd.innerHTML = `<div class="name">${it['product-name']}</div>`;

    const consoleTd = document.createElement("td");
    consoleTd.innerHTML = `<span class="muted">${it['console-name'] || ""}</span>`;

    const idTd = document.createElement("td");
    idTd.textContent = it.id || "";

    const looseTd = document.createElement("td");
    if (typeof it['loose-price'] === "number") {
      looseTd.textContent = `$${(it['loose-price']/100).toFixed(2)}`;
    } else {
      looseTd.textContent = "—";
    }

    const gradedTd = document.createElement("td");
    if (typeof it['graded-price'] === "number") {
      gradedTd.textContent = `$${(it['graded-price']/100).toFixed(2)}`;
    } else if (typeof it['new-price'] === "number") {
      gradedTd.textContent = `$${(it['new-price']/100).toFixed(2)}`;
    } else {
      gradedTd.textContent = "—";
    }

    const releaseTd = document.createElement("td");
    releaseTd.textContent = it['release-date'] || "—";

    tr.append(imgTd, nameTd, consoleTd, idTd, looseTd, gradedTd, releaseTd);
    tbody.appendChild(tr);
  }
}

// auto-search on load
doSearch();
