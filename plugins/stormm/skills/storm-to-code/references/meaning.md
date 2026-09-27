# What a storm means in code

## The YAML (schema v1)

```yaml
schemaVersion: 1
id: publish-job            # process id, a slug
name: Publish Job
blocks:
  - id: publish-job        # stable slug; renames change the title, never the id
    kind: command          # readmodel | command | aggregate | event | policy
    title: Publish Job     # the business name; the code name comes from it
    actor: Recruiter       # optional: who performs it
    hotspots: [ "…" ]      # optional: open questions
    fields:                # optional: { name, type }, type is free text (string, time, Address, Item[]…)
      - { name: jobId, type: string }
connections:
  - { from: publish-job, to: job }   # directed, between block ids
```

Match blocks by `id`, never by title. Two storms (or two versions of one) describe the same unit when the ids are equal.

## Stickies are units of code

| Kind | Is | Usually becomes |
|---|---|---|
| command | an intention, performed by the actor | a data type carrying its fields, plus a handler / use case |
| aggregate | the thing that decides and keeps the rules | a domain type (aggregate root) with a method per command it handles, recording events |
| event | a fact that happened, named in the past tense | an immutable data type carrying its fields |
| policy | a reaction: "whenever <event>, <command>" | an event handler that sends a command |
| read model | what someone looks at to decide | a view/query type, kept up to date by projecting events |

## Arrows are relationships

The storm grammar is `read model → command → aggregate → event → policy → command`, plus `event → read model`.

| Arrow | CLI wording | Usually becomes |
|---|---|---|
| read model → command | *Job Detail feeds Publish Job* | nothing server-side: the UI builds the command from the view. Worth a doc comment. |
| command → aggregate | *Job handles Publish Job* | the aggregate's method for that command, called by the command's handler (load → method → save → publish events) |
| aggregate → event | *Job records Job Published* | the aggregate method records that event |
| event → policy | *Job Published triggers Log activity* | the policy subscribes to that event |
| policy → command | *Log activity sends Create Activity Log* | the policy builds that command and hands it to its handler |
| event → read model | *Job Published updates Job Detail* | a projection updates the view from that event |

Any other arrow is outside the grammar: the CLI calls it unusual. Ask what it means before coding it.

## What the storm doesn't say

- **Invariants:** when an aggregate refuses a command. They come from the requirements or the user. Each one becomes an error plus a test.
- **Aggregate state:** whatever the invariants need.
- **Which command records which event** when one aggregate handles several commands and records several events. The CLI lists this as a gap. Ask.
- **Where a read model's data comes from** when no event updates it.
- **What handles a command that leads to no aggregate:** often a call to another system through a port. Follow the conventions, or ask.
- **Hotspots:** open questions. Leave them visible as TODOs, never silently answered.
