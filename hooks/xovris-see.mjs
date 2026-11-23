// #1802 (the owner, 20 Oct 21:0x: "it should be in a way xovris can also see the whole page so it knows what to fix, what to do, it has to
// be the best browser ... with full dev so it can see everything like a human does"), #1790 1b: XOVRIS SEES ITS OWN RESULT. When a change
// touches what a person sees, the stop gate opens the result in a real Chrome over the DevTools protocol - the picture at a desktop and a
// phone width, the console, every request, the accessibility tree and the page's own timings - and what it SAW is the agent's next step:
// an uncaught error, a failed request, a page wider than the phone, a broken image, a control no one can name, a blank page. The frames
// are written beside the session so the agent opens them and looks for itself. No dependency beyond Node (its WebSocket speaks the
// DevTools protocol), so it runs wherever the plugin is installed; the browser is the person's own Chrome, Edge or Chromium, headless,
// with no GPU and a throwaway profile, always closed.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** KEEP: machine format - the file kinds a browser renders; a change to none of them is never opened. */
export const RENDERED = /\.(html?|css|scss|sass|less|jsx|tsx|vue|svelte|astro|mdx|hbs|ejs|liquid|njk)$/i;
export const WIDTHS = [{ w: 1920, h: 945, dpr: 1, mobile: false }, { w: 390, h: 844, dpr: 2, mobile: true }];
/** KEEP: the clocks of one look - a dev server's first answer, a page's load - inside the hook's own 600 s, never a cap on the page. */
export const SERVE_MS = 90_000;
export const LOAD_MS = 30_000;

/** The person's own Chromium-family browser: XOVRIS_CHROME or CHROME_PATH first, then where each platform installs one. */
const listDir = (d) => { try { return readdirSync(d); } catch { return []; } };
const onPath = (n) => { const r = spawnSync("which", [n], { encoding: "utf8" }); return r.status === 0 ? r.stdout.trim() : ""; };

export function findChrome(env = process.env, exists = existsSync, list = listDir, which = onPath) {
  for (const k of ["XOVRIS_CHROME", "CHROME_PATH"]) if (env[k] && exists(env[k])) return env[k];
  // KEEP: machine format - the install paths Google, Microsoft and the Chromium project use on each platform
  const local = env.LOCALAPPDATA ?? "", pf = env.ProgramFiles ?? "C:\\Program Files", pf86 = env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const win = [join(pf, "Google", "Chrome", "Application", "chrome.exe"), join(pf86, "Google", "Chrome", "Application", "chrome.exe"), join(local, "Google", "Chrome", "Application", "chrome.exe"), join(pf86, "Microsoft", "Edge", "Application", "msedge.exe"), join(pf, "Microsoft", "Edge", "Application", "msedge.exe")];
  const mac = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"];
  const listed = process.platform === "win32" ? win : process.platform === "darwin" ? mac : [];
  for (const p of listed) if (p && exists(p)) return p;
  if (process.platform !== "win32") for (const n of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"]) {
    const at = which(n);
    if (at) return at;
  }
  // Playwright's own browsers (PLAYWRIGHT_BROWSERS_PATH, or its cache on each platform): a machine whose only Chromium is Playwright's - a CI
  // runner, a developer's laptop - has one (CI 40466610505 found none). The newest full build first, then the headless shell.
  const home = env.HOME ?? env.USERPROFILE ?? "";
  const pw = env.PLAYWRIGHT_BROWSERS_PATH && env.PLAYWRIGHT_BROWSERS_PATH !== "0" ? env.PLAYWRIGHT_BROWSERS_PATH
    : process.platform === "win32" ? join(local, "ms-playwright") : process.platform === "darwin" ? join(home, "Library", "Caches", "ms-playwright") : join(home, ".cache", "ms-playwright");
  // KEEP: machine format - the folders and files Playwright installs its Chromium builds under, on each platform
  const inside = process.platform === "win32"
    ? [["chrome-win", "chrome.exe"], ["chrome-win64", "chrome.exe"], ["chrome-win", "headless_shell.exe"], ["chrome-headless-shell-win64", "chrome-headless-shell.exe"]]
    : process.platform === "darwin"
      ? [["chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"], ["chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"], ["chrome-mac", "headless_shell"], ["chrome-headless-shell-mac-arm64", "chrome-headless-shell"]]
      : [["chrome-linux", "chrome"], ["chrome-linux64", "chrome"], ["chrome-linux", "headless_shell"], ["chrome-headless-shell-linux64", "chrome-headless-shell"]];
  const rev = (n) => Number(n.split("-").pop());
  const builds = list(pw).filter((n) => /^chromium(_headless_shell)?-\d+$/.test(n))
    .sort((a, b) => (a.includes("headless") === b.includes("headless") ? rev(b) - rev(a) : a.includes("headless") ? 1 : -1));
  for (const b of builds) for (const parts of inside) { const p = join(pw, b, ...parts); if (exists(p)) return p; }
  return null;
}

/** Where the result can be seen: XOVRIS_PREVIEW_URL, the repository's own dev server (its package.json says how it starts), or a page
 *  file opened as it is. Null when there is nothing a browser can open. */
export function pageTarget(cwd, files, changed) {
  const declared = (process.env.XOVRIS_PREVIEW_URL ?? "").trim();
  if (declared) return { url: declared, from: "XOVRIS_PREVIEW_URL" };
  let pkg = null;
  try { pkg = existsSync(join(cwd, "package.json")) ? JSON.parse(readFileSync(join(cwd, "package.json"), "utf8")) : null; } catch { pkg = null; }
  const pm = existsSync(join(cwd, "pnpm-lock.yaml")) ? "pnpm" : existsSync(join(cwd, "yarn.lock")) ? "yarn" : existsSync(join(cwd, "bun.lock")) || existsSync(join(cwd, "bun.lockb")) ? "bun" : "npm";
  // KEEP: the toolchains' own script names for serving a page while it is worked on
  const script = ["dev", "start", "preview", "serve"].find((s) => typeof pkg?.scripts?.[s] === "string");
  if (script && existsSync(join(cwd, "node_modules"))) return { start: `${pm} run ${script}`, from: `package.json scripts.${script}` };
  const pages = files.filter((f) => /\.html?$/i.test(f));
  const page = changed.find((f) => /\.html?$/i.test(f)) ?? pages.find((f) => /(^|\/)index\.html?$/i.test(f)) ?? pages[0];
  return page ? { url: pathToFileURL(resolve(cwd, page)).href, from: page } : null;
}

const LOCAL_URL = /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0):\d+[^\s"'\x1b]*/; // KEEP: machine format - a dev server's own "ready at" line
const killTree = (p) => { if (!p?.pid) return; if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(p.pid), "/T", "/F"], { windowsHide: true }); else { try { process.kill(-p.pid, "SIGTERM"); } catch { try { p.kill("SIGTERM"); } catch { /* gone */ } } } };

/** The repository's own dev server, started the way it says, until it prints where it serves. */
export function serve(command, cwd, ms = SERVE_MS) {
  return new Promise((done) => {
    const p = spawn(command, { cwd, shell: true, windowsHide: true, detached: process.platform !== "win32", env: { ...process.env, BROWSER: "none", CI: "1" } });
    let out = "";
    const t = setTimeout(() => finish(null, `it printed no address within ${Math.round(ms / 1000)} s`), ms);
    const finish = (url, why) => { clearTimeout(t); if (!url) killTree(p); done(url ? { url: url.replace("0.0.0.0", "127.0.0.1"), stop: () => killTree(p) } : { error: `${command}: ${why}${out ? ` - it said: ${out.slice(-300)}` : ""}` }); };
    const read = (c) => { out += String(c); const m = LOCAL_URL.exec(out.replace(/\x1b\[[0-9;]*m/g, "")); if (m) finish(m[0], null); };
    p.stdout?.on("data", read); p.stderr?.on("data", read);
    p.on("exit", (code) => finish(null, `it ended (${code}) before serving`));
  });
}

/** One DevTools session over Node's own WebSocket. */
function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const waits = new Map(), on = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(String(m.data));
    if (d.id && waits.has(d.id)) { const [ok, no] = waits.get(d.id); waits.delete(d.id); d.error ? no(new Error(d.error.message)) : ok(d.result); }
    else if (d.method) for (const f of on.get(d.method) ?? []) f(d.params);
  };
  const ready = new Promise((ok, no) => { ws.onopen = ok; ws.onerror = () => no(new Error("the browser's DevTools socket did not open")); });
  return {
    ready,
    send: (method, params = {}) => new Promise((ok, no) => { id += 1; waits.set(id, [ok, no]); ws.send(JSON.stringify({ id, method, params })); }),
    on: (ev, f) => on.set(ev, [...(on.get(ev) ?? []), f]),
    once: (ev, ms) => new Promise((ok) => { const t = setTimeout(() => ok(null), ms); on.set(ev, [...(on.get(ev) ?? []), (p) => { clearTimeout(t); ok(p); }]); }),
    close: () => { try { ws.close(); } catch { /* closed */ } },
  };
}

/** What the page itself shows at this width, read in the page: wider than the screen, images that did not load, controls with no name,
 *  and whether there is anything on it at all. */
const PAGE_READ = (screen) => `(() => {
  const vw = ${screen}, de = document.documentElement;
  const wide = [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1 && getComputedStyle(e).position !== "fixed"; }).slice(0, 5).map((e) => e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + (e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\\s+/).slice(0, 2).join(".") : ""));
  const broken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.src).map((i) => i.src).slice(0, 5);
  const text = (document.body?.innerText ?? "").trim().length;
  return { width: de.scrollWidth, vw, wide, broken, text, title: document.title };
})()`;

/** One headless browser on its own profile: its DevTools port once it opens, and the last of what it said on stderr (why it did not). */
async function openChrome(chrome, extra) {
  const profile = mkdtempSync(join(tmpdir(), "xovris-see-"));
  const args = ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-extensions", ...extra, `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank"];
  const browser = spawn(chrome, args, { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
  let err = "", exited = false;
  browser.stderr?.on("data", (d) => { err = (err + d).slice(-2000); });
  browser.on("exit", () => { exited = true; });
  browser.on("error", (e) => { exited = true; err += String(e?.message ?? e); });
  const portFile = join(profile, "DevToolsActivePort");
  const t0 = Date.now();
  while (!existsSync(portFile) && !exited && Date.now() - t0 < 20_000) await new Promise((r) => setTimeout(r, 200));
  const port = existsSync(portFile) ? readFileSync(portFile, "utf8").split(/\r?\n/)[0] : null;
  const stop = () => { killTree(browser); try { rmSync(profile, { recursive: true, force: true }); } catch { /* the browser may still hold it a moment */ } };
  return { port, err: err.trim(), stop };
}

/** Open the result in a real browser and say what a person would see wrong. */
export async function look(chrome, url, outDir, o = {}) {
  const seen = { url, frames: [], problems: [], notes: [] };
  let s = null, opened = null;
  try {
    opened = await openChrome(chrome, []);
    // A kernel that forbids Chrome's sandbox (Ubuntu 23.10+ restricts the user namespaces it needs; root has none) refuses the launch and
    // says so: that one refusal opens the person's own result once without it, and the notes say so - never a look silently not taken.
    if (!opened.port && process.platform === "linux" && /no usable sandbox|without --no-sandbox|namespace/i.test(opened.err)) {
      opened.stop();
      opened = await openChrome(chrome, ["--no-sandbox"]);
      if (opened.port) seen.notes.push("this machine forbids the browser's sandbox, so the result was opened without it");
    }
    if (!opened.port) throw new Error(`the browser did not open its DevTools port${opened.err ? ` - it said: ${opened.err.split("\n").filter(Boolean).slice(-2).join(" ").slice(0, 300)}` : ""}`);
    const port = opened.port;
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
    s = cdp(target.webSocketDebuggerUrl);
    await s.ready;
    const errors = [], failed = [];
    s.on("Runtime.exceptionThrown", (p) => errors.push(`an uncaught error: ${(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text ?? "").split("\n")[0].slice(0, 200)}`));
    s.on("Runtime.consoleAPICalled", (p) => { if (p.type === "error") errors.push(`console.error: ${(p.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200)}`); });
    s.on("Log.entryAdded", (p) => { if (p.entry?.level === "error") errors.push(`the browser: ${String(p.entry.text).slice(0, 200)}${p.entry.url ? ` (${p.entry.url})` : ""}`); });
    s.on("Network.responseReceived", (p) => { if (p.response?.status >= 400) failed.push(`${p.response.status} ${p.response.url}`); });
    s.on("Network.loadingFailed", (p) => { if (!p.canceled) failed.push(`${p.errorText} (${p.type ?? "request"})`); });
    for (const m of ["Runtime.enable", "Log.enable", "Network.enable", "Page.enable", "Performance.enable"]) await s.send(m);
    mkdirSync(outDir, { recursive: true });
    for (const w of o.widths ?? WIDTHS) {
      await s.send("Emulation.setDeviceMetricsOverride", { width: w.w, height: w.h, deviceScaleFactor: w.dpr, mobile: w.mobile });
      await s.send("Emulation.setTouchEmulationEnabled", { enabled: w.mobile });
      const loaded = s.once("Page.loadEventFired", o.loadMs ?? LOAD_MS);
      const t1 = Date.now();
      await s.send("Page.navigate", { url });
      if (!(await loaded)) seen.problems.push(`at ${w.w} px the page did not finish loading within ${Math.round((o.loadMs ?? LOAD_MS) / 1000)} s`);
      const loadS = Math.round((Date.now() - t1) / 100) / 10;
      await new Promise((r) => setTimeout(r, o.settleMs ?? 1500));
      // measured against the screen's own width: a phone widens its layout to fit a page that is too wide, so its innerWidth would hide it
      const r = (await s.send("Runtime.evaluate", { expression: PAGE_READ(w.w), returnByValue: true })).result?.value ?? {};
      if (r.width > r.vw + 1) seen.problems.push(`at ${w.w} px the page is ${r.width} px wide - it scrolls sideways${r.wide?.length ? ` (wider than the screen: ${r.wide.join(", ")})` : ""}`);
      if (r.broken?.length) seen.problems.push(`at ${w.w} px ${r.broken.length} image(s) did not load: ${r.broken.join(", ").slice(0, 300)}`);
      if (!r.text) seen.problems.push(`at ${w.w} px the page shows no text at all - a blank page`);
      const ax = await s.send("Accessibility.getFullAXTree").catch(() => null);
      const unnamed = (ax?.nodes ?? []).filter((n) => !n.ignored && ["button", "link", "textbox", "combobox", "checkbox"].includes(n.role?.value) && !String(n.name?.value ?? "").trim()).length;
      if (unnamed) seen.problems.push(`at ${w.w} px ${unnamed} control(s) have no name a screen reader can say`);
      const shot = await s.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      const frame = join(outDir, `see-${w.w}.png`);
      writeFileSync(frame, Buffer.from(shot.data, "base64"));
      seen.frames.push(frame);
      seen.notes.push(`${w.w} px: loaded in ${loadS} s, "${String(r.title ?? "").slice(0, 60)}"`);
    }
    const perf = await s.send("Performance.getMetrics").catch(() => null);
    const metric = (n) => perf?.metrics?.find((m) => m.name === n)?.value;
    if (metric("ScriptDuration") !== undefined) seen.notes.push(`script ${Math.round(metric("ScriptDuration") * 1000)} ms, layout ${Math.round((metric("LayoutDuration") ?? 0) * 1000)} ms`);
    seen.problems.push(...[...new Set(errors)].slice(0, 8), ...[...new Set(failed)].slice(0, 8).map((f) => `a request failed: ${f}`));
  } catch (e) {
    seen.notes.push(`Xovris could not look: ${String(e?.message ?? e).slice(0, 400)}`);
  } finally {
    s?.close();
    opened?.stop();
  }
  return seen;
}

/** The whole look for a stop: only when the change touched what a person sees, within the time the hook has left. */
export async function see(cwd, files, changed, outDir, msLeft) {
  if (!changed.some((f) => RENDERED.test(f))) return null;
  if (/^(0|false|no|off)$/i.test((process.env.XOVRIS_SEE ?? "").trim())) return null;
  const chrome = findChrome();
  if (!chrome) return { url: null, frames: [], problems: [], notes: ["Xovris found no Chrome, Edge or Chromium on this machine to look at the result with - set XOVRIS_CHROME to one"] };
  if (msLeft < SERVE_MS + LOAD_MS * 2) return { url: null, frames: [], problems: [], notes: ["the tests took the hook's time - the result was not opened this stop"] };
  const t = pageTarget(cwd, files, changed);
  if (!t) return { url: null, frames: [], problems: [], notes: ["nothing a browser can open was found - set XOVRIS_PREVIEW_URL to where the result is served"] };
  let served = null;
  if (t.start) { served = await serve(t.start, cwd); if (served.error) return { url: null, frames: [], problems: [], notes: [`the repository's server did not start: ${served.error}`] }; }
  try { return await look(chrome, served?.url ?? t.url, outDir); } finally { served?.stop?.(); }
}

/** What the gate says of what it saw: the problems as the next step, the frames to open. */
export function sawWords(seen) {
  if (!seen?.problems?.length) return null;
  return `What Xovris saw of your result in a real browser (${seen.url}) - open the frames to see it as a person does (${seen.frames.join(", ")}):\n${seen.problems.map((p) => `- ${p}`).join("\n")}`;
}
