# Projection client

Renderer-independent bounded read-only client at version 0.10.0. Its only dependency
is the shared Projection contract. No Vue, DOM, transport, source owner or writer.

`adopt(snapshot, context)` validates the complete Scene using PP0's exact schema and
SHA-256 revision. `hydrate` requires exact SSR key/revision/lineage. A mismatch is
rejected; recovery is a separate `current` adoption with explicit expected-current
revision (null only for a missing key). Revisions are opaque, never sortable clocks.
The caller owns delivery/session ordering. `input` accepts Snapshot/NoChange but
does not send ACKs or claim that the user saw a rendered frame.

`present`, `navigate`, `back`, `forward` only change immutable PresentationState.
Rebase preserves exact item/region IDs, clears disappeared selections/inspector
and falls back to Scene root for missing focus. `action` creates a local handle
bound to key/revision/action; `intent` revalidates it and returns an owner command
descriptor, not authorization or an effect. Renderers must not execute descriptors
as URLs/code. `renderPlan` adds selection/focus/expansion to the supplied Scene; it
does not classify data by labels or compose semantic Scenes from raw data.

Bounds: 8 keys (oldest inactive adoption evicted), 2 snapshots/key, 512 KiB
per snapshot, 64 navigation entries, 256 selections/expansions. Evicted navigation
targets raise SceneUnavailable; no hidden latest lookup. No persistent storage,
event listener or timer. `close` clears all cache and presentation state.

RenderState (DOM references, pixel scroll, layout and scheduling) belongs to the
installed renderer and must be disposed on revision/Scene change or unmount.
Unknown abstract region roles fail as UnsupportedRenderer, not arbitrary plugins.

`viewMode` belongs only to PresentationState (`spatial` or `structured`), never
the canonical Scene. Both modes carry the same exact items, relationships,
actions, sources and inspector target. `renderPlan` retains the Scene relations
and derives highlight/related flags solely from selected/focused endpoint IDs.
It does not infer relationships from labels or source data. Rebase drops vanished
targets while retaining the selected mode for updates to the same Scene.
