# Stormm process YAML — schema v1

A process is stored in the customer's GitHub repository as one file:

```
stormm/
  processes/
    checkout.yaml
```

The file on `main` is the agreed process. Changes arrive as pull requests that edit this file.
It holds business meaning only — no positions, no layout file.

## Example

```yaml
schemaVersion: 1
id: checkout
name: Checkout

blocks:
  - id: cart
    kind: readmodel
    title: Cart
    fields:
      - { name: cartId, type: string }
      - { name: items, type: "CartItem[]" }
  - id: place-order
    kind: command
    title: Place order
    actor: Customer
    hotspots:
      - What if the cart is empty?
    fields:
      - { name: cartId, type: string }
      - { name: shippingAddress, type: Address }
  - { id: order, kind: aggregate, title: Order }
  - { id: order-placed, kind: event, title: Order placed }
  - { id: ship-when-placed, kind: policy, title: Ship when order placed }
  - { id: ship-order, kind: command, title: Ship order, actor: Warehouse }
  - { id: shipment, kind: aggregate, title: Shipment }
  - { id: order-shipped, kind: event, title: Order shipped }

connections:
  - { from: cart, to: place-order }
  - { from: place-order, to: order }
  - { from: order, to: order-placed }
  - { from: order-placed, to: ship-when-placed }
  - { from: ship-when-placed, to: ship-order }
  - { from: ship-order, to: shipment }
  - { from: shipment, to: order-shipped }
```

## Keys

**Process (top level)**

| Key | Required | Meaning |
|---|---|---|
| `schemaVersion` | yes | Always `1` for this version. |
| `id` | yes | Process slug; matches the file name. Frozen after creation. |
| `name` | yes | Display name; free to rename. |
| `blocks` | yes | Every block on the canvas. |
| `connections` | no | Directed links between blocks, one per line. |

**Block**

| Key | Required | Meaning |
|---|---|---|
| `id` | yes | Slug of the title at creation, then frozen. Unique in the file (collision → `order-2`). |
| `kind` | yes | `readmodel` \| `command` \| `aggregate` \| `event` \| `policy` |
| `title` | yes | Business name on the card. |
| `actor` | no | Who performs it, e.g. `Customer`. |
| `hotspots` | no | Open questions, list of strings. |
| `fields` | no | List of `{ name, type }`; `type` is free text. |

Optional keys are omitted when empty.

**Connection**: `{ from: <block id>, to: <block id> }`. No other keys in v1.

## Rules

- **Stable IDs.** Renaming changes `title`/`name`, never `id`. Diffs are computed by ID.
  One exception: a block that hasn't reached the agreed version yet keeps its ID in step with its title, so a block added as "New policy" and named "Reserve stock" becomes `reserve-stock`. Until GitHub is connected, "not yet agreed" means "added in the current editing session"; once the page reloads, the ID is frozen.
- **Canonical output.** Fixed key order and formatting; the same model always serializes to the same bytes.
- **Stable order.** Blocks and connections keep their order from `main`; new items are appended.
- **Repeat a concept when that reads better.** A second `Order` aggregate (`order-2`) can keep two chains apart instead of joining them through one shared block.

## Storage and saving (until GitHub is connected)

A local folder stands in for the connected repositories: `repos/<project>/stormm/processes/<id>.yaml`, with processes outside any project under `repos/_no-project/`. The file name is the process ID.

- **Whole-file saves.** The editor sends the whole YAML plus the version it was based on: the file's git blob SHA, which is also what GitHub's contents API uses.
- **No silent overwrites.** If the file changed since that version, the save is refused (409) and the editor offers Reload.
- **Errors block saving; warnings don't.** A file with errors, or whose `id` doesn't match its file name, is refused (422).
- **Canonical on disk.** Whatever formatting was sent, the file is stored in canonical form.
- **New processes** start with no blocks.
- **Hand-broken files** still appear in the list and show their parse errors when opened.

## Layout (derived, never stored)

- **Groups.** Blocks connected to each other, directly or through other blocks, form a group. Each group gets its own band of rows, stacked top to bottom in the order its first block appears in the file.
- **Columns.** Within a group, a block's column is its longest path from the group's start blocks. Back edges (e.g. `policy → command` loops) are ignored for ranking.
- **Rows.** Within a column, rows follow file order.
- **Unconnected blocks** share one last row, left to right in file order.

### Dragged positions (per browser)

Dragging is a personal view preference. It is kept in the browser's `localStorage`, never in the YAML, the PR, or Stormm's database.

- Key: `stormm:layout:<process id>` → `{ "<block id>": { "x": 0, "y": 0 } }` (absolute canvas coordinates).
- On load, a block uses its saved position if one exists; otherwise its derived position.
- Keyed by block ID, so a dragged block keeps its place across renames, drafts and merged changes. Positions for block IDs no longer in the file are dropped.
- New blocks always appear at their derived position, even if dragged blocks now sit nearby.
- **Reset layout** clears the process's saved positions and returns every block to its derived position.
- If `localStorage` is unavailable (private window, cleared data), the derived layout is used; nothing breaks.
- The change review screen ignores saved positions: before and after are both drawn from the derived layout, so every reviewer sees the same picture.

## Validation

| Rule | Level |
|---|---|
| `schemaVersion` is known | error |
| IDs are valid slugs and block IDs are unique | error |
| `kind` is one of the five kinds | error |
| Connection ends exist | error |
| Duplicate connection, or a block connected to itself | error |
| Grammar: `readmodel → command → aggregate → event → policy → command`, plus `event → readmodel` | warning |
| Block with no connections | warning |

## Versioning

Readers migrate older versions forward; the writer only writes the current version.
Adding an optional key (e.g. a connection `note`) does not bump `schemaVersion`; removing or changing the meaning of a key does.
