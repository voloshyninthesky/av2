---
tags: [subsystem]
---

# Mascot

The low-poly avatar labelled «Ти» — the visitor's body on stage. `js/mascot/` (appearance,
state, pose, walk, editor, update) plus `js/scene/mascot-model.js`. Contract: [[SPEC]] §4
and the whole of §13.

## On stage

Starts **downstage, nudged stage-left toward the guitar, inside the key spotlight pool**
(`MASCOT_START`, also the fall respawn point) and held back off the footlight row so those
point lights can't blow the costume out. The guitar is in easy reach; every other instrument
sits behind the visitor. That placement is a soft tutorial — the first thing within reach is
the thing most people want to touch.

- Movement is **click-to-move on the floor, or the mobile stick**. Deliberately *not*
  keyboard-bound — the desktop keyboard is reserved for the multi-instrument jam ([[SPEC]] §5).
  (Arrows / WASD do walk while idle, but no play key is ever shared with them.)
- Can fall off the stage edge, with a short recovery.
- Instrument focus poses or seats it and reframes the camera → [[Focus framing]].
- Clicking the HUD logo toggles a **tektonik dance**: procedural 8-beat loop, overhead arm
  sweeps + bounce, full spin on the last two beats. Limbs relax smoothly on stop; walk
  input, instrument approach or a fall stops it.

### Walk collision

Footprints are **convex X/Z hulls derived from the visible meshes** of instruments and
speaker stacks, expanded by the mascot's rounded clearance — not axis-aligned boxes. That
matters because several objects are rotated: a bounding box around an angled piano would
block floor a visitor can see is empty. Keyboard / stick movement slides along angled edges;
click routes use expanded footprint corners; approaches stop at the nearest clear silhouette
edge before focus; exiting a seated pose projects the mascot back to clear floor.

### Shadows are curated

Only the major masses cast: torso, neck, face, hair, limbs, shoes. Trim, stripes, collar,
eyes and pins are excluded — they add nothing to the shadow map and would roughly double the
shadow-pass draw calls now that the mascot stands in the key light. The guitar and mic follow
the same rule inside that pool.

## The dressing room

HUD person icon → `#modal-mascot`. `js/mascot/editor.js` (480 lines).

> It should feel like a small dressing room inside the stage, not a settings form.

Three categories — **ОБЛИЧЧЯ / ОДЯГ / ФОРМА** — with deliberately small, curated groups:
four hairstyles (including bald, with a shared fringe shell restyled per style), three
smiles, five hair colours, three eye colours, four skin tones applied to face *and both
hands*, four coherent varsity palettes, primary / accent / shoe overrides, four accessories,
and height / build sliders. **РАНДОМ** picks only from compatible combinations.

Exact option lists and IDs: [[SPEC]] §4 and §13. They change more often than this note will.

### The model that makes it safe

- Opening creates a **draft**. Changes apply live to the real 3D mascot.
- **ГОТОВО** validates and writes `localStorage` `av2.mascot.v3`, closes, restores the
  previous stage camera. No toast — the changed mascot is its own confirmation.
- **✕ / Esc** restores the *opening snapshot* in 3D and storage.
- **СКИНУТИ** resets the draft without closing or persisting, and exposes **ПОВЕРНУТИ**.
- Nothing writes storage on a tap or a slider tick — only **ГОТОВО**.

Two constraints worth protecting in any edit here:

1. **No allocation in the input handler.** Procedural parts are created once and toggled or
   recoloured in place. A 20-change stress pass must create no additional meshes or materials
   and cause no frame hitch.
2. **Per-field fallback on load.** A malformed `av2.mascot.v3` field falls back
   independently and never invalidates the whole look. Removed legacy values (`buzz`,
   `tied`, `sunset`, `chain`, `cap`, `blush`, dropped tones and colours) each fall back to a
   default. `v1` / `v2` keys are deliberately **not** migrated — the key bump is how returning
   visitors get reset. The mascot must also keep working if v3 is absent or storage is
   unavailable.

### Opening the editor from a focused instrument

It leaves focus **immediately, with no return animation**: the instrument settles to rest
(the guitar drops back on its stand) and the camera snaps straight to its pre-focus stage
frame before the preview camera takes over.

That snap **must land exactly on the saved frame** — an orbit drag made just before opening
must not leave a residual offset — because the editor saves this exact position as the frame
to restore on close. A drift here is invisible until the visitor closes the editor and the
stage is subtly wrong.

While editing: instruments and stage hints are hidden so they can't obscure the preview,
background controls are inert, and backdrop taps never close the editor. Horizontal drag in
the preview rotates the mascot around its own Y axis and never touches the stage camera.
Preview angle is session-only — not part of the saved appearance.

## Related

- [[Focus framing]] — the measured preview rectangle, and the seated / held poses
- [[SPEC]] §13 — outcomes, responsive composition, control design, full acceptance list
