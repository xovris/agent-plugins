# com.github.copilot

GitHub Copilot's own namespace in this Agent Plugins 1.0 package. Copilot reads the portable parts from the package root - `plugin.json`,
`mcp.json` (Xovris's tools at https://api.xovris.ai/v1/mcp) and `skills/` - and reads Copilot-only parts (agents, hooks, rules,
LSP) from this folder; every other client ignores it.
