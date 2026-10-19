---
name: xovris
description: Use Xovris when the person asks whether something they run is working or safe - a website, an app, an API, a domain, email, a server, a network, a cloud account or a device - when they want Xovris set up or connected, when a change should be checked before it ships, or when a fault should be found, fixed and proved. Xovris's tools come from its own server (xovris in this plugin's MCP servers).
---

# Xovris

Xovris watches what a person runs, finds what is wrong, fixes it and proves the fix. Its tools are served by the `xovris` MCP server
this plugin adds; the first use signs the person in through their browser, once.

## How to use it

1. **Start with `setup_status`.** It says what Xovris already watches for this person and what is not connected yet. When something
   is missing, offer to connect it - Xovris does the setup itself; never hand the person a list of commands to run.
2. **Ask in the person's own words.** Pass what they said, whole. Xovris reads the request itself and decides what to check; do not
   narrow it to one kind of thing first.
3. **Say only what a step stands behind.** Report what Xovris checked from the result its tool returned. If no tool has run yet, say
   what will be checked - never that it was.
4. **A fix is done when its check passes.** Xovris proves each fix with the check that found the fault; report that figure, and say
   plainly when a check is still running or did not pass.
5. **Changes ask first.** Anything that changes the person's system follows the level of access they gave Xovris - observe only, ask
   first, act on low risk, or act by itself. Respect the answer the tool gives.

## What stays private

What Xovris reads for a job is used for that job. Xovris never trains on a customer's data.
