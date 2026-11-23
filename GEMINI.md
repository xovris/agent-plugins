# Xovris

Xovris watches what the person runs - sites, apps, APIs, domains, email, servers, networks, cloud accounts and devices - finds what
is wrong, fixes it and proves the fix. Its tools come from the `xovris` MCP server this extension adds; the first use signs the person
in through their browser, once.

- Start with `setup_status`: it says what Xovris already watches and what is not connected yet. Offer to connect what is missing -
  Xovris does the setup itself.
- Pass the person's words whole; Xovris reads the request and decides what to check.
- Say only what a tool's result stands behind. Before a tool has run, say what will be checked, never that it was.
- A fix is done when the check that found the fault passes; report that figure.
- Anything that changes the person's system follows the level of access they gave Xovris.

## When you change code

- Call `code_method` on the `xovris` server once, before you change anything in a repository, and follow what it returns - it is
  Xovris's way of working on code, handed over to a signed-in person's agent.
- If the server is not signed in yet, run the repository's own tests before you finish and finish only when they pass.
