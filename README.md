# Xovris for every AI agent

One package, read by every host that reads plugins: Xovris's tools over MCP (https://api.xovris.ai/v1/mcp) and its way of working
as a skill. The first use signs you in through your browser, once.

The quickest way is one line on a machine with Node - it finds the agents you have and adds Xovris to each:

    npx xovris@latest agents

## What is in it

| Part | Read by |
| --- | --- |
| `plugin.json`, `mcp.json`, `skills/` | Every Agent Plugins 1.0 host - ChatGPT and Codex, Cursor, GitHub Copilot, Kiro, VS Code |
| `extensions.com.openai` in `plugin.json` | ChatGPT and Codex (how Xovris is shown) |
| `.claude-plugin/` | Claude Code - the manifest and this repository as its marketplace |
| `hooks/` | Claude Code - Xovris's way of working on code: the repository's files and its test command handed over before the first turn (nothing to wait for), and every stop checked (no test weakened, a test proving the change, the tests passing) |
| `.cursor-plugin/` | Cursor - the manifest and this repository as its marketplace |
| `com.github.copilot/` | GitHub Copilot's own namespace |
| `gemini-extension.json`, `GEMINI.md` | Gemini CLI and Antigravity CLI |

## Xovris adds itself

`npx xovris@latest agents` finds every agent on the machine and adds Xovris to each, reading each one back before it says done.

Do it yourself instead:

- **Claude Code:** `claude plugin marketplace add xovris/agent-plugins`, then `claude plugin install xovris@xovris`
- **Gemini CLI:** `gemini extensions install https://github.com/xovris/agent-plugins`
- **Any other host:** this repository as a plugin source in the host's own plugin settings.

## Working on code

In Claude Code, Xovris hands the agent the repository's files and the command its tests run with when a session starts - the agent
never waits on it (XOVRIS_REPRODUCE=1 runs the tests first and hands over what fails) - then checks the change at every stop. It reads the test command from the repository's own toolchain (package.json, go.mod, Cargo.toml, the
Maven, Gradle or .NET project, composer.json, the Gemfile, CMake, a Makefile's test target, pytest or Pester); a repository none of
these describes names it once with `XOVRIS_TEST_COMMAND`. Every other agent gets the same way of working as the `xovris-code` skill.

This package is the source of the xovris/agent-plugins repository, kept in Xovris at `packages/agent-plugins`.
Licence: Apache-2.0.
