# The conventions file

`.stormm/conventions.md` at the repository root says how this repository turns a storm into code. It is written once per repository and belongs to the engineers. Every storm in the repo follows it, and it's what makes the skill work for any language.

## What it must answer

1. **Where storms live**, e.g. `stormm/*.yaml`.
2. **Language and module/package root.**
3. **Code names:** which casing is used where (types, files, methods), and how a command's verb becomes the aggregate method name.
4. **Each sticky kind:** the file path pattern, and the shape (types, interfaces, handler signature).
5. **Each arrow:** what code realizes it.
6. **Gaps:** what to do for a command without an aggregate, for hotspots, and for invariants.
7. **Tests:** what gets a test, and where.

See [../examples/go/.stormm/conventions.md](../examples/go/.stormm/conventions.md) for a complete one.

## When the file is missing

Infer it from the code, then ask the user to approve it before writing any code:

1. Look for the layers: folders or modules named like `domain`, `application`, `command(s)`, `query`/`queries`, `handlers`, `events`, `policies`/`sagas`/`subscribers`/`listeners`, `projections`/`read`.
2. Open two or three existing examples of each kind (a command and its handler, an aggregate, an event, an event subscriber, a query) and write down the patterns they share: file naming, type naming, constructor style, how events are recorded and dispatched, how errors are returned.
3. Where the repo has no example of a kind (often policies or projections), propose the smallest shape that fits the existing code, and say that it's a proposal.
4. Write the file in the format of the Go example, filling every section. Show it to the user and wait for approval.

Once approved, commit it with the code, so the next storm (and the next engineer's agent) uses the same answers.
