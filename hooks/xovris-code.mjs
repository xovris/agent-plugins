#!/usr/bin/env node
// Xovris's way of working on code, inside the agent a person attaches it to (#1767: the proof measures what ships, never a copy kept in
// the test). Claude Code's own SessionStart and Stop events: at the start Xovris runs the repository's own tests and hands the agent
// what fails and the files it points to, so its first turn goes on the fix; at every stop it holds "done" until no existing test is
// weakened, a test proves the change and the repository's tests pass - its reason is the agent's next step. It never refuses the
// person: the same unproven change STALL_SAME stops running lets the session end, said as such (a runaway signal, never a cap).
//   node xovris-code.mjs start|stop      (stdin: the hook's JSON; stdout: the hook's answer)
// No dependency beyond Node, so it runs wherever the plugin is installed.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { sawWords, see } from "./xovris-see.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
/** The method is closed (L10, L66): it lives in the package's closed/ folder, which the published plugin never carries. A source
 *  checkout (and the proof harness, claude-arms.ts XOVRIS_METHOD) reads it there; an installed plugin reads it from the person's own
 *  Xovris when they are signed in - XOVRIS_TOKEN, or the key `xovris login` saved - kept for the day beside that key; without either,
 *  the hand-over says plainly what Xovris does without it. */
export const CLOSED_METHOD = join(HERE, "..", "closed", "method.md");
const configDir = (env = process.env) => env.XOVRIS_CONFIG_DIR || (process.platform === "win32" ? join(env.APPDATA || join(homedir(), "AppData", "Roaming"), "xovris")
  : process.platform === "darwin" ? join(homedir(), "Library", "Application Support", "xovris") : join(env.XDG_CONFIG_HOME || join(homedir(), ".config"), "xovris"));
/** The person's own Xovris and key: XOVRIS_TOKEN (with XOVRIS_API_URL), else what `xovris login` saved. */
export function signedIn(env = process.env) {
  if (env.XOVRIS_TOKEN) return { api: (env.XOVRIS_API_URL || "https://api.xovris.ai").replace(/\/+$/, ""), token: env.XOVRIS_TOKEN };
  try { const s = JSON.parse(readFileSync(join(configDir(env), "credentials.json"), "utf8")); return s.token ? { api: String(s.api || "https://api.xovris.ai").replace(/\/+$/, ""), token: s.token } : null; } catch { return null; }
}
/** One read of GET /v1/agents/method, in a child so the hook stays synchronous; null when it did not answer. */
export function fetchMethod(who) {
  const script = "fetch(process.env.U,{headers:{authorization:'Bearer '+process.env.T,accept:'application/json'},signal:AbortSignal.timeout(8000)}).then(r=>r.ok?r.json():null).then(j=>process.stdout.write(j&&typeof j.method==='string'?j.method:''),()=>{})";
  const r = spawnSync(process.execPath, ["-e", script], { env: { ...process.env, U: `${who.api}/v1/agents/method`, T: who.token }, encoding: "utf8", timeout: 10_000, windowsHide: true });
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : null;
}
export const WITHOUT_METHOD = "Xovris's way of working on code is kept on the person's Xovris account and is handed over here once they are signed in (npx xovris login). Without it, Xovris still runs the repository's own tests at every stop and holds done until they pass - read the person's words whole, prove each part, and run the tests before you finish.";
/** The method for this session: the closed file, else the day's copy from the person's Xovris, else read now, else said plainly. */
export function methodText({ closed = CLOSED_METHOD, env = process.env, fetch = fetchMethod, now = Date.now() } = {}) {
  const own = read(closed);
  if (own && own.trim()) return { text: own.trim(), from: "closed" };
  const who = signedIn(env);
  if (!who) return { text: WITHOUT_METHOD, from: "none" };
  const cache = join(configDir(env), "method.json");
  try { const c = JSON.parse(readFileSync(cache, "utf8")); if (c.api === who.api && now - Date.parse(c.at) < 86_400_000 && c.text) return { text: c.text, from: "cache" }; } catch { /* read it now */ }
  const text = fetch(who);
  if (!text) return { text: WITHOUT_METHOD, from: "none" };
  try { mkdirSync(dirname(cache), { recursive: true }); writeFileSync(cache, JSON.stringify({ api: who.api, at: new Date(now).toISOString(), text }), { mode: 0o600 }); } catch { /* read again next time */ }
  return { text, from: "account" };
}
export const METHOD = (() => { try { return readFileSync(CLOSED_METHOD, "utf8").trim(); } catch { return ""; } })();
export const STALL_SAME = 3;
export const IS_TEST = /(^|\/)(test|tests|__tests__|spec|specs)\/|[._-](test|spec)\.[a-z0-9]+$|_test\.go$|(^|\/)test_[^/]+\.py$|\.Tests\.ps1$/i;

const posix = (p) => p.split(sep).join("/");
const read = (p) => { try { return readFileSync(p, "utf8"); } catch { return null; } };
const linesOf = (t) => t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const hashOf = (p) => { try { return createHash("sha1").update(readFileSync(p)).digest("hex"); } catch { return null; } };
const binary = (p) => { try { return readFileSync(p).subarray(0, 8192).includes(0); } catch { return false; } };

/** What a test run writes (a build folder, a compiled program) is never the agent's change: the files and new folders the start's own
 *  run made, and any binary file, are left out of what the gate reads. */
export function madeBy(before, after) {
  const had = new Set(before);
  const made = after.filter((f) => !had.has(f));
  const dirs = new Set(before.flatMap((f) => { const out = []; let d = f; while (d.includes("/")) { d = d.slice(0, d.lastIndexOf("/")); out.push(d); } return out; }));
  const madeDirs = [...new Set(made.map((f) => { const s = f.split("/"); for (let i = 1; i < s.length; i += 1) { const d = s.slice(0, i).join("/"); if (!dirs.has(d)) return d; } return null; }).filter(Boolean))];
  return { made, madeDirs };
}
export function ownFiles(cwd, state) {
  return listFiles(cwd).filter((f) => !state.made.includes(f) && !state.madeDirs.some((d) => f.startsWith(`${d}/`)) && !binary(join(cwd, f)));
}

/** The repository's files: git's own list where it is a repository (its ignore rules, never ours), else every file outside dot-folders
 *  and installed packages. */
export function listFiles(cwd) {
  const g = spawnSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], { cwd, encoding: "utf8", windowsHide: true, maxBuffer: 256 * 1024 * 1024 });
  if (g.status === 0) return g.stdout.split("\0").filter((f) => f && existsSync(join(cwd, f)));
  const walk = (at) => readdirSync(at, { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith(".") || e.name === "node_modules") return [];
    const p = join(at, e.name);
    return e.isDirectory() ? walk(p) : [posix(relative(cwd, p))];
  });
  try { return walk(cwd); } catch { return []; }
}

/** How this repository runs its own tests: the person's own declaration first (XOVRIS_TEST_COMMAND), then the file each toolchain
 *  names its runner in - the same reading as Xovris's repository method (packages/review/src/method.ts), carried here because the
 *  plugin ships alone. KEEP: these are the toolchains' own conventions, never a reading of the person's words; a repository none of them
 *  describes is said as such, and its command is one setting away. */
export function testCommand(cwd, files) {
  const declared = (process.env.XOVRIS_TEST_COMMAND ?? "").trim();
  if (declared) return { command: declared, from: "XOVRIS_TEST_COMMAND" };
  const has = (f) => existsSync(join(cwd, f));
  const any = (re) => files.some((f) => re.test(f));
  const at = (cmd, from) => ({ command: cmd, from });
  let pkg = null;
  try { pkg = has("package.json") ? JSON.parse(read(join(cwd, "package.json")) ?? "{}") : null; } catch { pkg = null; }
  const pm = has("pnpm-lock.yaml") ? "pnpm" : has("yarn.lock") ? "yarn" : has("bun.lock") || has("bun.lockb") ? "bun" : "npm";
  if (pkg?.scripts?.test && !/no test specified/.test(pkg.scripts.test)) return at(`${pm} test`, "package.json scripts.test");
  if (has("go.mod")) return at("go test ./...", "go.mod");
  if (has("Cargo.toml")) return at("cargo test", "Cargo.toml");
  if (has("pom.xml")) return at(`${has("mvnw") ? "./mvnw" : "mvn"} -q -B test`, "pom.xml");
  if (["build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts"].some(has)) return at(`${has("gradlew") ? "./gradlew" : "gradle"} test`, "the Gradle build file");
  if (any(/\.(sln|slnx|csproj|fsproj)$/)) return at("dotnet test", "the .NET project");
  if (has("composer.json")) return at(has("phpunit.xml") || has("phpunit.xml.dist") ? "vendor/bin/phpunit" : "composer test", "composer.json");
  if (has("Gemfile")) return at(any(/(^|\/)spec\//) ? "bundle exec rspec" : "bundle exec rake test", "Gemfile");
  if (has("CMakeLists.txt")) return at("cmake -S . -B build && cmake --build build && ctest --test-dir build --output-on-failure", "CMakeLists.txt");
  if (has("Makefile") && /^test\s*:/m.test(read(join(cwd, "Makefile")) ?? "")) return at("make test", "the Makefile's test target");
  if (has("pytest.ini") || has("conftest.py") || /\[tool\.pytest/.test(read(join(cwd, "pyproject.toml")) ?? "")) return at("python -m pytest -q", "the pytest configuration");
  if (any(/(^|\/)test_[^/]+\.py$|_test\.py$/)) return at("python -m unittest discover -v", "Python tests and no runner named: unittest");
  if (any(/\.Tests\.ps1$/i)) return at("pwsh -NoProfile -Command Invoke-Pester -CI", "Pester tests");
  return null;
}

/** KEEP: the hook's own clock for one run of the tests - inside Claude Code's 600 s hook timeout, so a slow suite is said, never hung. */
export const TEST_MS = 540_000;
export function runTests(command, cwd) {
  const t0 = Date.now();
  const r = spawnSync(command, { cwd, shell: true, encoding: "utf8", timeout: TEST_MS, windowsHide: true, maxBuffer: 64 * 1024 * 1024, env: process.env });
  const output = `${r.stdout ?? ""}${r.stderr ?? ""}${r.error ? `\n${r.error.message}` : ""}`;
  return { passed: r.status === 0, output, seconds: Math.round((Date.now() - t0) / 100) / 10 };
}

/** KEEP: what is handed is sized by what Claude Code puts in front of the agent whole - a longer hook answer is saved to a file the
 *  agent must then open, a turn spent (cs-price, 20 Oct: 45.8 KB, three turns lost) - never a limit on what the agent may read; it reads
 *  the rest itself. Every turn re-sends it too (#1765, cpp-lru). */
export const TAIL_LINES = 80;
export const TAIL_CHARS = 3_000;
export const HAND_CHARS = 9_000;
const tail = (s) => { const t = s.replace(/\r\n/g, "\n").trimEnd().split("\n").slice(-TAIL_LINES).map((l) => l.slice(0, 400)).join("\n"); return t.length > TAIL_CHARS ? t.slice(-TAIL_CHARS) : t; };

/** The repository as its owner keeps it: git's tracked files - what a test run or a build left untracked is not the repository. Null where
 *  it is not a git repository. */
export function trackedFiles(cwd) {
  const g = spawnSync("git", ["ls-files", "-z"], { cwd, encoding: "utf8", windowsHide: true, maxBuffer: 256 * 1024 * 1024 });
  return g.status === 0 ? g.stdout.split("\0").filter((f) => f && existsSync(join(cwd, f))) : null;
}

/** What Xovris hands over at the start: the method, what fails now, and the files it points to - those the failure names, then the
 *  tests, then the rest - whole, for as long as the hand-over stays cheap; the repository's shape after that. */
export function handOver(cwd, files, command, run) {
  const parts = [methodText().text, "This is the same method as the xovris-code skill - there is no need to load it."];
  if (!command) parts.push("Xovris found no command this repository runs its tests with (none of its toolchains names one, and XOVRIS_TEST_COMMAND is not set) - find how its tests run before you change anything.");
  else if (!run) parts.push(`The repository's tests run with this command (from ${command.from}) - use it exactly, it builds and runs them:\n${command.command}`);
  else if (run.passed) parts.push(`Xovris ran the repository's own tests (\`${command.command}\`, from ${command.from}): they pass as given.`);
  else parts.push(`Xovris ran the repository's own tests (\`${command.command}\`, from ${command.from}) before you started. What fails now:\n${tail(run.output)}`);
  const said = run && !run.passed ? run.output : "";
  const text = files.filter((f) => { try { const s = statSync(join(cwd, f)); return s.isFile() && s.size < 200_000; } catch { return false; } });
  const rank = (f) => (said.includes(f) || said.includes(f.split("/").pop()) ? 0 : IS_TEST.test(f) ? 1 : 2);
  const shown = [];
  let room = HAND_CHARS - parts.join("\n\n").length;
  for (const f of [...text].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))) {
    const body = read(join(cwd, f));
    if (body === null || body.includes("\0") || body.length > room) continue;
    shown.push(`--- ${f}\n${body.trimEnd()}`);
    room -= body.length;
  }
  if (shown.length) parts.push(`The repository's files as they are now (${shown.length} of ${files.length}):\n${shown.join("\n\n")}`);
  const rest = files.filter((f) => !shown.some((s) => s.startsWith(`--- ${f}\n`)));
  if (rest.length) {
    const dirs = new Map();
    for (const f of rest) { const d = f.includes("/") ? f.slice(0, f.lastIndexOf("/")) : "."; dirs.set(d, (dirs.get(d) ?? 0) + 1); }
    parts.push(`The rest of the repository, by folder (files):\n${[...dirs].sort().map(([d, n]) => `${d} (${n})`).join("\n")}`);
  }
  return parts.join("\n\n");
}

/** What the gate reads of a change against the tests as they were at the start: every existing test line removed or changed, and
 *  whether a test was added. */
export function readChange(before, cwd, files) {
  const now = files.filter((f) => IS_TEST.test(f));
  const weakened = [];
  let added = now.some((f) => !(f in before));
  for (const [f, was] of Object.entries(before)) {
    const body = read(join(cwd, f));
    if (body === null) { weakened.push(`${f} was removed`); continue; }
    const kept = new Set(linesOf(body));
    const gone = linesOf(was).filter((l) => !kept.has(l));
    if (gone.length) weakened.push(`${f}: ${gone.length} line(s) of the existing test changed or removed, first "${gone[0].slice(0, 120)}"`);
    const had = new Set(linesOf(was));
    if (linesOf(body).some((l) => !had.has(l))) added = true;
  }
  return { weakened, added };
}

/** The gate's answer: the reason to keep working, or null when Xovris's checks hold. cs-price (20 Oct): the shown tests went red to
 *  green while two parts of the person's words stayed wrong, so a red-to-green run is never the whole proof - a test of the agent's
 *  own is asked for every change. */
export function reasonOf(g) {
  const why = [];
  if (g.weakened.length) why.push(`An existing test was weakened - put it back exactly as it was and add new cases instead: ${g.weakened.join("; ")}.`);
  if (!g.added) why.push("No test of yours proves the change yet - for each part of the person's words the repository's tests do not check, add one small test beside them that checks it.");
  if (g.checks && !g.checks.passed) why.push(`The repository's tests fail with your change:\n${tail(g.checks.output)}`);
  return why.length ? `Xovris's checks do not hold yet:\n${why.join("\n")}` : null;
}

/** A runaway signal, never a cap: the same change and the same reason STALL_SAME times running lets the session end. */
export function stalled(state, key) {
  const n = state.stall?.key === key ? (state.stall.n ?? 0) + 1 : 1;
  state.stall = { key, n };
  return n >= STALL_SAME;
}

export const stateFile = (sessionId, cwd) => join(tmpdir(), "xovris-code", String(sessionId ?? createHash("sha1").update(cwd).digest("hex").slice(0, 16)).replace(/[^\w.-]/g, "_"), "state.json");

/** The agent never waits on Xovris (G162.01, 20 Oct: the start's own test run was 5-20 s on the person's clock before the first turn -
 *  go-bucket 19.7 s, cs-price 12.1 s - while the method has the agent run the tests with its fix anyway). The run before the first turn
 *  is the person's choice, XOVRIS_REPRODUCE=1; the stop's run is the proof either way. */
export const reproduceAtStart = () => /^(1|true|yes)$/i.test((process.env.XOVRIS_REPRODUCE ?? "").trim());

export function start(input) {
  const t0 = Date.now();
  const cwd = input.cwd ?? process.cwd();
  const files = listFiles(cwd).filter((f) => !binary(join(cwd, f)));
  const command = testCommand(cwd, files);
  const run = command && reproduceAtStart() ? runTests(command.command, cwd) : null;
  const state = {
    cwd, command, redBefore: run ? !run.passed : null, at: new Date().toISOString(), ...madeBy(files, listFiles(cwd)),
    tests: Object.fromEntries(files.filter((f) => IS_TEST.test(f)).map((f) => [f, read(join(cwd, f)) ?? ""])),
    hashes: Object.fromEntries(files.map((f) => [f, hashOf(join(cwd, f))])),
    stops: [],
  };
  const context = handOver(cwd, trackedFiles(cwd) ?? files, command, run);
  state.startSeconds = Math.round((Date.now() - t0) / 100) / 10;
  const file = stateFile(input.session_id, cwd);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(state));
  return { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context } };
}

export function stop(input) {
  const t0 = Date.now();
  const cwd = input.cwd ?? process.cwd();
  const file = stateFile(input.session_id, cwd);
  const state = (() => { try { return JSON.parse(readFileSync(file, "utf8")); } catch { return null; } })();
  if (!state) return null;
  const files = ownFiles(cwd, state);
  const changed = files.filter((f) => state.hashes[f] !== hashOf(join(cwd, f))).concat(Object.keys(state.hashes).filter((f) => !files.includes(f)));
  // what changed and what is on disk, kept for the look that follows (stopAndSee) - one reading of the tree per stop
  state.changed = changed;
  state.files = files;
  state.stopStarted = t0;
  const log = (decision, reason) => { state.stops.push({ at: new Date().toISOString(), s: Math.round((Date.now() - t0) / 100) / 10, decision, reason: reason?.slice(0, 240) ?? null }); writeFileSync(file, JSON.stringify(state)); };
  // nothing changed: a question answered, not a change to prove
  if (!changed.length) { log("unchanged", null); return null; }
  // what the gate's own run writes (a build folder, a compiled program) is never the agent's change at the next stop
  const listed = listFiles(cwd);
  const checks = state.command ? runTests(state.command.command, cwd) : null;
  const made = madeBy(listed, listFiles(cwd));
  state.made = [...new Set([...(state.made ?? []), ...made.made])];
  state.madeDirs = [...new Set([...(state.madeDirs ?? []), ...made.madeDirs])];
  const reason = reasonOf({ ...readChange(state.tests, cwd, files), checks });
  if (!reason) { log("pass", null); return null; }
  const key = createHash("sha1").update(`${changed.sort().map((f) => `${f}:${hashOf(join(cwd, f))}`).join("|")}\0${reason.slice(0, 200)}`).digest("hex");
  if (stalled(state, key)) { log("stalled", reason); return { systemMessage: `Xovris's gate let the session end on an unproven change after ${STALL_SAME} identical stops: ${reason.slice(0, 300)}` }; }
  // #1788.1 / #1790 1b: verify and retry inside the run - a second stop with the checks still not holding is never "try again" but
  // diagnose, re-plan and take another approach; every stop is kept in the session's record (state.stops) for the miss loop
  state.blocks = (state.blocks ?? 0) + 1;
  // no progress on the change itself (the debug-fixation loop, research/p3-core/1b-1d-verify-retry-and-miss-loop.md): a stop on the very
  // change the last stop held is said as such at once, so the next step is a new approach rather than the same one again
  const change = changed.map((f) => `${f}:${hashOf(join(cwd, f))}`).join("|");
  const same = state.blocks > 1 && state.lastChange === change;
  state.lastChange = change;
  log("block", reason);
  return { decision: "block", reason: state.blocks > 1 ? `${reason}\n${same ? `${UNCHANGED} ` : ""}${replan(state.blocks)}` : reason };
}

/** #1802 / #1790 1b: the stop that also SEES - when the change touched what a person sees, the result is opened in a real browser and
 *  what it showed (an uncaught error, a failed request, a page wider than the phone, a broken image, a control with no name, a blank
 *  page) is the next step beside the tests' reason; a pass that looks wrong is held. The frames are written beside the session. */
export const HOOK_MS = 600_000;
export async function stopAndSee(input, look = see) {
  const answer = stop(input);
  if (answer && !("decision" in answer)) return answer;
  const cwd = input.cwd ?? process.cwd();
  const file = stateFile(input.session_id, cwd);
  const state = (() => { try { return JSON.parse(readFileSync(file, "utf8")); } catch { return null; } })();
  if (!state?.changed?.length) return answer;
  const seen = await look(cwd, state.files ?? [], state.changed, join(dirname(file), `see-${state.stops.length}`), HOOK_MS - (Date.now() - (state.stopStarted ?? Date.now())) - 15_000);
  if (!seen) return answer;
  state.seen = { at: new Date().toISOString(), url: seen.url, frames: seen.frames, problems: seen.problems, notes: seen.notes };
  writeFileSync(file, JSON.stringify(state));
  const saw = sawWords(seen);
  if (!saw) return answer;
  return { decision: "block", reason: answer ? `${answer.reason}\n${saw}` : `Xovris's checks do not hold yet:\n${saw}` };
}

/** A repeated stop on an unchanged change (#1788.1): said first, before the re-plan. */
export const UNCHANGED = "Nothing in the change has moved since your last stop.";

/** What a repeated stop asks for (#1788.1): the cause read from the output, then a different approach - never a variation of the last. */
export const replan = (n) => `This is stop ${n} with Xovris's checks not holding. Before your next edit, say in one line the cause the output above shows - the cause, not the symptom - then fix it by a different approach from your last change, not a variation of it.`;

// the hook's command names this file with the plugin root's own separators (C:\\...\\0.3.0/hooks/...): compared resolved, and on
// Windows without regard to case, or the hook would run nothing
const same = (a, b) => (process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b);
if (process.argv[1] && same(resolve(process.argv[1]), fileURLToPath(import.meta.url))) {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => (raw += c));
  process.stdin.on("end", async () => {
    let input = {};
    try { input = JSON.parse(raw || "{}"); } catch { input = {}; }
    try {
      const answer = process.argv[2] === "start" ? start(input) : process.argv[2] === "stop" ? await stopAndSee(input) : null;
      if (answer) process.stdout.write(JSON.stringify(answer));
    } catch (e) {
      // the gate never holds the person on its own fault: said, and the session carries on
      process.stdout.write(JSON.stringify({ systemMessage: `Xovris's code hook could not run: ${String(e?.message ?? e).slice(0, 300)}` }));
    }
  });
}
