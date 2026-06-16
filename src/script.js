"use strict";

/* --------------------------------------------------------------------------
   SPLIT — equal-share expense settler
   Vanilla JS, no dependencies. State lives in the DOM and is mirrored to
   localStorage so a refresh never loses the entered data.
-------------------------------------------------------------------------- */

const STORAGE_KEYS = { people: "split.people", lang: "split.language", theme: "theme" };
const SUPPORTED_LANGS = ["en", "es", "ca"];

const appConfig = window.APP_CONFIG || { currency: "€", currencyPosition: "right" };

let translations = {};
let currentLanguage = "en";

/* ------------------------------------------------------------- utilities */

function t(key) {
  const dict = translations[currentLanguage] || {};
  return dict[key] != null ? dict[key] : key;
}

function detectLanguage() {
  const stored = localStorage.getItem(STORAGE_KEYS.lang);
  if (SUPPORTED_LANGS.includes(stored)) return stored;
  const browser = (navigator.language || "en").slice(0, 2).toLowerCase();
  return SUPPORTED_LANGS.includes(browser) ? browser : "en";
}

function formatCurrency(amount) {
  const value = (Math.round(amount * 100) / 100).toFixed(2);
  return appConfig.currencyPosition === "left"
    ? `${appConfig.currency}${value}`
    : `${value}${appConfig.currency}`;
}

/* Parses amounts written in either convention, treating the last separator
   as the decimal point: "12.50", "12,50", "1 234,5", "1,234.56", "1.234,56",
   "€12" → number (NaN-safe → 0). */
function parseAmount(raw) {
  if (typeof raw !== "string") return 0;
  const s = raw.replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  const lastSep = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
  const normalized =
    lastSep === -1
      ? s
      : s.slice(0, lastSep).replace(/[.,]/g, "") + "." + s.slice(lastSep + 1).replace(/[.,]/g, "");
  const value = parseFloat(normalized);
  return Number.isFinite(value) ? value : 0;
}

function svg(markup) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = markup.trim();
  return wrapper.firstChild;
}

/* ---------------------------------------------------------------- theme */

function initTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  document.documentElement.setAttribute("data-theme", current);
}

function toggleTheme() {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem(STORAGE_KEYS.theme, next);
}

/* --------------------------------------------------------- person rows */

const content = () => document.getElementById("content");

function createPersonRow(name = "", amount = "") {
  const row = document.createElement("div");
  row.className = "person";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "person-name";
  nameInput.autocomplete = "off";
  nameInput.placeholder = t("namePlaceholder");
  nameInput.setAttribute("aria-label", t("namePlaceholder"));
  nameInput.value = name;

  const field = document.createElement("div");
  field.className =
    "amount-field " + (appConfig.currencyPosition === "left" ? "affix-left" : "affix-right");

  const currency = document.createElement("span");
  currency.className = "currency";
  currency.textContent = appConfig.currency;

  const amountInput = document.createElement("input");
  amountInput.type = "text";
  amountInput.inputMode = "decimal";
  amountInput.className = "person-amount";
  amountInput.autocomplete = "off";
  amountInput.placeholder = t("amountPlaceholder");
  amountInput.setAttribute("aria-label", t("amountPlaceholder"));
  amountInput.value = amount;

  field.append(currency, amountInput);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "row-remove";
  remove.setAttribute("aria-label", "Remove");
  remove.appendChild(
    svg(
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>'
    )
  );
  remove.addEventListener("click", () => removeRow(row));

  row.append(nameInput, field, remove);
  return row;
}

function addPerson(focus = true) {
  const row = createPersonRow();
  content().appendChild(row);
  updateRemoveVisibility();
  if (focus) row.querySelector(".person-name").focus();
  persist();
}

function removeRow(row) {
  if (content().querySelectorAll(".person").length <= 2) return;
  row.remove();
  updateRemoveVisibility();
  persist();
  refreshSummaryIfVisible();
}

function updateRemoveVisibility() {
  const rows = content().querySelectorAll(".person");
  const hide = rows.length <= 2;
  rows.forEach((row) => row.querySelector(".row-remove").classList.toggle("hidden", hide));
}

function getPeople() {
  return Array.from(content().querySelectorAll(".person")).map((row) => ({
    name: row.querySelector(".person-name").value.trim(),
    amount: parseAmount(row.querySelector(".person-amount").value),
    raw: row.querySelector(".person-amount").value.trim(),
  }));
}

/* --------------------------------------------------------- persistence */

function persist() {
  const people = Array.from(content().querySelectorAll(".person")).map((row) => ({
    name: row.querySelector(".person-name").value,
    amount: row.querySelector(".person-amount").value,
  }));
  try {
    localStorage.setItem(STORAGE_KEYS.people, JSON.stringify(people));
  } catch (e) {
    /* storage unavailable (private mode) — ignore */
  }
}

function restorePeople() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.people) || "null");
  } catch (e) {
    saved = null;
  }

  content().innerHTML = "";
  if (Array.isArray(saved) && saved.length >= 2) {
    saved.forEach((p) => content().appendChild(createPersonRow(p.name || "", p.amount || "")));
  } else {
    content().appendChild(createPersonRow());
    content().appendChild(createPersonRow());
  }
  updateRemoveVisibility();
}

function resetAll() {
  try {
    localStorage.removeItem(STORAGE_KEYS.people);
  } catch (e) {}
  content().innerHTML = "";
  content().appendChild(createPersonRow());
  content().appendChild(createPersonRow());
  updateRemoveVisibility();
  hideError();
  const summary = document.getElementById("summary");
  summary.classList.add("hidden");
  summary.innerHTML = "";
  content().querySelector(".person-name").focus();
}

/* --------------------------------------------------------- calculation */

/* Greedy minimal-transfer settlement. Returns a flat list of transfers. */
function settle(people) {
  const total = people.reduce((sum, p) => sum + p.amount, 0);
  const average = total / people.length;

  const creditors = people
    .map((p) => ({ name: p.name, balance: p.amount - average }))
    .filter((b) => b.balance > 0.005)
    .sort((a, b) => b.balance - a.balance);
  const debtors = people
    .map((p) => ({ name: p.name, balance: average - p.amount }))
    .filter((b) => b.balance > 0.005)
    .sort((a, b) => b.balance - a.balance);

  const transfers = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].balance, creditors[j].balance);
    if (amount > 0.005) {
      transfers.push({
        from: debtors[i].name,
        to: creditors[j].name,
        amount: Math.round(amount * 100) / 100,
      });
    }
    debtors[i].balance -= amount;
    creditors[j].balance -= amount;
    if (debtors[i].balance < 0.005) i++;
    if (creditors[j].balance < 0.005) j++;
  }

  return { total, average, transfers };
}

/* ------------------------------------------------------------ validation */

function showError(message) {
  const el = document.getElementById("form-error");
  el.textContent = message;
  el.classList.remove("hidden");
}

function hideError() {
  document.getElementById("form-error").classList.add("hidden");
}

function validate() {
  const rows = Array.from(content().querySelectorAll(".person"));
  rows.forEach((row) =>
    row.querySelectorAll("input").forEach((i) => i.classList.remove("invalid"))
  );

  let complete = 0;
  let partial = false;
  rows.forEach((row) => {
    const nameInput = row.querySelector(".person-name");
    const amountInput = row.querySelector(".person-amount");
    const hasName = nameInput.value.trim() !== "";
    const hasAmount = amountInput.value.trim() !== "";

    if (hasName && hasAmount) {
      complete++;
    } else if (hasName || hasAmount) {
      // a row with only one field filled is incomplete — flag and block
      partial = true;
      if (!hasName) markInvalid(nameInput);
      if (!hasAmount) markInvalid(amountInput);
    }
  });

  if (complete < 2 || partial) {
    showError(t("validationError"));
    return false;
  }
  hideError();
  return true;
}

function markInvalid(input) {
  input.classList.add("invalid");
  const clear = () => {
    input.classList.remove("invalid");
    input.removeEventListener("input", clear);
  };
  input.addEventListener("input", clear);
}

/* --------------------------------------------------------------- render */

function buildSummaryText(result) {
  const lines = [];
  lines.push(t("summaryTitle"));
  lines.push(`${t("totalSpent")}: ${formatCurrency(result.total)} · ${t("perPerson")}: ${formatCurrency(result.average)}`);
  lines.push("");
  if (result.transfers.length === 0) {
    lines.push(t("balancedMessage"));
  } else {
    result.transfers.forEach((tr) => {
      lines.push(`${tr.from} → ${tr.to}: ${formatCurrency(tr.amount)}`);
    });
  }
  return lines.join("\n");
}

function makeChip(labelKey, iconMarkup) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "chip-btn";
  btn.appendChild(svg(iconMarkup));
  const span = document.createElement("span");
  span.textContent = t(labelKey);
  btn.appendChild(span);
  return btn;
}

function renderContributions(people, average) {
  const maxDiff = Math.max(...people.map((p) => Math.abs(p.amount - average)), 0.01);
  const wrap = document.createElement("div");
  wrap.className = "contributions";

  const label = document.createElement("div");
  label.className = "section-label";
  label.textContent = t("contributions");
  wrap.appendChild(label);

  people.forEach((p) => {
    const diff = p.amount - average;
    const pct = Math.min((Math.abs(diff) / maxDiff) * 50, 50); // half the track each side
    const state = diff > 0.005 ? "pos" : diff < -0.005 ? "neg" : "even";

    const row = document.createElement("div");
    row.className = "contribution";

    const name = document.createElement("span");
    name.className = "contribution-name";
    name.textContent = p.name; // textContent → no XSS

    const track = document.createElement("div");
    track.className = "bar-track";
    const fill = document.createElement("div");
    fill.className = `bar-fill ${state}`;
    fill.style.width = `${pct}%`;
    track.appendChild(fill);

    const diffEl = document.createElement("span");
    diffEl.className = `contribution-diff ${state}`;
    diffEl.textContent =
      state === "even"
        ? t("onTrack")
        : (diff > 0 ? "+" : "−") + formatCurrency(Math.abs(diff));

    row.append(name, track, diffEl);
    wrap.appendChild(row);
  });

  return wrap;
}

function displayResults(result, people) {
  const summary = document.getElementById("summary");
  summary.innerHTML = "";

  // header
  const header = document.createElement("div");
  header.className = "summary-header";
  const h2 = document.createElement("h2");
  h2.textContent = t("summaryTitle");
  const actions = document.createElement("div");
  actions.className = "summary-actions";

  const copyBtn = makeChip(
    "copySummary",
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
  );
  copyBtn.addEventListener("click", () => copySummary(result, copyBtn));

  const shareBtn = makeChip(
    "shareSummary",
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>'
  );
  shareBtn.addEventListener("click", () => shareSummary(result, copyBtn));

  actions.append(copyBtn, shareBtn);
  header.append(h2, actions);
  summary.appendChild(header);

  // stats
  const stats = document.createElement("div");
  stats.className = "stats";
  [
    [formatCurrency(result.total), t("totalSpent")],
    [formatCurrency(result.average), t("perPerson")],
    [String(result.transfers.length), t("transactions")],
  ].forEach(([value, lbl]) => {
    const stat = document.createElement("div");
    stat.className = "stat";
    const v = document.createElement("span");
    v.className = "stat-value";
    v.textContent = value;
    const l = document.createElement("span");
    l.className = "stat-label";
    l.textContent = lbl;
    stat.append(v, l);
    stats.appendChild(stat);
  });
  summary.appendChild(stats);

  // contributions
  summary.appendChild(renderContributions(people, result.average));

  const divider = document.createElement("div");
  divider.className = "divider";
  summary.appendChild(divider);

  // settlements
  if (result.transfers.length === 0) {
    const settled = document.createElement("div");
    settled.className = "settled";
    settled.appendChild(
      svg(
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
      )
    );
    const msg = document.createElement("span");
    msg.textContent = t("balancedMessage");
    settled.appendChild(msg);
    summary.appendChild(settled);
  } else {
    const list = document.createElement("div");
    list.className = "transfers";
    result.transfers.forEach((tr) => {
      const item = document.createElement("div");
      item.className = "transfer";

      const from = document.createElement("span");
      from.className = "transfer-from";
      from.textContent = tr.from;

      const arrow = document.createElement("span");
      arrow.className = "transfer-arrow";
      arrow.appendChild(
        svg(
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
        )
      );

      const to = document.createElement("span");
      to.className = "transfer-to";
      to.textContent = tr.to;

      const amount = document.createElement("span");
      amount.className = "transfer-amount";
      amount.textContent = formatCurrency(tr.amount);

      item.append(from, arrow, to, amount);
      list.appendChild(item);
    });
    summary.appendChild(list);
  }

  summary.classList.remove("hidden");
}

/* ----------------------------------------------------------- copy/share */

function copySummary(result, btn) {
  const text = buildSummaryText(result);
  navigator.clipboard.writeText(text).then(() => {
    if (!btn) return;
    const span = btn.querySelector("span");
    const original = span.textContent;
    btn.classList.add("copied");
    span.textContent = t("copied");
    setTimeout(() => {
      btn.classList.remove("copied");
      span.textContent = original;
    }, 1800);
  }).catch(() => {});
}

function shareSummary(result, copyBtn) {
  const text = buildSummaryText(result);
  if (navigator.share) {
    navigator.share({ title: "SPLIT", text }).catch(() => {});
  } else {
    copySummary(result, copyBtn);
  }
}

/* ------------------------------------------------------------- compute */

function calculate() {
  if (!validate()) return;
  const people = getPeople().filter((p) => p.name && p.raw !== "");
  if (people.length < 2) return;

  const result = settle(people);
  displayResults(result, people);

  requestAnimationFrame(() => {
    document.getElementById("summary").scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

function refreshSummaryIfVisible() {
  const summary = document.getElementById("summary");
  if (!summary.classList.contains("hidden")) calculate();
}

/* ------------------------------------------------------------- i18n UI */

function applyLanguage() {
  document.documentElement.lang = currentLanguage;
  document.title = `SPLIT — ${t("title")}`;
  document.getElementById("title").textContent = t("title");
  document.getElementById("subtitle").textContent = t("subtitle");
  document.getElementById("add-label").textContent = t("addPersonButton");
  document.getElementById("submit").textContent = t("calculateButton");
  document.getElementById("reset").textContent = t("resetButton");

  content().querySelectorAll(".person-name").forEach((i) => {
    i.placeholder = t("namePlaceholder");
    i.setAttribute("aria-label", t("namePlaceholder"));
  });
  content().querySelectorAll(".person-amount").forEach((i) => {
    i.placeholder = t("amountPlaceholder");
    i.setAttribute("aria-label", t("amountPlaceholder"));
  });

  document.querySelectorAll(".seg").forEach((b) =>
    b.classList.toggle("active", b.dataset.lang === currentLanguage)
  );
}

function changeLanguage(lang) {
  currentLanguage = lang;
  localStorage.setItem(STORAGE_KEYS.lang, lang);
  applyLanguage();
  refreshSummaryIfVisible();
}

/* ---------------------------------------------------------------- init */

async function init() {
  initTheme();
  currentLanguage = detectLanguage();

  try {
    const res = await fetch("translations.json");
    translations = await res.json();
  } catch (e) {
    translations = {};
  }

  restorePeople();
  applyLanguage();

  document.getElementById("add").addEventListener("click", () => addPerson(true));
  document.getElementById("submit").addEventListener("click", calculate);
  document.getElementById("reset").addEventListener("click", resetAll);
  document.getElementById("theme-toggle").addEventListener("click", toggleTheme);

  document.querySelectorAll(".seg").forEach((btn) =>
    btn.addEventListener("click", () => changeLanguage(btn.dataset.lang))
  );

  const form = document.getElementById("debt-form");
  form.addEventListener("input", persist);
  form.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      calculate();
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
