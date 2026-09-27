# stormm plugin for Claude Code

Gives Claude the `storm-to-code` skill. With it, Claude reads a Stormm process YAML (an event storm) and writes the code for it in your repository's own language and structure. When the storm changes, it tells you what code has to change, and it can check whether the code still matches the storm.

## Install

```
/plugin marketplace add <git URL or local path of the stormm repo>
/plugin install stormm@stormm
```

To try it without installing: `claude --plugin-dir path/to/stormm/plugins/stormm`.

## Use

1. Commit your storm YAML to the repository, e.g. `stormm/publish-job.yaml` (download it from the Stormm app).
2. Ask Claude, for example:
   - "Implement stormm/publish-job.yaml"
   - "What changed in stormm/publish-job.yaml since v1.2, and what code does that mean?"
   - "Does the code still match stormm/publish-job.yaml?"
3. The first time, Claude writes `.stormm/conventions.md` from your existing code (where each sticky kind goes, and in what shape) and asks you to approve it. Every later storm follows it.

## What's inside

- `skills/storm-to-code/`: the skill, what stickies and arrows mean in code, the conventions format, and a complete Go example (`examples/go/`).
- `scripts/stormm.mjs`: a CLI the skill uses (`explain`, `changes --since <ref>`). It's one bundled file that needs Node 20+ and nothing else, built from `packages/cli` in the stormm repo. The skill still works without Node.
