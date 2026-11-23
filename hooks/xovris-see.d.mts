export interface Seen { url: string | null; frames: string[]; problems: string[]; notes: string[] }
export interface Width { w: number; h: number; dpr: number; mobile: boolean }
export const RENDERED: RegExp;
export const WIDTHS: Width[];
export const SERVE_MS: number;
export const LOAD_MS: number;
export function findChrome(env?: Record<string, string | undefined>, exists?: (p: string) => boolean, list?: (dir: string) => string[],
  which?: (name: string) => string): string | null;
export function pageTarget(cwd: string, files: readonly string[], changed: readonly string[]): { url: string; from: string } | { start: string; from: string } | null;
export function serve(command: string, cwd: string, ms?: number): Promise<{ url: string; stop: () => void } | { error: string }>;
export function look(chrome: string, url: string, outDir: string, o?: { widths?: Width[]; loadMs?: number; settleMs?: number }): Promise<Seen>;
export function see(cwd: string, files: readonly string[], changed: readonly string[], outDir: string, msLeft: number): Promise<Seen | null>;
export function sawWords(seen: Seen | null | undefined): string | null;
