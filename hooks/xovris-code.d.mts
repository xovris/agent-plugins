// Types for xovris-code.mjs, so the proof harness and its lane read the shipped hook itself (#1767).
export interface TestCommand { command: string; from: string }
export interface TestRun { passed: boolean; output: string; seconds: number }
export interface Stop { at: string; s: number; decision: string; reason: string | null }
export interface State { cwd: string; command: TestCommand | null; redBefore: boolean | null; at: string; tests: Record<string, string>; hashes: Record<string, string | null>; made: string[]; madeDirs: string[]; stops: Stop[]; startSeconds?: number; stall?: { key: string; n: number } }
export const METHOD: string;
export const CLOSED_METHOD: string;
export const WITHOUT_METHOD: string;
export function signedIn(env?: Record<string, string | undefined>): { api: string; token: string } | null;
export function fetchMethod(who: { api: string; token: string }): string | null;
export function methodText(o?: { closed?: string; env?: Record<string, string | undefined>; fetch?: (who: { api: string; token: string }) => string | null; now?: number }): { text: string; from: 'closed' | 'cache' | 'account' | 'none' };
export function reproduceAtStart(): boolean;
export const STALL_SAME: number;
export const IS_TEST: RegExp;
export const TEST_MS: number;
export const TAIL_LINES: number;
export const HAND_CHARS: number;
export const TAIL_CHARS: number;
export function trackedFiles(cwd: string): string[] | null;
export function listFiles(cwd: string): string[];
export function madeBy(before: readonly string[], after: readonly string[]): { made: string[]; madeDirs: string[] };
export function ownFiles(cwd: string, state: Pick<State, "made" | "madeDirs">): string[];
export function testCommand(cwd: string, files: readonly string[]): TestCommand | null;
export function runTests(command: string, cwd: string): TestRun;
export function handOver(cwd: string, files: readonly string[], command: TestCommand | null, run: TestRun | null): string;
export function readChange(before: Record<string, string>, cwd: string, files: readonly string[]): { weakened: string[]; added: boolean };
export function reasonOf(g: { weakened: string[]; added: boolean; checks: TestRun | { passed: boolean; output: string } | null }): string | null;
export function stalled(state: { stall?: { key: string; n: number } }, key: string): boolean;
export function stateFile(sessionId: string | null | undefined, cwd: string): string;
export function start(input: { cwd?: string; session_id?: string }): { hookSpecificOutput: { hookEventName: string; additionalContext: string } };
export function stop(input: { cwd?: string; session_id?: string }): { decision: string; reason: string } | { systemMessage: string } | null;
export const HOOK_MS: number;
export function stopAndSee(input: { cwd?: string; session_id?: string }, look?: (cwd: string, files: readonly string[], changed: readonly string[], outDir: string, msLeft: number) => Promise<{ url: string | null; frames: string[]; problems: string[]; notes: string[] } | null>): Promise<{ decision: string; reason: string } | { systemMessage: string } | null>;
