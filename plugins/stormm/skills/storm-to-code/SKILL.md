---
name: storm-to-code
description: Turn a Stormm event-storm process YAML into code in the repository's own language and structure, and keep the code in step as the storm changes. Use when the user points at a storm or process YAML (schemaVersion + blocks + connections with kinds readmodel/command/aggregate/event/policy), asks to implement or scaffold an event storm or process model, asks what changed in the storm and what code that means, or asks whether the code still matches the storm. Works for any language; the repo's conventions decide the shape.
---

# Storm to code

An event storm is the skeleton of the code. Every sticky is a unit of code (a type), and every arrow is a relationship between two units (a method, a handler, a projection). The storm gives the names, the units and how they connect. The engineers own the inside: invariants, aggregate state, storage, and anything the storm leaves as a hotspot.

Your job is to write that skeleton and its obvious wiring **in the style the repository already uses**, never to impose a structure of your own.

Read [references/meaning.md](references/meaning.md) before the first time you work from a storm in a session. It defines the YAML and what each sticky and arrow means in code.

## The helper CLI

The plugin ships a CLI that reads the YAML deterministically. It needs Node 20+:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/stormm.mjs" explain <process.yaml>                  # units, arrows, one slice per command, gaps
node "${CLAUDE_PLUGIN_ROOT}/scripts/stormm.mjs" changes <process.yaml> --since <git-ref> # what changed since that commit, as work items
```

Add `--json` for the same data as JSON. It exits non-zero on a storm with errors (unknown kind, dangling connection…); show those to the user and stop, since they must be fixed in the storm.

Without Node, read the YAML yourself using references/meaning.md, and for changes compare it with `git show <ref>:<path>`. The CLI only saves you from doing that by hand.

## Workflow

1. **Find the storm and the conventions.**
   - Storms usually live in `stormm/*.yaml`; ask if you can't find the one the user means.
   - Read `.stormm/conventions.md` at the repo root. If it's missing, write one before any code (see [references/conventions.md](references/conventions.md)): infer it from the existing code, then show it to the user and wait for approval. The conventions decide every file path, name and shape below.

2. **Work out the task.**
   - **Code already exists for this storm:** run `changes --since <ref>`, where `<ref>` is the commit the code was last aligned with. Ask the user if it isn't obvious; the last commit touching both the storm and its code is a good guess (`git log -1 --format=%h -- <storm> <code dirs>`). Each work item is one change.
   - **New storm:** run `explain`. Work one **slice** at a time: a command, its aggregate, the events it records, and what reacts to them.

3. **Report the gaps before writing.** The `Gaps` section lists what the storm doesn't say: commands with no aggregate, read models with no source, stickies with no fields, and hotspots. Tell the user which ones you'll handle by convention and which need their decision. Don't invent business rules. An invariant not stated in the storm or the requirements gets a `TODO`, not a guess.

4. **Write the code**, following the conventions and the code around it:
   - Use the storm's names exactly, in the repo's casing (`names.pascal`, `names.snake`… in the JSON). A storm rename is a code rename.
   - Use the fields as the storm gives them. Map field types (`string`, `time`, `Address`, `Item[]`) to the language's types or existing value objects. Don't add fields the storm lacks without saying so.
   - Put each hotspot as a TODO on the unit it belongs to, in the form the conventions give.
   - Write tests the way the repo does: one per invariant on the aggregate, plus a slice test wired in memory when the repo has that kind of test.

5. **Verify** with the repo's own build, lint and test commands, and fix what fails.

6. **Report** the mapping from storm to code: each sticky → file and type, each arrow → method or handler. Also list anything you decided that the storm didn't say (invariants, extra fields, gap handling), so the user can move those decisions back into the storm.

## Checking code against a storm

When asked whether the code matches the storm:
1. Run `explain --json`.
2. For every unit, find its type where the conventions say it lives, by name.
3. For every arrow, find its code (the aggregate method, the policy handler, the projection).
4. Report three lists: in the storm but missing from the code, in the code but not in the storm (a type or handler following the conventions that no sticky explains), and names that differ.

Don't change code during a check unless the user asks you to.

## Example

[examples/go/](examples/go/) is a complete worked example: `stormm/publish-job.yaml`, its `.stormm/conventions.md`, and the Go code written from them, with passing tests. Use it to see how stickies and arrows land in real code. Don't copy its structure into a repository whose conventions differ.
