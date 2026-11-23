---
name: xovris-code
description: Use whenever you change code in a repository - fixing a fault, building what the person asked for, or changing behaviour - in an agent where Xovris's hooks have not already handed you this method at the start (in Claude Code they have; there is no need to load it). It is Xovris's way of working on code - every part of the person's words fixed at its cause and proved by a test, no existing test weakened, the tests run before you finish.
---

# Xovris on code

Xovris works with you on the repository in front of you, and it hands you its way of working on code itself. In Claude Code its hooks
hand it over before your first turn, with the repository's files and the command its tests run with, and check your change every time
you stop. In any other agent, call the `code_method` tool of the xovris server once, before you change anything, and follow what it
returns.

If the xovris server is not signed in, ask the person to sign in once (`npx xovris login`, or connect the xovris server in this agent);
meanwhile run the repository's own tests before you finish and finish only when they pass. Where no toolchain names the
repository's test command, set it once in `XOVRIS_TEST_COMMAND`.
