// BUILDSTAMP: 2026-02-16 20:23:50 | bytes=92345
console.log('TMS app.js loaded (buildstamp)');
// ---------- Google Maps (client-side) for Trip miles ----------
let __gmapsLoadPromise = null;
function ensureGoogleMapsLoaded() {
  // In this build, the Google Maps script is embedded in index.html.
  // So we simply verify it's available.
  if (window.google && window.google.maps && window.google.maps.DirectionsService) return Promise.resolve(true);
  if (__gmapsLoadPromise) return __gmapsLoadPromise;
  __gmapsLoadPromise = Promise.reject(new Error("gmaps_not_loaded"));
  return __gmapsLoadPromise;
}
function calcRouteMiles(origin, destination) {
  return new Promise((resolve, reject) => {
    if (!origin || !destination) return reject(new Error("missing_origin_destination"));
    try {
      const svc = new google.maps.DirectionsService();
      svc.route(
        { origin, destination, travelMode: google.maps.TravelMode.DRIVING },
        (res, status) => {
          if (status !== "OK" || !res || !res.routes || !res.routes.length) {
            return reject(new Error("route_failed_" + status));
          }
          let meters = 0;
          const legs = res.routes[0].legs || [];
          for (const leg of legs) meters += (leg.distance && leg.distance.value) ? leg.distance.value : 0;
          const miles = meters / 1609.344;
          resolve(miles);
        }
      );
    } catch (e) {
      reject(e);
    }
  });
}
// Trucking Made Simple — Blueprint app.js (Plain Lock friendly, no-jQuery)
// NOTE: This file is intentionally "single-init" (one DOMContentLoaded) to prevent double-binding bugs.
// ---------- Tiny helpers ----------
const $ = (id) => document.getElementById(id);
const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));
const money = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return "$0.00";
  return x.toLocaleString(undefined, { style: "currency", currency: "USD" });
};

// Round to cents to avoid floating-point penny drift in Gate math
const round2 = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round((x + Number.EPSILON) * 100) / 100;
};

// Number formatter used by Fleet and other modules
// fmtNum(1234.5) -> "1,234.50"
const fmtNum = (n, digits = 2) => {
  const x = Number(n);
  if (!Number.isFinite(x)) {
    return (0).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  return x.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
};
const num = (id, fallback = 0) => {
  const el = $(id);
  if (!el) return fallback;
  const v = Number(el.value);
  return Number.isFinite(v) ? v : fallback;
};
const str = (id) => ($(id)?.value || "").trim();
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (val) => {
  if (val == null) return "";
  // Allow Date objects
  if (val instanceof Date && !isNaN(val)) {
    const mm = String(val.getMonth() + 1).padStart(2, "0");
    const dd = String(val.getDate()).padStart(2, "0");
    const yy = val.getFullYear();
    return `${mm}/${dd}/${yy}`;
  }
  const s = String(val).trim();
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${m}/${d}/${y}`;
  }
  // m/d/yyyy or mm/dd/yyyy
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [m, d, y] = s.split("/");
    return `${m.padStart(2,"0")}/${d.padStart(2,"0")}/${y}`;
  }
  const dt = new Date(s);
  if (!isNaN(dt)) {
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    const yy = dt.getFullYear();
    return `${mm}/${dd}/${yy}`;
  }
  return s;
};
// Backwards-compatible alias (Fleet module expects formatDate)
const formatDate = fmtDate;

const escapeHtml = (s) => String(s)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");


// ---------- Scenario scratch (not saved) ----------
let lastScenarioOut = null;
let lastScenarioInputs = null;

// ---------- LocalStorage keys ----------
const LS_SETTINGS = "tms_settings_v1";
const LS_LOADS = "tms_actual_loads_v1";
const LS_TRIPS = "tms_trips_v1";
const LS_INVOICE_COUNTER = "tms_invoice_counter_v1";
const LS_ACTIVE_TRIP_ID = "tms_active_trip_id_v1";
const LS_REMIT_INFO = "tms_remit_info_v1";
const LS_SELECTED_LOAD_INDEX = "tms_selected_load_index_v1";
const LS_TRIP_PICKUP_ADDRS = "tms_trip_pickup_addrs_v1";
const LS_TRIP_DELIVERY_ADDRS = "tms_trip_delivery_addrs_v1";

const LS_FLEET_DRIVERS = "tms_fleet_drivers_v1";
const LS_FLEET_SETTINGS = "tms_fleet_settings_v1";
const LS_FLEET_SETTLEMENTS = "tms_fleet_settlements_v1";
// ---------- Storage ----------
function getSettings() {
  try { return JSON.parse(localStorage.getItem(LS_SETTINGS) || "null"); }
  catch { return null; }
}
function saveSettings(obj) {
  localStorage.setItem(LS_SETTINGS, JSON.stringify(obj));
}
function readCompanyInfoFromUI() {
  return {
    ownerName: (document.getElementById("s_ownerName")?.value || "").trim(),
    companyName: (document.getElementById("s_companyName")?.value || "").trim(),
    mcNumber: (document.getElementById("s_mcNumber")?.value || "").trim(),
    dotNumber: (document.getElementById("s_dotNumber")?.value || "").trim(),
    truckNumber: (document.getElementById("s_truckNumber")?.value || "").trim(),
    trailerNumber: (document.getElementById("s_trailerNumber")?.value || "").trim(),
    companyPhone: (document.getElementById("s_companyPhone")?.value || "").trim(),
    companyEmail: (document.getElementById("s_companyEmail")?.value || "").trim(),
  };
}
function writeCompanyInfoToUI(settings) {
  const c = (settings && settings.company) ? settings.company : {};
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ""; };
  setVal("s_ownerName", c.ownerName);
  setVal("s_companyName", c.companyName);
  setVal("s_mcNumber", c.mcNumber);
  setVal("s_dotNumber", c.dotNumber);
  setVal("s_truckNumber", c.truckNumber);
  setVal("s_trailerNumber", c.trailerNumber);
  setVal("s_companyPhone", c.companyPhone);
  setVal("s_companyEmail", c.companyEmail);
}
function hookCompanyInfoAutosave() {
  const ids = ["s_ownerName","s_companyName","s_mcNumber","s_dotNumber","s_truckNumber","s_trailerNumber","s_companyPhone","s_companyEmail"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => {
      const s = getSettings() || {};
      s.company = readCompanyInfoFromUI();
      saveSettings(s);
    });
  });
}
function getCompanyInfoSafe() {
  const s = getSettings() || {};
  const c = s.company || {};
  return {
    ownerName: c.ownerName || "[Your Name]",
    companyName: c.companyName || "[Your Company]",
    mcNumber: c.mcNumber || "[MC Number]",
    dotNumber: c.dotNumber || "[DOT Number]",
    companyPhone: c.companyPhone || "[Phone Number]",
    companyEmail: c.companyEmail || "[Your Email]",
  };
}
function getLoads() {
  try { return JSON.parse(localStorage.getItem(LS_LOADS) || "[]"); }
  catch { return []; }
}
function saveLoads(arr) {
  localStorage.setItem(LS_LOADS, JSON.stringify(arr));
}
function getTrips() {
  try { return JSON.parse(localStorage.getItem(LS_TRIPS) || "[]"); }
  catch { return []; }
}
function saveTrips(arr) {
  localStorage.setItem(LS_TRIPS, JSON.stringify(arr || []));
}

// ---------- Fleet (Drivers + Settlements) ----------
function getFleetDrivers(){
  try { return JSON.parse(localStorage.getItem(LS_FLEET_DRIVERS) || "[]"); }
  catch { return []; }
}
function saveFleetDrivers(arr){
  localStorage.setItem(LS_FLEET_DRIVERS, JSON.stringify(arr || []));
}
function getFleetSettings(){
  try { return JSON.parse(localStorage.getItem(LS_FLEET_SETTINGS) || "null"); }
  catch { return null; }
}
function saveFleetSettings(obj){
  localStorage.setItem(LS_FLEET_SETTINGS, JSON.stringify(obj || {}));
}

// Fleet settings (isolated) — SAFE defaults (does not touch core Settings)
function getFleetSettingsSafe(){
  const cur = getFleetSettings() || {};
  return {
    carrierMode: !!cur.carrierMode,
    companyPayBasis: (cur.companyPayBasis === "gross") ? "gross" : "net",
    weekStart: (cur.weekStart === "SUN") ? "SUN" : "MON",
  };
}
function setFleetSettingsSafe(patch){
  const cur = getFleetSettingsSafe();
  const next = Object.assign({}, cur, patch || {});
  saveFleetSettings(next);
  return next;
}
function getFleetSettlements(){
  try { return JSON.parse(localStorage.getItem(LS_FLEET_SETTLEMENTS) || "[]"); }
  catch { return []; }
}
function saveFleetSettlements(arr){
  localStorage.setItem(LS_FLEET_SETTLEMENTS, JSON.stringify(arr || []));
}




// ---------- Trip Files (Rate Confirmations) ----------
function bytesToNice(n) {
  const num = Number(n || 0);
  if (!num) return "0 B";
  const kb = 1024, mb = kb * 1024;
  if (num >= mb) return (num / mb).toFixed(2) + " MB";
  if (num >= kb) return (num / kb).toFixed(0) + " KB";
  return num + " B";
}

function getTripFilesSelectedTripId() {
  const sel = $("tripFilesTripSelect");
  const v = sel ? String(sel.value || "") : "";
  return v || getActiveTripId() || "";
}

function updateTripFilesTripSelect() {
  const sel = $("tripFilesTripSelect");
  if (!sel) return;

  const trips = getTrips().slice().sort((a,b) => {
    const ta = Date.parse(a.pickupDate || "") || (a.updatedAt || 0);
    const tb = Date.parse(b.pickupDate || "") || (b.updatedAt || 0);
    return tb - ta;
  });

  const activeId = getActiveTripId();
  const current = String(sel.value || "") || activeId;

  sel.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "— Select a Trip (Load) —";
  sel.appendChild(opt0);

  trips.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = formatTripOptionLabel(t);
    sel.appendChild(opt);
  });

  if (current && trips.some(t => t.id === current)) sel.value = current;
}

function getTripFilesArray(trip) {
  const arr = trip && Array.isArray(trip.files) ? trip.files : [];
  return arr;
}

function saveTripFilesArray(tripId, filesArr) {
  const trips = getTrips();
  const idx = trips.findIndex(t => t.id === tripId);
  if (idx < 0) return false;
  trips[idx].files = Array.isArray(filesArr) ? filesArr : [];
  trips[idx].updatedAt = Date.now();
  saveTrips(trips);
  return true;
}

function renderTripFilesList(tripId) {
  const out = $("tripFilesList");
  const hint = $("tripFilesHint");
  if (!out) return;

  if (!tripId) {
    out.innerHTML = "No files attached yet.";
    if (hint) hint.textContent = "Select a Trip to view/add attachments.";
    return;
  }

  const trip = findTripById(tripId);
  const label = trip ? formatTripOptionLabel(trip) : "(Trip not found)";
  if (hint) hint.textContent = "Attaching to: " + label;

  if (!trip) {
    out.innerHTML = "Trip not found. Select another Trip.";
    return;
  }

  const files = getTripFilesArray(trip);
  if (!files.length) {
    out.innerHTML = "No files attached yet.";
    return;
  }

  out.innerHTML = "";
  files.slice().sort((a,b) => (b.addedAt||0) - (a.addedAt||0)).forEach(f => {
    const row = document.createElement("div");
    row.className = "fileRow";

    const meta = document.createElement("div");
    meta.className = "fileMeta";

    const name = document.createElement("div");
    name.className = "fileName";
    const labelPrefix = (f.label || "").trim();
    name.textContent = (labelPrefix ? (labelPrefix + " — ") : "") + (f.name || "file");
    meta.appendChild(name);

    const sub = document.createElement("div");
    sub.className = "fileSub";
    const when = f.addedAt ? new Date(f.addedAt).toLocaleString() : "";
    sub.textContent = [bytesToNice(f.size), when].filter(Boolean).join(" • ");
    meta.appendChild(sub);

    const actions = document.createElement("div");
    actions.className = "fileActions";

    const openA = document.createElement("a");
    openA.href = f.dataUrl || "#";
    openA.target = "_blank";
    openA.rel = "noopener";
    openA.textContent = "Open";
    actions.appendChild(openA);

    const dlA = document.createElement("a");
    dlA.href = f.dataUrl || "#";
    dlA.download = f.name || "attachment";
    dlA.textContent = "Download";
    actions.appendChild(dlA);

    const rm = document.createElement("button");
    rm.type = "button";
    rm.textContent = "Remove";
    rm.addEventListener("click", () => {
      const next = getTripFilesArray(findTripById(tripId)).filter(x => x.id !== f.id);
      saveTripFilesArray(tripId, next);
      renderTripFilesList(tripId);
      // keep dropdown options fresh
      try { updateTripFilesTripSelect(); } catch {}
      try { renderTripList(); } catch {}
    });
    actions.appendChild(rm);

    row.appendChild(meta);
    row.appendChild(actions);
    out.appendChild(row);
  });
}

function initTripFilesUI() {
  const sel = $("tripFilesTripSelect");
  const inFiles = $("tripFilesInput");
  const inLabel = $("tripFilesLabel");
  const btnAdd = $("btnTripFilesAdd");
  const btnClear = $("btnTripFilesClear");

  if (sel) {
    sel.addEventListener("change", () => {
      const id = String(sel.value || "");
      if (id) {
        // Make it the Active Trip too (keeps Invoice consistent) WITHOUT overwriting entry inputs.
        setActiveTripId(id);
        updateActiveTripLabel();
        // highlight active in list
        const list = $("tripList");
        if (list) {
          list.querySelectorAll("details.list-item").forEach(d => d.classList.toggle("active", d.getAttribute("data-trip-id") === id));
        }
      }
      renderTripFilesList(getTripFilesSelectedTripId());
    });
  }

  if (btnAdd) {
    btnAdd.addEventListener("click", async () => {
      const tripId = getTripFilesSelectedTripId();
      if (!tripId) {
        alert("Select a Trip first (Attach files to:).");
        return;
      }
      const trip = findTripById(tripId);
      if (!trip) {
        alert("Trip not found. Select another Trip.");
        return;
      }

      const files = (inFiles && inFiles.files) ? Array.from(inFiles.files) : [];
      if (!files.length) {
        alert("Choose at least one file (PDF/Image).");
        return;
      }

      const label = (inLabel ? String(inLabel.value || "").trim() : "");

      // Guardrail: base64 in localStorage is limited. Encourage small files.
      const tooBig = files.find(f => (f.size || 0) > 2 * 1024 * 1024);
      if (tooBig) {
        const ok = confirm("One or more files are larger than ~2MB. Local storage may fail on big files. Continue anyway?");
        if (!ok) return;
      }

      const existing = getTripFilesArray(trip).slice();
      const readAsDataUrl = (file) => new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ""));
        r.onerror = () => reject(new Error("read_failed"));
        r.readAsDataURL(file);
      });

      try {
        for (const f of files) {
          const dataUrl = await readAsDataUrl(f);
          existing.push({
            id: "f_" + Math.random().toString(36).slice(2) + Date.now().toString(36),
            name: f.name || "attachment",
            label,
            mime: f.type || "",
            size: f.size || 0,
            dataUrl,
            addedAt: Date.now()
          });
        }
        saveTripFilesArray(tripId, existing);
        if (inFiles) inFiles.value = "";
        if (inLabel) inLabel.value = "";
        renderTripFilesList(tripId);
        // refresh dropdown labels (updatedAt might change ordering)
        try { updateTripFilesTripSelect(); } catch {}
        try { renderTripList(); } catch {}
      } catch (e) {
        console.warn("trip_files_add_failed", e);
        alert("Upload failed. This may happen if the file is too large for local storage.");
      }
    });
  }

  if (btnClear) {
    btnClear.addEventListener("click", () => {
      const tripId = getTripFilesSelectedTripId();
      if (!tripId) {
        alert("Select a Trip first (Attach files to:).");
        return;
      }
      const ok = confirm("Clear ALL attached files for this Trip?");
      if (!ok) return;
      saveTripFilesArray(tripId, []);
      renderTripFilesList(tripId);
      try { renderTripList(); } catch {}
    });
  }

  // Initial render
  try { updateTripFilesTripSelect(); } catch {}
  try { renderTripFilesList(getTripFilesSelectedTripId()); } catch {}
}
// ---------- Trip Address Autosave (Pickup/Delivery) ----------
function getStrList(key) {
  try {
    const raw = localStorage.getItem(key);
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr.filter(Boolean).map(x => String(x).trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}
function saveStrList(key, arr) {
  try { localStorage.setItem(key, JSON.stringify(Array.isArray(arr) ? arr : [])); } catch {}
}
function addUniqueToStrList(key, value, max = 30) {
  const v = String(value || "").trim();
  if (!v) return;
  const list = getStrList(key);
  const norm = v.toLowerCase();
  const filtered = list.filter(x => String(x).trim().toLowerCase() !== norm);
  filtered.unshift(v); // most recent first
  saveStrList(key, filtered.slice(0, Math.max(5, max)));
}
function renderDatalist(datalistId, items) {
  let dl = document.getElementById(datalistId);
  // If the datalist doesn't exist yet, create it so this feature works
  // even if the HTML wasn't updated.
  if (!dl) {
    dl = document.createElement("datalist");
    dl.id = datalistId;
    document.body.appendChild(dl);
  }
  dl.innerHTML = "";
  (items || []).forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    dl.appendChild(opt);
  });
}
function refreshTripAddressDatalists() {
  renderDatalist("dl_pickupAddrs", getStrList(LS_TRIP_PICKUP_ADDRS));
  renderDatalist("dl_deliveryAddrs", getStrList(LS_TRIP_DELIVERY_ADDRS));
}
function initTripAddressAutosave() {
  // Paint existing history into datalists
  refreshTripAddressDatalists();

  const pickupEl = document.getElementById("t_pickupAddr");
  const deliveryEl = document.getElementById("t_deliveryAddr");
  // Ensure inputs are wired to datalists even if HTML wasn't updated
  try { if (pickupEl) pickupEl.setAttribute("list", "dl_pickupAddrs"); } catch {}
  try { if (deliveryEl) deliveryEl.setAttribute("list", "dl_deliveryAddrs"); } catch {}
  if (!pickupEl && !deliveryEl) return;

  // Debounced input saver (prevents saving every keystroke)
  const makeDebouncedSaver = (key) => {
    let t = null;
    return (val) => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        addUniqueToStrList(key, val);
        refreshTripAddressDatalists();
      }, 650);
    };
  };

  const savePickupDebounced = makeDebouncedSaver(LS_TRIP_PICKUP_ADDRS);
  const saveDeliveryDebounced = makeDebouncedSaver(LS_TRIP_DELIVERY_ADDRS);

  // Save on input (debounced) + on blur (immediate)
  if (pickupEl) {
    pickupEl.addEventListener("input", () => savePickupDebounced(pickupEl.value));
    pickupEl.addEventListener("blur", () => { addUniqueToStrList(LS_TRIP_PICKUP_ADDRS, pickupEl.value); refreshTripAddressDatalists(); });
    pickupEl.addEventListener("change", () => { addUniqueToStrList(LS_TRIP_PICKUP_ADDRS, pickupEl.value); refreshTripAddressDatalists(); });
  }
  if (deliveryEl) {
    deliveryEl.addEventListener("input", () => saveDeliveryDebounced(deliveryEl.value));
    deliveryEl.addEventListener("blur", () => { addUniqueToStrList(LS_TRIP_DELIVERY_ADDRS, deliveryEl.value); refreshTripAddressDatalists(); });
    deliveryEl.addEventListener("change", () => { addUniqueToStrList(LS_TRIP_DELIVERY_ADDRS, deliveryEl.value); refreshTripAddressDatalists(); });
  }
}
// ================================
// Invoice Numbering (Auto)
// ================================
function getInvoiceCounter() {
  const raw = localStorage.getItem(LS_INVOICE_COUNTER);
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return 0;
}
function setInvoiceCounter(n) {
  const x = Math.max(0, Math.floor(Number(n) || 0));
  localStorage.setItem(LS_INVOICE_COUNTER, String(x));
}
// Determine next invoice number (uses counter if set; otherwise derives from saved trips)
function getNextInvoiceNumber() {
  let c = getInvoiceCounter();
  if (c > 0) {
    c += 1;
    setInvoiceCounter(c);
    return String(c);
  }
  // Derive from existing trips (max numeric invoiceNo or loadNumber that looks numeric)
  const trips = getTrips();
  let maxNum = 0;
  for (const t of trips) {
    const cand = (t && (t.invoiceNo || t.invoiceNumber || t.loadNumber)) ? String(t.invoiceNo || t.invoiceNumber || t.loadNumber) : "";
    const num = Number(cand.replace(/[^0-9]/g, ""));
    if (Number.isFinite(num) && num > maxNum) maxNum = num;
  }
  // Start at 1000 if nothing exists
  const next = (maxNum > 0 ? (maxNum + 1) : 1000);
  setInvoiceCounter(next);
  return String(next);
}
function ensureTripInvoiceNumber(trip) {
  if (!trip) return "";
  const existing = trip.invoiceNo || trip.invoiceNumber;
  if (existing && String(existing).trim()) return String(existing).trim();
  const inv = getNextInvoiceNumber();
  trip.invoiceNo = inv;
  return inv;
}

// ================================
// Actual ↔ Trips link (Read-only Actual)
// ================================
function formatTripOptionLabel(t) {
  const ln = (t.loadNumber || "").trim() || "(no load#)";
  const del = t.deliveryDate ? t.deliveryDate : "";
  const miles = Math.round((Number(t.deadheadMiles)||0) + (Number(t.loadedMiles)||0));
  const rate = Number(t.rate)||0;
  const parts = [ln];
  if (del) parts.push(del);
  if (miles) parts.push(miles + " mi");
  if (rate) parts.push(money(rate));
  return parts.join(" • ");
}

function refreshActualTripDropdown() {
  const sel = $("a_tripSelect");
  if (!sel) return;

  const trips = getTrips();
  const prev = sel.value || localStorage.getItem(LS_ACTIVE_TRIP_ID) || "";

  sel.innerHTML = '<option value="">— Select a saved load —</option>';
  trips.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = formatTripOptionLabel(t);
    sel.appendChild(opt);
  });

  // restore selection if possible
  if (prev) sel.value = prev;
}

function computeDotHoursAway(totalMiles) {
  // locked baseline: avg mph (settings), 30-min break every 8 driving hrs,
  // 15 min fuel stop per 500 miles, 10-hr sleeper per 11 driving hrs (proxy)
  const s = getSettings() || {};
  const mph = Math.min(65, Math.max(45, Number(s.avgMph ?? SETTINGS_DEFAULTS.avgMph)));

  const driveHrs = totalMiles > 0 ? (totalMiles / mph) : 0;

  const breakCount = Math.floor(driveHrs / 8);
  const breakHrs = breakCount * 0.5;

  const fuelStops = totalMiles > 0 ? Math.max(1, Math.ceil(totalMiles / 500)) : 0;
  const fuelHrs = fuelStops * 0.25;

  // Sleeper proxy: each additional 11 driving hours requires a 10-hr sleeper
  const drivingDays = driveHrs > 0 ? Math.ceil(driveHrs / 11) : 0;
  const sleeperHrs = Math.max(0, drivingDays - 1) * 10;

  const totalHrs = driveHrs + breakHrs + fuelHrs + sleeperHrs;

  return {
    driveHrs,
    breakHrs,
    fuelStops,
    fuelHrs,
    sleeperHrs,
    totalHrs,
    days: drivingDays
  };
}

// ---------- Gate-specific DOT proxy (stricter sleeper rule) ----------
// NOTE: Does NOT change the locked core computeDotHoursAway used elsewhere.
// Gate uses an 11-hr driving-day proxy: each additional 11 driving hrs requires a 10-hr sleeper.
function computeDotHoursAwayGate(totalMiles, mphOverride) {
  const s = getSettings() || {};
  const mphBase = Math.min(65, Math.max(45, Number(mphOverride ?? s.avgMph ?? SETTINGS_DEFAULTS.avgMph)));
  const driveHrs = totalMiles > 0 ? (totalMiles / mphBase) : 0;

  const breakCount = Math.floor(driveHrs / 8);
  const breakHrs = breakCount * 0.5;

  const fuelStops = totalMiles > 0 ? Math.max(1, Math.ceil(totalMiles / 500)) : 0;
  const fuelHrs = fuelStops * 0.25;

  // Sleeper proxy: 11 driving hours per day
  const drivingDays = driveHrs > 0 ? Math.ceil(driveHrs / 11) : 0;
  const sleeperHrs = Math.max(0, drivingDays - 1) * 10;

  // Total away time baseline = drive + breaks + fuel + sleeper
  const totalHrs = driveHrs + breakHrs + fuelHrs + sleeperHrs;
  return {
    mphUsed: mphBase,
    driveHrs,
    breakHrs,
    fuelStops,
    fuelHrs,
    sleeperHrs,
    drivingDays,
    totalHrs
  };
}

function sumReservesPct(settings) {
  const r = settings?.reserves || {};
  const vals = [r.factoring, r.tax, r.plates, r.ifta, r.maint, r.highway, r.tires]
    .map(v => Number(v) || 0)
    .filter(v => isFinite(v));
  const sum = vals.reduce((a,b)=>a+b,0);
  return Math.min(0.95, Math.max(0, sum));
}

function getMpgUsed(settings) {
  const lifetime = Number(settings?.lifetimeMpg || 0);
  if (lifetime && lifetime > 0.1) return lifetime;
  return Number(settings?.defaultMpg ?? SETTINGS_DEFAULTS.defaultMpg);
}

// NOTE: Do NOT redeclare `money` — it's already defined as a top-level helper.
// Gate modules should use the shared `money()` helper to avoid "Identifier already declared" crashes.


// Accepts either decimal (0.12) or percent (12) inputs. Returns decimal.
function normalizePctInput(v){
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  // If user typed 12 (meaning 12%), convert to 0.12.
  if (Math.abs(n) > 1) return n / 100;
  return n;
}

// ---------- Gate (original) calculation ----------
function calcGateShipperQuote() {
  const settings = getSettings() || SETTINGS_DEFAULTS;

  const laneMiles = Number(document.getElementById('g_laneMiles')?.value || 0);
  const repositionMiles = Number(document.getElementById('g_repositionMiles')?.value || 0);
  const tolls = Number(document.getElementById('g_tolls')?.value || 0);
  const fuelPrice = Number(document.getElementById('g_fuelPrice')?.value || 0);
  const riskPct = normalizePctInput(document.getElementById('g_riskPct')?.value || 0);
  const targetOtraf = Number(document.getElementById('g_targetOtraf')?.value || 0);

  const totalMiles = Math.max(0, laneMiles + repositionMiles);
  const mpg = getMpgUsed(settings);
  const gallons = mpg > 0 ? (totalMiles / mpg) : 0;
  const fuelCost = gallons * fuelPrice;

  const dot = computeDotHoursAwayGate(totalMiles);
  const hoursAway = dot.totalHrs;

  const monthlyFixed = Number(settings.household || 0) + Number(settings.businessFixed || 0);
  const dailyFixed = monthlyFixed / 30.4;
  const fixedTrip = dailyFixed * (hoursAway / 24);

  const baseCost = round2(fuelCost + tolls + fixedTrip);
  const riskAmount = round2(baseCost * Math.max(0, riskPct));
  const baseWithRisk = round2(baseCost + riskAmount);

  const reservesPct = sumReservesPct(settings);
  const requiredNet = round2(Math.max(0, targetOtraf) * hoursAway);

  // Solve for gross such that: gross*(1-reservesPct) - baseWithRisk >= requiredNet
  const denom = Math.max(0.01, 1 - reservesPct);
  const minGross = round2((baseWithRisk + requiredNet) / denom);
  const minRatePerMile = totalMiles > 0 ? (minGross / totalMiles) : 0;

  return {
    laneMiles,
    repositionMiles,
    totalMiles,
    mpg,
    gallons,
    fuelPrice,
    fuelCost,
    tolls,
    monthlyFixed,
    dailyFixed,
    fixedTrip,
    hoursAway,
    dot,
    riskPct,
    baseCost,
    riskAmount,
    baseWithRisk,
    reservesPct,
    requiredNet,
    minGross,
    minRatePerMile
  };
}

// Gate (original) UI helpers (read-only cost basis + lightweight rule notes)
function updateGateReadOnlyBasis() {
  const settings = getSettings() || SETTINGS_DEFAULTS;
  const monthlyFixed = Number(settings.household || 0) + Number(settings.businessFixed || 0);
  const dailyFixed = monthlyFixed / 30.4;
  const fixedPerHr = dailyFixed / 24;
  const mpg = getMpgUsed(settings);

  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = (typeof v === 'number') ? (Number.isFinite(v) ? v.toFixed(2) : '') : (v ?? '');
  };

  setVal('g_monthlyFixedRO', monthlyFixed);
  setVal('g_dailyFixedRO', dailyFixed);
  setVal('g_fixedPerHrRO', fixedPerHr);
  setVal('g_mpgUsedRO', mpg);
}

function renderGateAppliedRules() {
  const box = document.getElementById('g_appliedRules');
  if (!box) return;

  const region = (document.getElementById('g_regionPreset')?.value || '').trim();
  const deadzone = !!document.getElementById('g_deadzoneToggle')?.checked;
  const statesSel = document.getElementById('g_routeStates');
  const states = statesSel ? Array.from(statesSel.selectedOptions).map(o => o.value) : [];
  const weekendAuto = !!document.getElementById('g_weekendAuto')?.checked;
  const weekendDays = Number(document.getElementById('g_weekendDays')?.value || 0);
  const returnHomeMiles = Number(document.getElementById('g_returnHomeMiles')?.value || 0);
  const returnHomeDayAdd = Number(document.getElementById('g_returnHomeDayAdd')?.value || 0);

  const lines = [];
  if (region) {
    const label = {
      metro: 'Major Metro: traffic/slowdown assumed',
      northeast: 'Northeast/NYC: toll corridor + congestion assumed',
      mountain: 'Mountain: speed/MPG hit assumed',
      highfuel: 'High Fuel Area: fuel price risk assumed',
      deadzone: 'Dead Zone: reposition likely (outbound weak)',
    }[region] || region;
    lines.push(`• Region preset: ${label}`);
  }
  if (deadzone) lines.push('• Dead-zone reposition toggle: ON (reposition miles may be required)');
  if (states.length) lines.push(`• Route states selected: ${states.join(', ')}`);
  if (weekendAuto) lines.push(`• Weekend buffer auto: ON (default add ${weekendDays.toFixed(1)} day(s) when restricted)`);
  if (returnHomeMiles > 0 || returnHomeDayAdd > 0) lines.push(`• Specialty trailer positioning: includes return-home allowance (${returnHomeMiles.toFixed(0)} mi, +${returnHomeDayAdd.toFixed(1)} day(s))`);

  box.textContent = lines.length ? lines.join('\n') : '—';
}

// ---------- Gate (Internal) calculation ----------
function detectRegion(originState, destState) {
  const o = (originState || '').trim().toUpperCase();
  const d = (destState || '').trim().toUpperCase();
  const states = [o,d].filter(Boolean);

  const northeast = new Set(['NY','NJ','CT','MA','RI','PA','MD','DE']);
  const highFuel = new Set(['CA','NY','NJ','CT','MA','RI','WA','OR']);
  const mountain = new Set(['MT','CO','WY','UT','ID','NV','AZ','NM']);
  const deadzone = new Set(['ME','ND','SD','VT','NH']);

  if (states.some(s => northeast.has(s))) return 'northeast';
  if (states.some(s => mountain.has(s))) return 'mountain';
  if (states.some(s => deadzone.has(s))) return 'deadzone';
  if (states.some(s => highFuel.has(s))) return 'highfuel';
  return 'none';
}

function regionModifiers(region) {
  // Realistic mode defaults (defensible, not inflated)
  switch(region){
    case 'northeast':
      return { label: 'Northeast / NYC', mphMult: 0.88, mpgMult: 0.98, extraDelayHrs: 0.75, fuelAdder: 0.20, deadzoneMilesPct: 0.00 };
    case 'metro':
      return { label: 'Major Metro', mphMult: 0.90, mpgMult: 1.00, extraDelayHrs: 0.50, fuelAdder: 0.00, deadzoneMilesPct: 0.00 };
    case 'mountain':
      return { label: 'Mountain / Elevation', mphMult: 0.95, mpgMult: 0.93, extraDelayHrs: 0.25, fuelAdder: 0.00, deadzoneMilesPct: 0.00 };
    case 'deadzone':
      return { label: 'Dead Zone', mphMult: 1.00, mpgMult: 1.00, extraDelayHrs: 0.25, fuelAdder: 0.00, deadzoneMilesPct: 0.10 };
    case 'highfuel':
      return { label: 'High Fuel Region', mphMult: 1.00, mpgMult: 1.00, extraDelayHrs: 0.00, fuelAdder: 0.35, deadzoneMilesPct: 0.00 };
    case 'none':
    default:
      return { label: 'None', mphMult: 1.00, mpgMult: 1.00, extraDelayHrs: 0.00, fuelAdder: 0.00, deadzoneMilesPct: 0.00 };
  }
}

function calcGateInternal() {
  const settings = getSettings() || SETTINGS_DEFAULTS;

  const originState = String(document.getElementById('gi_originState')?.value || '');
  const destState = String(document.getElementById('gi_destState')?.value || '');
  const totalMilesRaw = Number(document.getElementById('gi_totalMiles')?.value || 0);

  const tolls = Number(document.getElementById('gi_tolls')?.value || 0);
  const fuelPriceIn = Number(document.getElementById('gi_fuelPrice')?.value || 0);

  const waitHrs = Number(document.getElementById('gi_waitHrs')?.value || 0);
  const detentionRate = Number(document.getElementById('gi_detentionRate')?.value || 100);

  // IMPORTANT: riskPct accepts DECIMAL (0.12) or PERCENT (12) and is normalized to decimal
  const riskPct = normalizePctInput(document.getElementById('gi_riskPct')?.value || 0);

  const targetOtraf = Number(document.getElementById('gi_targetOtraf')?.value || 0);
  const override = String(document.getElementById('gi_regionOverride')?.value || 'auto');

  // Region detection + modifiers
  const detected = detectRegion(originState, destState);
  const region = (override === 'auto') ? detected : override;
  const mod = regionModifiers(region);

  // Miles (dead-zone adds miles)
  const deadzoneAddMiles = (Number.isFinite(totalMilesRaw) ? totalMilesRaw : 0) * (Number(mod.deadzoneMilesPct) || 0);
  const totalMiles = Math.max(0, (Number.isFinite(totalMilesRaw) ? totalMilesRaw : 0) + deadzoneAddMiles);

  // Fuel (MPG + fuel price modifiers)
  const baseMpg = getMpgUsed(settings);
  const mpg = Math.max(0.1, baseMpg * (Number(mod.mpgMult) || 1));
  const fuelPrice = Math.max(0, (Number.isFinite(fuelPriceIn) ? fuelPriceIn : 0) + (Number(mod.fuelAdder) || 0));

  const gallons = totalMiles > 0 ? (totalMiles / mpg) : 0;
  const fuelCost = gallons * fuelPrice;

  // Time Away (DOT proxy + region delay)
  const baseMph = Number(settings.avgMph ?? SETTINGS_DEFAULTS.avgMph);
  const mphUsed = Math.min(65, Math.max(45, baseMph * (Number(mod.mphMult) || 1)));

  const dot = computeDotHoursAwayGate(totalMiles, mphUsed);
  const hoursAway = Math.max(0, Number(dot.totalHrs || 0) + (Number(mod.extraDelayHrs) || 0));

  // Detention (1 hr free)
  const detentionBillable = Math.max(0, (Number.isFinite(waitHrs) ? waitHrs : 0) - 1);
  const detentionCost = detentionBillable * Math.max(0, Number.isFinite(detentionRate) ? detentionRate : 0);

  // Fixed costs prorated by hours away
  const monthlyFixed = (Number(settings.household) || 0) + (Number(settings.businessFixed) || 0);
  const dailyFixed = monthlyFixed / 30.4;
  const fixedTrip = dailyFixed * (hoursAway / 24);

  // Base cost + risk buffer
  const baseCost = round2(fuelCost + Math.max(0, tolls) + fixedTrip + detentionCost);
  const riskAmount = round2(baseCost * Math.max(0, riskPct));
  const baseWithRisk = round2(baseCost + riskAmount);

  // Reserves % + required net goal
  const reservesPct = sumReservesPct(settings);
  const requiredNet = round2(Math.max(0, targetOtraf) * hoursAway);

  // Solve for gross so that:
  // gross*(1 - reservesPct) - baseWithRisk >= requiredNet
  const denom = Math.max(0.01, 1 - reservesPct);
  const minGross = round2((baseWithRisk + requiredNet) / denom);
  const minRatePerMile = totalMiles > 0 ? (minGross / totalMiles) : 0;

  return {
    originState: originState.trim().toUpperCase(),
    destState: destState.trim().toUpperCase(),
    override,
    detected,
    region,
    mod,

    totalMilesRaw,
    deadzoneAddMiles,
    totalMiles,

    baseMpg,
    mpg,
    fuelPriceIn,
    fuelPrice,
    gallons,
    fuelCost,

    tolls,
    waitHrs,
    detentionRate,
    detentionBillable,
    detentionCost,

    mphUsed,
    dot,
    hoursAway,

    monthlyFixed,
    dailyFixed,
    fixedTrip,

    riskPct,
    baseCost,
    riskAmount,
    baseWithRisk,

    reservesPct,
    requiredNet,
    minGross,
    minRatePerMile
  };
}

function loadTripIntoActual(tripId) {
  const trips = getTrips();
  const t = trips.find(x => x.id === tripId) || null;

  const hint = $("actualTripRefHint");
  if (!t) {
    if (hint) hint.textContent = "No trip selected.";
    // clear display fields
    ["a_loadNumber","a_brokerName","a_brokerAddr","a_brokerPhone","a_brokerEmail","a_shipperName","a_shipperAddr","a_consigneeName","a_consigneeAddr","a_deliveryDate","a_deadhead","a_loaded","a_tripMiles","a_fuelPrice","a_gallons","a_gross","a_hoursAway"].forEach(id=>{
      const el=$(id); if(!el) return; el.value=""; 
    });
    $("actualOut") && ($("actualOut").textContent="—");
    $("a_dotBreakdown") && ($("a_dotBreakdown").textContent="—");
    return null;
  }

  // Reset Actual add-ons when loading a new trip
  resetActualAddOnsUI();

  localStorage.setItem(LS_ACTIVE_TRIP_ID, t.id);

  const dead = Number(t.deadheadMiles)||0;
  const loaded = Number(t.loadedMiles)||0;
  const miles = dead + loaded;

  const fuelPrice = Number(t.fuelPrice)||0;
  const gallons = Number(t.gallons)||0;
  const gross = Number(t.rate)||0;

  const formatFullAddr = (obj) => {
    if (!obj) return "";
    const addr = (obj.addr || "").trim();
    const city = (obj.city || "").trim();
    const state = (obj.state || "").trim();
    const zip = (obj.zip || "").trim();
    const cityStateZip = [city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    return [addr, cityStateZip].filter(Boolean).join(", ").trim();
  };

  $("a_deliveryDate") && ($("a_deliveryDate").value = t.deliveryDate || "");
  $("a_deadhead") && ($("a_deadhead").value = dead);
  $("a_loaded") && ($("a_loaded").value = loaded);
  // 🔧 Populate "from Trip" read-only profile fields
$("a_loadNumber") && ($("a_loadNumber").value = t.loadNumber || "");

$("a_brokerName") && ($("a_brokerName").value = t.broker?.name || "");
$("a_brokerAddr") && ($("a_brokerAddr").value = formatFullAddr(t.broker));
$("a_brokerPhone") && ($("a_brokerPhone").value = t.broker?.phone || "");
$("a_brokerEmail") && ($("a_brokerEmail").value = t.broker?.email || "");

$("a_shipperName") && ($("a_shipperName").value = t.shipper?.name || "");
$("a_shipperAddr") && ($("a_shipperAddr").value = formatFullAddr(t.shipper));

$("a_consigneeName") && ($("a_consigneeName").value = t.consignee?.name || "");
$("a_consigneeAddr") && ($("a_consigneeAddr").value = formatFullAddr(t.consignee));
  $("a_tripMiles") && ($("a_tripMiles").value = Math.round(miles));
  $("a_fuelPrice") && ($("a_fuelPrice").value = fuelPrice);
  $("a_gallons") && ($("a_gallons").value = gallons);
  $("a_gross") && ($("a_gross").value = gross);

  // hours away auto from DOT baseline (Trips doesn't yet store hours away in this build)
  const dot = computeDotHoursAway(miles);
  $("a_hoursAway") && ($("a_hoursAway").value = Number(dot.totalHrs.toFixed(1)));

  if (hint) hint.textContent = "Loaded from Trips: " + formatTripOptionLabel(t);
  return t;
}

function getActiveTripId() {
  return localStorage.getItem(LS_ACTIVE_TRIP_ID) || "";
}
function setActiveTripId(id) {
  localStorage.setItem(LS_ACTIVE_TRIP_ID, id || "");
}
function findTripById(id) {
  if (!id) return null;
  return getTrips().find(t => t.id === id) || null;
}
function mostRecentTrip() {
  const trips = getTrips();
  if (!trips.length) return null;
  return trips.slice().sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
}
function getRemitInfo() {
  return localStorage.getItem(LS_REMIT_INFO) || "";
}
function saveRemitInfo(text) {
  localStorage.setItem(LS_REMIT_INFO, String(text || ""));
}
// ---------- Tabs / screens ----------
function setActiveScreen(name) {
  // Fleet safety: if Carrier Mode is OFF, block navigation to Fleet to avoid a blank screen
  try {
    if (String(name) === "fleet") {
      const fs = (typeof getFleetSettingsSafe === "function") ? getFleetSettingsSafe() : null;
      if (!fs || !fs.carrierMode) name = "settings";
    }
  } catch {}
  qsa(".screen").forEach(s => s.classList.remove("active"));
  qsa(".tab").forEach(t => t.classList.remove("active"));
  const screen = $(`screen-${name}`);
  const tab = qs(`.tab[data-screen="${name}"]`);
  if (screen) screen.classList.add("active");
  if (tab) tab.classList.add("active");

  // Mobile nav (1–2 tabs + More dropdown)
  try { updateMobileNav(name); } catch {}

  // Auto-refresh computed totals when entering related tabs
  if (name === "totals" || name === "reserve" || name === "bank") {
    try { renderTotals(); } catch {}
  }

  // Keep Gate (original) read-only basis in sync
  if (name === 'gate') {
    try { updateGateReadOnlyBasis(); } catch {}
    try { renderGateAppliedRules(); } catch {}
  }
}

// ---------- Mobile nav (zero-overlap header) ----------
let __allTabsCache = null;
function getAllTabs() {
  if (__allTabsCache) return __allTabsCache;
  const tabs = qsa('.tab').map(btn => ({
    screen: btn.dataset.screen,
    label: (btn.textContent || '').trim() || btn.dataset.screen
  })).filter(t => t.screen);
  __allTabsCache = tabs;
  return tabs;
}

function setMobilePrimaryButtons(primaryScreens, activeScreen) {
  const mobile = document.getElementById('mobileTabs');
  if (!mobile) return;
  const btns = Array.from(mobile.querySelectorAll('.mTab'));
  btns.forEach((b, idx) => {
    const s = primaryScreens[idx];
    if (!s) { b.classList.add('hidden'); return; }
    b.classList.remove('hidden');
    b.dataset.screen = s;
    // label comes from the desktop tab text (single source of truth)
    const t = getAllTabs().find(x => x.screen === s);
    b.textContent = (t ? t.label : s);
    b.classList.toggle('active', s === activeScreen);
  });
}

function updateMobileNav(activeScreen) {
  const mobile = document.getElementById('mobileTabs');
  const more = document.getElementById('mobileMore');
  if (!mobile || !more) return;

  const all = getAllTabs();
  if (!all.length) return;

  // Always show Settings + (Active or Trip) as the 2 visible buttons.
  const pinnedA = 'settings';
  let pinnedB = 'trip';
  if (activeScreen && activeScreen !== pinnedA && activeScreen !== pinnedB) pinnedB = activeScreen;
  if (activeScreen === pinnedA) pinnedB = 'trip';

  const primary = [pinnedA, pinnedB].filter(Boolean);
  setMobilePrimaryButtons(primary, activeScreen);

  // Build More dropdown from the remaining tabs (not already shown)
  const shown = new Set(primary);
  const opts = all.filter(t => !shown.has(t.screen));

  // Reset options
  more.innerHTML = '';
  const ph = document.createElement('option');
  ph.value = '';
  ph.textContent = 'More ▾';
  more.appendChild(ph);

  // Put the active screen at top (if it's not in the primary)
  if (activeScreen && !shown.has(activeScreen)) {
    const activeTab = all.find(t => t.screen === activeScreen);
    if (activeTab) {
      const o = document.createElement('option');
      o.value = activeTab.screen;
      o.textContent = '• ' + activeTab.label;
      more.appendChild(o);
      const sep = document.createElement('option');
      sep.disabled = true;
      sep.textContent = '────────';
      more.appendChild(sep);
    }
  }

  opts.forEach(t => {
    const o = document.createElement('option');
    o.value = t.screen;
    o.textContent = t.label;
    more.appendChild(o);
  });

  // Ensure dropdown doesn't stay "stuck" on a choice
  more.value = '';
}
// ---------- Read settings from inputs ----------
function readSettingsFromInputs() {
  return {
    household: num("s_household", 0),
    businessFixed: num("s_businessFixed", 0),
    avgMph: num("s_avgMph", 60),
    defaultMpg: num("s_defaultMpg", 4.6),
    tank: num("s_tank", 280),
    fuelStopMin: num("s_fuelStopMin", 15),
    // Google Maps key is embedded in index.html in this build.
    reserves: {
      factoring: num("r_factoring", 0.02),
      tax: num("r_tax", 0.28),
      plates: num("r_plates", 0.05),
      ifta: num("r_ifta", 0.05),
      maint: num("r_maint", 0.07),
      highway: num("r_highway", 0.05),
      tires: num("r_tires", 0.05),
    },
    // Maintenance (Oil Change)
    maintenance: {
      currentOdo: num("m_currentOdo", 0),
      lastOilOdo: num("m_lastOilOdo", 0),
      oilInterval: (document.getElementById("m_oilInterval")?.value || "15000"),
      oilCustom: num("m_oilCustom", 0),
      dueSoonMiles: num("m_dueSoon", 500),
    },
    // Optional starting balances for Totals screen
    reserveStart: num("s_reserveStart", 0),
    bankStart: num("s_bankStart", 0)

  };
}
// ---------- Plain Lock Settings v1.0 (preferences only) ----------
const SETTINGS_DEFAULTS = {
  household: 5259,
  businessFixed: 1742,
  avgMph: 60,
  defaultMpg: 4.6,
  tank: 280,
  fuelStopMin: 15,
  // gmapsKey removed (embedded in index.html)
  reserves: {
    factoring: 0.02,
    tax: 0.28,
    plates: 0.05,
    ifta: 0.05,
    maint: 0.07,
    highway: 0.05,
    tires: 0.05,
  },
  company: {
    ownerName: "",
    companyName: "",
    mcNumber: "",
    dotNumber: "",
    truckNumber: "",
    trailerNumber: "",
    companyPhone: "",
    companyEmail: "",
  },
  maintenance: {
    currentOdo: 0,
    lastOilOdo: 0,
    oilInterval: "15000",
    oilCustom: 12000,
    dueSoonMiles: 500
  },
  reserveStart: 0,
  bankStart: 0
};

function applySettingsToInputs(s) {
  if (!s) return;
  $("s_household").value = s.household ?? "";
  $("s_businessFixed").value = s.businessFixed ?? "";
  if ($("s_avgMph")) {
    $("s_avgMph").value = String(s.avgMph ?? SETTINGS_DEFAULTS.avgMph);
    $("s_avgMphVal") && ($("s_avgMphVal").textContent = String(Math.round(Number($("s_avgMph").value) || SETTINGS_DEFAULTS.avgMph)));
  }
  $("s_defaultMpg").value = s.defaultMpg ?? "";
  $("s_tank").value = s.tank ?? "";
  $("s_fuelStopMin").value = s.fuelStopMin ?? "";
  // gmapsKey field removed
  $("r_factoring").value = s.reserves?.factoring ?? "";
  $("r_tax").value = s.reserves?.tax ?? "";
  $("r_plates").value = s.reserves?.plates ?? "";
  $("r_ifta").value = s.reserves?.ifta ?? "";
  $("r_maint").value = s.reserves?.maint ?? "";
  $("r_highway").value = s.reserves?.highway ?? "";
  $("r_tires").value = s.reserves?.tires ?? "";
  // Maintenance (Oil Change)
  $("m_currentOdo") && ($("m_currentOdo").value = s.maintenance?.currentOdo ?? "");
  $("m_lastOilOdo") && ($("m_lastOilOdo").value = s.maintenance?.lastOilOdo ?? "");
  if ($("m_oilInterval")) {
    $("m_oilInterval").value = String(s.maintenance?.oilInterval ?? SETTINGS_DEFAULTS.maintenance.oilInterval);
  }
  $("m_oilCustom") && ($("m_oilCustom").value = s.maintenance?.oilCustom ?? "");
  $("m_dueSoon") && ($("m_dueSoon").value = s.maintenance?.dueSoonMiles ?? SETTINGS_DEFAULTS.maintenance.dueSoonMiles);
  // Starting balances
  $("s_reserveStart") && ($("s_reserveStart").value = s.reserveStart ?? "");
  $("s_bankStart") && ($("s_bankStart").value = s.bankStart ?? "");

}


function updateSettingsFinePrint() {
  const hh = num("s_household", 0);
  const biz = num("s_businessFixed", 0);
  const monthlyFixed = hh + biz;
  const dailyFixed = monthlyFixed / 30.4;

  // Lifetime MPG display (read-only)
  const miles = Number(localStorage.getItem("lifetimeMiles") || 0) || 0;
  const gallons = Number(localStorage.getItem("lifetimeGallons") || 0) || 0;
  const lifetime = gallons > 0 ? (miles / gallons) : 0;

  const elMpg = $("s_lifetimeMpg");
  if (elMpg) elMpg.value = lifetime > 0 ? lifetime.toFixed(2) : "";

  const out = $("settingsFinePrint");
  if (!out) return;

  // Plain Lock: show fixed costs clearly (household + business, then total)
  out.textContent =
`Fixed Costs (editable)
Household Fixed: $${hh.toFixed(2)}/mo
Business Fixed:  $${biz.toFixed(2)}/mo
--------------------------------
Total Fixed:     $${monthlyFixed.toFixed(2)}/mo → $${dailyFixed.toFixed(2)}/day (÷30.4)`;
}

function saveSettingsPlainLock() {
  const raw = readSettingsFromInputs();
  // Guardrails (preferences sanity only — does NOT change formulas)
  const safe = {
    household: Math.max(0, Number(raw.household) || 0),
    businessFixed: Math.max(0, Number(raw.businessFixed) || 0),
    avgMph: Math.min(65, Math.max(45, Number(raw.avgMph) || SETTINGS_DEFAULTS.avgMph)),
    defaultMpg: Math.max(1, Number(raw.defaultMpg) || SETTINGS_DEFAULTS.defaultMpg),
    tank: Math.max(0, Number(raw.tank) || SETTINGS_DEFAULTS.tank),
    fuelStopMin: Math.max(0, Number(raw.fuelStopMin) || SETTINGS_DEFAULTS.fuelStopMin),
    reserves: {
      factoring: Math.max(0, Number(raw.reserves.factoring) || 0),
      tax: Math.max(0, Number(raw.reserves.tax) || 0),
      plates: Math.max(0, Number(raw.reserves.plates) || 0),
      ifta: Math.max(0, Number(raw.reserves.ifta) || 0),
      maint: Math.max(0, Number(raw.reserves.maint) || 0),
      highway: Math.max(0, Number(raw.reserves.highway) || 0),
      tires: Math.max(0, Number(raw.reserves.tires) || 0),
    },
    maintenance: {
      currentOdo: Math.max(0, Number(raw.maintenance?.currentOdo) || 0),
      lastOilOdo: Math.max(0, Number(raw.maintenance?.lastOilOdo) || 0),
      oilInterval: String(raw.maintenance?.oilInterval || SETTINGS_DEFAULTS.maintenance.oilInterval),
      oilCustom: Math.max(0, Number(raw.maintenance?.oilCustom) || SETTINGS_DEFAULTS.maintenance.oilCustom),
      dueSoonMiles: Math.max(0, Number(raw.maintenance?.dueSoonMiles) || SETTINGS_DEFAULTS.maintenance.dueSoonMiles),
    },
    reserveStart: Math.max(0, Number(raw.reserveStart) || 0),
    bankStart: Math.max(0, Number(raw.bankStart) || 0),
    company: readCompanyInfoFromUI()
  };
  saveSettings(safe);
  $("settingsHint").textContent = "✅ Settings saved. (Preferences only — formulas are locked.)";
  try { updateSettingsFinePrint(); } catch {}
  try { updateMaintenancePill(); } catch {}
  // Auto-refresh computed tabs (Reserve/Bank/Totals) from their sources
  try { renderTotals(); } catch {}
}
function resetSettingsPlainLock() {
  applySettingsToInputs(SETTINGS_DEFAULTS);
  const s = getSettings() || {};
  s.household = SETTINGS_DEFAULTS.household;
  s.businessFixed = SETTINGS_DEFAULTS.businessFixed;
  s.avgMph = SETTINGS_DEFAULTS.avgMph;
  s.defaultMpg = SETTINGS_DEFAULTS.defaultMpg;
  s.tank = SETTINGS_DEFAULTS.tank;
  s.fuelStopMin = SETTINGS_DEFAULTS.fuelStopMin;
  s.reserves = { ...SETTINGS_DEFAULTS.reserves };
  saveSettings(s);
  $("settingsHint").textContent = "♻️ Reset to defaults. (Preferences only — formulas are locked.)";
  try { updateSettingsFinePrint(); } catch {}
  try { updateMaintenancePill(); } catch {}
  // Auto-refresh computed tabs (Reserve/Bank/Totals) from their sources
  try { renderTotals(); } catch {}
}
function needSettings(redirect = true) {
  const s = getSettings();
  if (!s) {
    $("settingsHint").textContent = "Please enter Settings and tap “Save Settings”.";
    if (redirect) setActiveScreen("settings");
    return null;
  }
  $("settingsHint").textContent = "";
  return s;
}
// ================================
// Plain Lock — Scenario v1.0
// ================================
const SCENARIO_LOCK = {
  requiredIds: ["sc_deadhead", "sc_loaded", "sc_gross"],
  warnReturnIfGteLoaded: true,
  lockReturnMilesWhenOff: true,
};
function getLifetimeMpgUsed(defaultMpg = 6.8) {
  const miles = Number(localStorage.getItem("lifetimeMiles") || 0);
  const gallons = Number(localStorage.getItem("lifetimeGallons") || 0);
  if (miles > 0 && gallons > 0) return miles / gallons;
  return defaultMpg;
}
function money2(n){ return Number.isFinite(n) ? n.toFixed(2) : ""; }
function getScenarioTotalMiles() {
  const deadhead = num("sc_deadhead", 0);
  const loaded   = num("sc_loaded", 0);
  const returning = $("sc_returnToggle")?.checked;
  const returnMiles = returning ? num("sc_returnMiles", 0) : 0;
  return deadhead + loaded + returnMiles;
}
function updateScenarioFuelUI() {
  const totalMiles = getScenarioTotalMiles();
  const s = getSettings() || null;
  const typedPrice = num("sc_fuelPrice", NaN);
  const fuelPrice = Number.isFinite(typedPrice) ? typedPrice : 0;
  const mpgUsed = getLifetimeMpgUsed((s?.defaultMpg || SETTINGS_DEFAULTS.defaultMpg));
  const estGallons = mpgUsed > 0 ? (totalMiles / mpgUsed) : 0;
  const estFuelCost = estGallons * fuelPrice;
  $("sc_mpgUsed") && ($("sc_mpgUsed").value = money2(mpgUsed));
  $("sc_estGallons") && ($("sc_estGallons").value = money2(estGallons));
  $("sc_estFuelCost") && ($("sc_estFuelCost").value = money2(estFuelCost));
  return { totalMiles, fuelPrice, mpgUsed, estGallons, estFuelCost };
}
// Scenario: Estimated Hours Away From Family (read-only)
function computeScenarioHoursAway({ totalMiles, waitHours, mph, fuelStopMin, nextLoad }) {
  const safeMph = Math.min(65, Math.max(35, Number(mph) || 50));
  const drivingHours = totalMiles > 0 ? (totalMiles / safeMph) : 0;

  const breakHours = Math.floor(drivingHours / 8) * 0.5;

  const stopMin = Math.max(0, Number(fuelStopMin ?? 15));
  // Next Load mode assumes at least one fuel stop if you're moving
  const fuelStops = totalMiles > 0 ? (nextLoad ? Math.max(1, Math.ceil(totalMiles / 500)) : Math.floor(totalMiles / 1000)) : 0;
  const fuelHours = fuelStops * (stopMin / 60);

  let sleeperHours = 0;
  let days = 0;
  if (nextLoad) {
    // rough-but-consistent: days are based on 11 driving hours/day; sleeper is 10 hours between days
    days = drivingHours > 0 ? Math.max(1, Math.ceil(drivingHours / 11)) : 0;
    sleeperHours = Math.max(0, (days - 1) * 10);
  }

  const totalHoursAway = drivingHours + breakHours + fuelHours + sleeperHours + (Number(waitHours) || 0);
  return { drivingHours, breakHours, fuelStops, fuelHours, sleeperHours, days, totalHoursAway };
}

// Scenario: Estimated Hours Away From Family (read-only)
function updateScenarioHoursAwayUI() {
  const out = $("sc_estHoursAway");
  if (!out) return;
  const deadhead = num("sc_deadhead", 0);
  const loaded = num("sc_loaded", 0);
  const retOn = $("sc_returnToggle")?.checked;
  const ret = retOn ? num("sc_returnMiles", 0) : 0;
  const wait = 0; // Scenario is estimate-only; wait/detention belong in Actual.

  const totalMiles = deadhead + loaded + ret;

  const nextLoad = false; // Next-load toggle is not part of Scenario Clean-up lock v1.0
  const settings = getSettings() || {};
  const mph = Math.min(65, Math.max(45, Number(settings.avgMph ?? SETTINGS_DEFAULTS.avgMph)));
  const fuelStopMin = settings.fuelStopMin ?? 15;

  $("sc_avgMphUsed") && ($("sc_avgMphUsed").value = String(Math.round(mph)));

  const dot = computeScenarioHoursAway({ totalMiles, waitHours: wait, mph, fuelStopMin, nextLoad });
  out.value = dot.totalHoursAway > 0 ? dot.totalHoursAway.toFixed(1) : "";
}
function setScenarioWarn(msg = "", mode = "ok") {
  const el = $("scenarioLockWarn");
  if (!el) return;
  el.classList.remove("ok", "warn", "bad");
  el.classList.add(mode);
  el.textContent = msg;
}
function enforceScenarioReturnLock() {
  const toggle = $("sc_returnToggle");
  const rm = $("sc_returnMiles");
  if (!toggle || !rm) return;
  const returning = !!toggle.checked;
  if (SCENARIO_LOCK.lockReturnMilesWhenOff && !returning) {
    rm.value = "0";
    rm.disabled = true;
    rm.classList.add("locked");
  } else {
    rm.disabled = false;
    rm.classList.remove("locked");
  }
}
function scenarioInputsAreValid() {
  const deadhead = num("sc_deadhead", NaN);
  const loaded = num("sc_loaded", NaN);
  const gross = num("sc_gross", NaN);
  if (![deadhead, loaded, gross].every(Number.isFinite)) return false;
  if (deadhead < 0 || loaded < 0 || gross < 0) return false;
  const returning = $("sc_returnToggle")?.checked;
  const returnMiles = num("sc_returnMiles", 0);
  if (returning && returnMiles < 0) return false;
  return true;
}
function updateScenarioCalcButtonState() {
  const btn = $("btnCalcScenario");
  if (!btn) return;
  const ok = scenarioInputsAreValid();
  btn.disabled = !ok;
  if (!ok) {
    setScenarioWarn("Fill required fields: Deadhead, Loaded, Gross Revenue.", "bad");
  } else {
    setScenarioWarn("Ready. Scenario is estimate-only and will not save to history.", "ok");
  }
}
function scenarioSoftWarnings() {
  const returning = $("sc_returnToggle")?.checked;
  const loaded = num("sc_loaded", 0);
  const returnMiles = num("sc_returnMiles", 0);
  if (SCENARIO_LOCK.warnReturnIfGteLoaded && returning && loaded > 0 && returnMiles >= loaded) {
    setScenarioWarn("⚠️ Return Miles are equal to or greater than Loaded Miles. Confirm this reposition back home/yard is real.", "warn");
    return;
  }
}

async function scenarioAutoFillMilesFromCities() {
  const statusEl = $("sc_cityStatus");
  const setStatus = (t) => { if (statusEl) statusEl.textContent = t; };

  const fromLoc = str("sc_fromLoc");
  const pickupLoc = str("sc_pickupLoc");
  const deliveryLoc = str("sc_deliveryLoc");
  const homeLoc = str("sc_homeLoc");

  if (!pickupLoc || !deliveryLoc) {
    setStatus("Enter Pickup + Delivery first.");
    setScenarioWarn("⚠️ To auto-calc, enter Pickup and Delivery city/state.", "warn");
    return;
  }

  setStatus("Calculating miles…");
  setScenarioWarn("Calculating miles from City/State…", "ok");

  try {
    await ensureGoogleMapsLoaded();

    // Loaded miles (required for auto-calc)
    const loadedMiles = await calcRouteMiles(pickupLoc, deliveryLoc);

    // Deadhead miles (optional)
    let deadheadMiles = null;
    if (fromLoc) deadheadMiles = await calcRouteMiles(fromLoc, pickupLoc);

    // Return miles (only if toggle is ON and home is provided)
    const returning = $("sc_returnToggle")?.checked;
    let returnMiles = null;
    if (returning && homeLoc) returnMiles = await calcRouteMiles(deliveryLoc, homeLoc);

    // Apply to existing Scenario fields (NO removals)
    if (Number.isFinite(loadedMiles)) $("sc_loaded").value = loadedMiles.toFixed(1);
    if (deadheadMiles != null && Number.isFinite(deadheadMiles)) $("sc_deadhead").value = deadheadMiles.toFixed(1);
    if (returnMiles != null && Number.isFinite(returnMiles)) $("sc_returnMiles").value = returnMiles.toFixed(1);

    // Trigger your existing Scenario auto-recalc listeners
    ["sc_deadhead", "sc_loaded", "sc_returnMiles"].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });

    setStatus(
      `Done ✅ Loaded: ${loadedMiles.toFixed(1)} mi` +
      (deadheadMiles != null ? ` • Deadhead: ${deadheadMiles.toFixed(1)} mi` : "") +
      (returnMiles != null ? ` • Return: ${returnMiles.toFixed(1)} mi` : "")
    );

    scenarioSoftWarnings();
  } catch (e) {
    console.error(e);
    setStatus("Auto-calc failed. Check locations / Maps availability.");
    setScenarioWarn("⚠️ Auto-calc failed. Verify city/state format and that Google Maps is available.", "bad");
  }
}

// Expose to HTML onclick (reliable wiring)
window.scenarioAutoFillMilesFromCities = scenarioAutoFillMilesFromCities;
window.scenarioClearCityAutoFields = scenarioClearCityAutoFields;

function scenarioClearCityAutoFields() {
  ["sc_fromLoc","sc_pickupLoc","sc_deliveryLoc","sc_homeLoc"].forEach((id) => {
    const el = $(id);
    if (el) el.value = "";
  });
  const statusEl = $("sc_cityStatus");
  if (statusEl) statusEl.textContent = "—";
}

function calculateScenarioLocked(silent=false) {
  const s = needSettings(false) || SETTINGS_DEFAULTS;

  enforceScenarioReturnLock();
  updateScenarioCalcButtonState();
  if (!scenarioInputsAreValid()) return;

  const deadhead = num("sc_deadhead", 0);
  const loaded = num("sc_loaded", 0);
  const gross = num("sc_gross", 0);
  const returning = $("sc_returnToggle")?.checked;
  const returnMiles = returning ? num("sc_returnMiles", 0) : 0;

  const totalMiles = deadhead + loaded + returnMiles;
  $("sc_totalMiles") && ($("sc_totalMiles").value = totalMiles.toFixed(1));

  // Fuel estimate (uses lifetime MPG if available; else Settings fallback MPG)
  const fuel = updateScenarioFuelUI();

  // DOT minimum time estimate (locked)
  const dot = computeDotHoursAway(totalMiles);
  const hoursAwayEst = Number(dot.totalHrs || 0) || 0;
  $("sc_estHoursAway") && ($("sc_estHoursAway").value = hoursAwayEst > 0 ? hoursAwayEst.toFixed(1) : "");

  // Read-only MPH used (from Settings)
  const mphUsed = Math.min(65, Math.max(45, Number(s.avgMph ?? SETTINGS_DEFAULTS.avgMph)));
  $("sc_avgMphUsed") && ($("sc_avgMphUsed").value = String(Math.round(mphUsed)));

  const out = calcCore(
    { deadhead, loaded, returning, returnMiles, gross },
    s,
    fuel.fuelPrice,
    0,
    hoursAwayEst
  );

  // Scenario uses fuel estimate (no actual gallons here)
  out.fuelCost = fuel.estFuelCost;
  out.dotBreakdown = dot;

  // Net in Scenario: Gross - Fuel - Fixed - Reserves
  out.net = gross - out.fuelCost - out.fixedTripCost - out.reserves;
  out.netPerMile = out.totalMiles > 0 ? (out.net / out.totalMiles) : 0;

  // O.T.R.A.F.F: net per hour away
  out.otr = (hoursAwayEst > 0) ? (out.net / hoursAwayEst) : 0;

  lastScenarioOut = out;
  renderScenario(out);
  updateScenarioBadge(out);
  scenarioSoftWarnings();

  // mirror key outputs into read-only boxes
  $("sc_otraff") && ($("sc_otraff").value = money2(out.otr));
  $("sc_net") && ($("sc_net").value = money2(out.net));

  if (!silent) setScenarioWarn("✅ Scenario calculated (estimate-only).", "ok");
}

// ---------- Core calculation// ---------- Core calculation (stable version) ----------
function calcCore({ deadhead, loaded, returning, returnMiles, gross }, settings, fuelPrice = 0, gallons = 0, hoursAway = 0) {
  const totalMiles = deadhead + loaded + (returning ? returnMiles : 0);
  // Fuel: if gallons provided (Actual), use it. If not, estimate gallons using MPG.
  const mpg = Number(settings.defaultMpg) || 4.6;
  const estGallons = totalMiles / mpg;
  const fuelCost = gallons > 0 ? gallons * fuelPrice : estGallons * fuelPrice;
  // Fixed monthly -> per-day then per-trip (by hoursAway if given; else 1 day)
  const monthlyFixed = (Number(settings.household) || 0) + (Number(settings.businessFixed) || 0);
  const dailyFixed = monthlyFixed / 30.4;
  const tripDays = Math.max(0.25, (hoursAway > 0 ? hoursAway / 24 : 1));
  const fixedTripCost = dailyFixed * tripDays;
  // Reserves (% of gross)
  const reservesPct =
    (Number(settings.reserves?.factoring) || 0) +
    (Number(settings.reserves?.tax) || 0) +
    (Number(settings.reserves?.plates) || 0) +
    (Number(settings.reserves?.ifta) || 0) +
    (Number(settings.reserves?.maint) || 0) +
    (Number(settings.reserves?.highway) || 0) +
    (Number(settings.reserves?.tires) || 0);
  const reserves = gross * reservesPct;
  const net = gross - fuelCost - fixedTripCost - reserves;
  const otrHours = hoursAway > 0 ? hoursAway : 24;
  const otr = net / otrHours;
  return { totalMiles, fuelCost, fixedTripCost, reservesPct, reserves, net, otr, monthlyFixed, dailyFixed };
}
// ---------- Render outputs ----------
function scoreScenario(out) {
  const net = Number(out?.net || 0) || 0;
  const otr = Number(out?.otr || 0) || 0;
  const npm = Number(out?.netPerMile || 0) || 0;

  if (net <= 0 || otr < 20 || npm < 0.10) return { tier: "bad", label: "DON’T HAUL" };
  if (otr >= 50 && npm >= 0.75) return { tier: "good", label: "GOOD LOAD" };
  return { tier: "ok", label: "OK LOAD" };
}

function updateScenarioBadge(out) {
  const el = $("scenarioBadge");
  if (!el) return;
  const s = scoreScenario(out);
  el.classList.remove("good","ok","bad");
  el.classList.add(s.tier);

  const dot = (s.tier === "good") ? "🟢" : (s.tier === "ok") ? "🟠" : "🔴";
  const miles = Number(out?.totalMiles || 0) || 0;
  const otr = Number(out?.otr || 0) || 0;
  const npm = Number(out?.netPerMile || 0) || 0;

  el.textContent = `${dot} ${s.label} — O.T.R.A.F.F ${money(otr)}/hr • Net/Mile ${money(npm)}/mi • Miles ${miles.toFixed(0)}`;
}

function clampMin(n, min=0){ n=Number(n); return Number.isFinite(n)? Math.max(min,n): min; }

function computeBillableDetention(loadWait, unloadWait){
  const free = 1; // 1 hour free at shipper + 1 hour free at consignee
  const lw = clampMin(loadWait,0);
  const uw = clampMin(unloadWait,0);
  return Math.max(0, lw - free) + Math.max(0, uw - free);
}

// -------------------------
// Actual module add-ons (wait/detention/expenses)
// -------------------------
let actualExpensesDraft = [];

function moneyStr(n){
  const v = Number(n);
  return Number.isFinite(v) ? `$${v.toFixed(2)}` : "$0.00";
}

function readFixedCostPerHour(settings){
  const monthlyFixed = (Number(settings?.household)||0) + (Number(settings?.businessFixed)||0);
  const dailyFixed = monthlyFixed / 30.4;
  const perHr = dailyFixed / 24;
  return { monthlyFixed, dailyFixed, perHr };
}

function computeActualOtherExpensesTotal(){
  return actualExpensesDraft.reduce((sum,e)=> sum + (Number(e.amount)||0), 0);
}

function renderActualExpenses(){
  const list = $("actualExpenseList");
  const totalEl = $("a_otherExpensesTotal");
  if (!list) return;

  list.innerHTML = "";
  actualExpensesDraft.forEach((e, idx)=>{
    const row = document.createElement("div");
    row.className = "list-item";
    row.style.paddingRight = "120px";
    row.innerHTML = `<div class="list-title">${escapeHtml(e.type || "Other")}</div>
      <div class="list-sub">${moneyStr(e.amount)}</div>`;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Remove";
    btn.className = "trip-delete-btn";
    btn.addEventListener("click", (ev)=>{
      ev.stopPropagation();
      actualExpensesDraft.splice(idx,1);
      renderActualExpenses();
      $("btnCalcActual")?.click();
    });
    row.appendChild(btn);
    list.appendChild(row);
  });

  if (totalEl) totalEl.value = moneyStr(computeActualOtherExpensesTotal());
}

function resetActualAddOnsUI(){
  actualExpensesDraft = [];
  renderActualExpenses();
  // reset add-on fields if present
  if ($("a_waitShipper")) $("a_waitShipper").value = "0";
  if ($("a_waitConsignee")) $("a_waitConsignee").value = "0";
  if ($("a_detBillHours")) $("a_detBillHours").value = "";
  if ($("a_detRate")) $("a_detRate").value = "100";
  if ($("a_detTotal")) $("a_detTotal").value = "";
  if ($("a_waitCostPerHr")) $("a_waitCostPerHr").value = "";
  if ($("a_waitLost")) $("a_waitLost").value = "";
  if ($("a_otherExpensesTotal")) $("a_otherExpensesTotal").value = moneyStr(0);
}

function updateDetentionBillHoursAuto(){
  const billEl = $("sc_detentionBillHours");
  if (!billEl || billEl.dataset.auto === "0") return;
  const lw = num("sc_loadWait", 0);
  const uw = num("sc_unloadWait", 0);
  const billableAuto = computeBillableDetention(lw, uw);
  billEl.value = billableAuto.toFixed(1);
  billEl.dataset.auto = "1";
}

async function copyToClipboard(text){
  try{
    await navigator.clipboard.writeText(text);
    return true;
  }catch(e){
    try{
      const ta=document.createElement("textarea");
      ta.value=text;
      ta.style.position="fixed";
      ta.style.left="-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    }catch(_){
      return false;
    }
  }
}

function buildDetentionEmail(){
  const loadWait = num("sc_loadWait", 0);
  const unloadWait = num("sc_unloadWait", 0);

  const billableAuto = computeBillableDetention(loadWait, unloadWait);
  const billHrs = (() => {
    const v = $("sc_detentionBillHours")?.value ?? "";
    const n = v === "" ? billableAuto : Number(v);
    return Number.isFinite(n) ? Math.max(0, n) : Math.max(0, billableAuto);
  })();

  const rate = Math.max(0, num("sc_detentionRate", 75));
  const total = billHrs * rate;

  const company = ($("s_companyName")?.value || "Your Company").trim();
  const phone = ($("s_companyPhone")?.value || "").trim();
  const email = ($("s_companyEmail")?.value || "").trim();

  const subject = `Detention Request — Waiting Time at Shipper/Consignee`;
  const bodyLines = [];
  bodyLines.push(`Hello,`);
  bodyLines.push(``);
  bodyLines.push(`This is a detention request for excessive wait time on this load.`);
  bodyLines.push(``);
  bodyLines.push(`Wait time details:`);
  bodyLines.push(`- Shipper wait: ${loadWait.toFixed(1)} hrs (1.0 hr free)`);
  bodyLines.push(`- Consignee wait/unload: ${unloadWait.toFixed(1)} hrs (1.0 hr free)`);
  bodyLines.push(``);
  bodyLines.push(`Billable detention: ${billHrs.toFixed(1)} hrs @ $${rate.toFixed(0)}/hr = $${total.toFixed(2)}`);
  bodyLines.push(``);
  bodyLines.push(`Please confirm approval and add detention to the rate confirmation / invoice.`);
  bodyLines.push(``);
  bodyLines.push(`Thank you,`);
  bodyLines.push(company);
  if (phone) bodyLines.push(phone);
  if (email) bodyLines.push(email);

  return { subject, body: bodyLines.join("\n") };
}

function renderScenario(out) {
  if (!out) return;
  const el = $("scenarioOut");
  if (!el) return;

  const totalMiles = Number(out.totalMiles || 0) || 0;
  const fuelCost = Number(out.fuelCost || 0) || 0;
  const fixedTripCost = Number(out.fixedTripCost || 0) || 0;
  const reserves = Number(out.reserves || 0) || 0;
  const reservesPct = Number(out.reservesPct || 0) || 0;
  const net = Number(out.net || 0) || 0;
  const otr = Number(out.otr || 0) || 0;
  const netPerMile = Number(out.netPerMile || 0) || 0;

  const dot = out.dotBreakdown || null;

  const lines = [];
  lines.push(`Total Miles: ${totalMiles.toFixed(1)}`);
  lines.push(`Fuel Cost (est): $${fuelCost.toFixed(2)}`);
  lines.push(`Fixed Trip Cost: $${fixedTripCost.toFixed(2)}`);

  const mf = Number(out.monthlyFixed || 0) || 0;
  const df = Number(out.dailyFixed || 0) || 0;
  lines.push(`Fixed Cost Basis: (Household + Business) = $${mf.toFixed(2)}/mo → $${df.toFixed(2)}/day (÷30.4)`);

  lines.push(`Reserves (${(reservesPct * 100).toFixed(1)}%): $${reserves.toFixed(2)}`);
  lines.push(`Net: $${net.toFixed(2)}`);
  lines.push(`Net per Mile: $${netPerMile.toFixed(2)}/mi`);
  lines.push(`O.T.R.A.F.F: $${otr.toFixed(2)}/hr`);

  if (dot) {
    lines.push(``);
    lines.push(`DOT Minimum Time Estimate (locked)`);
    lines.push(`Driving: ${Number(dot.driveHrs||0).toFixed(1)} hrs`);
    lines.push(`30-min Breaks: ${Number(dot.breakHrs||0).toFixed(1)} hrs`);
    lines.push(`Fuel Stops: ${Number(dot.fuelStops||0)} (${Number(dot.fuelHrs||0).toFixed(1)} hrs)`);
    lines.push(`Sleeper: ${Number(dot.sleeperHrs||0).toFixed(1)} hrs`);
    lines.push(`Days: ${Number(dot.days||0)}`);
    lines.push(`Total Hours Away: ${Number(dot.totalHrs||0).toFixed(1)} hrs`);
  }

  el.textContent = lines.join("\n");
}
function renderActual(out) {
  $("actualOut").textContent =
`Total Miles: ${out.totalMiles.toFixed(1)}
Fuel Cost: ${money(out.fuelCost)}
Fixed Trip Cost: ${money(out.fixedTripCost)}
Reserves (${(out.reservesPct * 100).toFixed(1)}%): ${money(out.reserves)}
Net: ${money(out.net)}
O.T.R.A.F.F: ${money(out.otr)}/hr`;
}
// ---------- Totals ----------
function renderTotals() {
  const loads = getLoads();
  if (!loads.length) {
    $("totalsOut").textContent = "—\nNo Actual loads saved yet.";
    $("reserveOut") && ($("reserveOut").textContent = "—");
    $("bankOut") && ($("bankOut").textContent = "—");
    return;
  }

  const s = getSettings() || SETTINGS_DEFAULTS;
  const monthlyFixed = (Number(s.household) || 0) + (Number(s.businessFixed) || 0);
  const dailyFixed = monthlyFixed / 30.4;
  const reservesPct =
    (Number(s.reserves?.factoring) || 0) +
    (Number(s.reserves?.tax) || 0) +
    (Number(s.reserves?.plates) || 0) +
    (Number(s.reserves?.ifta) || 0) +
    (Number(s.reserves?.maint) || 0) +
    (Number(s.reserves?.highway) || 0) +
    (Number(s.reserves?.tires) || 0);

  const reserveStart = Number(s.reserveStart || 0) || 0;
  const bankStart = Number(s.bankStart || 0) || 0;

  // Date helpers (local)
  const now = new Date();
  const y = now.getFullYear();
  const startOfYear = new Date(y, 0, 1);
  const startOfMonth = new Date(y, now.getMonth(), 1);

  // Start of week = Monday
  const day = (now.getDay() + 6) % 7; // 0=Mon ... 6=Sun
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0,0,0,0);
  startOfWeek.setDate(now.getDate() - day);

  function parseDate(dStr, fallbackMs) {
    if (typeof dStr === "string" && dStr.length >= 10) {
      const d = new Date(dStr + "T00:00:00");
      if (!isNaN(d.getTime())) return d;
    }
    return new Date(fallbackMs || Date.now());
  }

  let grossYTD = 0, fuelYTD = 0, netYTD = 0;
  const byMonth = new Map();

  const buckets = {
    week: { reserve: 0, bank: 0, count: 0 },
    month: { reserve: 0, bank: 0, count: 0 },
    ytd: { reserve: 0, bank: 0, count: 0 }
  };

  for (const l of loads) {
    const gross = Number(l.gross || 0) || 0;
    const fuelCost = Number(l.fuelCost || 0) || 0;
    const netActual = Number(l.net || 0) || 0;
    const detention = Number(l.detentionTotal || 0) || 0;
    const hoursAway = Number(l.hoursAway || 0) || 0;

    grossYTD += gross;
    fuelYTD += fuelCost;
    netYTD += netActual;

    const monthKey = (l.deliveryDate || "").slice(0, 7) || "Unknown Month";
    const m = byMonth.get(monthKey) || { gross: 0, fuel: 0, net: 0, count: 0 };
    m.gross += gross;
    m.fuel += fuelCost;
    m.net += netActual;
    m.count += 1;
    byMonth.set(monthKey, m);

    // Reserve/Bank math (professional: uses Settings fixed costs + reserve %; subtracts from actual net)
    const effectiveGross = gross + detention;
    const tripDays = Math.max(0.25, (hoursAway > 0 ? hoursAway / 24 : 1));
    const fixedTripCost = dailyFixed * tripDays;
    const reserveAdd = effectiveGross * reservesPct;
    const bankAdd = netActual - fixedTripCost - reserveAdd;

    const d = parseDate(l.deliveryDate, l.createdAt);
    const inYTD = d >= startOfYear;
    const inMonth = d >= startOfMonth;
    const inWeek = d >= startOfWeek;

    if (inYTD) {
      buckets.ytd.reserve += reserveAdd; buckets.ytd.bank += bankAdd; buckets.ytd.count += 1;
    }
    if (inMonth) {
      buckets.month.reserve += reserveAdd; buckets.month.bank += bankAdd; buckets.month.count += 1;
    }
    if (inWeek) {
      buckets.week.reserve += reserveAdd; buckets.week.bank += bankAdd; buckets.week.count += 1;
    }
  }

  const monthLines = Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, m]) =>
`Month: ${k} (Loads: ${m.count})
  Gross: ${money(m.gross)}
  Fuel:  ${money(m.fuel)}
  Net:   ${money(m.net)}`
    );

  $("totalsOut").textContent =
`YTD (All Saved Actual Loads)
Gross: ${money(grossYTD)}
Fuel:  ${money(fuelYTD)}
Net:   ${money(netYTD)}
------------------------
${monthLines.join("\n\n")}`;

  // Reserve Totals panel
  if ($("reserveOut")) {
    $("reserveOut").textContent =
`Reserve Totals (computed from saved Actual loads)
This Week (since Mon): ${money(buckets.week.reserve)}  • Loads: ${buckets.week.count}
This Month:            ${money(buckets.month.reserve)} • Loads: ${buckets.month.count}
Year-to-Date:          ${money(buckets.ytd.reserve)}   • Loads: ${buckets.ytd.count}
------------------------
Starting Reserve:      ${money(reserveStart)}
Estimated Reserve Now: ${money(reserveStart + buckets.ytd.reserve)}

Reserve % Basis (sum): ${(reservesPct*100).toFixed(1)}%`;
  }

  // Bank panel (Available After Fixed + Reserves)
  if ($("bankOut")) {
    $("bankOut").textContent =
`Bank (Available After Fixed + Reserves)
This Week (since Mon): ${money(buckets.week.bank)}  • Loads: ${buckets.week.count}
This Month:            ${money(buckets.month.bank)} • Loads: ${buckets.month.count}
Year-to-Date:          ${money(buckets.ytd.bank)}   • Loads: ${buckets.ytd.count}
------------------------
Starting Bank:         ${money(bankStart)}
Estimated Bank Now:    ${money(bankStart + buckets.ytd.bank)}

Fixed Cost Basis: ${money(monthlyFixed)}/mo → ${money(dailyFixed)}/day`;
  }
}

// ---------- Maintenance status (global) ----------
function updateMaintenancePill() {
  const pill = $("maintPill");
  if (!pill) return;

  const s = getSettings() || SETTINGS_DEFAULTS;
  const m = s.maintenance || SETTINGS_DEFAULTS.maintenance;

  const current = Number(m.currentOdo || 0) || 0;
  const last = Number(m.lastOilOdo || 0) || 0;

  // Interval selection
  let interval = 15000;
  const sel = String(m.oilInterval || "15000");
  if (sel === "10000") interval = 10000;
  else if (sel === "15000") interval = 15000;
  else interval = Math.max(1, Number(m.oilCustom || SETTINGS_DEFAULTS.maintenance.oilCustom) || 12000);

  const dueSoon = Math.max(0, Number(m.dueSoonMiles || SETTINGS_DEFAULTS.maintenance.dueSoonMiles) || 500);
  const nextDue = last + interval;

  // If user hasn't filled anything, keep OK
  if (current <= 0 || last <= 0) {
    pill.classList.remove("ok","bad");
    pill.classList.add("good");
    pill.textContent = "🟢 Maintenance OK";
    pill.title = "Set odometer + last oil change in Settings to enable alerts.";
    return;
  }

  const remaining = nextDue - current;

  let tier = "good";
  let label = "🟢 Maintenance OK";
  if (remaining <= 0) {
    tier = "bad";
    label = `🔴 Oil Change Overdue (${Math.abs(Math.round(remaining))} mi)`;
  } else if (remaining <= dueSoon) {
    tier = "ok";
    label = `🟡 Oil Change Due Soon (${Math.round(remaining)} mi)`;
  }

  pill.classList.remove("good","ok","bad");
  pill.classList.add(tier);
// Mobile: circle only (no text)
if (window.matchMedia && window.matchMedia('(max-width:700px)').matches) {
  pill.textContent = '';
  pill.setAttribute('aria-label', label);
} else {
  pill.textContent = label;
}
  pill.title = `Current: ${Math.round(current)} | Last Oil: ${Math.round(last)} | Interval: ${Math.round(interval)} | Next Due: ${Math.round(nextDue)}`;
}

// ---------- Loads list ----------
let selectedLoadIndex = null;

function formatLoadOptionLabel(l, i){
  const ln = (l.loadNumber && String(l.loadNumber).trim() !== "") ? `#${l.loadNumber}` : `#${i + 1}`;
  const brokerLabel = (l.brokerName || l.broker || "Unknown Broker");
  const dateLabel = (l.deliveryDate || "No date");
  const miles = Math.round((Number(l.deadhead)||0) + (Number(l.loaded)||0) + (Number(l.returnMiles)||0));
  const gross = Number(l.gross||0);
  const parts = [`Load ${ln}`, dateLabel, brokerLabel];
  if (miles) parts.push(miles + " mi");
  if (gross) parts.push(money(gross));
  return parts.join(" • ");
}

function renderSelectedLoadDetail(load){
  const detail = $("loadDetailOut");
  if (!detail) return;
  if (!load){
    detail.textContent = "Select a load from the dropdown to see details.";
    detail.style.whiteSpace = "pre-wrap";
    return;
  }
  const ln = (load.loadNumber && String(load.loadNumber).trim() !== "") ? `#${load.loadNumber}` : "";
  detail.textContent =
`Load ${ln}
Broker: ${load.brokerName || load.broker || ""}
Broker Address: ${load.brokerAddress || load.brokerAddr || load.broker?.addr || ""}
Phone: ${load.brokerPhone || load.broker?.phone || ""}
Email: ${load.brokerEmail || load.broker?.email || ""}

Shipper: ${load.shipperName || ""}
Shipper Address: ${load.shipperAddress || ""}

Consignee: ${load.consigneeName || ""}
Consignee Address: ${load.consigneeAddress || ""}

Delivery Date: ${load.deliveryDate || ""}
Miles: deadhead ${load.deadhead ?? 0} / loaded ${load.loaded ?? 0} / return ${(load.returning ? load.returnMiles : 0) || 0}
Gross: ${money(load.gross || 0)}
Fuel:  ${money(load.fuelCost || 0)}
Net:   ${money(load.net || 0)}
O.T.R.A.F.F: ${money(load.otr || 0)}/hr`;
  detail.style.whiteSpace = "pre-wrap";
}

function renderLoadsList() {
  const sel = $("loadsSelect");
  const list = $("loadsList"); // legacy (kept hidden in HTML)
  const btnDel = $("btnDeleteSelectedLoad");

  const loads = getLoads(); // newest-first
  selectedLoadIndex = null;
  if (btnDel) btnDel.disabled = true;

  // Dropdown UX
  if (sel) {
    const prevRaw = (sel.value || localStorage.getItem(LS_SELECTED_LOAD_INDEX) || "");
    sel.innerHTML = '<option value="">— Select a saved Actual load —</option>';

    if (!Array.isArray(loads) || !loads.length) {
      renderSelectedLoadDetail(null);
      if (list) list.innerHTML = "";
      return;
    }

    loads.forEach((l, i) => {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = formatLoadOptionLabel(l, i);
      sel.appendChild(opt);
    });

    // restore selection if possible
    if (prevRaw !== "" && Number.isFinite(Number(prevRaw)) && loads[Number(prevRaw)]) {
      sel.value = String(Number(prevRaw));
      selectedLoadIndex = Number(sel.value);
      if (btnDel) btnDel.disabled = false;
      renderSelectedLoadDetail(loads[selectedLoadIndex]);
    } else {
      renderSelectedLoadDetail(null);
    }

    // bind once
    if (sel.dataset.bound !== "1") {
      sel.dataset.bound = "1";
      sel.addEventListener("change", () => {
        const v = sel.value;
        if (v === "") {
          selectedLoadIndex = null;
          localStorage.removeItem(LS_SELECTED_LOAD_INDEX);
          if (btnDel) btnDel.disabled = true;
          renderSelectedLoadDetail(null);
          return;
        }
        selectedLoadIndex = Number(v);
        localStorage.setItem(LS_SELECTED_LOAD_INDEX, String(selectedLoadIndex));
        if (btnDel) btnDel.disabled = false;
        renderSelectedLoadDetail(loads[selectedLoadIndex]);
      });
    }

    if (list) list.innerHTML = "";
    return;
  }

  // Fallback: old stacked UI if dropdown missing
  if (!list) return;

  list.innerHTML = "";
  renderSelectedLoadDetail(null);

  if (!Array.isArray(loads) || !loads.length) {
    list.innerHTML = `<div class="list-item muted">No loads saved yet.</div>`;
    return;
  }

  loads.forEach((l, i) => {
    const ln = (l.loadNumber && String(l.loadNumber).trim() !== "") ? `#${l.loadNumber}` : `#${i + 1}`;
    const brokerLabel = (l.brokerName || l.broker || "Unknown Broker");
    const dateLabel = (l.deliveryDate || "No date");
    const netLabel = money(l.net);

    const detailsEl = document.createElement("details");
    detailsEl.className = "list-item";
    detailsEl.setAttribute("data-load-index", String(i));

    const summary = document.createElement("summary");
    summary.className = "trip-summary";
    summary.innerHTML = `
      <div>
        <div class="list-title">${escapeHtml(dateLabel)} — ${escapeHtml(brokerLabel)} — Load ${escapeHtml(ln)}</div>
        <div class="list-sub">Net ${escapeHtml(netLabel)}</div>
      </div>
      <span class="chev">▾</span>
    `;
    detailsEl.appendChild(summary);

    const body = document.createElement("div");
    body.className = "trip-detail";
    body.textContent =
`Load ${ln}
Broker: ${l.brokerName || l.broker || ""}
Broker Address: ${l.brokerAddress || l.brokerAddr || l.broker?.addr || ""}
Phone: ${l.brokerPhone || l.broker?.phone || ""}
Email: ${l.brokerEmail || l.broker?.email || ""}

Shipper: ${l.shipperName || ""}
Shipper Address: ${l.shipperAddress || ""}

Consignee: ${l.consigneeName || ""}
Consignee Address: ${l.consigneeAddress || ""}

Delivery Date: ${l.deliveryDate || ""}
Miles: deadhead ${l.deadhead ?? 0} / loaded ${l.loaded ?? 0} / return ${(l.returning ? l.returnMiles : 0) || 0}
Gross: ${money(l.gross || 0)}
Fuel:  ${money(l.fuelCost || 0)}
Net:   ${money(l.net || 0)}
O.T.R.A.F.F: ${money(l.otr || 0)}/hr`;
    body.style.whiteSpace = "pre-wrap";

    detailsEl.appendChild(body);

    detailsEl.addEventListener("toggle", () => {
      if (detailsEl.open) {
        selectedLoadIndex = i;
        if (btnDel) btnDel.disabled = false;
      }
    });

    list.appendChild(detailsEl);
  });
}

// ---------- Broker emails (Plain Code rules v1.0) ----------
function mostRecentLoad() {
  const loads = getLoads();
  return loads.length ? loads[loads.length - 1] : null;
}
function firmEmail(ctx) {
  const c = getCompanyInfoSafe();
  const loadLabel = ctx.loadNumber ? `Load ${ctx.loadNumber}` : "the load";
  const delivered = ctx.deliveryDate || todayISO();
  return `Subject: Payment Status Request — ${loadLabel} (Delivered ${delivered})
Hi ${ctx.brokerName || "[Broker]"} Team,
I’m following up on payment for ${loadLabel} delivered on ${delivered}. Please confirm payment status and expected pay date.
Load Summary:
- Load #: ${ctx.loadNumber || ""}
- Pickup: ${ctx.pickupDate || ""}
- Delivery: ${delivered}
- Shipper: ${ctx.shipperName || ""}
- Consignee: ${ctx.consigneeName || ""}
- Gross: ${money(ctx.gross || 0)}
Thank you,
${c.ownerName}
${c.companyName}
MC: ${c.mcNumber} | DOT: ${c.dotNumber}
${c.companyPhone}
${c.companyEmail}`;
}
function praiseEmail(ctx) {
  const c = getCompanyInfoSafe();
  const loadLabel = ctx.loadNumber ? `Load ${ctx.loadNumber}` : "the recent load";
  const delivered = ctx.deliveryDate || todayISO();
  return `Subject: Thank You — Smooth Load (${loadLabel})
Hi ${ctx.brokerName || "[Broker]"} Team,
Thank you for the smooth communication and support on ${loadLabel} delivered on ${delivered}. Everything went well and I appreciate working with you.
Looking forward to the next opportunity.
Best,
${c.ownerName}
${c.companyName}
${c.companyPhone}
${c.companyEmail}`;
}
function getBrokerEmailContext() {
  // Prefer Active Trip data (Trip module is the "load file")
  const t = findTripById(getActiveTripId()) || mostRecentTrip();
  const l = mostRecentLoad();
  // Merge where helpful (gross comes from Actual most recent load)
  const ctx = {
    brokerName: t?.broker?.name || l?.brokerName || "",
    brokerEmail: t?.broker?.email || l?.brokerEmail || "",
    brokerPhone: t?.broker?.phone || l?.brokerPhone || "",
    loadNumber: t?.loadNumber || "",
    pickupDate: t?.pickupDate || "",
    deliveryDate: t?.deliveryDate || l?.deliveryDate || "",
    shipperName: t?.shipper?.name || "",
    consigneeName: t?.consignee?.name || "",
    gross: l?.gross || 0,
  };
  return ctx;
}
// ================================
// Trip Module (Profiles + Auto-Fill) v1.0
// ================================
function initTripDropdowns() {
  const toggles = document.querySelectorAll(".trip-toggle");
  toggles.forEach(btn => {
    btn.addEventListener("click", () => {
      const content = btn.nextElementSibling;
      if (!content) return;
      const open = content.style.display === "block";
      content.style.display = open ? "none" : "block";
      // flip arrow symbol
      btn.textContent = btn.textContent.includes("▲")
        ? btn.textContent.replace("▲", "▼")
        : btn.textContent.replace("▼", "▲");
    });
  });
}
function clearTripInputs() {
  const ids = [
    "t_loadNumber","t_pickupDate","t_deliveryDate","t_weightLbs","t_rate","t_pickupAddr","t_deliveryAddr","t_deadheadMiles","t_loadedMiles","t_totalMiles","t_fuelPrice","t_gallons",
    "t_brokerName","t_brokerAddr","t_brokerEmail","t_brokerPhone",
    "t_shipperName","t_shipperAddr","t_shipperCity","t_shipperState","t_shipperZip",
    "t_consigneeName","t_consigneeAddr","t_consigneeCity","t_consigneeState","t_consigneeZip"
  ];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  const box = document.getElementById("t_otraffOut");
  if (box) box.textContent = "—";
  setActiveTripId("");
  updateActiveTripLabel();
}
function tripFromInputs(existingId) {
  const now = Date.now();
  const id = existingId || ("trip_" + now);
  return {
    id,
    loadNumber: (document.getElementById("t_loadNumber")?.value || "").trim(),
    pickupDate: document.getElementById("t_pickupDate")?.value || "",
    deliveryDate: document.getElementById("t_deliveryDate")?.value || "",
    pickupAddr: (document.getElementById("t_pickupAddr")?.value || "").trim(),
    deliveryAddr: (document.getElementById("t_deliveryAddr")?.value || "").trim(),
    weightLbs: Number(document.getElementById("t_weightLbs")?.value || 0) || 0,
    rate: Number(document.getElementById("t_rate")?.value || 0) || 0,
    deadheadMiles: Number(document.getElementById("t_deadheadMiles")?.value || 0) || 0,
    loadedMiles: Number(document.getElementById("t_loadedMiles")?.value || 0) || 0,
    fuelPrice: Number(document.getElementById("t_fuelPrice")?.value || 0) || 0,
    gallons: Number(document.getElementById("t_gallons")?.value || 0) || 0,
    broker: {
      name: (document.getElementById("t_brokerName")?.value || "").trim(),
      addr: (document.getElementById("t_brokerAddr")?.value || "").trim(),
      email: (document.getElementById("t_brokerEmail")?.value || "").trim(),
      phone: (document.getElementById("t_brokerPhone")?.value || "").trim()
    },
    shipper: {
      name: (document.getElementById("t_shipperName")?.value || "").trim(),
      addr: (document.getElementById("t_shipperAddr")?.value || "").trim(),
      city: (document.getElementById("t_shipperCity")?.value || "").trim(),
      state: (document.getElementById("t_shipperState")?.value || "").trim(),
      zip: (document.getElementById("t_shipperZip")?.value || "").trim()
    },
    consignee: {
      name: (document.getElementById("t_consigneeName")?.value || "").trim(),
      addr: (document.getElementById("t_consigneeAddr")?.value || "").trim(),
      city: (document.getElementById("t_consigneeCity")?.value || "").trim(),
      state: (document.getElementById("t_consigneeState")?.value || "").trim(),
      zip: (document.getElementById("t_consigneeZip")?.value || "").trim()
    },
    createdAt: now,
    updatedAt: now
  };
}
function loadTripToInputs(trip) {
  if (!trip) return;
  $("t_loadNumber").value = trip.loadNumber || "";
  $("t_pickupDate").value = trip.pickupDate || "";
  $("t_deliveryDate").value = trip.deliveryDate || "";
  $("t_pickupAddr") && ($("t_pickupAddr").value = trip.pickupAddr || "");
  $("t_deliveryAddr") && ($("t_deliveryAddr").value = trip.deliveryAddr || "");
  // Keep address history fresh for dropdown suggestions
  try { addUniqueToStrList(LS_TRIP_PICKUP_ADDRS, trip.pickupAddr || ""); } catch {}
  try { addUniqueToStrList(LS_TRIP_DELIVERY_ADDRS, trip.deliveryAddr || ""); } catch {}
  try { refreshTripAddressDatalists(); } catch {}
  $("t_weightLbs").value = trip.weightLbs || "";
  $("t_rate").value = (trip.rate ?? "") || "";
  $("t_deadheadMiles").value = (trip.deadheadMiles ?? "") || "";
  $("t_loadedMiles").value = (trip.loadedMiles ?? "") || "";
  $("t_fuelPrice").value = (trip.fuelPrice ?? "") || "";
  $("t_gallons").value = (trip.gallons ?? "") || "";
  updateTripDerivedUI();
  $("t_brokerName").value = trip.broker?.name || "";
  $("t_brokerAddr") && ($("t_brokerAddr").value = trip.broker?.addr || "");
  $("t_brokerEmail").value = trip.broker?.email || "";
  $("t_brokerPhone").value = trip.broker?.phone || "";
  $("t_shipperName").value = trip.shipper?.name || "";
  $("t_shipperAddr").value = trip.shipper?.addr || "";
  $("t_shipperCity").value = trip.shipper?.city || "";
  $("t_shipperState").value = trip.shipper?.state || "";
  $("t_shipperZip").value = trip.shipper?.zip || "";
  $("t_consigneeName").value = trip.consignee?.name || "";
  $("t_consigneeAddr").value = trip.consignee?.addr || "";
  $("t_consigneeCity").value = trip.consignee?.city || "";
  $("t_consigneeState").value = trip.consignee?.state || "";
  $("t_consigneeZip").value = trip.consignee?.zip || "";
  setActiveTripId(trip.id);
  updateActiveTripLabel();
}

function updateTripDerivedUI() {
  // Trip-derived totals + O.T.R.A.F.F (estimate)
  const deadhead = Number($("t_deadheadMiles")?.value || 0) || 0;
  const loaded = Number($("t_loadedMiles")?.value || 0) || 0;
  const totalMiles = deadhead + loaded;

  const tm = $("t_totalMiles");
  if (tm) tm.value = totalMiles > 0 ? totalMiles.toFixed(1) : "";

  const box = $("t_otraffOut");
  if (!box) return;

  // If nothing entered yet, keep it clean
  if (totalMiles <= 0) { box.textContent = "—"; return; }

  const s = getSettings() || { defaultMpg: 6.8, fuelStopMin: 15, household: 0, businessFixed: 0, reserves: {} };
  const gross = Number($("t_rate")?.value || 0) || 0;
  const fuelPrice = Number($("t_fuelPrice")?.value || 0) || 0;
  const gallons = Number($("t_gallons")?.value || 0) || 0;
  const waitHours = 0;

  const dot = computeDotMinimum({ totalMiles, waitHours, settings: s });
  const out = calcCore({ deadhead, loaded, returning: false, returnMiles: 0, gross }, s, fuelPrice, gallons, dot.minHoursAway);

  box.textContent =
`DOT / Time Breakdown (Estimate)
Driving Hours: ${dot.drivingHours.toFixed(1)}
30-min Breaks: ${dot.breakHours.toFixed(1)}
Fuel Stops: ${dot.fuelStops} (Fuel Time: ${dot.fuelHours.toFixed(1)} hrs)
Sleeper (10-hr breaks): ${dot.sleeperHours.toFixed(1)} hrs
Days On Road: ${dot.days}
Minimum Hours Away: ${dot.minHoursAway.toFixed(1)} hrs

Trip Math (from Trip inputs)
Total Miles: ${totalMiles.toFixed(1)}
Fuel Cost: $${(Number.isFinite(out.fuelCost)?out.fuelCost:0).toFixed(2)}
Net: $${(Number.isFinite(out.net)?out.net:0).toFixed(2)}
O.T.R.A.F.F: $${(Number.isFinite(out.otr)?out.otr:0).toFixed(2)}/hr`;
}

function updateActiveTripLabel() {
  const label = $("activeTripLabel");
  if (!label) return;
  const activeId = getActiveTripId();
  if (!activeId) {
    label.textContent = "Active Trip: None selected";
    return;
  }
  const trip = findTripById(activeId);
  if (!trip) {
    label.textContent = "Active Trip: None selected";
    return;
  }
  const title = trip.loadNumber || "(no load #)";
  label.textContent = "Active Trip: " + title;
}
// ================================
// Trip Name Cache (Broker/Shipper/Consignee) — Autosave on blur
// Purpose: Allow dropdown suggestions even before a Trip is saved.
// Storage: localStorage (offline friendly)
// ================================
const NAMECACHE_KEY = "tms_nameCache_v1";
function getNameCache() {
  try {
    const raw = localStorage.getItem(NAMECACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const safe = parsed && typeof parsed === "object" ? parsed : {};
    return {
      brokers: Array.isArray(safe.brokers) ? safe.brokers : [],
      shippers: Array.isArray(safe.shippers) ? safe.shippers : [],
      consignees: Array.isArray(safe.consignees) ? safe.consignees : [],
    };
  } catch {
    return { brokers: [], shippers: [], consignees: [] };
  }
}
function setNameCache(cache) {
  try { localStorage.setItem(NAMECACHE_KEY, JSON.stringify(cache)); } catch {}
}
function addNameToCache(kind, name) {
  const v = String(name || "").trim();
  if (!v) return;
  const cache = getNameCache();
  const map = {
    broker: "brokers",
    shipper: "shippers",
    consignee: "consignees"
  };
  const key = map[kind];
  if (!key) return;
  const arr = cache[key] || [];
  const lower = v.toLowerCase();
  const exists = arr.some(x => String(x || "").trim().toLowerCase() === lower);
  if (exists) return;
  arr.unshift(v);
  // Keep it light (mobile/localStorage safe)
  cache[key] = arr.slice(0, 60);
  setNameCache(cache);
}
function updateNameDatalists() {
  const trips = getTrips();
  const brokers = new Set();
  const shippers = new Set();
  const consignees = new Set();
  trips.forEach(t => {
    if (t.broker?.name) brokers.add(String(t.broker.name).trim());
    if (t.shipper?.name) shippers.add(String(t.shipper.name).trim());
    if (t.consignee?.name) consignees.add(String(t.consignee.name).trim());
  });

  // Also include autosaved names (even if user hasn't saved the trip yet)
  const cache = getNameCache();
  (cache.brokers || []).forEach(n => brokers.add(String(n).trim()));
  (cache.shippers || []).forEach(n => shippers.add(String(n).trim()));
  (cache.consignees || []).forEach(n => consignees.add(String(n).trim()));

  const brokerList = Array.from(brokers).filter(Boolean).sort((a,b)=>a.localeCompare(b)).slice(0, 30);
  const shipperList = Array.from(shippers).filter(Boolean).sort((a,b)=>a.localeCompare(b)).slice(0, 30);
  const consigneeList = Array.from(consignees).filter(Boolean).sort((a,b)=>a.localeCompare(b)).slice(0, 30);
  const dlBroker = $("dl_brokerNames");
  const dlShipper = $("dl_shipperNames");
  const dlConsignee = $("dl_consigneeNames");
  const fill = (dl, arr) => {
    if (!dl) return;
    dl.innerHTML = "";
    arr.forEach(name => { dl.innerHTML += `<option value="${name}"></option>`; });
  };
  fill(dlBroker, brokerList);
  fill(dlShipper, shipperList);
  fill(dlConsignee, consigneeList);
  // Also populate the Trip Entry "Recall ..." dropdowns (helps on mobile where datalist UI is inconsistent)
  const selBroker = $("t_brokerRecall");
  const selShipper = $("t_shipperRecall");
  const selConsignee = $("t_consigneeRecall");
  const fillSelect = (sel, arr, placeholder) => {
    if (!sel) return;
    const current = sel.value || "";
    sel.innerHTML = `<option value="">${placeholder}</option>` + arr.map(v => `<option value="${v}">${v}</option>`).join("");
    // keep selection if still present
    if (current && arr.includes(current)) sel.value = current;
  };
  fillSelect(selBroker, brokerList, "Recall broker…");
  fillSelect(selShipper, shipperList, "Recall shipper…");
  fillSelect(selConsignee, consigneeList, "Recall consignee…");
}

function mostRecentTripWith(field, name) {
  const n = (name || "").trim().toLowerCase();
  if (!n) return null;
  const trips = getTrips()
    .filter(t => String((t[field]?.name || "")).trim().toLowerCase() === n)
    .sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return trips[0] || null;
}
function hookTripAutofill() {
  // Quick recall dropdowns (select -> fills name and triggers existing autofill)
  $("t_brokerRecall")?.addEventListener("change", () => {
    const v = $("t_brokerRecall").value;
    if (!v) return;
    $("t_brokerName").value = v;
    $("t_brokerName").dispatchEvent(new Event("change"));
  });
  $("t_shipperRecall")?.addEventListener("change", () => {
    const v = $("t_shipperRecall").value;
    if (!v) return;
    $("t_shipperName").value = v;
    $("t_shipperName").dispatchEvent(new Event("change"));
  });
  $("t_consigneeRecall")?.addEventListener("change", () => {
    const v = $("t_consigneeRecall").value;
    if (!v) return;
    $("t_consigneeName").value = v;
    $("t_consigneeName").dispatchEvent(new Event("change"));
  });

  // Broker autofill: address + email/phone
  $("t_brokerName")?.addEventListener("change", () => {
    // Autosave name immediately (so it appears next time)
    addNameToCache("broker", $("t_brokerName").value);
    updateNameDatalists();
    const t = mostRecentTripWith("broker", $("t_brokerName").value);
    if (!t) return;

    // Only fill blanks (never overwrite what the user already typed)
    if (!$("t_brokerAddr").value) $("t_brokerAddr").value = t.broker?.addr || "";
    if (!$("t_brokerEmail").value) $("t_brokerEmail").value = t.broker?.email || "";
    if (!$("t_brokerPhone").value) $("t_brokerPhone").value = t.broker?.phone || "";
  });
  $("t_brokerName")?.addEventListener("blur", () => {
    addNameToCache("broker", $("t_brokerName").value);
    updateNameDatalists();
  });

// Shipper autofill: address fields + (optional) load weight
  $("t_shipperName")?.addEventListener("change", () => {
    addNameToCache("shipper", $("t_shipperName").value);
    updateNameDatalists();
    const t = mostRecentTripWith("shipper", $("t_shipperName").value);
    if (!t) return;
    if (!$("t_shipperAddr").value) $("t_shipperAddr").value = t.shipper?.addr || "";
    if (!$("t_shipperCity").value) $("t_shipperCity").value = t.shipper?.city || "";
    if (!$("t_shipperState").value) $("t_shipperState").value = t.shipper?.state || "";
    if (!$("t_shipperZip").value) $("t_shipperZip").value = t.shipper?.zip || "";
    // If weight empty, recall most recent weight for this shipper
    if (!Number($("t_weightLbs")?.value || 0)) $("t_weightLbs").value = t.weightLbs || "";
  });
  $("t_shipperName")?.addEventListener("blur", () => {
    addNameToCache("shipper", $("t_shipperName").value);
    updateNameDatalists();
  });
  // Consignee autofill: address fields
  $("t_consigneeName")?.addEventListener("change", () => {
    addNameToCache("consignee", $("t_consigneeName").value);
    updateNameDatalists();
    const t = mostRecentTripWith("consignee", $("t_consigneeName").value);
    if (!t) return;
    if (!$("t_consigneeAddr").value) $("t_consigneeAddr").value = t.consignee?.addr || "";
    if (!$("t_consigneeCity").value) $("t_consigneeCity").value = t.consignee?.city || "";
    if (!$("t_consigneeState").value) $("t_consigneeState").value = t.consignee?.state || "";
    if (!$("t_consigneeZip").value) $("t_consigneeZip").value = t.consignee?.zip || "";
  });
  $("t_consigneeName")?.addEventListener("blur", () => {
    addNameToCache("consignee", $("t_consigneeName").value);
    updateNameDatalists();
  });
}

function updateLoadRecallOptions() {
  const sel = $("t_loadRecall");
  if (!sel) return;
  const trips = getTrips().slice().sort((a,b) => {
    const ta = Date.parse(a.pickupDate || "") || (a.updatedAt || 0);
    const tb = Date.parse(b.pickupDate || "") || (b.updatedAt || 0);
    return tb - ta;
  });
  const current = sel.value;
  sel.innerHTML = `<option value="">Select a saved load…</option>` + trips.map(t => {
    const title = (t.loadNumber || "(no load #)");
    const d = t.pickupDate || "";
    return `<option value="${t.id}">${title}${d ? " — " + d : ""}</option>`;
  }).join("");
  if (current && trips.some(t => t.id === current)) sel.value = current;
}

function renderTripList() {
  updateActiveTripLabel();
  updateNameDatalists();
  updateLoadRecallOptions();
  try { updateTripFilesTripSelect(); } catch {}
  try { renderTripFilesList(getTripFilesSelectedTripId()); } catch {}

  const list = $("tripList");
  if (!list) return;

  const trips = getTrips().slice().sort((a,b) => {
    const ta = Date.parse(a.pickupDate || "") || (a.updatedAt || 0);
    const tb = Date.parse(b.pickupDate || "") || (b.updatedAt || 0);
    return tb - ta;
  });

  const activeId = getActiveTripId();

  if (!trips.length) {
    list.innerHTML = `<div class="hint">No saved trips yet.</div>`;
    return;
  }

  list.innerHTML = "";
  trips.forEach(t => {
    const isActive = t.id === activeId;
    const title = t.loadNumber || "(no load #)";
    const sub = (t.pickupDate || "") + (t.deliveryDate ? (" → " + t.deliveryDate) : "");

    const details = document.createElement("details");
    details.className = "list-item" + (isActive ? " active" : "");
    details.setAttribute("data-trip-id", t.id);

    const summary = document.createElement("summary");
    summary.className = "trip-summary";

    const left = document.createElement("div");
    const t1 = document.createElement("div");
    t1.className = "list-title";
    t1.textContent = title + (isActive ? " (Active)" : "");
    const t2 = document.createElement("div");
    t2.className = "list-sub";
    t2.textContent = sub;
    left.appendChild(t1);
    left.appendChild(t2);

    const chev = document.createElement("span");
    chev.className = "chev";
    chev.textContent = "▾";

    summary.appendChild(left);
    summary.appendChild(chev);
    details.appendChild(summary);

    const body = document.createElement("div");
    body.className = "trip-detail";

    const mini = document.createElement("div");
    mini.className = "mini";

    function miniLine(label, value) {
      const d = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = label + ": ";
      d.appendChild(strong);
      d.appendChild(document.createTextNode(value || ""));
      return d;
    }

    const fullAddr = (obj) => {
      if (!obj) return "";
      const addr = (obj.addr || "").trim();
      const city = (obj.city || "").trim();
      const state = (obj.state || "").trim();
      const zip = (obj.zip || "").trim();
      const cityStateZip = [city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
      return [addr, cityStateZip].filter(Boolean).join(", ").trim();
    };

    mini.appendChild(miniLine("Broker", t.broker?.name || ""));
    mini.appendChild(miniLine("Broker Address", t.broker?.addr || ""));
    mini.appendChild(miniLine("Shipper", t.shipper?.name || ""));
    mini.appendChild(miniLine("Shipper Address", fullAddr(t.shipper)));
    mini.appendChild(miniLine("Consignee", t.consignee?.name || ""));
    mini.appendChild(miniLine("Consignee Address", fullAddr(t.consignee)));
    mini.appendChild(miniLine("Weight", String(t.weightLbs || "")));

    const actions = document.createElement("div");
    actions.className = "trip-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "trip-edit-btn";
    editBtn.textContent = "Edit";

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "trip-delete-btn";
    delBtn.textContent = "Delete";

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    body.appendChild(mini);
    body.appendChild(actions);
    details.appendChild(body);

    // Summary click => Active + load into form
    summary.addEventListener("click", (e) => {
      if (e.target && (e.target.closest(".trip-delete-btn") || e.target.closest(".trip-edit-btn"))) return;
      const id = details.getAttribute("data-trip-id");
      const trip = findTripById(id);
      if (!trip) return;
      loadTripToInputs(trip);
      setActiveTripId(id);
      const tfSel = $("tripFilesTripSelect");
      if (tfSel) tfSel.value = id;
      try { renderTripFilesList(id); } catch {}
      list.querySelectorAll("details.list-item").forEach(d => d.classList.toggle("active", d.getAttribute("data-trip-id") === id));
      updateActiveTripLabel();
      const sel = $("t_loadRecall");
      if (sel) sel.value = id;
    });

    // Edit => load + set active + re-render
    editBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = details.getAttribute("data-trip-id");
      const trip = findTripById(id);
      if (!trip) return;
      loadTripToInputs(trip);
      setActiveTripId(id);
      renderTripList();
  try { initTripFilesUI(); } catch (e) { console.warn('trip_files_init_failed', e); }
    });

    // Delete
    delBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = details.getAttribute("data-trip-id");
      const trip = findTripById(id);
      if (!trip) return;
      const nm = trip.loadNumber || "(no load #)";
      const ok = confirm("Delete trip " + nm + "? This cannot be undone.");
      if (!ok) return;
      saveTrips(getTrips().filter(x => x.id !== id));
      if (getActiveTripId() === id) setActiveTripId("");
      renderTripList();
    });

    list.appendChild(details);
  });

  // keep Actual dropdown in sync
  try { refreshActualTripDropdown(); } catch {}
}
function invoiceFromTrip(trip) {
  const remit = getRemitInfo();
  const c = getCompanyInfoSafe();
  const ship = trip.shipper || {};
  const con = trip.consignee || {};
  const broker = trip.broker || {};
  const shipLine2 = [ship.city, ship.state, ship.zip].filter(Boolean).join(", ").replace(", ,", ",");
  const conLine2 = [con.city, con.state, con.zip].filter(Boolean).join(", ").replace(", ,", ",");
  return `
INVOICE
Carrier:
${c.companyName}
Attn: ${c.ownerName}
MC: ${c.mcNumber}   DOT: ${c.dotNumber}
Phone: ${c.companyPhone}
Email: ${c.companyEmail}
Bill To (Broker):
${broker.name || ""}
Phone: ${broker.phone || ""}
Email: ${broker.email || ""}
Load Details:
Load Number: ${trip.loadNumber || ""}
Pickup Date: ${trip.pickupDate || ""}
Delivery Date: ${trip.deliveryDate || ""}
Load Weight (lbs): ${trip.weightLbs || ""}
Rate / Revenue: $${(trip.rate || 0) ? Number(trip.rate).toFixed(2) : ""}
Shipper:
${ship.name || ""}
${ship.addr || ""}
${shipLine2}
Consignee:
${con.name || ""}
${con.addr || ""}
${conLine2}
---------------------------------------
Freight Charges: $${(trip.rate || 0) ? Number(trip.rate).toFixed(2) : "____________________"}
---------------------------------------
Remit To:
${remit || ""}
Thank you for your business.
`.trim();
}
function initTripModule() {
  // Remittance (global) load + autosave
  const remitEl = $("t_remitInfo");
  if (remitEl) {
    remitEl.value = getRemitInfo();
    remitEl.addEventListener("input", () => saveRemitInfo(remitEl.value));
  }


  // Pickup/Delivery address autosave + dropdown suggestions
  initTripAddressAutosave();

  // Trip derived (Total Miles + O.T.R.A.F.F)
  ["t_deadheadMiles","t_loadedMiles","t_fuelPrice","t_gallons","t_rate"].forEach(id => {
    $(id)?.addEventListener("input", updateTripDerivedUI);
    $(id)?.addEventListener("change", updateTripDerivedUI);
  });
  updateTripDerivedUI();
  // Save Trip
  $("btnSaveTrip")?.addEventListener("click", () => {
    const activeId = getActiveTripId();
    const trips = getTrips();
    const now = Date.now();
    const t = tripFromInputs(activeId || null);
    // Required fields guardrail (Trip must be usable)
    const missing = [];
    if (!t.loadNumber) missing.push("Load #");
    if (!t.pickupDate) missing.push("Pickup Date");
    if (!t.broker?.name) missing.push("Broker Name");
    if (missing.length) {
      alert("Missing required fields: " + missing.join(", "));
      return;
    }
    t.updatedAt = now;
    const idx = trips.findIndex(x => x.id === t.id);
    if (idx >= 0) {
      // Preserve auto invoice number on updates
      t.createdAt = trips[idx].createdAt || t.createdAt;
      t.invoiceNo = (trips[idx].invoiceNo || trips[idx].invoiceNumber || t.invoiceNo || "").toString();
      if (!t.invoiceNo.trim()) t.invoiceNo = getNextInvoiceNumber();
      trips[idx] = t;
    } else {
      // Assign auto invoice number on creation
      t.invoiceNo = (t.invoiceNo || "").toString();
      if (!t.invoiceNo.trim()) t.invoiceNo = getNextInvoiceNumber();
      trips.push(t);
    }
    saveTrips(trips);
    setActiveTripId(t.id);
    renderTripList();
    refreshActualTripDropdown();
    $("tripHint") && ($("tripHint").textContent = "Trip saved.");
  });
  // New Trip
  $("btnNewTrip")?.addEventListener("click", () => {
    clearTripInputs();
    renderTripList();
    refreshActualTripDropdown();
    $("tripHint") && ($("tripHint").textContent = "New Trip (blank). Fill and Save.");
  });

  // Auto-Calculate Miles (Google Maps) — Loaded miles and optional deadhead from last trip delivery
  $("btnTripCalcMiles")?.addEventListener("click", async () => {
    const pickup = ($("t_pickupAddr")?.value || "").trim();
    const drop = ($("t_deliveryAddr")?.value || "").trim();
    if (!pickup || !drop) {
      alert("Enter both Pickup Address and Delivery Address first.");
      return;
    }
    // Save addresses immediately so they are available next time (even if user doesn’t hit Save Trip yet)
    try { addUniqueToStrList(LS_TRIP_PICKUP_ADDRS, pickup); } catch {}
    try { addUniqueToStrList(LS_TRIP_DELIVERY_ADDRS, drop); } catch {}
    try { refreshTripAddressDatalists(); } catch {}
    try {
      await ensureGoogleMapsLoaded();
    } catch (e) {
      alert("Google Maps miles auto-calc needs an API key in Settings (Google Maps API Key).");
      return;
    }
    $("tripHint") && ($("tripHint").textContent = "Calculating miles…");
    try {
      const loadedMiles = await calcRouteMiles(pickup, drop);
      if ($("t_loadedMiles")) $("t_loadedMiles").value = loadedMiles ? loadedMiles.toFixed(1) : "";
      // Deadhead auto-calc from last saved Trip delivery → this pickup (when Deadhead is blank)
      const deadheadBlank = !parseFloat($("t_deadheadMiles")?.value || "");
      if (deadheadBlank) {
        const trips = getTrips();
        // pick most recent saved trip (excluding current active id if it exists)
        const activeId = getActiveTripId();
        const candidates = (trips || []).filter(x => x && x.id && x.id !== activeId && (x.deliveryAddr || x.consignee?.addr || "").trim());
        candidates.sort((a,b) => (b.updatedAt||b.createdAt||0) - (a.updatedAt||a.createdAt||0));
        const last = candidates[0] || null;
        const lastDrop = (last?.deliveryAddr || "").trim() || "";
        if (lastDrop) {
          const deadheadMiles = await calcRouteMiles(lastDrop, pickup);
          if ($("t_deadheadMiles")) $("t_deadheadMiles").value = deadheadMiles ? deadheadMiles.toFixed(1) : "";
        }
      }
      updateTripDerivedUI();
      $("tripHint") && ($("tripHint").textContent = "Miles updated from Google Maps.");
    } catch (e) {
      console.error(e);
      $("tripHint") && ($("tripHint").textContent = "Miles auto-calc failed. Check addresses or API key restrictions.");
      alert("Miles auto-calc failed. Make sure addresses are valid and your Google API key has Maps JavaScript API enabled.");
    }
  });

  // Broker Email (from Trip)
  function openBrokerEmail(kind) {
  const trip = tripFromInputs(getActiveTripId() || undefined);
  const email = String(trip.broker?.email || "").trim();
  if (!email) {
    $("tripHint") && ($("tripHint").textContent = "Add Broker Email first (Trip → Broker).");
    return;
  }
  const loadNum = trip.loadNumber || "";
  const subj = ("Load " + loadNum + " — " + (kind === "praise" ? "Appreciation" : "Confirmation / Rules")).trim();

  let body = "";
  if (kind === "praise") {
    body =
      "Thanks for the load.\n\n" +
      "Load #: " + loadNum + "\n" +
      "Pickup: " + (trip.pickupDate || "") + "\n" +
      "Delivery: " + (trip.deliveryDate || "") + "\n\n" +
      "Shipper: " + (trip.shipper?.name || "") + "\n" +
      "Consignee: " + (trip.consignee?.name || "") + "\n" +
      "Rate: $" + ((trip.rate || 0) ? Number(trip.rate).toFixed(2) : "") + "\n\n" +
      "If you have anything else that needs handled, just send it over.";
  } else {
    body =
      "Confirming load details and Plain Code rules:\n\n" +
      "Load #: " + loadNum + "\n" +
      "Pickup: " + (trip.pickupDate || "") + "\n" +
      "Delivery: " + (trip.deliveryDate || "") + "\n\n" +
      "Shipper: " + (trip.shipper?.name || "") + "\n" +
      "Consignee: " + (trip.consignee?.name || "") + "\n" +
      "Weight (lbs): " + (trip.weightLbs || "") + "\n" +
      "Rate: $" + ((trip.rate || 0) ? Number(trip.rate).toFixed(2) : "") + "\n\n" +
      "Rules:\n" +
      "- Detention starts after 1 hour of arrival (must be billed).\n" +
      "- Any changes to appointment times must be confirmed in writing.\n" +
      "- Lumper, TONU, layover, and re-delivery must be pre-approved and billed.\n\n" +
      "Please confirm receipt.";
  }

  const link = "mailto:" + encodeURIComponent(email) +
    "?subject=" + encodeURIComponent(subj) +
    "&body=" + encodeURIComponent(body);
  window.location.href = link;
}
$("btnTripFirmEmail")?.addEventListener("click", () => openBrokerEmail("firm"));
$("btnTripPraiseEmail")?.addEventListener("click", () => openBrokerEmail("praise"));

  // Invoice
  function onGenerateInvoiceClick() {
    const out = $("invoiceOut");
    try {
      const trip = findTripById(getActiveTripId()) || mostRecentTrip();

      if (!trip) {
        if (out) out.textContent = "No saved Trip yet. Save a Trip first.";
        return;
      }

      // Auto invoice numbering (stable per trip)
      const invoiceNo = ensureTripInvoiceNumber(trip);
      // Persist invoice number back to Trips storage
      try {
        const trips = getTrips();
        const tid = trip.id;
        const updated = trips.map(t => (t && tid && t.id === tid) ? { ...t, invoiceNo } : t);
        saveTrips(updated);
      } catch {}

      // Remittance (global) — show on invoice
      const remit = $("t_remitInfo")?.value || "";

      // Simple invoice date (local)
      const today = fmtDate(new Date());

      // FROM (Company Info)
      const fromCompany = $("s_companyName")?.value || "";
      const fromOwner   = $("s_ownerName")?.value || "";
      const fromPhone   = $("s_companyPhone")?.value || "";
      const fromEmail   = $("s_companyEmail")?.value || "";
      const fromMC      = $("s_mcNumber")?.value || "";
      const fromDOT     = $("s_dotNumber")?.value || "";

      // TO (Broker)
      const toBroker = trip.broker?.name || "";
      const toEmail  = trip.broker?.email || "";
      const toPhone  = trip.broker?.phone || "";
      const toAddr = trip.broker?.addr || trip.brokerAddr || "";

    // Shipment addresses
    const shipperLine1 = [trip.shipper?.addr, trip.shipper?.city, trip.shipper?.state, trip.shipper?.zip]
      .filter(Boolean).join(", ");
    const consigneeLine1 = [trip.consignee?.addr, trip.consignee?.city, trip.consignee?.state, trip.consignee?.zip]
      .filter(Boolean).join(", ");

    const invoiceHTML = `
      <div class="invoice-wrap" aria-label="Invoice Preview">

        <div class="invoice-header">
          <div class="invoice-ids">
            <div class="invoice-title"><span class="invoice-label">Invoice #</span> ${invoiceNo || "----"}</div>
            <div class="invoice-subtitle"><span class="invoice-label">Load #</span> ${(trip.loadNumber || "").trim() || "—"}</div>
          </div>
          <div class="invoice-meta">
            <div><strong>Date</strong> ${today}</div>
            <div><strong>Terms:</strong> NET 10 DAYS</div>
          </div>
        </div>

        <div class="invoice-grid">

         <div class="invoice-box">
  <strong>TO:</strong><br>
  ${toBroker}<br>
  ${toAddr ? `${toAddr}<br>` : ``}
  ${toEmail ? `${toEmail}<br>` : ``}
  ${toPhone ? `${toPhone}` : ``}
</div>

          <div class="invoice-box">
            <strong>FROM:</strong>
            ${fromCompany || ``}<br>
            ${fromOwner ? `${fromOwner}<br>` : ``}
            ${fromPhone ? `Phone: ${fromPhone}<br>` : ``}
            ${fromEmail ? `Email: ${fromEmail}<br>` : ``}
            ${fromMC ? `MC#: ${fromMC}<br>` : ``}
            ${fromDOT ? `DOT#: ${fromDOT}` : ``}
          </div>

        </div>

        <table class="invoice-table" role="table">
          <thead>
            <tr>
              <th style="width:90px;">Load #</th>
              <th>Shipment Info</th>
              <th style="width:120px;">Primary Fee</th>
              <th style="width:120px;">Sub Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${trip.loadNumber || ""}</td>
              <td>
                ${trip.bolNumber ? `BOL: ${trip.bolNumber}<br>` : ``}
                Pickup Date: ${fmtDate(trip.pickupDate)}<br>
                Delivery Date: ${fmtDate(trip.deliveryDate)}<br>
                ${trip.weightLbs ? `Weight: ${Number(trip.weightLbs).toLocaleString()} lbs<br>` : ``}

                <br>

                <div><strong>From:</strong></div>
                <div><strong>Shipper</strong></div>
                <div>${trip.shipper?.name || ""}</div>
                <div>${shipperLine1 || ""}</div>

                <br>

                <div><strong>To:</strong></div>
                <div><strong>Consignee</strong></div>
                <div>${trip.consignee?.name || ""}</div>
                <div>${consigneeLine1 || ""}</div>

                <br>

                ${remit ? `<div><strong>Remittance:</strong></div><div style="white-space:pre-wrap;">${escapeHtml(remit)}</div>` : ``}
              </td>
              <td>${money(trip.rate)}</td>
              <td>${money(trip.rate)}</td>
            </tr>
          </tbody>
        </table>

        <div class="invoice-total">
          Invoice Total: ${money(trip.rate)}<br>
          Balance Due: ${money(trip.rate)}
        </div>

        <div style="text-align:center; margin-top:18px;">We appreciate your business!</div>

      </div>
    `;

      if (out) out.innerHTML = invoiceHTML;

      // Enable Print button once invoice is built
      const btnPrint = $("btnPrintInvoice");
      if (btnPrint) btnPrint.disabled = false;
      const btnPdf = $("btnPdfInvoice");
      if (btnPdf) btnPdf.disabled = false;
    } catch (err) {
      console.error("Invoice generation error", err);
      if (out) out.textContent = "Invoice error: " + (err?.message || String(err));
    }
  }

  // Bind directly (normal case)
  $("btnInvoice")?.addEventListener("click", onGenerateInvoiceClick);

  // Safety net: delegated click handler (covers dynamic re-renders / edge cases)
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.id === "btnInvoice") onGenerateInvoiceClick();
  });

  $("btnPrintInvoice")?.addEventListener("click", () => {
  const invoiceHTML = $("invoiceOut")?.innerHTML || "";
  if (!invoiceHTML.trim()) return;

  const printCss = `
    @page { margin: 12mm; }
    body { margin: 0; background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; }
    .invoice-wrap { border: none; margin: 0; max-width: none; padding: 0; }
    .invoice-header { border-bottom: 1px solid #ddd; padding-bottom: 12px; margin-bottom: 16px; }
    .invoice-title { font-size: 26px; font-weight: 700; }
    .invoice-meta { text-align: right; font-size: 14px; }
    .invoice-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 18px; }
    .invoice-box strong { display: block; margin-bottom: 4px; }
    .invoice-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    .invoice-table th, .invoice-table td { border: 1px solid #ccc; padding: 8px; vertical-align: top; }
    .invoice-table th { background: #f3f3f3; }
    .invoice-total { text-align: right; margin-top: 20px; font-size: 18px; font-weight: 700; }
  `;

  const w = window.open("", "_blank", "width=950,height=700");
  if (!w) return;

  w.document.open();
  w.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Invoice</title>
        <style>${printCss}</style>
      </head>
      <body>
        ${invoiceHTML}
        <script>
          window.onload = () => {
            window.focus();
            window.print();
            window.close();
          };
        </script>
      </body>
    </html>
  `);
  w.document.close();
});

// Create PDF (downloads a PDF file of the invoice preview)
$("btnPdfInvoice")?.addEventListener("click", async () => {
  try {
    const out = $("invoiceOut");
    const node = document.querySelector("#invoiceOut .invoice-wrap") || out;
    if (!node) return;

    const html = out?.innerHTML || "";
    if (!html.trim()) return;

    if (typeof window.html2canvas !== "function" || !window.jspdf?.jsPDF) {
      alert("PDF libraries failed to load. Please check your internet connection and refresh.");
      return;
    }

    // Render invoice to a high-res canvas
    const canvas = await window.html2canvas(node, { scale: 2, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");

    const { jsPDF } = window.jspdf;

    // Letter size in points
    const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "letter" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const margin = 24; // 1/3 inch-ish
    const usableWidth = pageWidth - margin * 2;
    const imgWidth = usableWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let y = margin;
    let remaining = imgHeight;

    // Add first page
    pdf.addImage(imgData, "PNG", margin, y, imgWidth, imgHeight, undefined, "FAST");

    // If it overflows, add pages by shifting the image up
    remaining -= (pageHeight - margin * 2);
    let page = 1;
    while (remaining > 0) {
      pdf.addPage();
      page += 1;
      const offsetY = margin - (pageHeight - margin * 2) * (page - 1);
      pdf.addImage(imgData, "PNG", margin, offsetY, imgWidth, imgHeight, undefined, "FAST");
      remaining -= (pageHeight - margin * 2);
    }

    // Filename
    const activeId = getActiveTripId?.() || "";
    const safeId = String(activeId || "invoice").replace(/[^a-z0-9\-_]+/gi, "_");
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    pdf.save(`Invoice_${safeId}_${yyyy}-${mm}-${dd}.pdf`);
  } catch (err) {
    console.error("Create PDF error", err);
    alert("Could not create PDF. See console for details.");
  }
});

renderTripList();
  updateNameDatalists();
  hookTripAutofill();

  // Load Recall
  $("btnLoadRecall")?.addEventListener("click", () => {
    const id = $("t_loadRecall")?.value || "";
    if (!id) return;
    const trip = findTripById(id);
    if (!trip) return;
    loadTripToInputs(trip);
    setActiveTripId(id);
    renderTripList();
    refreshActualTripDropdown();
    $("tripHint") && ($("tripHint").textContent = "Loaded saved Trip into form.");
  });
  $("t_loadRecall")?.addEventListener("change", () => {
    $("btnLoadRecall")?.click();
  });
}
// ================================
// Lifetime MPG (logs when you tap Save Actual)
// ================================
function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function getStoredNumber(key, fallback = 0) {
  const v = Number(localStorage.getItem(key));
  return Number.isFinite(v) ? v : fallback;
}
function setStoredNumber(key, value) {
  localStorage.setItem(key, String(value));
}
function updateLifetimeMpgUI() {
  const miles = getStoredNumber("lifetimeMiles", 0);
  const gallons = getStoredNumber("lifetimeGallons", 0);
  const mpg = gallons > 0 ? miles / gallons : 0;
  const out = $("lifetimeAvgMpg");
  if (out) out.textContent = mpg.toFixed(2);

  // mirror to Settings (read-only lifetime mpg)
  const sl = $("s_lifetimeMpg");
  if (sl) sl.value = mpg > 0 ? mpg.toFixed(2) : "";

  try { updateSettingsFinePrint(); } catch {}
  try { updateMaintenancePill(); } catch {}
}
// ---------- Actual: DOT minimum time breakdown ----------
function computeDotMinimum({ totalMiles, waitHours, settings }) {
  const mph = Math.min(65, Math.max(45, Number(settings?.avgMph ?? SETTINGS_DEFAULTS.avgMph)));
  const drivingHours = totalMiles / mph;
  const breakHours = Math.floor(drivingHours / 8) * 0.5;
  const fuelStopMin = Math.max(0, Number(settings?.fuelStopMin ?? 15));
  const fuelStops = Math.floor(totalMiles / 1000);
  const fuelHours = fuelStops * (fuelStopMin / 60);
  // Sleeper / 10-hour breaks: 1 per "day" of driving (rough, estimate)
  // We estimate days based on driving hours / 11hr drive per day.
  const days = Math.max(1, Math.ceil(drivingHours / 11));
  const sleeperHours = Math.max(0, (days - 1) * 10); // no sleeper needed if it's a same-day run
  const minHoursAway = drivingHours + breakHours + fuelHours + sleeperHours + waitHours;
  return { drivingHours, breakHours, fuelStops, fuelHours, sleeperHours, days, minHoursAway };
}
function renderDotBreakdown(outObj) {
  const box = $("a_dotBreakdown");
  if (!box) return;
  if (!outObj) { box.textContent = "—"; return; }
  box.textContent =
`DOT / Time Breakdown (Estimate)
Driving Hours: ${outObj.drivingHours.toFixed(1)}
30-min Breaks: ${outObj.breakHours.toFixed(1)}
Fuel Stops: ${outObj.fuelStops} (Fuel Time: ${outObj.fuelHours.toFixed(1)} hrs)
Sleeper (10-hr breaks): ${outObj.sleeperHours.toFixed(1)} hrs
Days On Road: ${outObj.days}
Minimum Hours Away: ${outObj.minHoursAway.toFixed(1)} hrs`;
}
// ================================
// App Init (single)

// ================================
// Collapsible Sections (All Tabs)
// Turns each H2 block into a collapsible <details>, and wraps pre-H2 input blocks as "Main Fields".
// ================================
function buildCollapsibleSections() {
  const screens = document.querySelectorAll('section.screen');
  screens.forEach(screen => {
    if (!screen || screen.dataset.collapsibleBuilt === '1') return;
    screen.dataset.collapsibleBuilt = '1';

    const children = Array.from(screen.children);
    if (!children.length) return;

    const frag = document.createDocumentFragment();
    let currentInner = null;
    let seenFirstH2 = false;
    let preDetailsMade = false;

    const closeDetails = () => { currentInner = null; };

    const makeDetails = (title) => {
      const det = document.createElement('details');
      det.className = 'collapsibleSection';
      det.open = false;

      const sum = document.createElement('summary');
      sum.textContent = title || 'Section';

      const inner = document.createElement('div');
      inner.className = 'collapsibleInner';

      det.appendChild(sum);
      det.appendChild(inner);
      frag.appendChild(det);

      currentInner = inner;
    };

    children.forEach(el => {
      if (!el) return;

      // Convert top-level H2 sections into collapsibles
      if (el.tagName === 'H2') {
        closeDetails();
        makeDetails((el.textContent || '').trim() || 'Section');
        seenFirstH2 = true;
        // Do NOT keep the H2 itself; summary replaces it.
        el.remove();
        return;
      }

      const hasFields = !!(el.querySelector && el.querySelector('input, select, textarea'));

      // If we haven't hit any H2 yet, and we encounter the first block that contains fields,
      // wrap it (and subsequent blocks until the first H2) into a "Main Fields" collapsible.
      if (!seenFirstH2 && !preDetailsMade && hasFields) {
        makeDetails('Main Fields');
        preDetailsMade = true;
      }

      if (currentInner) currentInner.appendChild(el);
      else frag.appendChild(el);
    });

    screen.innerHTML = '';
    screen.appendChild(frag);
  });
}

// ================================

// =========================
// Fleet Module (Driver Pay + Owner/Company Split)
// =========================
function fleetNormalizePct(v){
  // Accept "0.30" or "30" → decimal
  return normalizePctInput(v);
}
function fleetNowLabel(ts){
  const d = new Date(ts || Date.now());
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  const yy = d.getFullYear();
  return `${mm}/${dd}/${yy}`;
}
function getActiveFleetDriverId(){
  const s = getFleetSettings() || {};
  return String(s.activeDriverId || "");
}
function setActiveFleetDriverId(id){
  const s = getFleetSettings() || {};
  s.activeDriverId = String(id || "");
  saveFleetSettings(s);
}
function fleetDriverBlank(){
  return {
    id: "drv_" + Date.now(),
    name: "",
    type: "company", // company | ownerop
    defaults: { basis: "net", payType: "pct", pct: 0.30, perMile: 0.60, flat: 150 },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}
function fleetDriverFromUI(existingId){
  const d = fleetDriverBlank();
  d.id = existingId || d.id;
  d.name = ( $("f_driverName")?.value || "" ).trim();
  d.type = String($("f_driverType")?.value || "company");
  d.defaults = {
    basis: String($("f_defaultBasis")?.value || "net"),
    payType: String($("f_defaultPayType")?.value || "pct"),
    pct: fleetNormalizePct($("f_defaultPct")?.value || 0.30),
    perMile: Number($("f_defaultPerMile")?.value || 0),
    flat: Number($("f_defaultFlat")?.value || 0),
  };
  d.updatedAt = Date.now();
  return d;
}
function fleetWriteDriverToUI(driver){
  const d = driver || {};
  if ($("f_driverName")) $("f_driverName").value = d.name || "";
  if ($("f_driverType")) $("f_driverType").value = d.type || "company";
  if ($("f_defaultBasis")) $("f_defaultBasis").value = d.defaults?.basis || "net";
  if ($("f_defaultPayType")) $("f_defaultPayType").value = d.defaults?.payType || "pct";
  if ($("f_defaultPct")) $("f_defaultPct").value = (d.defaults?.pct ?? "").toString();
  if ($("f_defaultPerMile")) $("f_defaultPerMile").value = (d.defaults?.perMile ?? "").toString();
  if ($("f_defaultFlat")) $("f_defaultFlat").value = (d.defaults?.flat ?? "").toString();
}
function fleetEnsureAtLeastOneDriver(){
  const drivers = getFleetDrivers();
  if (drivers.length) return drivers;
  const seed = fleetDriverBlank();
  seed.name = "Driver 1";
  saveFleetDrivers([seed]);
  setActiveFleetDriverId(seed.id);
  return [seed];
}
function fleetRenderDriverSelect(){
  const sel = $("f_driverSelect");
  if (!sel) return;
  const drivers = fleetEnsureAtLeastOneDriver();
  const active = getActiveFleetDriverId() || drivers[0]?.id;
  if (!getActiveFleetDriverId() && active) setActiveFleetDriverId(active);

  sel.innerHTML = "";
  drivers.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = `${d.name || "(Unnamed)"} • ${d.type === "ownerop" ? "Owner-Op" : "Company"}`;
    sel.appendChild(opt);
  });
  sel.value = active || drivers[0]?.id || "";

  const picked = drivers.find(x => x.id === sel.value) || drivers[0];
  fleetWriteDriverToUI(picked);
  fleetApplyDriverDefaultsToSettlement(picked);
}

function fleetRenderAllDriverSelects(){
  const drivers = getFleetDrivers();
  const activeId = getActiveFleetDriverId() || drivers[0]?.id || "";

  // Primary driver select
  const p = $("f_primaryDriver");
  if (p){
    p.innerHTML = "";
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = drivers.length ? "Select a driver…" : "No drivers yet.";
    p.appendChild(ph);
    drivers.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = d.name || "(Driver)";
      p.appendChild(opt);
    });
    p.value = activeId || "";
  }

  // Secondary driver
  const s = $("f_secondaryDriver");
  if (s){
    s.innerHTML = "";
    const ph2 = document.createElement("option");
    ph2.value = "";
    ph2.textContent = "None";
    s.appendChild(ph2);
    drivers.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = d.name || "(Driver)";
      s.appendChild(opt);
    });
  }

  // Period driver
  const pd = $("f_periodDriver");
  if (pd){
    pd.innerHTML = "";
    const ph3 = document.createElement("option");
    ph3.value = "";
    ph3.textContent = drivers.length ? "Select a driver…" : "No drivers yet.";
    pd.appendChild(ph3);
    drivers.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = d.name || "(Driver)";
      pd.appendChild(opt);
    });
    pd.value = activeId || "";
  }


  const fs0 = getFleetSettingsSafe();
  const carrierOn = !!fs0.carrierMode;
  const hasDrivers = drivers.length > 0;
  // Enforce: Carrier Mode requires at least one driver
  const disableFleet = carrierOn && !hasDrivers;
  ["btnFleetCalc","btnFleetSaveSettlement","btnFleetRunPeriod"].forEach(id=>{
    const b = $(id);
    if (b) b.disabled = disableFleet;
  });

  // Also keep pay basis select synced to company setting
  const fs = getFleetSettingsSafe();
  if ($("f_payBasis")){
    $("f_payBasis").value = fs.companyPayBasis === "gross" ? "gross" : "net";
  }
}

function fleetToggleRepowerUI(){
  const on = !!$("f_isRepowerSplit")?.checked;
  const setHidden = (id, hidden) => {
    const el = $(id);
    if (!el) return;
    const lab = el.closest("label");
    if (lab) lab.classList.toggle("isHidden", hidden);
  };
  setHidden("f_secondaryDriver", !on);
  setHidden("f_primaryLoadedMiles", !on);
  setHidden("f_secondaryLoadedMiles", !on);
}

function initFleetCarrierSettingsUI(){
  const uiToggle = $("fleet_carrierMode");
  const uiBasis = $("fleet_companyPayBasis");
  const uiWeekStart = $("fleet_weekStart");

  const fs = getFleetSettingsSafe();
  if (uiToggle) uiToggle.checked = !!fs.carrierMode;
  if (uiBasis) uiBasis.value = fs.companyPayBasis;
  if (uiWeekStart) uiWeekStart.value = fs.weekStart;

  uiToggle?.addEventListener("change", () => {
    const next = setFleetSettingsSafe({ carrierMode: !!uiToggle.checked });
    applyFleetVisibility(next);
  });

  uiBasis?.addEventListener("change", () => {
    const next = setFleetSettingsSafe({ companyPayBasis: String(uiBasis.value||"net") });
    // Keep disabled select in Fleet screen synced
    $("f_payBasis") && ($("f_payBasis").value = next.companyPayBasis);
  });

  uiWeekStart?.addEventListener("change", () => {
    const next = setFleetSettingsSafe({ weekStart: String(uiWeekStart.value||"MON") });
    // sync period control
    $("f_periodWeekStart") && ($("f_periodWeekStart").value = next.weekStart);
  });

  applyFleetVisibility(fs);
}

function applyFleetVisibility(fs){
  const on = !!fs.carrierMode;
  const tabBtn = document.getElementById("tabFleet");
  const screen = document.getElementById("screen-fleet");
  // Hide desktop + mobile nav entries for Fleet
  document.querySelectorAll('[data-screen="fleet"]').forEach(b => b.classList.toggle("isHidden", !on));
  tabBtn && tabBtn.classList.toggle("isHidden", !on);
  screen && screen.classList.toggle("isHidden", !on);

  // If Fleet is hidden and currently active, bounce to Settings
  const active = document.querySelector(".tab.active");
  if (!on){
    const activeScreen = active?.dataset?.screen || "";
    if (activeScreen === "fleet"){
      setActiveScreen("settings");
    }
  }

  // When Carrier Mode ON, require at least 1 driver
  if (on){
    const hasDrivers = getFleetDrivers().length > 0;
    const hint = $("fleetDriverHint");
    if (!hasDrivers && hint) hint.textContent = "Carrier Mode is ON. Create at least one driver to continue.";
  }
}

// Weekly summary helpers
function fleetInitPeriodControls(){
  const fs = getFleetSettingsSafe();
  $("f_periodWeekStart") && ($("f_periodWeekStart").value = fs.weekStart);
  const w = $("f_weekOf");
  if (w && !w.value) w.value = todayISO();
}

function fleetWeekRange(isoDate, weekStart){
  // weekStart: MON or SUN
  const d = isoDate ? new Date(isoDate + "T00:00:00") : new Date();
  const day = d.getDay(); // 0=Sun..6=Sat
  let deltaStart = 0;
  if (weekStart === "SUN"){
    deltaStart = -day;
  } else { // MON
    deltaStart = (day === 0) ? -6 : (1 - day);
  }
  const start = new Date(d);
  start.setDate(d.getDate() + deltaStart);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const toISO = (x)=> x.toISOString().slice(0,10);
  return { startISO: toISO(start), endISO: toISO(end) };
}

function fleetRunWeeklySummary(){
  const outEl = $("fleetPeriodOut");
  if (!outEl) return;

  const driverId = String($("f_periodDriver")?.value || "");
  if (!driverId){
    outEl.textContent = "⚠️ Select a driver first.";
    return;
  }

  const weekOf = String($("f_weekOf")?.value || todayISO());
  const wkStart = String($("f_periodWeekStart")?.value || "MON");
  const rng = fleetWeekRange(weekOf, wkStart);

  const recs = getFleetSettlements();
  const hits = recs.filter(r => {
    const dt = (r.deliveryDate || "").slice(0,10);
    if (!dt) return false;
    if (dt < rng.startISO || dt > rng.endISO) return false;
    const dps = r.driverPays || [];
    return dps.some(dp => String(dp.driver?.id || dp.driverId || "") === driverId);
  });

  let totalFinal = 0, totalGross=0, totalNet=0, totalOwner=0, loads=0, miles=0;
  hits.forEach(r => {
    loads += 1;
    totalGross += Number(r.gross||0)||0;
    totalNet += Number(r.net||0)||0;
    totalOwner += Number(r.ownerShareTrue||0)||0;
    // sum driver final for this driver
    (r.driverPays||[]).forEach(dp=>{
      const id = String(dp.driver?.id || dp.driverId || "");
      if (id === driverId){
        totalFinal += Number(dp.finalPay||0)||0;
        miles += Number(dp.milesDriven||0)||0;
      }
    });
  });

  const driver = fleetGetDriverById(driverId);
  const lines = [];
  lines.push(`Weekly Summary: ${driver?.name||"(Driver)"} • ${rng.startISO} to ${rng.endISO}`);
  lines.push(`Loads included: ${loads}`);
  lines.push(`Total Loaded Miles (for this driver): ${fmtNum(miles)}`);
  lines.push(`Total Revenue (Gross): ${money(totalGross)}`);
  lines.push(`Total True Net: ${money(totalNet)}`);
  lines.push(`Total Driver Pay (final): ${money(totalFinal)}`);
  lines.push(`Total Owner/Company Share (true): ${money(totalOwner)}`);
  outEl.textContent = lines.join("\n");
}

function fleetExportWeeklySummaryJSON(){
  const driverId = String($("f_periodDriver")?.value || "");
  const weekOf = String($("f_weekOf")?.value || todayISO());
  const wkStart = String($("f_periodWeekStart")?.value || "MON");
  const rng = fleetWeekRange(weekOf, wkStart);

  const recs = getFleetSettlements();
  const hits = recs.filter(r => {
    const dt = (r.deliveryDate || "").slice(0,10);
    if (!dt) return false;
    if (dt < rng.startISO || dt > rng.endISO) return false;
    const dps = r.driverPays || [];
    return dps.some(dp => String(dp.driver?.id || dp.driverId || "") === driverId);
  });

  const payload = { driverId, weekStart: rng.startISO, weekEnd: rng.endISO, settlements: hits };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `fleet_weekly_${driverId||"driver"}_${rng.startISO}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0);
}
function fleetApplyDriverDefaultsToSettlement(driver){
  const d = driver || {};
  const def = d.defaults || {};
  if ($("f_payBasis")) $("f_payBasis").value = def.basis || "net";
  if ($("f_payType")) $("f_payType").value = def.payType || "pct";
  if ($("f_pct")) $("f_pct").value = (def.pct ?? "").toString();
  if ($("f_perMile")) $("f_perMile").value = (def.perMile ?? "").toString();
  if ($("f_flat")) $("f_flat").value = (def.flat ?? "").toString();
}
function fleetRenderLoadSelect(){
  const sel = $("f_loadSelect");
  if (!sel) return;
  const loads = getLoads();
  sel.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = loads.length ? "Select a saved Actual load…" : "No saved Actual loads yet.";
  sel.appendChild(placeholder);

  loads.forEach((l,i) => {
    const opt = document.createElement("option");
    // Many existing saves may not have a stable id. Fall back to loadNumber or index.
    const fallbackId = (l && (l.id || l.loadId || l.loadNumber || l.bol))
      ? String(l.id || l.loadId || l.loadNumber || l.bol)
      : (`idx:${i}`);
    opt.value = String(fallbackId);
    const ln = (l.loadNumber || "").trim() || "(No Load #)";
    const dt = (l.deliveryDate || "").trim();
    // Accept common legacy field names
    const gross = Number(l.gross ?? l.revenue ?? l.rate ?? 0) || 0;
    const net = Number(l.net ?? l.netRevenue ?? l.actualNet ?? l.actualNetRevenue ?? 0) || 0;
    opt.textContent = `${ln}${dt ? " • "+formatDate(dt) : ""} • Gross ${money(gross)} • Net ${money(net)}`;
    sel.appendChild(opt);
  });
}
function fleetGetSelectedLoad(){
  const id = String($("f_loadSelect")?.value || "");
  if (!id) return null;
  const loads = getLoads();
  // idx fallback
  if (id.startsWith("idx:")){
    const n = Number(id.slice(4));
    return Number.isFinite(n) ? (loads[n] || null) : null;
  }
  return loads.find(x => String(x.id||x.loadId||x.loadNumber||x.bol||"") === id) || null;
}
function fleetGetSelectedDriver(){
  const id = String($("f_driverSelect")?.value || "");
  const drivers = getFleetDrivers();
  return drivers.find(x => String(x.id||"") === id) || null;
}

// Back-compat helper (some Fleet code uses this name)
function fleetGetDriverById(id){
  const drivers = getFleetDrivers();
  const sid = String(id || "");
  return drivers.find(x => String(x.id||"") === sid) || null;
}
function fleetComputeSettlement(){
  const settings = getFleetSettingsSafe();
  const carrierOn = !!settings.carrierMode;

  const primaryDriver = fleetGetDriverById(String($("f_primaryDriver")?.value || $("f_driverSelect")?.value || ""));
  const load = fleetGetSelectedLoad();

  if (carrierOn && getFleetDrivers().length === 0){
    return { ok:false, msg:"Carrier Mode is ON. Create at least one driver to continue." };
  }
  if (!primaryDriver) return { ok:false, msg:"Pick a primary driver first." };
  if (!load) return { ok:false, msg:"Pick a saved Actual load first." };

  // Accept common legacy field names so Fleet can connect to existing saved Actual loads.
  const loadedMilesTotal = Number(load.loadedMiles ?? load.loaded ?? load.loaded_miles ?? load.loadedMilesTrip ?? 0) || 0;
  const totalMiles = Number(load.totalMiles ?? load.total ?? load.tripMiles ?? load.milesTotal ?? 0) || 0;
  const gross = Number(load.gross ?? load.revenue ?? load.rate ?? load.totalRevenue ?? 0) || 0;
  const net = Number(load.net ?? load.netRevenue ?? load.actualNet ?? load.actualNetRevenue ?? 0) || 0;

  // Company-wide pay basis, with optional per-load override for "Rescue pay from Gross"
  const rescueGross = !!$("f_repower")?.checked;
  const basis = rescueGross ? "gross" : settings.companyPayBasis;
  const basisAmountTotal = (basis === "gross") ? gross : net;

  // Repower split (two drivers) — split by LOADED miles only
  const isRepowerSplit = !!$("f_isRepowerSplit")?.checked;
  const secondaryDriver = isRepowerSplit
    ? fleetGetDriverById(String($("f_secondaryDriver")?.value || ""))
    : null;

  let A = Number($("f_primaryLoadedMiles")?.value || 0) || 0;
  if (!isRepowerSplit) A = loadedMilesTotal; // all miles to primary by default
  if (isRepowerSplit){
    // default primary miles = half if blank, else clamp
    if (!A && loadedMilesTotal) A = Math.round(loadedMilesTotal / 2);
    A = Math.max(0, Math.min(loadedMilesTotal, A));
  }
  let B = isRepowerSplit ? Math.max(0, loadedMilesTotal - A) : 0;
  if ($("f_secondaryLoadedMiles")) $("f_secondaryLoadedMiles").value = String(B || 0);

  const splitA = (isRepowerSplit && secondaryDriver && (A + B) > 0) ? (A / (A + B)) : 1;
  const splitB = (isRepowerSplit && secondaryDriver && (A + B) > 0) ? (B / (A + B)) : 0;

  // Protect Driver: when ON, company can cover shortfall (driver pay can exceed allocated basis)
  // When OFF, CPM/Flat are capped to allocated basis and Percent naturally scales.
  const protect = !!$("f_protectDriver")?.checked;
  const minPay = Number($("f_minPay")?.value || 0) || 0;
  const advance = Number($("f_advance")?.value || 0) || 0;
  const notes = ( $("f_notes")?.value || "" ).trim();

  // Per-load pay inputs (match the Settlement UI)
  const uiPayType = String($("f_payType")?.value || "pct");
  const uiPct = fleetNormalizePct($("f_pct")?.value || 0);
  const uiPerMile = Number($("f_perMile")?.value || 0) || 0;
  const uiFlat = Number($("f_flat")?.value || 0) || 0;

  // Helper: compute pay using the CURRENT settlement inputs.
  function calcDriverPay(milesDriven, allocatedBasis){
    let pay = 0;
    if (uiPayType === "pct") pay = allocatedBasis * Math.max(0, uiPct);
    else if (uiPayType === "permile") pay = milesDriven * Math.max(0, uiPerMile);
    else if (uiPayType === "flat") pay = Math.max(0, uiFlat);

    // Optional minimum pay
    pay = Math.max(pay, Math.max(0, minPay));

    // If NOT protecting the driver, cap CPM/Flat to allocated basis
    if (!protect && uiPayType !== "pct"){
      pay = Math.min(pay, Math.max(0, allocatedBasis));
    }
    return pay;
  }

  // If basis is <= 0, driver pay is forced to 0 (company absorbs loss / no driver debt)
  let driverPays = [];
  if (basisAmountTotal <= 0){
    driverPays = [{
      driver: primaryDriver,
      milesDriven: isRepowerSplit ? A : loadedMilesTotal,
      splitPct: 1,
      allocatedBasis: basisAmountTotal,
      pay: 0,
      advanceApplied: Math.max(0, advance),
      finalPay: 0
    }];
    if (secondaryDriver){
      driverPays.push({
        driver: secondaryDriver,
        milesDriven: B,
        splitPct: 0,
        allocatedBasis: 0,
        pay: 0,
        advanceApplied: 0,
        finalPay: 0
      });
    }
  } else {
    const allocA = basisAmountTotal * splitA;
    const allocB = basisAmountTotal * splitB;

    const payA = calcDriverPay((isRepowerSplit ? A : loadedMilesTotal), allocA);
    const payB = (secondaryDriver) ? calcDriverPay(B, allocB) : 0;

    // Advances: apply to primary driver only (v1). Protect driver: final pay never below 0.
    const finalA = Math.max(0, payA - Math.max(0, advance));
    const finalB = Math.max(0, payB);

    driverPays = [{
      driver: primaryDriver,
      milesDriven: (isRepowerSplit ? A : loadedMilesTotal),
      splitPct: splitA,
      allocatedBasis: allocA,
      pay: payA,
      advanceApplied: Math.max(0, advance),
      finalPay: finalA
    }];

    if (secondaryDriver){
      driverPays.push({
        driver: secondaryDriver,
        milesDriven: B,
        splitPct: splitB,
        allocatedBasis: allocB,
        pay: payB,
        advanceApplied: 0,
        finalPay: finalB
      });
    }
  }

  const totalDriverPayFinal = driverPays.reduce((s,x)=>s + (Number(x.finalPay||0)||0), 0);

  // Owner/Company share is ALWAYS based on TRUE NET (truth), even if paying from GROSS
  const ownerShareTrue = net - totalDriverPayFinal;

  return {
    ok: true,
    load,
    basis,
    basisAmountTotal,
    gross,
    net,
    loadedMilesTotal,
    totalMiles,
    rescueGross,
    isRepowerSplit: !!(isRepowerSplit && secondaryDriver),
    driverPays,
    totalDriverPayFinal,
    ownerShareTrue,
    protect,
    minPay,
    notes
  };
}

function fleetRenderSettlement(out){
  const el = $("fleetOut");
  if (!el) return;
  if (!out || !out.ok){
    el.textContent = (out && out.msg) ? ("⚠️ " + out.msg) : "—";
    return;
  }

  const ln = (out.load.loadNumber || "").trim() || "(No Load #)";
  const dt = (out.load.deliveryDate || "").trim();
  const basisLabel = (out.basis === "gross") ? "GROSS (Revenue)" : "NET (Profit)";
  const lines = [];
  lines.push(`Load: ${ln}${dt ? " • " + formatDate(dt) : ""}`);
  lines.push(`Pay basis used: ${basisLabel} • Basis Amount: ${money(out.basisAmountTotal)}`);
  lines.push(`Revenue (Gross): ${money(out.gross)} • True Net: ${money(out.net)}`);
  lines.push(`Loaded Miles: ${fmtNum(out.loadedMilesTotal)} • Total Miles: ${fmtNum(out.totalMiles)}`);
  if (out.rescueGross) lines.push(`Rescue override: ON (forced Gross for this settlement)`);
  if (out.isRepowerSplit) lines.push(`Repower split: ON (split by loaded miles)`);

  lines.push("");
  lines.push("Driver payouts:");
  out.driverPays.forEach(dp => {
    const nm = dp.driver?.name || "(Driver)";
    const pct = Math.round((Number(dp.splitPct||0)*100)*10)/10;
    lines.push(`- ${nm}: miles ${fmtNum(dp.milesDriven)} • split ${pct}% • pay ${money(dp.pay)} • advance ${money(dp.advanceApplied)} • FINAL ${money(dp.finalPay)}`);
  });

  lines.push("");
  lines.push(`Total Driver Pay (final): ${money(out.totalDriverPayFinal)}`);
  lines.push(`Owner/Company Share (TRUE NET - Driver Pay): ${money(out.ownerShareTrue)}`);
  if (out.ownerShareTrue < 0) lines.push("⚠️ Company absorbed loss (owner share is negative).");

  if (out.notes) lines.push(`Notes: ${out.notes}`);

  el.textContent = lines.join("\n");
}

function fleetSaveSettlement(out){
  try {
    const arr = getFleetSettlements();
    const rec = {
      id: "fs_" + Math.random().toString(36).slice(2,10),
      createdAt: new Date().toISOString(),
      loadId: out.load.id || "",
      loadNumber: out.load.loadNumber || "",
      deliveryDate: out.load.deliveryDate || "",
      basis: out.basis,
      basisAmount: out.basisAmountTotal,
      gross: out.gross,
      net: out.net,
      loadedMiles: out.loadedMilesTotal,
      totalMiles: out.totalMiles,
      rescueGross: !!out.rescueGross,
      repowerSplit: !!out.isRepowerSplit,
      driverPays: out.driverPays || [],
      totalDriverPayFinal: out.totalDriverPayFinal,
      ownerShareTrue: out.ownerShareTrue,
      notes: out.notes || ""
    };
    arr.unshift(rec);
    saveFleetSettlements(arr);
    return true;
  } catch (e){
    console.warn("fleet_save_failed", e);
    return false;
  }
}

function fleetRenderHistory(){
  const table = $("fleetHistoryTable");
  const tbody = table?.querySelector("tbody");
  if (!tbody) return;
  const arr = getFleetSettlements();
  tbody.innerHTML = "";
  if (!arr.length){
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="7" style="opacity:.85;">No settlements saved yet.</td>`;
    tbody.appendChild(tr);
    return;
  }
  arr.slice(0,200).forEach(r => {
    const tr = document.createElement("tr");
    const basisLabel = `${String(r.basis||"").toUpperCase()} ${money(Number(r.basisAmount||0)||0)}`;
    const driverNames = (r.driverPays||[]).map(dp => dp.driver?.name || "").filter(Boolean).join(" + ");
    const totalDriver = money(Number(r.totalDriverPayFinal||0)||0);
    const ownerTrue = money(Number(r.ownerShareTrue||0)||0);
    tr.innerHTML = `
      <td>${escapeHtml(fleetNowLabel(r.createdAt))}</td>
      <td>${escapeHtml(driverNames || "")}</td>
      <td>${escapeHtml((r.loadNumber||"") + (r.deliveryDate ? " • "+formatDate(r.deliveryDate) : ""))}</td>
      <td>${escapeHtml(basisLabel)}</td>
      <td>${escapeHtml(totalDriver)}</td>
      <td>${escapeHtml(ownerTrue)}</td>
      <td>${escapeHtml((r.notes||"").slice(0,40))}${(r.notes||"").length>40 ? "…" : ""}</td>
    `;
    tbody.appendChild(tr);
  });
}

function initFleetModule(){
  // Driver select changes (Drivers editor)
  $("f_driverSelect")?.addEventListener("change", () => {
    const drivers = getFleetDrivers();
    const id = String($("f_driverSelect")?.value || "");
    const d = drivers.find(x => x.id === id) || null;
    if (d) {
      setActiveFleetDriverId(d.id);
      fleetWriteDriverToUI(d);
      fleetRenderAllDriverSelects();
    }
  });

  // Primary driver select changes (Settlement)
  $("f_primaryDriver")?.addEventListener("change", () => {
    const d = fleetGetDriverById(String($("f_primaryDriver")?.value || ""));
    if (d){
      setActiveFleetDriverId(d.id);
      // Keep the editor in sync (nice UX)
      $("f_driverSelect") && ($("f_driverSelect").value = d.id);
      fleetWriteDriverToUI(d);
      fleetRenderAllDriverSelects();
      try { fleetApplyDriverDefaultsToSettlement(d); } catch {}
    }
    $("fleetOut") && ($("fleetOut").textContent = "—");
  });

  $("f_secondaryDriver")?.addEventListener("change", () => {
    $("fleetOut") && ($("fleetOut").textContent = "—");
  });

  $("f_isRepowerSplit")?.addEventListener("change", () => {
    fleetToggleRepowerUI();
    $("fleetOut") && ($("fleetOut").textContent = "—");
  });

  $("f_primaryLoadedMiles")?.addEventListener("input", () => {
    // update auto secondary miles
    const load = fleetGetSelectedLoad();
    const loaded = Number(load?.loadedMiles || load?.loaded || 0) || 0;
    let A = Number($("f_primaryLoadedMiles")?.value || 0) || 0;
    A = Math.max(0, Math.min(loaded, A));
    const B = Math.max(0, loaded - A);
    $("f_secondaryLoadedMiles") && ($("f_secondaryLoadedMiles").value = String(B||0));
  });

  // Load select changes
  $("f_loadSelect")?.addEventListener("change", () => {
    const load = fleetGetSelectedLoad();
    // reset repower miles auto
    const loaded = Number(load?.loadedMiles || load?.loaded || 0) || 0;
    if ($("f_primaryLoadedMiles") && !$("f_primaryLoadedMiles").value) $("f_primaryLoadedMiles").value = loaded ? String(Math.round(loaded/2)) : "";
    $("f_secondaryLoadedMiles") && ($("f_secondaryLoadedMiles").value = loaded ? String(Math.max(0, loaded - (Number($("f_primaryLoadedMiles")?.value||0)||0))) : "");
    $("fleetOut") && ($("fleetOut").textContent = "—");
    $("fleetSettleHint") && ($("fleetSettleHint").textContent = "");
  });

  // Save Driver
  $("btnFleetSaveDriver")?.addEventListener("click", () => {
    const sel = $("f_driverSelect");
    const activeId = sel ? String(sel.value||"") : getActiveFleetDriverId();
    const d = fleetDriverFromUI(activeId || null);
    if (!d.name.trim()){
      $("fleetDriverHint") && ($("fleetDriverHint").textContent = "⚠️ Enter a Driver Name first.");
      return;
    }
    const arr = getFleetDrivers();
    const idx = arr.findIndex(x => x.id === d.id);
    if (idx >= 0){
      d.createdAt = arr[idx].createdAt || d.createdAt;
      arr[idx] = d;
    } else {
      arr.push(d);
    }
    saveFleetDrivers(arr);
    setActiveFleetDriverId(d.id);
    fleetRenderDriverSelect();
    fleetRenderAllDriverSelects();
    $("fleetDriverHint") && ($("fleetDriverHint").textContent = "Driver saved.");
  });

  // New Driver
  $("btnFleetNewDriver")?.addEventListener("click", () => {
    const arr = getFleetDrivers();
    const d = fleetDriverBlank();
    arr.push(d);
    saveFleetDrivers(arr);
    setActiveFleetDriverId(d.id);
    fleetRenderDriverSelect();
    fleetRenderAllDriverSelects();
    $("fleetDriverHint") && ($("fleetDriverHint").textContent = "New driver created. Enter details and Save.");
  });

  // Delete Driver
  $("btnFleetDeleteDriver")?.addEventListener("click", () => {
    const id = String($("f_driverSelect")?.value || "");
    if (!id) return;
    const ok = confirm("Delete this driver? (Settlements remain for history.)");
    if (!ok) return;
    const arr = getFleetDrivers().filter(x => x.id !== id);
    saveFleetDrivers(arr);
    const nextId = arr[0]?.id || "";
    setActiveFleetDriverId(nextId);
    fleetRenderDriverSelect();
    fleetRenderAllDriverSelects();
    $("fleetDriverHint") && ($("fleetDriverHint").textContent = "Driver deleted.");
  });

  // Calculate Settlement
  $("btnFleetCalc")?.addEventListener("click", () => {
    try {
      const out = fleetComputeSettlement();
      fleetRenderSettlement(out);
    } catch (e){
      console.warn("fleet_calc_failed", e);
      const el = $("fleetOut");
      if (el) el.textContent = "⚠️ Settlement calc failed. Open console for details.";
      const hint = $("fleetSettleHint");
      if (hint) hint.textContent = "⚠️ Calculate failed (see console).";
    }
  });

  // Save Settlement
  $("btnFleetSaveSettlement")?.addEventListener("click", () => {
    const out = fleetComputeSettlement();
    if (!out.ok){
      fleetRenderSettlement(out);
      return;
    }
    const ok = fleetSaveSettlement(out);
    if (ok){
      fleetRenderHistory();
      $("fleetSettleHint") && ($("fleetSettleHint").textContent = "Settlement saved.");
    }
  });

  // Clear Settlements
  $("btnFleetClearSettlements")?.addEventListener("click", () => {
    const ok = confirm("Clear ALL fleet settlements? This does not delete Actual loads.");
    if (!ok) return;
    saveFleetSettlements([]);
    fleetRenderHistory();
    $("fleetSettleHint") && ($("fleetSettleHint").textContent = "Settlements cleared.");
  });

  $("btnFleetRefreshHistory")?.addEventListener("click", () => {
    fleetRenderHistory();
  });

  // Weekly summary
  $("btnFleetRunPeriod")?.addEventListener("click", () => {
    fleetRunWeeklySummary();
  });
  $("btnFleetExportPeriod")?.addEventListener("click", () => {
    fleetExportWeeklySummaryJSON();
  });

  // Initial render
  fleetRenderDriverSelect();
  fleetRenderLoadSelect();
  fleetRenderHistory();
  fleetRenderAllDriverSelects();
  fleetToggleRepowerUI();
  fleetInitPeriodControls();
}



document.addEventListener("DOMContentLoaded", () => {
  try { buildCollapsibleSections(); } catch (e) { console.warn("collapsible_init_failed", e); }
  // Default date
  const dd = $("a_deliveryDate");
  if (dd && !dd.value) dd.value = todayISO();
  // Load saved settings into inputs
  const savedSettings = getSettings();
  if (savedSettings) applySettingsToInputs(savedSettings);
  writeCompanyInfoToUI(savedSettings || {});
  hookCompanyInfoAutosave();
  try { initFleetCarrierSettingsUI(); } catch(e){ console.warn('fleet_settings_ui_failed', e); }

  try { updateSettingsFinePrint(); } catch {}
  try { updateMaintenancePill(); } catch {}

  // Tabs
  qsa(".tab").forEach(btn => btn.addEventListener("click", () => setActiveScreen(btn.dataset.screen)));

  // Mobile nav (1–2 tabs + More)
  const mobileNav = document.getElementById('mobileTabs');
  const mobileMore = document.getElementById('mobileMore');
  mobileNav?.querySelectorAll('.mTab')?.forEach(btn => {
    btn.addEventListener('click', () => {
      const s = btn.dataset.screen;
      if (s) setActiveScreen(s);
    });
  });
  mobileMore?.addEventListener('change', () => {
    const v = String(mobileMore.value || '').trim();
    if (v) setActiveScreen(v);
    mobileMore.value = '';
  });

  // Initial paint
  try { updateMobileNav(qs('.tab.active')?.dataset?.screen || 'settings'); } catch {}

  // Tabs horizontal scroll helpers
  const tabsEl = document.getElementById('tabs');
  const leftBtn = document.getElementById('tabsScrollLeft');
  const rightBtn = document.getElementById('tabsScrollRight');
  const scrollTabsBy = (dx) => { if (!tabsEl) return; tabsEl.scrollBy({ left: dx, behavior: 'smooth' }); };
  leftBtn?.addEventListener('click', () => scrollTabsBy(-320));
  rightBtn?.addEventListener('click', () => scrollTabsBy(320));

  // Gate (original) events
  const gCalc = document.getElementById('g_calcBtn');
  const gReset = document.getElementById('g_resetBtn');
  const gOut = document.getElementById('g_out');
  const gBadge = document.getElementById('gateBadge');
  const gDeadzone = document.getElementById('g_deadzoneToggle');
  const gRegion = document.getElementById('g_regionPreset');
  const gRouteStates = document.getElementById('g_routeStates');
  const gWeekendAuto = document.getElementById('g_weekendAuto');
  const gWeekendDays = document.getElementById('g_weekendDays');
  const gReturnHomeMiles = document.getElementById('g_returnHomeMiles');
  const gReturnHomeDayAdd = document.getElementById('g_returnHomeDayAdd');

  // Seed read-only basis at boot
  try { updateGateReadOnlyBasis(); } catch {}
  try { renderGateAppliedRules(); } catch {}

  // Dead-zone toggle: auto-suggest reposition miles when turned on
  gDeadzone?.addEventListener('change', () => {
    const lane = Number(document.getElementById('g_laneMiles')?.value || 0);
    const repEl = document.getElementById('g_repositionMiles');
    if (!repEl) return;
    if (gDeadzone.checked) {
      const current = Number(repEl.value || 0);
      if (current <= 0) {
        const suggested = lane > 0 ? Math.max(50, Math.min(250, Math.round(lane * 0.15))) : 120;
        repEl.value = String(suggested);
      }
    }
    renderGateAppliedRules();
  });
  [gRegion, gRouteStates, gWeekendAuto, gWeekendDays, gReturnHomeMiles, gReturnHomeDayAdd].forEach(el => {
    el?.addEventListener('change', renderGateAppliedRules);
  });
  gCalc?.addEventListener('click', () => {
    try {
      const o = calcGateShipperQuote();
      if (!gOut) return;
      try { updateGateReadOnlyBasis(); } catch {}
      try { renderGateAppliedRules(); } catch {}
      gOut.textContent =
`GATE QUOTE (shipper-facing)
------------------------------------------------------------
Lane miles:        ${o.laneMiles.toFixed(0)} mi
Reposition miles:  ${o.repositionMiles.toFixed(0)} mi
TOTAL miles:       ${o.totalMiles.toFixed(0)} mi

DOT minimum time estimate (Gate proxy)
- Drive:           ${o.dot.driveHrs.toFixed(2)} hrs @ ${o.dot.mphUsed.toFixed(0)} mph
- 30-min breaks:   ${o.dot.breakHrs.toFixed(2)} hrs
- Fuel stops:      ${o.dot.fuelStops} stops (${o.dot.fuelHrs.toFixed(2)} hrs)
- Sleeper (10-hr): ${o.dot.sleeperHrs.toFixed(2)} hrs
TOTAL hours away:  ${o.hoursAway.toFixed(2)} hrs

Cost basis (read-only from Settings)
- Fuel:            ${o.gallons.toFixed(2)} gal @ $${o.fuelPrice.toFixed(2)} = $${money(o.fuelCost)}
- Tolls:           $${money(o.tolls)}
- Fixed (prorated):$${money(o.fixedTrip)}  (dailyFixed $${money(o.dailyFixed)})

Base cost:         $${money(o.baseCost)}
Risk buffer:       ${(o.riskPct*100).toFixed(1)}%  -> +$${money(o.riskAmount)} (total $${money(o.baseWithRisk)})
Reserves set-aside:${(o.reservesPct*100).toFixed(1)}% of gross

Target O.T.R.A.F.F net goal:
$${o.requiredNet.toFixed(2)}  ($${Number(document.getElementById('g_targetOtraf')?.value||0).toFixed(2)}/hr × ${o.hoursAway.toFixed(2)} hrs)

RECOMMENDED MIN GROSS: $${money(o.minGross)}
MIN RATE PER MILE:     $${o.minRatePerMile.toFixed(2)}/mi
`;

      if (gBadge) {
        gBadge.textContent = '✅ Gate quote ready';
        gBadge.classList.remove('bad');
        gBadge.classList.add('good');
      }
    } catch (e) {
      if (gOut) gOut.textContent = "Error: " + (e?.message || String(e));
      if (gBadge) {
        gBadge.textContent = '⚠️ Gate error — check inputs';
        gBadge.classList.remove('good');
        gBadge.classList.add('bad');
      }
    }
  });
  gReset?.addEventListener('click', () => {
    ['g_laneMiles','g_repositionMiles','g_tolls','g_fuelPrice','g_riskPct','g_targetOtraf'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    if (gOut) gOut.textContent = 'Waiting for inputs…';
    if (gBadge) {
      gBadge.textContent = '⚪️ Waiting for inputs…';
      gBadge.classList.remove('good','bad');
      gBadge.classList.add('ok');
    }
    try { renderGateAppliedRules(); } catch {}
  });

  // Gate (Internal) events
  const giCalc = document.getElementById('gi_calcBtn');
  const giReset = document.getElementById('gi_resetBtn');
  const giOut = document.getElementById('gi_out');
  giCalc?.addEventListener('click', () => {
    try {
      const o = calcGateInternal();
      if (!giOut) return;
      giOut.textContent =
`GATE (INTERNAL) — Realistic Minimum Rate Engine
------------------------------------------------------------
Origin: ${o.originState || '—'}   Destination: ${o.destState || '—'}
Region: ${o.mod.label}  (detected: ${o.detected}${o.override !== 'auto' ? ', OVERRIDDEN' : ''})

Miles
- Input miles:     ${o.totalMilesRaw.toFixed(0)}
- Dead-zone add:   ${o.deadzoneAddMiles.toFixed(0)}
- TOTAL miles:     ${o.totalMiles.toFixed(0)}

Time Away (DOT + realistic)
- MPH used:        ${o.mphUsed.toFixed(0)}
- Drive:           ${o.dot.driveHrs.toFixed(2)} hrs
- Breaks:          ${o.dot.breakHrs.toFixed(2)} hrs
- Fuel time:       ${o.dot.fuelHrs.toFixed(2)} hrs (${o.dot.fuelStops} stops)
- Sleeper:         ${o.dot.sleeperHrs.toFixed(2)} hrs (${o.dot.drivingDays} driving day(s))
- Region delay:    ${(o.mod.extraDelayHrs||0).toFixed(2)} hrs
TOTAL hours away:  ${o.hoursAway.toFixed(2)} hrs

Costs
- Fuel:            ${o.gallons.toFixed(2)} gal @ $${o.fuelPrice.toFixed(2)} = $${money(o.fuelCost)}
- Tolls:           $${money(o.tolls)}
- Fixed (prorated):$${money(o.fixedTrip)} (dailyFixed $${money(o.dailyFixed)})
- Wait forecast:   ${o.waitHrs.toFixed(2)} hrs (1 hr free)
- Detention:       ${o.detentionBillable.toFixed(2)} hrs × $${o.detentionRate.toFixed(0)} = $${money(o.detentionCost)}

Base cost:         $${money(o.baseCost)}
Risk buffer:       ${(o.riskPct*100).toFixed(1)}%  -> +$${money(o.riskAmount)} (total $${money(o.baseWithRisk)})
Reserves set-aside:${(o.reservesPct*100).toFixed(1)}% of gross
Required net goal: $${o.requiredNet.toFixed(2)}  ($${Number(document.getElementById('gi_targetOtraf')?.value||0).toFixed(2)}/hr × ${o.hoursAway.toFixed(2)} hrs)

MINIMUM GROSS REQUIRED: $${money(o.minGross)}
MINIMUM RATE PER MILE:  $${o.minRatePerMile.toFixed(2)}/mi
`;
    } catch (e) {
      if (giOut) giOut.textContent = "Error: " + (e?.message || String(e));
    }
  });
  giReset?.addEventListener('click', () => {
    ['gi_originState','gi_destState','gi_totalMiles','gi_fuelPrice','gi_tolls','gi_waitHrs','gi_detentionRate','gi_riskPct','gi_targetOtraf'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    const sel = document.getElementById('gi_regionOverride');
    if (sel) sel.value = 'auto';
    if (giOut) giOut.textContent = '—';
  });
  // Settings: Load Test Data
  $("btnLoadTestData")?.addEventListener("click", () => {
    $("s_household").value = 5259;
    $("s_businessFixed").value = 1742;
    $("s_avgMph") && ($("s_avgMph").value = "60");
    $("s_avgMphVal") && ($("s_avgMphVal").textContent = "60");
    $("s_defaultMpg").value = 4.6;
    $("s_tank").value = 280;
    $("s_fuelStopMin").value = 15;
    $("r_factoring").value = 0.02;
    $("r_tax").value = 0.28;
    $("r_plates").value = 0.05;
    $("r_ifta").value = 0.05;
    $("r_maint").value = 0.07;
    $("r_highway").value = 0.05;
    $("r_tires").value = 0.05;
    $("settingsHint").textContent = "Test data loaded. Tap “Save Settings”.";
  });
  $("btnSaveSettings")?.addEventListener("click", saveSettingsPlainLock);
  $("btnResetSettings")?.addEventListener("click", resetSettingsPlainLock);
  // Settings fine print (auto)
  ["s_household","s_businessFixed","s_defaultMpg"].forEach(id=>{
    $(id)?.addEventListener("input", updateSettingsFinePrint);
    $(id)?.addEventListener("change", updateSettingsFinePrint);
  });
  // Maintenance (Oil Change) — live indicator
  ["m_currentOdo","m_lastOilOdo","m_oilInterval","m_oilCustom","m_dueSoon"].forEach(id=>{
    $(id)?.addEventListener("input", updateMaintenancePill);
    $(id)?.addEventListener("change", updateMaintenancePill);
  });

// Avg MPH slider display
  const mphSlider = $("s_avgMph");
  const mphVal = $("s_avgMphVal");
  const syncMphDisplay = () => {
    if (!mphSlider || !mphVal) return;
    mphVal.textContent = String(Math.round(Number(mphSlider.value) || SETTINGS_DEFAULTS.avgMph));
  };
  mphSlider?.addEventListener("input", syncMphDisplay);
  mphSlider?.addEventListener("change", syncMphDisplay);
  syncMphDisplay();
  updateSettingsFinePrint();

  // Scenario
  const scenarioRecalc = () => {
    enforceScenarioReturnLock();
    updateScenarioCalcButtonState();
    updateScenarioFuelUI();
    // auto-calc when valid (silent)
    if (scenarioInputsAreValid()) calculateScenarioLocked(true);
  };

  $("btnCalcScenario")?.addEventListener("click", () => calculateScenarioLocked(false));

  ["sc_gross","sc_deadhead","sc_loaded","sc_returnMiles","sc_fuelPrice"].forEach((id) => {
    $(id)?.addEventListener("input", scenarioRecalc);
    $(id)?.addEventListener("change", scenarioRecalc);
  });

  $("sc_returnToggle")?.addEventListener("change", scenarioRecalc);

  // initial state
  enforceScenarioReturnLock();
  updateScenarioCalcButtonState();
  updateScenarioFuelUI();
  // Actual: Load Selected Trip into Actual (read-only)
  $("btnUseTripForActual")?.addEventListener("click", () => {
    const id = $("a_tripSelect")?.value || "";
    loadTripIntoActual(id);
  });
  $("a_tripSelect")?.addEventListener("change", () => {
    const id = $("a_tripSelect")?.value || "";
    loadTripIntoActual(id);
  });

  // Actual: Add Other Expense (dropdown)
  $("btnAddActualExpense")?.addEventListener("click", () => {
    const type = $("a_expType")?.value || "Other";
    const amt = num("a_expAmount", 0);
    if (!(amt > 0)) return;
    actualExpensesDraft.unshift({ type, amount: amt, createdAt: Date.now() });
    if ($("a_expAmount")) $("a_expAmount").value = "";
    renderActualExpenses();
    $("btnCalcActual")?.click();
  });

  // Actual: Calculate (NO redirect to Settings)
  $("btnCalcActual")?.addEventListener("click", () => {
    const s = needSettings(false); // do not jump tabs
    if (!s) {
      $("actualHint").textContent = "⚠️ Settings are not saved yet. Calculations may be incomplete.";
      // continue anyway
    }

    const selId = $("a_tripSelect")?.value || localStorage.getItem(LS_ACTIVE_TRIP_ID) || "";
    if (selId) loadTripIntoActual(selId);

    const deadhead = num("a_deadhead", 0);
    const loaded = num("a_loaded", 0);
    const miles = Math.max(0, deadhead + loaded);

    const gross = num("a_gross", 0);
    const fuelPrice = num("a_fuelPrice", 0);
    const gallons = num("a_gallons", 0);
    const fuelCost = gallons * fuelPrice;

    // Actual add-ons
    const waitShipper = num("a_waitShipper", 0);
    const waitConsignee = num("a_waitConsignee", 0);
    const waitTotal = Math.max(0, waitShipper + waitConsignee);

    const billableAuto = computeBillableDetention(waitShipper, waitConsignee);
    const detBillEl = $("a_detBillHours");
    const detBillHours = (detBillEl && String(detBillEl.value||"").trim() !== "")
      ? Math.max(0, Number(detBillEl.value))
      : billableAuto;

    const detRate = Math.max(100, num("a_detRate", 100));
    const detentionTotal = detBillHours * detRate;
    if ($("a_detTotal")) $("a_detTotal").value = moneyStr(detentionTotal);

    // Fixed-cost burn per hour (waiting cost)
    const fc = readFixedCostPerHour(s || SETTINGS_DEFAULTS);
    const waitCostPerHr = fc.perHr;
    const waitLost = waitTotal * waitCostPerHr;
    if ($("a_waitCostPerHr")) $("a_waitCostPerHr").value = moneyStr(waitCostPerHr);
    if ($("a_waitLost")) $("a_waitLost").value = `${moneyStr(waitLost)} on ${waitTotal.toFixed(1)} hrs`;

    const otherExpenses = computeActualOtherExpensesTotal();
    if ($("a_otherExpensesTotal")) $("a_otherExpensesTotal").value = moneyStr(otherExpenses);

    // Hours away baseline + waiting time
    const dotBase = computeDotHoursAway(miles);
    const hoursAway = (num("a_hoursAway", 0) || dotBase.totalHrs) + waitTotal;
    if ($("a_hoursAway")) $("a_hoursAway").value = hoursAway.toFixed(1);

    // Net includes detention as additional revenue (if billed)
    const net = gross + detentionTotal - fuelCost - otherExpenses;
    const otr = hoursAway > 0 ? (net / hoursAway) : 0;

    $("actualOut").textContent =
      `Total Miles: ${Math.round(miles)}\n` +
      `Fuel Cost: ${money(fuelCost)}\n` +
      `Other Expenses: ${money(otherExpenses)}\n` +
      `Detention Bill: ${detBillHours.toFixed(1)} hrs @ $${detRate.toFixed(0)}/hr = ${money(detentionTotal)}\n` +
      `Net: ${money(net)}\n` +
      `Hours Away (DOT + wait): ${hoursAway.toFixed(1)}\n` +
      `O.T.R.A.F.F.: ${money(otr)} / hr`;

    const dot = dotBase;
    $("a_dotBreakdown").textContent =
      `DOT Breakdown (auto)\n` +
      `Drive Hours @60mph: ${dot.driveHrs.toFixed(1)}\n` +
      `Fuel Stops: ${dot.fuelStops} (${dot.fuelHrs.toFixed(2)} hrs)\n` +
      `30-min Breaks: ${dot.breakHrs.toFixed(1)} hrs\n` +
      `Sleeper: ${dot.sleeperHrs.toFixed(1)} hrs\n` +
      `Total Hours Away: ${dot.totalHrs.toFixed(1)}\n` +
      `Days Away (calc): ${dot.days}`;

    $("actualHint").textContent = "";
  });

  // Actual: Save (NO redirect to Settings)
  // Actual: Save (NO redirect to Settings)
  $("btnSaveActual")?.addEventListener("click", () => {
    const s = needSettings(false);
    if (!s) {
      $("actualHint").textContent = "⚠️ Settings are not saved yet. Saving is still allowed, but totals may be off.";
    }

    // Calculate first to ensure outputs up to date
    $("btnCalcActual")?.click();

    const trips = getTrips();
    const selId = $("a_tripSelect")?.value || localStorage.getItem(LS_ACTIVE_TRIP_ID) || "";
    const t = trips.find(x => x.id === selId) || null;
    if (!t) {
      alert("Select a Trip/Load first.");
      return;
    }

    // Save a snapshot to LS_LOADS (existing history bucket)
    const miles = num("a_tripMiles", 0);
    const gross = num("a_gross", 0);
    const fuelPrice = num("a_fuelPrice", 0);
    const gallons = num("a_gallons", 0);
    const fuelCost = gallons * fuelPrice;
    const waitShipper = num("a_waitShipper", 0);
    const waitConsignee = num("a_waitConsignee", 0);
    const waitTotal = Math.max(0, waitShipper + waitConsignee);
    const billableAuto = computeBillableDetention(waitShipper, waitConsignee);
    const detBillEl = $("a_detBillHours");
    const detBillHours = (detBillEl && String(detBillEl.value||"").trim() !== "")
      ? Math.max(0, Number(detBillEl.value))
      : billableAuto;
    const detRate = Math.max(100, num("a_detRate", 100));
    const detentionTotal = detBillHours * detRate;
    const otherExpenses = computeActualOtherExpensesTotal();

    const dotBase = computeDotHoursAway(miles);
    const hoursAway = (num("a_hoursAway", 0) || dotBase.totalHrs) + waitTotal;
    const net = gross + detentionTotal - fuelCost - otherExpenses;
    const otr = hoursAway > 0 ? (net / hoursAway) : 0;

    const arr = getLoads();

    // Idempotent save: if this Trip was saved before, UPDATE it instead of creating duplicates.
    const existingIndex = Array.isArray(arr) ? arr.findIndex(x => x && x.tripId === t.id) : -1;

    const payload = {
      id: (existingIndex >= 0 && arr[existingIndex]?.id) ? arr[existingIndex].id : ("actual_" + Date.now()),
      tripId: t.id,
      loadNumber: t.loadNumber || "",
      deliveryDate: t.deliveryDate || "",
      totalMiles: miles,

// Carry over Trip-side parties (auto-fill request)
shipperName: t.shipper?.name || "",
shipperAddress: $("a_shipperAddr")?.value || "",

consigneeName: t.consignee?.name || "",
consigneeAddress: $("a_consigneeAddr")?.value || "",

brokerName: t.broker?.name || "",
brokerAddress: $("a_brokerAddr")?.value || "",
brokerPhone: t.broker?.phone || "",
brokerEmail: t.broker?.email || "",

    // Miles breakout
    deadhead: Number($("a_deadhead")?.value || 0),
    loaded: Number($("a_loaded")?.value || 0),
    returnMiles: Number($("a_returnMiles")?.value || 0),
    returning: !!t.returning,

      gross,
      fuelCost,
      net,
      hoursAway,
      otr,
      waitShipper,
      waitConsignee,
      detentionBillHours: detBillHours,
      detentionRate: detRate,
      detentionTotal,
      otherExpenses,
      expenses: actualExpensesDraft.slice(0, 100),
      manualOTRAFF: num("a_manualOTRAFF", 0) || 0,
      createdAt: (existingIndex >= 0 && arr[existingIndex]?.createdAt) ? arr[existingIndex].createdAt : Date.now(),
      updatedAt: Date.now()
    };

    if (existingIndex >= 0) {
      arr[existingIndex] = payload;
    } else {
      arr.unshift(payload);
    }

    saveLoads(arr.slice(0, 300));
renderLoadsTable?.();
    try { fleetRenderLoadSelect?.(); } catch {}
    renderLoadsList?.();

    // Log lifetime MPG totals (only on Save Actual, avoids double count)
    if (miles > 0 && gallons > 0) {
      setStoredNumber("lifetimeMiles", getStoredNumber("lifetimeMiles", 0) + miles);
      setStoredNumber("lifetimeGallons", getStoredNumber("lifetimeGallons", 0) + gallons);
      updateLifetimeMpgUI();
    }

    $("actualHint").textContent = "✅ Saved. Check Loads or Totals.";
    // Auto-refresh computed tabs (Reserve/Bank/Totals) from their sources
    try { renderTotals(); } catch {}
    alert("Actual saved to history.");
  });
  // Totals
  $("btnRefreshTotals")?.addEventListener("click", renderTotals);


  $("btnClearAll")?.addEventListener("click", () => {
    const ok = confirm("Clear ALL local data (Settings + Loads + Trips)? This cannot be undone.");
    if (!ok) return;
    localStorage.removeItem(LS_SETTINGS);
    localStorage.removeItem(LS_LOADS);
    localStorage.removeItem(LS_TRIPS);
    localStorage.removeItem(LS_ACTIVE_TRIP_ID);
    localStorage.removeItem(LS_REMIT_INFO);
    localStorage.removeItem("lifetimeMiles");
    localStorage.removeItem("lifetimeGallons");
    $("totalsOut").textContent = "—\nCleared.";
    $("actualHint").textContent = "";
    $("settingsHint").textContent = "Cleared. Re-enter settings.";
    $("loadsList").innerHTML = "";
    $("loadDetailOut").textContent = "Tap a load to see details.";
    $("invoiceOut") && ($("invoiceOut").textContent = "Invoice output will appear here.");
    $("t_remitInfo") && ($("t_remitInfo").value = "");
    clearTripInputs();
    renderTripList();
    updateLifetimeMpgUI();
    renderDotBreakdown(null);
  });
  // Broker screen
  $("btnFirmEmail")?.addEventListener("click", () => {
    const ctx = getBrokerEmailContext();
    $("brokerOut").textContent = (ctx.brokerName || ctx.loadNumber) ? firmEmail(ctx) : "No Trip or Actual load saved yet.";
  });
  $("btnPraiseEmail")?.addEventListener("click", () => {
    const ctx = getBrokerEmailContext();
    $("brokerOut").textContent = (ctx.brokerName || ctx.loadNumber) ? praiseEmail(ctx) : "No Trip or Actual load saved yet.";
  });
  // Loads screen
  $("btnRefreshLoads")?.addEventListener("click", renderLoadsList);
  $("btnDeleteSelectedLoad")?.addEventListener("click", () => {
    const loads = getLoads();
    if (selectedLoadIndex === null || selectedLoadIndex === undefined) {
      alert("Tap a load first.");
      return;
    }
    if (!loads[selectedLoadIndex]) {
      alert("That load no longer exists. Refreshing list.");
      renderLoadsList();
      return;
    }
    const l = loads[selectedLoadIndex];
    const ln = (l.loadNumber && String(l.loadNumber).trim() !== "") ? `#${l.loadNumber}` : `#${selectedLoadIndex + 1}`;
    const ok = confirm(`Delete saved load ${ln} (${l.deliveryDate || "No date"} — ${l.brokerName || l.broker || "Unknown Broker"})?`);
    if (!ok) return;

    loads.splice(selectedLoadIndex, 1);
    saveLoads(loads);

    // Keep dropdown selection sane after delete
    try {
      const nextIdx = Math.min(selectedLoadIndex || 0, loads.length - 1);
      if (loads.length > 0 && nextIdx >= 0) {
        localStorage.setItem(LS_SELECTED_LOAD_INDEX, String(nextIdx));
      } else {
        localStorage.removeItem(LS_SELECTED_LOAD_INDEX);
      }
    } catch {}
    selectedLoadIndex = null;
    renderLoadsList();
  });

  $("btnClearAllLoads")?.addEventListener("click", () => {
    const ok = confirm("Clear ALL saved loads? This cannot be undone.");
    if (!ok) return;
    saveLoads([]);
    selectedLoadIndex = null;
    renderLoadsList();
    try { fleetRenderLoadSelect?.(); } catch {}
  });
  // Trip init
  initTripDropdowns();
  initTripModule();
  // Fleet init
  initFleetModule();
  // Lifetime MPG init
  if (localStorage.getItem("lifetimeMiles") === null) setStoredNumber("lifetimeMiles", 0);
  if (localStorage.getItem("lifetimeGallons") === null) setStoredNumber("lifetimeGallons", 0);
  updateLifetimeMpgUI();
  // Scenario init
  enforceScenarioReturnLock();
  updateScenarioCalcButtonState();
  updateScenarioFuelUI();
  updateScenarioHoursAwayUI();
    try { updateScenarioBadge({ net: 0, otr: 0, netPerMile: 0, totalMiles: 0 }); } catch {}

  // Actual add-ons init
  try { resetActualAddOnsUI(); } catch {}

  // Initial renders
  renderTotals();
  renderLoadsList();
  renderDotBreakdown(null);
});

// ===== Background image path resolver (does NOT touch tabs/buttons) =====
(function setTmsBackground(){
  const candidates = [
    "images/desert-sunset-truck.png",
    "./images/desert-sunset-truck.png",
    "../images/desert-sunset-truck.png",
    "desert-sunset-truck.png",
    "./desert-sunset-truck.png",
    "app/images/desert-sunset-truck.png"
  ];

  function tryPath(i){
    if (i >= candidates.length) return;
    const p = candidates[i];
    const img = new Image();
    img.onload = () => {
      document.documentElement.style.setProperty("--tms-bg-url", `url("${p}")`);
    };
    img.onerror = () => tryPath(i + 1);
    img.src = p + (p.includes("?") ? "&" : "?") + "v=" + Date.now(); // cache-bust
  }

  tryPath(0);
})();


/* Desktop More Tabs */

(function setupDesktopMoreTabs(){
  const PINNED_COUNT = 5;          // show 4–5 buttons, hide the rest under More
  const DESKTOP_MIN = 900;         // matches CSS breakpoint

  function isDesktop(){
    return window.matchMedia && window.matchMedia(`(min-width: ${DESKTOP_MIN}px)`).matches;
  }

  function rebuild(){
    const tabs = document.getElementById('tabs');
    const select = document.getElementById('desktopMore');
    if (!tabs || !select) return;

    const buttons = Array.from(tabs.querySelectorAll('button.tab'));
    if (!buttons.length) return;

    // Reset
    buttons.forEach(b => b.classList.remove('desktop-hidden'));
    select.innerHTML = '<option value="">More ▾</option>';

    if (!isDesktop()){
      return; // no desktop hiding on mobile/tablet
    }

    const activeBtn = tabs.querySelector('button.tab.active');
    const overflow = buttons.slice(PINNED_COUNT);

    // Hide overflow buttons EXCEPT the active one (so user always sees where they are)
    overflow.forEach(btn => {
      if (activeBtn && btn === activeBtn) return;
      btn.classList.add('desktop-hidden');

      // add to dropdown
      const opt = document.createElement('option');
      opt.value = btn.getAttribute('data-screen') || '';
      opt.textContent = (btn.textContent || '').trim();
      select.appendChild(opt);
    });

    // If there is nothing to put in dropdown, hide it
    const wrapper = select.closest('.tabsMore');
    if (wrapper){
      wrapper.style.display = (select.options.length > 1) ? '' : 'none';
    }
  }

  // Click tab when dropdown changes
  function bind(){
    const select = document.getElementById('desktopMore');
    const tabs = document.getElementById('tabs');
    if (!select || !tabs) return;

    if (select.dataset.bound === '1') return;
    select.dataset.bound = '1';

    select.addEventListener('change', () => {
      const val = select.value;
      if (!val) return;
      const btn = tabs.querySelector(`button.tab[data-screen="${CSS.escape(val)}"]`);
      if (btn) btn.click();
      select.value = '';
    });
  }

  // Run now + on resize + when tabs change active state
  window.addEventListener('resize', () => { bind(); rebuild(); });

  document.addEventListener('click', (e) => {
    const t = e.target;
    if (t && t.matches && t.matches('#tabs button.tab')){
      // allow existing click handler to run, then rebuild
      setTimeout(rebuild, 0);
    }
  });

  // Initial
  bind();
  rebuild();
})();






/* Mobile More Menu */

(function setupMobileMoreMenu(){
  const MOBILE_MAX = 9999; // allow More menu on all viewports; CSS controls layout

  function isMobile(){
    return window.matchMedia && window.matchMedia(`(max-width: ${MOBILE_MAX}px)`).matches;
  }

  function getTabs(){
    const tabs = document.getElementById('tabs');
    if (!tabs) return [];
    return Array.from(tabs.querySelectorAll('button.tab')).map(b => ({
      screen: b.getAttribute('data-screen'),
      label: (b.textContent || '').trim(),
      el: b
    })).filter(t => t.screen);
  }

  function buildMenu(){
    const panel = document.getElementById('mobileMenuPanel');
    const inner = panel ? panel.querySelector('.mobileMenuInner') : null;
    if (!panel || !inner) return;

    inner.innerHTML = '';
    const pinned = new Set(['settings','scenario']);
    const tabs = getTabs();

    tabs.forEach(t => {
      if (pinned.has(t.screen)) return;
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'mobileMenuItem';
      item.setAttribute('role','menuitem');
      item.textContent = t.label;
      item.addEventListener('click', () => {
        panel.classList.remove('open');
        panel.setAttribute('aria-hidden','true');
        const btn = document.querySelector(`#tabs button.tab[data-screen="${CSS.escape(t.screen)}"]`);
        if (btn) btn.click();
        const moreBtn = document.getElementById('mMoreBtn');
        if (moreBtn) moreBtn.setAttribute('aria-expanded','false');
      });
      inner.appendChild(item);
    });

    if (!inner.children.length){
      const empty = document.createElement('div');
      empty.style.padding = '10px 12px';
      empty.style.color = 'rgba(255,255,255,.75)';
      empty.textContent = 'No more tabs';
      inner.appendChild(empty);
    }
  }

  function bind(){
    const moreBtn = document.getElementById('mMoreBtn');
    const panel = document.getElementById('mobileMenuPanel');
    const settingsBtn = document.getElementById('mTabSettings');
    const scenarioBtn = document.getElementById('mTabScenario');
    if (!moreBtn || !panel) return;

    if (moreBtn.dataset.bound === '1') return;
    moreBtn.dataset.bound = '1';

    moreBtn.addEventListener('click', () => {
      buildMenu();
      const open = panel.classList.toggle('open');
      panel.setAttribute('aria-hidden', open ? 'false' : 'true');
      moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    panel.addEventListener('click', (e) => {
      if (e.target === panel){
        panel.classList.remove('open');
        panel.setAttribute('aria-hidden','true');
        moreBtn.setAttribute('aria-expanded','false');
      }
    });

    // Pinned navigation
    if (settingsBtn && settingsBtn.dataset.bound !== '1'){
      settingsBtn.dataset.bound = '1';
      settingsBtn.addEventListener('click', () => {
          const btn = document.querySelector('#tabs button.tab[data-screen="settings"]');
        if (btn) btn.click();
      });
    }
    if (scenarioBtn && scenarioBtn.dataset.bound !== '1'){
      scenarioBtn.dataset.bound = '1';
      scenarioBtn.addEventListener('click', () => {
          const btn = document.querySelector('#tabs button.tab[data-screen="scenario"]');
        if (btn) btn.click();
      });
    }
  }

  function onReady(fn){
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  onReady(bind);
})();


/* ===== TMS_PAYWALL_V2 (Supabase Auth + Stripe Checkout + Profiles subscription_status) ===== */
(function () {
  const cfg = {
    supabaseUrl: String(window.TMS_SUPABASE_URL || "").trim(),
    supabaseAnon: String(window.TMS_SUPABASE_ANON_KEY || "").trim(),
    priceId: String(window.TMS_STRIPE_PRICE_ID || "").trim(),
    fnCreateCheckout: String(window.TMS_FN_CREATE_CHECKOUT || "create-checkout-session").trim(),
    fnCreatePortal: String(window.TMS_FN_CREATE_PORTAL || "create-portal-session").trim(),
    fnSyncSubscription: String(window.TMS_FN_SYNC_SUBSCRIPTION || "sync-subscription").trim(),
  };

  function $(id) { return document.getElementById(id); }

  function setStatus(msg, isError = false) {
    const el = $("tmsPaywallStatus");
    if (!el) return;
    if (!msg) { el.style.display = "none"; el.textContent = ""; return; }
    el.style.display = "block";
    el.textContent = (isError ? "✖ " : "• ") + msg;
  }


  function setTopbarStatus(msg, isError = false) {
    const el = $("topbarStatus");
    if (!el) return;
    el.classList.toggle("error", !!isError);
    el.textContent = msg || "";
    if (msg) {
      clearTimeout(setTopbarStatus._t);
      setTopbarStatus._t = setTimeout(() => {
        el.textContent = "";
        el.classList.remove("error");
      }, 6000);
    }
  }

  function showPaywall() {
    const pw = $("tmsPaywall");
    const root = $("appRoot");
    if (pw) { pw.classList.add("tms-show"); pw.setAttribute("aria-hidden", "false"); }
    if (root) root.classList.add("tms-locked");
  }

  function hidePaywall() {
    const pw = $("tmsPaywall");
    const root = $("appRoot");
    if (pw) { pw.classList.remove("tms-show"); pw.setAttribute("aria-hidden", "true"); }
    if (root) root.classList.remove("tms-locked");
  }

  function safeLocalAuthCleanup() {
    // Supabase stores tokens in localStorage; clear them to avoid stuck states.
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
      keys
        .filter(k => k && (k.includes("sb-") || k.includes("supabase")))
        .forEach(k => localStorage.removeItem(k));
    } catch {}
    try { sessionStorage.clear(); } catch {}
  }

  function getReturnUrl() {
    // Always return to the same page (no /paywall route needed)
    const u = new URL(window.location.href);
    u.searchParams.delete("session_id");
    u.searchParams.delete("sub");
    return u.origin + u.pathname;
  }

  function isUnlockedStatus(s) {
    return s === "active" || s === "trialing";
  }

  async function createSupabaseClient() {
    if (!cfg.supabaseUrl || !cfg.supabaseAnon || cfg.supabaseUrl.includes("PASTE_") || cfg.supabaseAnon.includes("PASTE_")) {
      console.warn("Paywall disabled: missing Supabase URL/anon key.");
      return null;
    }
    if (!window.supabase || !window.supabase.createClient) {
      console.warn("Paywall disabled: Supabase JS not loaded.");
      return null;
    }
    // Disable session persistence issues by setting persistSession true but we'll clear on signout
    return window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnon, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }

  async function ensureProfileRow(supabaseClient, user) {
    if (!user) return;
    // Upsert basic profile row (id,email). Requires RLS policy allowing user to upsert their row.
    try {
      await supabaseClient.from("profiles").upsert({ id: user.id, email: user.email }, { onConflict: "id" });
    } catch (e) {
      console.warn("profiles upsert failed (RLS?)", e);
    }
  }

  async function readProfile(supabaseClient, user) {
    if (!user) return null;
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("id,email,subscription_status,stripe_customer_id,current_period_end")
      .eq("id", user.id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function syncSubscription(supabaseClient, sessionId) {
    // Calls your Supabase Edge Function that uses STRIPE_SECRET_KEY + SERVICE_ROLE to update profiles.
    try {
      const body = sessionId ? { session_id: sessionId } : {};
      const { data, error } = await supabaseClient.functions.invoke(cfg.fnSyncSubscription, { body });
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn("sync-subscription failed", e);
      return null;
    }
  }

  async function evaluateLock(supabaseClient, opts = {}) {
    const { silent = false, trySync = false } = opts;
    const s = (await supabaseClient.auth.getSession())?.data?.session;
    const user = s?.user || null;

    if (!user) {
      if (!silent) setStatus("");
      showPaywall();
      $("tmsAuthBlock").style.display = "block";
      $("tmsSubBlock").style.display = "none";
      return;
    }

    $("tmsAuthBlock").style.display = "none";
    $("tmsSubBlock").style.display = "block";
    $("tmsSignedInAs").textContent = user.email || "";

    await ensureProfileRow(supabaseClient, user);

    // If Stripe redirected back with session_id, try to sync once automatically.
    const url = new URL(window.location.href);
    const sessionId = url.searchParams.get("session_id");
    const subFlag = url.searchParams.get("sub");

    if (trySync || sessionId || subFlag === "success") {
      if (!silent) setStatus("Checking subscription…");
      await syncSubscription(supabaseClient, sessionId || undefined);
      // Clean the URL so refreshes don't keep syncing
      url.searchParams.delete("session_id");
      url.searchParams.delete("sub");
      window.history.replaceState({}, "", url.toString());
    }

    let profile = null;
    try {
      profile = await readProfile(supabaseClient, user);
    } catch (e) {
      console.warn("profiles_select_failed", e);
      if (!silent) setStatus("Could not read profile/subscription (check RLS).", true);
      showPaywall();
      return;
    }

    const status = String(profile?.subscription_status || "").toLowerCase();
    if (isUnlockedStatus(status)) {
      if (!silent) setStatus("");
      hidePaywall();
      return;
    }

    // Still locked
    if (!silent) setStatus("Not subscribed yet. Tap “Subscribe & Unlock” or “Refresh”.");
    showPaywall();
  }

  async function createCheckoutAndRedirect(supabaseClient) {
    if (!cfg.priceId || cfg.priceId.includes("PASTE_")) throw new Error("missing_price_id");
    const s = (await supabaseClient.auth.getSession())?.data?.session;
    const user = s?.user;
    if (!user) throw new Error("not_signed_in");

    setStatus("Preparing checkout…");
    const successUrl = getReturnUrl() + "?sub=success"; // session_id added by Stripe only if your Edge Function uses {CHECKOUT_SESSION_ID}
    const cancelUrl = getReturnUrl();

    const { data, error } = await supabaseClient.functions.invoke(cfg.fnCreateCheckout, {
      body: { priceId: cfg.priceId, successUrl, cancelUrl },
    });
    if (error) throw error;
    const url = data?.url || data?.checkout_url || data?.checkoutUrl;
    if (!url) throw new Error("no_checkout_url_returned");
    window.location.href = url;
  }



  async function tmsCallEdgeFunction(supabaseClient, fnName, payload, timeoutMs = 15000) {
    // IMPORTANT:
    // Do NOT inject a custom Authorization header here. Supabase JS already sends the user's JWT
    // automatically when a session exists. Adding custom headers forces a browser CORS preflight,
    // which will fail unless the Edge Function explicitly handles OPTIONS + allows that header.
    const invokePromise = supabaseClient.functions.invoke(fnName, { body: payload || {} });

    const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error(`edge_${fnName}_timeout_${timeoutMs}ms`)), timeoutMs));
    const res = await Promise.race([invokePromise, timeoutPromise]);
    const { data, error } = res || {};
    if (error) throw error;
    return data;
  }
  async function signOutHard(supabaseClient) {
    setStatus("Signing out…");
    setTopbarStatus("Signing out…");
    try { await supabaseClient.auth.signOut({ scope: "global" }); } catch {}
    safeLocalAuthCleanup();
    // force UI reset
    window.location.replace(getReturnUrl());
    }

  async function wireUI(supabaseClient) {
    const btnIn = $("tmsBtnSignIn");
    const btnUp = $("tmsBtnSignUp");
    const btnMagic = $("tmsBtnMagic");
    const btnOut = $("tmsBtnSignOut");
    const btnSub = $("tmsBtnSubscribe");
    const btnRef = $("tmsBtnRefresh");
    const btnPortal = $("tmsBtnPortal");

    // Topbar actions (shown after unlock)
    const topAuthEl = document.getElementById("paywallAuthStatus");
    const btnTopProfile = document.getElementById("btnTopProfile");
    const btnTopSignOut = document.getElementById("btnTopSignOut");

    function setTopbarFromUser(user) {
      const email = user?.email || "";
      if (topAuthEl) topAuthEl.textContent = email ? `Signed in: ${email}` : "";
      if (btnTopProfile) btnTopProfile.hidden = !email;
      if (btnTopSignOut) btnTopSignOut.hidden = !email;
    }

    async function refreshTopbar() {
      try {
        const s = (await supabaseClient.auth.getSession())?.data?.session;
        setTopbarFromUser(s?.user);
      } catch {
        setTopbarFromUser(null);
      }
    }

    async function openPortal() {
      const s = (await supabaseClient.auth.getSession())?.data?.session;
      const user = s?.user;
      if (!user) throw new Error("not_signed_in");
      const returnUrl = window.location.origin + window.location.pathname;
      const out = await tmsCallEdgeFunction(supabaseClient, cfg.fnCreatePortal, { return_url: returnUrl });
      const url = out?.url || out?.portalUrl || out?.redirectUrl;
      if (!url) throw new Error("portal_missing_url");
      window.location.href = url;
    }

    btnIn?.addEventListener("click", async () => {
      const email = String($("tmsEmail").value || "").trim();
      const pass = String($("tmsPass").value || "");
      if (!email || !pass) return setStatus("Enter email + password.", true);
      setStatus("Signing in…");
      try {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        setStatus("");
        await evaluateLock(supabaseClient, { silent: true });
      } catch (e) {
        setStatus("Sign-in failed. Check email/password.", true);
        console.warn(e);
      }
    });

    btnUp?.addEventListener("click", async () => {
      const email = String($("tmsEmail").value || "").trim();
      const pass = String($("tmsPass").value || "");
      if (!email || !pass) return setStatus("Enter email + password.", true);
      setStatus("Creating account…");
      try {
        const { error } = await supabaseClient.auth.signUp({ email, password: pass });
        if (error) throw error;
        setStatus("Account created. Now sign in.", false);
      } catch (e) {
        const msg = String(e?.message || "");
        if (msg.toLowerCase().includes("rate")) setStatus("Too many attempts. Wait a minute and try again.", true);
        else setStatus("Sign-up failed. Try a different email/password.", true);
        console.warn(e);
      }
    });

    btnMagic?.addEventListener("click", async () => {
      const email = String($("tmsEmail").value || "").trim();
      if (!email) return setStatus("Enter email first.", true);
      setStatus("Sending magic link…");
      try {
        const { error } = await supabaseClient.auth.signInWithOtp({ email, options: { emailRedirectTo: getReturnUrl() } });
        if (error) throw error;
        setStatus("Magic link sent. Check your email.", false);
      } catch (e) {
        const msg = String(e?.message || "");
        if (msg.toLowerCase().includes("rate")) setStatus("Too many emails sent. Wait a minute and try again.", true);
        else setStatus("Magic link failed.", true);
        console.warn(e);
      }
    });

    // Paywall + topbar signout
    btnOut?.addEventListener("click", async () => { await signOutHard(supabaseClient); });
    btnTopSignOut?.addEventListener("click", async () => { setTopbarStatus("Signing out…"); await signOutHard(supabaseClient); });

    // Profile / Manage subscription
    btnPortal?.addEventListener("click", async () => {
      try { await openPortal(); }
      catch (e) {
        console.warn(e);
        setStatus("Profile failed: " + (e?.message || String(e)), true);
      }
    });
    btnTopProfile?.addEventListener("click", async () => {
      setTopbarStatus("Opening subscription portal…");
      try { await openPortal(); }
      catch (e) {
        console.warn(e);
        const msg = (e?.message || String(e));
        setTopbarStatus("Profile failed: " + msg, true);
        setStatus("Profile failed: " + msg, true);
      }
    });

    btnSub?.addEventListener("click", async () => {
      try { await createCheckoutAndRedirect(supabaseClient); }
      catch (e) {
        console.warn(e);
        setStatus("Checkout failed: " + (e?.message || String(e)), true);
      }
    });

    btnRef?.addEventListener("click", async () => {
      setStatus("Checking subscription…");
      await evaluateLock(supabaseClient, { trySync: true });
    });

    // Initialize topbar state
    await refreshTopbar();

    // React immediately to auth changes
    supabaseClient.auth.onAuthStateChange(async () => {
      await refreshTopbar();
      await evaluateLock(supabaseClient, { silent: true });
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const supabaseClient = await createSupabaseClient();
    if (!supabaseClient) return;

    await wireUI(supabaseClient);

    // Always start locked until we confirm subscription
    await evaluateLock(supabaseClient, { trySync: true });
  });
})();
