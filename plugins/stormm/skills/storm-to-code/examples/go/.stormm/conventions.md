# Storm conventions: Go

- Storms: `stormm/*.yaml`
- Module: `example.com/jobs` (Go 1.22)
- Code names: the storm's PascalCase name (`Publish Job` → `PublishJob`); file names are its snake_case name.

## Stickies

| Sticky | File | Shape |
|---|---|---|
| command | `application/command/<snake>.go` | `type <Name> struct` with the storm's fields, and `type <Name>Handler struct` with `Handle(ctx, <Name>) error` |
| aggregate | `domain/<snake>.go` | `type <Name> struct` (root) holding `events []DomainEvent`; `New<Name>`, `PullEvents()`, and a `<Name>Repository` interface |
| event | the file of the aggregate that records it | `type <Name> struct` with the storm's fields, and `EventName() string` returning `"<snake>"` |
| policy | `application/policy/<snake>.go` | `type <Name> struct` holding the handler of the command it sends, with `Handle(ctx, domain.<Event>) error` |
| read model | `application/query/<snake>.go` | `type <Name> struct` (the view), a `<Name>Store` port, a `<Name>Projection` with `On<Event>` per event that updates it |

## Arrows

| Arrow | Code |
|---|---|
| command → aggregate | A method on the aggregate named for the command's verb (`Publish Job` → `Job.Publish`). The command handler loads the aggregate, calls the method, saves, then publishes `PullEvents()`. |
| aggregate → event | The aggregate method appends the event to `events`. |
| event → policy | The policy's `Handle(ctx, domain.<Event>)`, subscribed on the event bus in the composition root. |
| policy → command | The policy builds the command and calls its handler. |
| event → read model | `<ReadModel>Projection.On<Event>`, subscribed on the event bus. |
| read model → command | No backend code: the UI builds the command from the view. Mention it in the command's doc comment. |

## When the storm leaves a gap

- **Command without an aggregate:** the handler calls a port declared next to it (e.g. `MemberNotifier`) and records no event.
- **Hotspot:** `// TODO(storm): <hotspot text>` on the unit it belongs to.
- **Invariants and aggregate state** are not in the storm: write them from the requirements, with a test each, and list them in the report.

## Tests

- `domain`: one test per invariant, on the aggregate method.
- One flow test per command slice, wired in memory, in `application/<slice>_test.go`.
