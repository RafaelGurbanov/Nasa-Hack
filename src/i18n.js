/*
 * I18N: the game's two languages (English, Azerbaijani). All text lives in locales/*.json,
 * built into locales/locales.js (window.LOCALES) by tools/build_locales.py.
 * - t(key, vars): text with {placeholders}. Numbers are formatted with Intl for the language
 *   (3,36 in Azerbaijani). Placeholders starting with "d_" are shown with a + or - sign.
 *   ISO dates (2024-05-10) become "10 may 2024" / "10 May 2024". A value {k, v} is translated too.
 * - Language: saved choice, else the browser language (az -> Azerbaijani), else English.
 */
(function (root) {
  "use strict";
  const L = root.LOCALES || {};
  const KEY = "msr-lang";
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function save(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode: fine */ } }
  const browser = ((root.navigator && (navigator.languages || [navigator.language])) || []).some((l) => /^az\b/i.test(l || "")) ? "az" : "en";
  let lang = L[saved()] ? saved() : browser;
  if (!L[lang]) lang = "en";
  const listeners = [];
  const locale = () => (lang === "az" ? "az" : "en-GB");

  // Some browsers ship without Azerbaijani Intl data (they print "2025 M11 6" and "2.8").
  // Then we use the Azerbaijani rules ourselves: comma decimals, dot thousands, month names below.
  const AZ_MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
  const azIntl = (() => { try { return new Intl.NumberFormat("az").format(2.5) === "2,5"; } catch (e) { return false; } })();
  function num(x, digits = 2) {
    const v = Math.round(x * 10 ** digits) / 10 ** digits;
    if (lang === "az" && !azIntl) {
      const [i, f] = new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(v).split(".");
      return i.replace(/,/g, ".") + (f ? "," + f : "");
    }
    return new Intl.NumberFormat(locale(), { maximumFractionDigits: digits }).format(v);
  }
  function date(iso) {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    if (lang === "az") {
      const out = new Intl.DateTimeFormat("az", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
      return /M\d|\d{4}.*\d{1,2}$/.test(out) ? `${d} ${AZ_MONTHS[m - 1]} ${y}` : out;   // "10 may 2024"
    }
    return new Intl.DateTimeFormat(locale(), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
  }
  function fmtValue(name, v) {
    if (v == null) return "";
    if (typeof v === "object" && v.k) return t(v.k, v.v);
    if (typeof v === "number") return (name.startsWith("d_") && v >= 0 ? "+" : "") + num(v);
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return date(v);
    return String(v);
  }
  function t(key, vars) {
    const table = L[lang] || {}, s = key in table ? table[key] : (L.en && L.en[key]);
    if (s == null) { if (root.console) console.warn("i18n: missing key", key); return key; }
    return s.replace(/\{(\w+)\}/g, (_, n) => fmtValue(n, vars ? vars[n] : undefined));
  }
  function setLang(v) {
    if (!L[v] || v === lang) return;
    lang = v; save(v);
    if (root.document) document.documentElement.lang = v;
    listeners.forEach((fn) => { try { fn(v); } catch (e) { console.warn(e); } });
  }
  if (root.document) document.documentElement.lang = lang;
  root.I18N = { t, num, date, setLang, get lang() { return lang; }, onChange: (fn) => listeners.push(fn), has: (k) => !!(L.en && k in L.en) };
})(typeof window !== "undefined" ? window : globalThis);
