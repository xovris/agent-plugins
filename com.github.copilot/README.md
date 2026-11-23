# com.github.copilot

GitHub Copilot's own namespace in this Agent Plugins 1.0 package. Copilot reads the portable parts from the package root - `plugin.json`,
`mcp.json` (Xovris's tools at https://api.xovris.ai/v1/mcp) and `skills/` - and reads Copilot-only parts (agents, hooks, rules,
LSP) from this folder; every other client ignores it.

`hooks/hooks.json` is Xovris's way of working on code in Copilot - its CLI, and VS Code's chat on the Copilot harness: the same one
script as Claude Code's (`../hooks/xovris-code.mjs`), at the start and at every stop. Its events are named as Claude Code names them
(`SessionStart`, `Stop`), so Copilot sends the fields the script reads (`session_id`, `cwd`, `stop_hook_active`), and the plugin's folder is
`CLAUDE_PLUGIN_ROOT`, which Copilot sets for a plugin's hooks - both read from copilot 1.0.112 itself on 14 Nov 2026.
