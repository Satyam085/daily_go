const MASTER_SCHEDULE_TSV = `322707\tBahej\tAG\tBhimpore\t07:00:00\t17:00:00\t0.02
322704\tBhimpore\tJGY\tBhimpore\t00:00:00\t24:00:00\t0.02
322706\tHathuka\tAG\tBhimpore\t07:00:00\t17:00:00\t0.02
322702\tHill\tHTEX\tBhimpore\t00:00:00\t24:00:00\t0.02
322701\tKhakhar\tAG\tBhimpore\t07:00:00\t17:00:00\t0.02
322705\tKumbhiya\tAG\tBhimpore\t07:00:00\t17:00:00\t0.02
322703\tRanveri\tJGY\tBhimpore\t00:00:00\t24:00:00\t0.02
322708\tSankalp\tHTEX\tBhimpore\t00:00:00\t24:00:00\t0.02
321106\tKamalchhod\tAG\tBorakhadi\t06:00:00\t16:00:00\t0.02
329801\tDhodhiya\tAG\tDegama\t06:00:00\t16:00:00\t0.02
329802\tKokanvad\tAG\tDegama\t06:00:00\t16:00:00\t0.02
329803\tMadhuli\tJGY\tDegama\t00:00:00\t24:00:00\t0.02
532802\tAndhatri\tJGY\tGodadha\t00:00:00\t24:00:00\t0.02
532804\tDharampura\tAG\tGodadha\t06:00:00\t16:00:00\t0.02
532803\tPahad\tAG\tGodadha\t06:00:00\t16:00:00\t0.02
532801\tPatel\tJGY\tGodadha\t00:00:00\t24:00:00\t0.02
388705\tDungari\tAG\tKelkui\t06:00:00\t16:00:00\t0.02
388703\tGodaun\tJGY\tKelkui\t00:00:00\t24:00:00\t0.02
388702\tNalotha\tAG\tKelkui\t06:00:00\t16:00:00\t0.02
388701\tParshi\tAG\tKelkui\t06:00:00\t16:00:00\t0.02
388704\tValmiki\tJGY\tKelkui\t00:00:00\t24:00:00\t0.02
322205\tAmbach\tJGY\tRupvada\t00:00:00\t24:00:00\t0.02
322203\tDegama\tJGY\tRupvada\t00:00:00\t24:00:00\t0.02
322206\tGandhi\tAGSKY\tRupvada\t06:00:00\t16:00:00\t0.02
322202\tKhanpur\tAGSKY\tRupvada\t06:00:00\t16:00:00\t0.02
322208\tTad\tAG\tRupvada\t06:00:00\t16:00:00\t0.02
102503\tBajipura\tAG\tValod\t06:00:00\t16:00:00\t0.02
102502\tBavli\tAG\tValod\t06:00:00\t16:00:00\t0.02
102512\tButwada\tJGY\tValod\t00:00:00\t24:00:00\t0.02
102515\tDelwada\tJGY\tValod\t00:00:00\t24:00:00\t0.02
102507\tNansad\tAG\tValod\t06:00:00\t16:00:00\t0.02
102514\tPavran\tAG\tValod\t06:00:00\t16:00:00\t0.02
102511\tRupvada\tAG\tValod\t06:00:00\t16:00:00\t0.02
102508\tSiker\tAG\tValod\t06:00:00\t16:00:00\t0.02
102504\tSumul\tJGY\tValod\t00:00:00\t24:00:00\t0.02
102513\tSumul Cattle\tHTEX\tValod\t00:00:00\t24:00:00\t0.02
102509\tTokarva\tAG\tValod\t06:00:00\t16:00:00\t0.02
102501\tValod (T)\tJGY\tValod\t00:00:00\t24:00:00\t0.02
102506\tVedchhi\tJGY\tValod\t00:00:00\t24:00:00\t0.02
140202\tBuhari\tJGY\tVirpore\t00:00:00\t24:00:00\t0.02
140206\tDadariya\tAG\tVirpore\t06:00:00\t16:00:00\t0.02
140204\tVirpur\tAG\tVirpore\t06:00:00\t16:00:00\t0.02`;

function parseMaster(tsv) {
  return tsv
    .trim()
    .split("\n")
    .map((line) => {
      const cols = line.split("\t");
      return {
        code: (cols[0] || "").trim(),
        feeder: (cols[1] || "").trim(),
        category: (cols[2] || "").trim(),
        substation: (cols[3] || "").trim(),
        start: (cols[4] || "").trim(),
        end: (cols[5] || "").trim(),
        mw: (cols[6] || "0.02").trim() || "0.02",
      };
    })
    .filter((f) => f.code);
}

const feederMaster = parseMaster(MASTER_SCHEDULE_TSV);
const feederByCode = Object.fromEntries(feederMaster.map((f) => [f.code, f]));
const entries = new Map();
const substations = [...new Set(feederMaster.map((f) => f.substation))].sort();
const API_BASE_URL = "";
const SESSION_STORAGE_KEY = "das_automation_session_v1";
let activeSubstation = substations[0] || "";
let visibleFeederCodes = [];
let selectedFeederCode = "";
let lastGeneratedScript = "";

const debouncedSave = debounce(() => {
  autoSaveActiveFeeder();
  runSoftValidation();
}, 500);
const debouncedValidation = debounce(() => runSoftValidation(), 200);

const el = {
  substationTabs: document.getElementById("substationTabs"),
  feederPills: document.getElementById("feederPills"),
  selectedFeeder: document.getElementById("selectedFeeder"),
  tt: document.getElementById("tt"),
  ttReason: document.getElementById("ttReason"),
  sfList: document.getElementById("sfList"),
  addSfBtn: document.getElementById("addSfBtn"),
  esdList: document.getElementById("esdList"),
  addEsdBtn: document.getElementById("addEsdBtn"),
  psdStart: document.getElementById("psdStart"),
  psdEnd: document.getElementById("psdEnd"),
  psdReason: document.getElementById("psdReason"),
  clearBtn: document.getElementById("clearBtn"),
  generateBtn: document.getElementById("generateBtn"),
  generateStatus: document.getElementById("generateStatus"),
};

function getTodayLocalDate() {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 10);
}

function loadSessionStateForToday() {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.date !== getTodayLocalDate()) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch (err) {
    return null;
  }
}

function persistSessionState() {
  try {
    const byCode = {};
    entries.forEach((value, code) => {
      byCode[code] = value;
    });
    const snapshot = {
      date: getTodayLocalDate(),
      activeSubstation,
      selectedFeederCode,
      entries: byCode,
    };
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (err) {
    // Ignore storage exceptions.
  }
}

function hydrateSessionState() {
  const snapshot = loadSessionStateForToday();
  if (!snapshot) return;

  const restoredEntries = snapshot.entries;
  if (restoredEntries && typeof restoredEntries === "object") {
    Object.keys(restoredEntries).forEach((code) => {
      if (feederByCode[code]) {
        const entry = restoredEntries[code];
        // Migration to multiple SFs/ESDs
        if (!entry.SFs && (entry["SF Start"] || entry["SF End"] || entry["SF Reason"])) {
          entry.SFs = [{
            Start: entry["SF Start"] || "",
            End: entry["SF End"] || "",
            Reason: entry["SF Reason"] || ""
          }];
          delete entry["SF Start"];
          delete entry["SF End"];
          delete entry["SF Reason"];
        } else if (!entry.SFs) {
          entry.SFs = [];
        }

        if (!entry.ESDs && (entry["ESD Start"] || entry["ESD End"] || entry["ESD Reason"])) {
          entry.ESDs = [{
            Start: entry["ESD Start"] || "",
            End: entry["ESD End"] || "",
            Reason: entry["ESD Reason"] || ""
          }];
          delete entry["ESD Start"];
          delete entry["ESD End"];
          delete entry["ESD Reason"];
        } else if (!entry.ESDs) {
          entry.ESDs = [];
        }
        entries.set(code, entry);
      }
    });
  }

  if (substations.includes(snapshot.activeSubstation)) {
    activeSubstation = snapshot.activeSubstation;
  }

  if (
    snapshot.selectedFeederCode &&
    feederByCode[snapshot.selectedFeederCode]
  ) {
    selectedFeederCode = snapshot.selectedFeederCode;
  }
}

function toHHMMSS(value) {
  if (!value) return "";
  if (value.length === 5) return `${value}:00`;
  return value;
}

function toHHMM(value) {
  if (!value) return "";
  return value.slice(0, 5);
}

function hasAnyEvent(entry) {
  return (
    Number(entry.TT || 0) > 0 ||
    (entry.SFs && entry.SFs.length > 0) ||
    (entry.ESDs && entry.ESDs.length > 0) ||
    entry["PSD Start"]
  );
}

function substationHasData(name) {
  return feederMaster
    .filter((f) => f.substation === name)
    .some((f) => {
      const entry = entries.get(f.code);
      return entry && hasAnyEvent(entry);
    });
}

// U9: Render substation tabs instead of select dropdown
function populateSubstations() {
  el.substationTabs.innerHTML = "";
  substations.forEach((name) => {
    const hasData = substationHasData(name);
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = `pill substation-tab${name === activeSubstation ? " active" : ""}${hasData ? " has-data" : ""}`;
    tab.dataset.substation = name;
    tab.textContent = name;
    tab.setAttribute("role", "tab");
    tab.setAttribute(
      "aria-selected",
      name === activeSubstation ? "true" : "false",
    );
    tab.setAttribute("aria-label", `${name}${hasData ? " (has data)" : ""}`);
    el.substationTabs.appendChild(tab);
  });
}

// U5: Feeder pills with has-data indicator + U12: ARIA labels
function renderFeederPills() {
  populateSubstations();
  visibleFeederCodes = feederMaster
    .filter((f) => f.substation === activeSubstation)
    .map((f) => f.code);

  el.feederPills.innerHTML = "";
  if (!visibleFeederCodes.length) {
    selectedFeederCode = "";
    clearFormFields();
    el.selectedFeeder.value = "";
    return;
  }

  if (!visibleFeederCodes.includes(selectedFeederCode)) {
    selectedFeederCode = visibleFeederCodes[0];
  }

  visibleFeederCodes.forEach((code) => {
    const feeder = feederByCode[code];
    const entry = entries.get(code);
    const hasData = entry && hasAnyEvent(entry);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `pill${code === selectedFeederCode ? " active" : ""}${hasData ? " has-data" : ""}`;
    btn.dataset.code = code;
    btn.textContent = feeder.feeder;
    btn.setAttribute("role", "tab");
    btn.setAttribute(
      "aria-selected",
      code === selectedFeederCode ? "true" : "false",
    );
    btn.setAttribute(
      "aria-label",
      `${feeder.feeder}${hasData ? " (has data)" : ""}`,
    );
    el.feederPills.appendChild(btn);
  });

  setFeederMeta(selectedFeederCode);
}

function autoSaveActiveFeeder() {
  if (!selectedFeederCode) return;
  saveCurrentEntry();
}

function debounce(fn, waitMs) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}

function setFeederMeta(code) {
  const feeder = feederByCode[code];
  if (!feeder) return;
  selectedFeederCode = code;
  el.selectedFeeder.value = `${feeder.feeder} (${feeder.category})`;
  loadEntryToForm(code);
  persistSessionState();
}

function clearFormFields() {
  el.tt.value = "";
  el.ttReason.value = "";
  el.sfList.innerHTML = "";
  el.esdList.innerHTML = "";
  el.psdStart.value = "";
  el.psdEnd.value = "";
  el.psdReason.value = "";
}

function createSfRow(start = "", end = "", reason = "") {
  const row = document.createElement("div");
  row.className = "dynamic-row";
  row.innerHTML = `
    <label>
      SF Start
      <input type="time" class="sf-start" value="${toHHMM(start)}">
    </label>
    <label>
      SF End
      <input type="time" class="sf-end" value="${toHHMM(end)}">
    </label>
    <div class="reason-container">
      <label class="reason-field">
        SF Reason
        <input type="text" class="sf-reason" placeholder="Reason" value="${reason}">
      </label>
      <button type="button" class="remove-btn" aria-label="Remove SF">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
      </button>
    </div>
  `;

  const inputs = row.querySelectorAll("input");
  inputs.forEach((input) => {
    input.addEventListener("input", debouncedSave);
    input.addEventListener("input", debouncedValidation);
    input.addEventListener("change", debouncedSave);
  });

  row.querySelector(".remove-btn").addEventListener("click", () => {
    row.remove();
    saveCurrentEntry();
    runSoftValidation();
  });

  el.sfList.appendChild(row);
}

function createEsdRow(start = "", end = "", reason = "") {
  const row = document.createElement("div");
  row.className = "dynamic-row";
  row.innerHTML = `
    <label>
      ESD Start
      <input type="time" class="esd-start" value="${toHHMM(start)}">
    </label>
    <label>
      ESD End
      <input type="time" class="esd-end" value="${toHHMM(end)}">
    </label>
    <div class="reason-container">
      <label class="reason-field">
        ESD Reason
        <input type="text" class="esd-reason" placeholder="Reason" value="${reason}">
      </label>
      <button type="button" class="remove-btn" aria-label="Remove ESD">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
      </button>
    </div>
  `;

  const inputs = row.querySelectorAll("input");
  inputs.forEach((input) => {
    input.addEventListener("input", debouncedSave);
    input.addEventListener("input", debouncedValidation);
    input.addEventListener("change", debouncedSave);
  });

  row.querySelector(".remove-btn").addEventListener("click", () => {
    row.remove();
    saveCurrentEntry();
    runSoftValidation();
  });

  el.esdList.appendChild(row);
}

function getSfsFromUI() {
  const rows = el.sfList.querySelectorAll(".dynamic-row");
  const sfs = [];
  rows.forEach((row) => {
    const start = row.querySelector(".sf-start").value;
    const end = row.querySelector(".sf-end").value;
    const reason = row.querySelector(".sf-reason").value.trim();
    if (start || end || reason) {
      sfs.push({ Start: toHHMMSS(start), End: toHHMMSS(end), Reason: reason });
    }
  });
  return sfs;
}

function getEsdsFromUI() {
  const rows = el.esdList.querySelectorAll(".dynamic-row");
  const esds = [];
  rows.forEach((row) => {
    const start = row.querySelector(".esd-start").value;
    const end = row.querySelector(".esd-end").value;
    const reason = row.querySelector(".esd-reason").value.trim();
    if (start || end || reason) {
      esds.push({ Start: toHHMMSS(start), End: toHHMMSS(end), Reason: reason });
    }
  });
  return esds;
}

// U4: Auto-expand details with data + U13: Focus management
function loadEntryToForm(code) {
  clearFormFields();
  const entry = entries.get(code);

  // Auto-expand/collapse details sections based on data
  document.querySelectorAll("details").forEach((d) => {
    const summary = d.querySelector("summary");
    if (!summary) return;
    const label = summary.textContent.trim();
    if (!entry) {
      if (label !== "TT") d.removeAttribute("open");
      return;
    }
    if (label === "SF" && entry.SFs && entry.SFs.length > 0) d.setAttribute("open", "");
    else if (label === "ESD" && entry.ESDs && entry.ESDs.length > 0) d.setAttribute("open", "");
    else if (label === "PSD" && entry["PSD Start"]) d.setAttribute("open", "");
    else if (label !== "TT") d.removeAttribute("open");
  });

  if (!entry) {
    createSfRow();
    createEsdRow();
    return;
  }

  el.tt.value = entry.TT || "";
  el.ttReason.value = entry["TT Reason"] || "";

  if (entry.SFs && entry.SFs.length > 0) {
    entry.SFs.forEach((sf) => createSfRow(sf.Start, sf.End, sf.Reason));
  } else {
    createSfRow();
  }

  if (entry.ESDs && entry.ESDs.length > 0) {
    entry.ESDs.forEach((esd) => createEsdRow(esd.Start, esd.End, esd.Reason));
  } else {
    createEsdRow();
  }

  el.psdStart.value = toHHMM(entry["PSD Start"]);
  el.psdEnd.value = toHHMM(entry["PSD End"]);
  el.psdReason.value = entry["PSD Reason"] || "";

  runSoftValidation();
  // Focus first input for keyboard workflow
  el.tt.focus();
}

function saveCurrentEntry() {
  const code = selectedFeederCode;
  const feeder = feederByCode[code];
  if (!feeder) return;
  const ttNumber = Number(el.tt.value);
  const ttValue =
    el.tt.value !== "" && Number.isFinite(ttNumber) && ttNumber >= 0
      ? String(Math.trunc(ttNumber))
      : "";
  const ttReason =
    el.ttReason.value.trim() || (Number(ttValue || 0) > 0 ? "Wind" : "");

  const record = {
    "Sub Station": feeder.substation,
    Feeder: feeder.feeder,
    "Feeder Category": feeder.category,
    Code: feeder.code,
    TT: ttValue,
    "TT Reason": ttReason,
    SFs: getSfsFromUI(),
    ESDs: getEsdsFromUI(),
    "PSD Start": toHHMMSS(el.psdStart.value),
    "PSD End": toHHMMSS(el.psdEnd.value),
    "PSD Reason": el.psdReason.value.trim(),
  };

  if (!hasAnyEvent(record)) {
    entries.delete(code);
  } else {
    entries.set(code, record);
  }

  persistSessionState();
}

function normalizeRowsForScript() {
  const flattened = [];
  feederMaster.forEach((f) => {
    const r = entries.get(f.code);
    if (!r) return;

    const sfs = r.SFs || [];
    const esds = r.ESDs || [];

    const maxLen = Math.max(1, sfs.length, esds.length);

    for (let i = 0; i < maxLen; i++) {
      const row = {
        Code: r.Code,
        TT: i === 0 ? r.TT : "",
        "TT Reason": i === 0 ? r["TT Reason"] : "",
        "SF Start": sfs[i] ? sfs[i].Start : "",
        "SF End": sfs[i] ? sfs[i].End : "",
        "SF Reason": sfs[i] ? sfs[i].Reason : "",
        "ESD Start": esds[i] ? esds[i].Start : "",
        "ESD End": esds[i] ? esds[i].End : "",
        "ESD Reason": esds[i] ? esds[i].Reason : "",
        "PSD Start": i === 0 ? r["PSD Start"] : "",
        "PSD End": i === 0 ? r["PSD End"] : "",
        "PSD Reason": i === 0 ? r["PSD Reason"] : "",
      };

      const hasEvent =
        row.TT ||
        row["SF Start"] ||
        row["ESD Start"] ||
        row["PSD Start"];

      if (hasEvent) {
        flattened.push(row);
      }
    }
  });
  return flattened;
}

function isValidHHMMSS(value) {
  return /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(value);
}

function validateRowsForScript(rows) {
  const issues = [];
  const sections = [
    ["SF", "SF Start", "SF End", "SF Reason"],
    ["ESD", "ESD Start", "ESD End", "ESD Reason"],
    ["PSD", "PSD Start", "PSD End", "PSD Reason"],
  ];

  const pushIssue = (code, message) => {
    const feeder = feederByCode[code];
    const name = feeder ? feeder.feeder : code;
    issues.push(`${name} (${code}): ${message}`);
  };

  rows.forEach((row) => {
    if (row.TT && !/^\d+$/.test(String(row.TT))) {
      pushIssue(row.Code, "TT should be a whole number.");
    }

    sections.forEach(([label, startKey, endKey, reasonKey]) => {
      const start = row[startKey];
      const end = row[endKey];
      const reason = row[reasonKey];

      if (start && !end) {
        pushIssue(row.Code, `${label} end time is missing.`);
      }
      if (!start && end) {
        pushIssue(row.Code, `${label} start time is missing.`);
      }
      if (start && !isValidHHMMSS(start)) {
        pushIssue(row.Code, `${label} start time is invalid.`);
      }
      if (end && !isValidHHMMSS(end)) {
        pushIssue(row.Code, `${label} end time is invalid.`);
      }
      if ((start || end) && !reason) {
        pushIssue(
          row.Code,
          `${label} reason is required when time is provided.`,
        );
      }
    });
  });

  return issues;
}

function buildAutomationScript(rows) {
  const rowsJson = JSON.stringify(rows, null, 2);
  const masterScheduleJson = JSON.stringify(MASTER_SCHEDULE_TSV);

  return `// ==========================================
// 1. MASTER SCHEDULE DATABASE
// ==========================================
const masterScheduleRaw = ${masterScheduleJson};

const masterDB = {};
masterScheduleRaw.split('\\n').forEach(line => {
  const cols = line.split('\\t');
  if (cols.length >= 6 && (cols[0] || '').trim()) {
    masterDB[cols[0].trim()] = {
      name: cols[1],
      type: cols[2],
      start: cols[4].trim(),
      end: cols[5].trim(),
      mw: cols[6] ? cols[6].trim() : '0.02'
    };
  }
});

// ==========================================
// 2. DAILY DATA (FROM WEB FORM)
// ==========================================
const rows = ${rowsJson};

// ==========================================
// 3. UTILITY FUNCTIONS
// ==========================================
function formatTime(time) {
  if (!time || time === '') return '';
  const parts = time.split(':');
  if (parts[0] && parts[0].length === 1) parts[0] = '0' + parts[0];
  if (parts[1] && parts[1].length === 1) parts[1] = '0' + parts[1];
  if (parts.length === 2) return parts[0] + ':' + parts[1] + ':00';
  return parts.join(':');
}

function triggerInput(element, value) {
  if (!element) return;
  element.value = value;
  ['input', 'change', 'blur'].forEach(evt => element.dispatchEvent(new Event(evt, { bubbles: true })));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForCount(selector, minCount, timeout = 7000, interval = 100) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (document.querySelectorAll(selector).length >= minCount) return true;
    await sleep(interval);
  }
  console.warn('Timeout waiting for', selector, 'count', minCount);
  return false;
}

async function waitForIndex(selector, index, timeout = 7000, interval = 100) {
  return waitForCount(selector, index + 1, timeout, interval);
}

function toMinutes(t) {
  const p = t.split(':').map(Number);
  return (p[0] * 60) + (p[1] || 0);
}

function fromMinutes(m) {
  const value = ((m % 1440) + 1440) % 1440;
  const h = Math.floor(value / 60);
  const min = value % 60;
  return String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0') + ':00';
}

function calculateDuration(start, end) {
  if (!start || !end) return '';
  let duration = toMinutes(end) - toMinutes(start);
  if (duration < 0) duration += 1440;
  return fromMinutes(duration);
}

function calculateCompensation(scheduleEnd, outageStart, outageEnd) {
  if (!scheduleEnd || !outageStart || !outageEnd) return { start: '', end: '' };
  let duration = toMinutes(outageEnd) - toMinutes(outageStart);
  if (duration < 0) duration += 1440;
  return {
    start: formatTime(scheduleEnd),
    end: fromMinutes(toMinutes(scheduleEnd) + duration)
  };
}

function calculateTotals(dataRows) {
  let sfCount = 0, esdCount = 0, psdCount = 0;
  dataRows.forEach(row => {
    if (row['SF Start']) sfCount++;
    if (row['ESD Start']) esdCount++;
    if (row['PSD Start']) psdCount++;
  });
  return { sfCount, esdCount, psdCount };
}

// ==========================================
// 4. MAIN FORM FILLING LOGIC
// ==========================================
async function fillForm() {
  console.log('Starting Smart Form Fill...');
  const totals = calculateTotals(rows);
  console.log('Totals:', totals);

  if (totals.esdCount > 0) {
    const cb = document.getElementById('IsFeederDown');
    if (cb && !cb.checked) { cb.click(); await sleep(300); }
  }

  if (totals.psdCount > 0) {
    const cb = document.getElementById('IsFeederDownPSD');
    if (cb && !cb.checked) { cb.click(); await sleep(300); }
  }

  if (totals.sfCount > 0) {
    triggerInput(document.getElementById('permanantfault'), totals.sfCount);
    await waitForCount('select[name="pffeedername[]"]', totals.sfCount);
  }

  if (totals.esdCount > 0) {
    triggerInput(document.getElementById('noofesdonfeeder'), totals.esdCount);
    await waitForCount('select[name="esdfeedername[]"]', totals.esdCount);
  }

  if (totals.psdCount > 0) {
    triggerInput(document.getElementById('noofpsdonfeeder'), totals.psdCount);
    await waitForCount('select[name="psdfeedername[]"]', totals.psdCount);
  }

  let sfIdx = 0, esdIdx = 0, psdIdx = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const masterData = masterDB[row.Code];

    if (row.TT && row.TT !== '0') {
      const btn = document.getElementById('addtt');
      if (btn) {
        const prevCount = document.querySelectorAll('select[name="ttfeedername[]"]').length;
        btn.click();
        await waitForCount('select[name="ttfeedername[]"]', prevCount + 1);
        const selects = document.querySelectorAll('select[name="ttfeedername[]"]');
        const nums = document.querySelectorAll('input[name="ttnumber[]"]');
        const reasons = document.querySelectorAll('input[name="ttreason[]"]');
        const idx = selects.length - 1;
        if (selects[idx]) triggerInput(selects[idx], row.Code);
        if (nums[idx]) triggerInput(nums[idx], row.TT);
        if (reasons[idx]) triggerInput(reasons[idx], row['TT Reason']);
      }
    }

    if (row['SF Start']) {
      const selects = document.querySelectorAll('select[name="pffeedername[]"]');
      if (selects[sfIdx]) {
        triggerInput(selects[sfIdx], row.Code);
        await waitForIndex('input[name="pffromtime[]"]', sfIdx);
        const froms = document.querySelectorAll('input[name="pffromtime[]"]');
        const tos = document.querySelectorAll('input[name="pftotime[]"]');
        const reasons = document.querySelectorAll('input[name="pfreason[]"]');
        if (froms[sfIdx]) froms[sfIdx].value = formatTime(row['SF Start']);
        if (tos[sfIdx]) {
          tos[sfIdx].value = formatTime(row['SF End']);
          tos[sfIdx].dispatchEvent(new Event('blur', { bubbles: true }));
        }
        if (reasons[sfIdx]) reasons[sfIdx].value = row['SF Reason'];
        const mwFields = document.querySelectorAll('input[name="pfMW[]"]');
        if (mwFields[sfIdx] && masterData) triggerInput(mwFields[sfIdx], masterData.mw);

        const suffix = sfIdx + 1;
        const ag3PhStart = document.getElementById('SFthreephasefromtime' + suffix);
        if (ag3PhStart && masterData && masterData.type.includes('AG')) {
          triggerInput(ag3PhStart, formatTime(masterData.start));
          const ag3PhEnd = document.getElementById('SFthreephasetotime' + suffix);
          if (ag3PhEnd) triggerInput(ag3PhEnd, formatTime(masterData.end));
          const compTimes = calculateCompensation(masterData.end, row['SF Start'], row['SF End']);
          const compStart = document.getElementById('SFcompesationfromtime' + suffix);
          if (compStart) {
            triggerInput(compStart, compTimes.start);
            triggerInput(document.getElementById('SFcompesationtotime' + suffix), compTimes.end);
            const duration = calculateDuration(masterData.start, masterData.end);
            triggerInput(document.getElementById('SFcompesationpowersuppy' + suffix), duration);
          }
        }
      }
      sfIdx++;
    }

    if (row['ESD Start']) {
      const selects = document.querySelectorAll('select[name="esdfeedername[]"]');
      if (selects[esdIdx]) {
        triggerInput(selects[esdIdx], row.Code);
        await waitForIndex('input[name="esdfeederfromtime[]"]', esdIdx);
        const froms = document.querySelectorAll('input[name="esdfeederfromtime[]"]');
        const tos = document.querySelectorAll('input[name="esdfeedertotime[]"]');
        const reasons = document.querySelectorAll('input[name="esdfeederreason[]"]');
        if (froms[esdIdx]) froms[esdIdx].value = formatTime(row['ESD Start']);
        if (tos[esdIdx]) {
          tos[esdIdx].value = formatTime(row['ESD End']);
          tos[esdIdx].dispatchEvent(new Event('blur', { bubbles: true }));
        }
        if (reasons[esdIdx]) reasons[esdIdx].value = row['ESD Reason'];
        const mwFields = document.querySelectorAll('input[name="esdfeederMW[]"]');
        if (mwFields[esdIdx] && masterData) triggerInput(mwFields[esdIdx], masterData.mw);

        const suffix = esdIdx + 1;
        const ag3PhStart = document.getElementById('ESDthreephasefromtime' + suffix);
        if (ag3PhStart && masterData && masterData.type.includes('AG')) {
          triggerInput(ag3PhStart, formatTime(masterData.start));
          const ag3PhEnd = document.getElementById('ESDthreephasetotime' + suffix);
          if (ag3PhEnd) triggerInput(ag3PhEnd, formatTime(masterData.end));
          const compTimes = calculateCompensation(masterData.end, row['ESD Start'], row['ESD End']);
          const compStart = document.getElementById('ESDcompesationfromtime' + suffix);
          if (compStart) {
            triggerInput(compStart, compTimes.start);
            triggerInput(document.getElementById('ESDcompesationtotime' + suffix), compTimes.end);
            const duration = calculateDuration(masterData.start, masterData.end);
            triggerInput(document.getElementById('ESDcompesationpowersuppy' + suffix), duration);
          }
        }
      }
      esdIdx++;
    }

    if (row['PSD Start']) {
      const selects = document.querySelectorAll('select[name="psdfeedername[]"]');
      if (selects[psdIdx]) {
        triggerInput(selects[psdIdx], row.Code);
        await waitForIndex('input[name="psdfeederfromtime[]"]', psdIdx);
        const froms = document.querySelectorAll('input[name="psdfeederfromtime[]"]');
        const tos = document.querySelectorAll('input[name="psdfeedertotime[]"]');
        const reasons = document.querySelectorAll('input[name="psdfeederreason[]"]');
        if (froms[psdIdx]) froms[psdIdx].value = formatTime(row['PSD Start']);
        if (tos[psdIdx]) {
          tos[psdIdx].value = formatTime(row['PSD End']);
          tos[psdIdx].dispatchEvent(new Event('blur', { bubbles: true }));
        }
        if (reasons[psdIdx]) reasons[psdIdx].value = row['PSD Reason'];
        const mwFields = document.querySelectorAll('input[name="psdfeederMW[]"]');
        if (mwFields[psdIdx] && masterData) triggerInput(mwFields[psdIdx], masterData.mw);

        const suffix = psdIdx + 1;
        const ag3PhStart = document.getElementById('PSDthreephasefromtime' + suffix);
        if (ag3PhStart && masterData && masterData.type.includes('AG')) {
          triggerInput(ag3PhStart, formatTime(masterData.start));
          const ag3PhEnd = document.getElementById('PSDthreephasetotime' + suffix);
          if (ag3PhEnd) triggerInput(ag3PhEnd, formatTime(masterData.end));
          const compTimes = calculateCompensation(masterData.end, row['PSD Start'], row['PSD End']);
          const compStart = document.getElementById('PSDcompesationfromtime' + suffix);
          if (compStart) {
            triggerInput(compStart, compTimes.start);
            triggerInput(document.getElementById('PSDcompesationtotime' + suffix), compTimes.end);
            const duration = calculateDuration(masterData.start, masterData.end);
            triggerInput(document.getElementById('PSDcompesationpowersuppy' + suffix), duration);
          }
        }
      }
      psdIdx++;
    }
  }

  console.log('Form filling complete!');
}

fillForm();
`;
}

async function writeToClipboard(text) {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    const temp = document.createElement("textarea");
    temp.value = text;
    temp.setAttribute("readonly", "true");
    temp.style.position = "fixed";
    temp.style.left = "-9999px";
    document.body.appendChild(temp);
    temp.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(temp);
    return copied;
  }
}

// U2: Color-coded status messages
function setStatus(text, type = "info") {
  if (!el.generateStatus) return;
  el.generateStatus.className = `entry-meta status-${type}`;
  el.generateStatus.innerHTML = text;
}

function formatDuration(start, end) {
  if (!start || !end) return "-";
  let diff = toMinutes(end) - toMinutes(start);
  if (diff < 0) diff += 1440;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatEventCell(start, end, reason) {
  if (!start && !end) return "-";
  const timeStr = `${toHHMM(start)} - ${toHHMM(end)}`;
  const duration = formatDuration(start, end);
  const reasonStr = reason ? `<br><small style="color:var(--muted)">${reason}</small>` : "";
  return `<strong>${timeStr}</strong> <small>(${duration})</small>${reasonStr}`;
}

// U11: Build summary table HTML for review modal
function buildSummaryHTML(rows) {
  let html =
    '<table class="summary-table"><thead><tr><th>Feeder</th><th>TT</th><th>SF</th><th>ESD</th><th>PSD</th></tr></thead><tbody>';
  rows.forEach((row) => {
    const f = feederByCode[row.Code];
    const name = f ? f.feeder : row.Code;
    
    let ttCell = "-";
    if (row.TT) {
      ttCell = `<strong>${row.TT}</strong>`;
      if (row["TT Reason"]) {
        ttCell += `<br><small style="color:var(--muted)">${row["TT Reason"]}</small>`;
      }
    }

    const sfCell = formatEventCell(row["SF Start"], row["SF End"], row["SF Reason"]);
    const esdCell = formatEventCell(row["ESD Start"], row["ESD End"], row["ESD Reason"]);
    const psdCell = formatEventCell(row["PSD Start"], row["PSD End"], row["PSD Reason"]);

    html += `<tr><td><strong>${name}</strong></td><td>${ttCell}</td><td>${sfCell}</td><td>${esdCell}</td><td>${psdCell}</td></tr>`;
  });
  html += "</tbody></table>";
  return html;
}

async function generateScript() {
  autoSaveActiveFeeder();
  const rows = normalizeRowsForScript();
  if (!rows.length) {
    setStatus(
      "No entries found. Add at least one TT/SF/ESD/PSD entry.",
      "error",
    );
    lastGeneratedScript = "";
    return;
  }

  const validationIssues = validateRowsForScript(rows);
  if (validationIssues.length) {
    const preview = validationIssues.slice(0, 2).join(" | ");
    const more =
      validationIssues.length > 2
        ? ` | +${validationIssues.length - 2} more`
        : "";
    setStatus(`Fix data before generate: ${preview}${more}`, "error");
    lastGeneratedScript = "";
    return;
  }

  // Check for long SF/ESD durations (> 2 hours)
  const durationWarnings = checkLongDurations(rows);
  if (durationWarnings.length) {
    const proceed = await showDurationWarning(durationWarnings);
    if (!proceed) {
      setStatus("Script generation cancelled.", "info");
      lastGeneratedScript = "";
      return;
    }
  }

  lastGeneratedScript = buildAutomationScript(rows);
  const copied = await writeToClipboard(lastGeneratedScript);
  setStatus(
    copied
      ? "Script generated and copied to clipboard."
      : "Script generated, but clipboard copy failed.",
    copied ? "success" : "error",
  );
}

function validateSingleRow(start, end, reason) {
  if (!start || !end || !reason) return;
  const hasTime = start.value || end.value;
  const hasReason = reason.value.trim();
  const hint = reason.parentElement.querySelector(".validation-hint");

  if (hasTime && !hasReason) {
    reason.classList.add("validation-warn");
    if (!hint) {
      const span = document.createElement("span");
      span.className = "validation-hint";
      span.textContent = "Reason is required when time is provided";
      reason.parentElement.appendChild(span);
    }
  } else {
    reason.classList.remove("validation-warn");
    if (hint) hint.remove();
  }
}

// Soft validation: reason required when time is filled (except TT)
function runSoftValidation() {
  // Validate dynamic SF rows
  const sfRows = el.sfList.querySelectorAll(".dynamic-row");
  sfRows.forEach((row) => {
    const start = row.querySelector(".sf-start");
    const end = row.querySelector(".sf-end");
    const reason = row.querySelector(".sf-reason");
    validateSingleRow(start, end, reason);
  });

  // Validate dynamic ESD rows
  const esdRows = el.esdList.querySelectorAll(".dynamic-row");
  esdRows.forEach((row) => {
    const start = row.querySelector(".esd-start");
    const end = row.querySelector(".esd-end");
    const reason = row.querySelector(".esd-reason");
    validateSingleRow(start, end, reason);
  });

  // Validate static PSD fields
  validateSingleRow(el.psdStart, el.psdEnd, el.psdReason);
}

// Check SF/ESD entries for duration > 2 hours, return warnings
function checkLongDurations(rows) {
  const warnings = [];
  rows.forEach((row) => {
    const f = feederByCode[row.Code];
    const name = f ? f.feeder : row.Code;

    [
      ["SF", "SF Start", "SF End"],
      ["ESD", "ESD Start", "ESD End"],
    ].forEach(([label, startKey, endKey]) => {
      const start = row[startKey];
      const end = row[endKey];
      if (!start || !end) return;
      const startMins = toMinutes(start);
      const endMins = toMinutes(end);
      let diff = endMins - startMins;
      if (diff < 0) diff += 1440;
      if (diff > 120) {
        const hrs = (diff / 60).toFixed(1);
        warnings.push(
          `${name} — ${label}: ${start.slice(0, 5)} to ${end.slice(0, 5)} (${hrs} hrs)`,
        );
      }
    });
  });
  return warnings;
}

function toMinutes(t) {
  const p = t.split(":").map(Number);
  return p[0] * 60 + (p[1] || 0);
}

// Show warning modal and return promise<boolean>
function showDurationWarning(warnings) {
  const overlay = document.getElementById("warningOverlay");
  const list = document.getElementById("warningList");
  const msg = document.getElementById("warningMessage");

  msg.textContent =
    "The following entries have SF or ESD duration exceeding 2 hours:";
  list.innerHTML = warnings.map((w) => `<li>${w}</li>`).join("");
  overlay.style.display = "flex";

  return new Promise((resolve) => {
    const continueBtn = document.getElementById("warningContinue");
    const cancelBtn = document.getElementById("warningCancel");
    function cleanup() {
      continueBtn.removeEventListener("click", onContinue);
      cancelBtn.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onOverlayClick);
      overlay.style.display = "none";
    }
    function onContinue() {
      cleanup();
      resolve(true);
    }
    function onCancel() {
      cleanup();
      resolve(false);
    }
    function onOverlayClick(e) {
      if (e.target === overlay) {
        cleanup();
        resolve(false);
      }
    }
    continueBtn.addEventListener("click", onContinue);
    cancelBtn.addEventListener("click", onCancel);
    overlay.addEventListener("click", onOverlayClick);
  });
}

// P8: Debounce bumped from 180ms to 500ms
function bindLiveAutoSave() {
  const trackedFields = [
    el.tt,
    el.ttReason,
    el.psdStart,
    el.psdEnd,
    el.psdReason,
  ];

  trackedFields.forEach((field) => {
    if (!field) return;
    field.addEventListener("input", debouncedSave);
    field.addEventListener("input", debouncedValidation);
    field.addEventListener("change", debouncedSave);
  });
}

// U9: Substation tabs click handler
el.substationTabs.addEventListener("click", (e) => {
  const tab = e.target.closest("button[data-substation]");
  if (!tab) return;
  autoSaveActiveFeeder();
  activeSubstation = tab.dataset.substation;
  populateSubstations();
  renderFeederPills();
  persistSessionState();
});

el.feederPills.addEventListener("click", (e) => {
  const pill = e.target.closest("button[data-code]");
  if (!pill) return;
  autoSaveActiveFeeder();
  selectedFeederCode = pill.dataset.code;
  renderFeederPills();
});

el.clearBtn.addEventListener("click", () => {
  clearFormFields();
  entries.clear();
  renderFeederPills();
  persistSessionState();
});
el.generateBtn.addEventListener("click", generateScript);
el.addSfBtn.addEventListener("click", () => {
  createSfRow();
  saveCurrentEntry();
});
el.addEsdBtn.addEventListener("click", () => {
  createEsdRow();
  saveCurrentEntry();
});

// P7: Reduced timeout from 300s to 60s
async function submitToServer(rows) {
  const runAutoBtn = document.getElementById("runAutoBtn");
  setStatus(
    '<span class="spinner"></span> Sending to automation server...',
    "info",
  );

  try {
    runAutoBtn.disabled = true;
    runAutoBtn.textContent = "Running...";

    const dateInput = document.getElementById("activityDate").value;
    let formattedDate = "";
    if (dateInput) {
      const [yyyy, mm, dd] = dateInput.split("-");
      formattedDate = `${dd}-${mm}-${yyyy}`;
    } else {
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, "0");
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const yyyy = now.getFullYear();
      formattedDate = `${dd}-${mm}-${yyyy}`;
    }

    const controller = new AbortController();
    const fetchTimeout = setTimeout(() => controller.abort(), 60_000);

    let res;
    try {
      res = await fetch(`${API_BASE_URL}/api/run-script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, activityDate: formattedDate }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      if (fetchErr.name === "AbortError") {
        throw new Error(
          "Request timed out after 60s. Check the DGVCL site manually.",
        );
      }
      throw new Error(`Network error: ${fetchErr.message}`);
    } finally {
      clearTimeout(fetchTimeout);
    }

    const resText = await res.text();
    let data;
    try {
      data = JSON.parse(resText);
    } catch (e) {
      console.error("Non-JSON Response Server Error:", resText);
      let errorMsg = resText.substring(0, 50).replace(/\s+/g, " ");
      if (res.status === 403)
        errorMsg = "403 Forbidden - Check Cloud Run unauthenticated access";
      if (res.status === 404)
        errorMsg = "404 Not Found - Check backend URL and route";
      throw new Error(`Server Error (${res.status}): ${errorMsg}`);
    }

    if (!res.ok) {
      throw new Error(data.message || "Failed to execute script");
    }

    setStatus("Automation finished successfully!", "success");
  } catch (err) {
    setStatus("Error: " + err.message, "error");
    console.error(err);
  } finally {
    runAutoBtn.disabled = false;
    runAutoBtn.textContent = "Run Automatically";
  }
}

// U3 + U11: Confirmation modal before submission
const runAutoBtn = document.getElementById("runAutoBtn");
if (runAutoBtn) {
  runAutoBtn.addEventListener("click", async () => {
    autoSaveActiveFeeder();

    const rows = normalizeRowsForScript();
    if (!rows.length) {
      setStatus(
        "No entries found. Add at least one TT/SF/ESD/PSD entry.",
        "error",
      );
      return;
    }

    const validationIssues = validateRowsForScript(rows);
    if (validationIssues.length) {
      const preview = validationIssues.slice(0, 2).join(" | ");
      const more =
        validationIssues.length > 2
          ? ` | +${validationIssues.length - 2} more`
          : "";
      setStatus(`Fix data before submitting: ${preview}${more}`, "error");
      return;
    }

    // Check for long SF/ESD durations (> 2 hours)
    const durationWarnings = checkLongDurations(rows);
    if (durationWarnings.length) {
      const proceed = await showDurationWarning(durationWarnings);
      if (!proceed) {
        setStatus("Submission cancelled.", "info");
        return;
      }
    }

    // Show summary modal for review
    const overlay = document.getElementById("summaryOverlay");
    const content = document.getElementById("summaryContent");
    content.innerHTML = buildSummaryHTML(rows);
    overlay.style.display = "flex";

    const confirmed = await new Promise((resolve) => {
      const confirmBtn = document.getElementById("summaryConfirm");
      const cancelBtn = document.getElementById("summaryCancel");
      function cleanup() {
        confirmBtn.removeEventListener("click", onConfirm);
        cancelBtn.removeEventListener("click", onCancel);
        overlay.removeEventListener("click", onOverlayClick);
        overlay.style.display = "none";
      }
      function onConfirm() {
        cleanup();
        resolve(true);
      }
      function onCancel() {
        cleanup();
        resolve(false);
      }
      function onOverlayClick(e) {
        if (e.target === overlay) {
          cleanup();
          resolve(false);
        }
      }
      confirmBtn.addEventListener("click", onConfirm);
      cancelBtn.addEventListener("click", onCancel);
      overlay.addEventListener("click", onOverlayClick);
    });

    if (!confirmed) {
      setStatus("Submission cancelled.", "info");
      return;
    }

    await submitToServer(rows);
  });
}

// ==========================================
// INIT
// ==========================================
hydrateSessionState();
populateSubstations();
renderFeederPills();
if (selectedFeederCode) loadEntryToForm(selectedFeederCode);
bindLiveAutoSave();
persistSessionState();

// U8: Set date to today, prevent future dates
const activityDateInput = document.getElementById("activityDate");
if (activityDateInput) {
  if (!activityDateInput.value) activityDateInput.value = getTodayLocalDate();
  activityDateInput.max = getTodayLocalDate();
}

// U10: Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  // Escape: close summary modal
  if (e.key === "Escape") {
    const warningOverlay = document.getElementById("warningOverlay");
    if (warningOverlay && warningOverlay.style.display !== "none") {
      document.getElementById("warningCancel").click();
      return;
    }
    const overlay = document.getElementById("summaryOverlay");
    if (overlay && overlay.style.display !== "none") {
      overlay.style.display = "none";
    }
    return;
  }

  // Alt+G: Generate script
  if (e.altKey && e.key === "g") {
    e.preventDefault();
    el.generateBtn.click();
    return;
  }

  // Alt+R: Run automatically
  if (e.altKey && e.key === "r") {
    e.preventDefault();
    const btn = document.getElementById("runAutoBtn");
    if (btn && !btn.disabled) btn.click();
    return;
  }

  // Alt+Left/Right: Navigate feeders within substation
  if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
    e.preventDefault();
    if (!visibleFeederCodes.length) return;
    autoSaveActiveFeeder();
    const idx = visibleFeederCodes.indexOf(selectedFeederCode);
    let nextIdx;
    if (e.key === "ArrowLeft") {
      nextIdx = idx <= 0 ? visibleFeederCodes.length - 1 : idx - 1;
    } else {
      nextIdx = idx >= visibleFeederCodes.length - 1 ? 0 : idx + 1;
    }
    selectedFeederCode = visibleFeederCodes[nextIdx];
    renderFeederPills();
  }
});
