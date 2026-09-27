# stormm plugin for Claude Code

Gives Claude the `storm-to-code` skill, built on the idea of **process modeling coding**: once the event storm is done, the domain is already designed.

- **The storm is the design.** The aggregates are the domain model. The commands and events, with their fields, are its interface. Actors, read models and policies are its usage.
- **Your project decides how it's built.** Claude learns the architecture, patterns, naming and tests from your existing code and docs, and follows them. The plugin prescribes no code structure.

Claude implements the storm's design rather than designing the domain again. It works for any language. It only writes business behavior the storm shows, raises the storm's gaps and hotspots as questions instead of guessing, and suggests changes to the storm rather than drifting from it.

## Try it without installing

```
claude --plugin-dir path/to/stormm/plugins/stormm
```

## Install

```
/plugin marketplace add <git URL or local path of the stormm repo>
/plugin install stormm@stormm
```

## Use

Commit the storm YAML to your repository (download it from the Stormm app), then ask, for example:
- "Implement stormm/publish-job.yaml"
- "What changed in stormm/publish-job.yaml since v1.2? Update the code."
- "Does the code still match stormm/publish-job.yaml?"

## What's inside

- `skills/storm-to-code/`: the skill's principles, and `references/meaning.md` on how to read each sticky and arrow.
- `scripts/stormm.mjs`: two helpers the skill uses, `check` (validate the storm) and `changes --since <ref>` (what differs, by block id). Neither interprets the storm: Claude always reads the YAML itself. It's one bundled file that needs Node 20+, built from `packages/cli` in the stormm repo. The skill still works without Node.
