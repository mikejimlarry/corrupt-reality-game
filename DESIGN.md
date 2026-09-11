---
name: "Corrupt Reality"
description: "The Failing Command Deck: a tense, technical cyberpunk interface operating through systemic decay."
colors:
  signal-cyan: "#00ffcc"
  rival-magenta: "#ff3355"
  corruption-red: "#ff1e3c"
  conflict-amber: "#ff8800"
  positive-blue: "#00ccff"
  counter-violet: "#bb44ff"
  cycle-green: "#00ff88"
  legendary-gold: "#ffaa00"
  console-void: "#0a0a0f"
  panel-black: "#05050f"
  card-black: "#0d0d1f"
  cold-steel: "#aabbcc"
  readable-body: "#8baaa0"
  readable-muted: "#778899"
  body-steel: "#667788"
  grid-steel: "#334455"
  dim-terminal: "#446655"
  pure-white: "#ffffff"
typography:
  display:
    fontFamily: "Doto, monospace"
    fontSize: "clamp(1.5rem, 7vw, 3rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "clamp(1px, 0.4vw, 4px)"
  headline:
    fontFamily: "monospace"
    fontSize: "1.1rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "4px"
  title:
    fontFamily: "monospace"
    fontSize: "0.9rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "2px"
  body:
    fontFamily: "monospace"
    fontSize: "0.7rem"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "0.5px"
  label:
    fontFamily: "monospace"
    fontSize: "0.55rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "3px"
  readableLabel:
    fontFamily: "monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "1px"
  readableBody:
    fontFamily: "monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "0.5px"
  controlTitle:
    fontFamily: "monospace"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "2px"
  canvasMicro:
    fontFamily: "monospace"
    fontSize: "7px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "1px"
  canvasLabel:
    fontFamily: "monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "1px"
  canvasBody:
    fontFamily: "monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  canvasTitle:
    fontFamily: "monospace"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "1px"
  canvasValue:
    fontFamily: "monospace"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0"
  canvasDisplay:
    fontFamily: "monospace"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "1px"
rounded:
  square: "0"
  micro: "2px"
  tag: "3px"
  control: "4px"
  container: "6px"
  panel: "8px"
spacing:
  hairline: "2px"
  micro: "4px"
  xs: "6px"
  sm: "8px"
  viewport: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "40px"
components:
  action-primary:
    backgroundColor: "{colors.signal-cyan}"
    textColor: "{colors.console-void}"
    typography: "{typography.title}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
    height: "48px"
  action-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.dim-terminal}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    padding: "8px 12px"
    height: "44px"
  choice-segment:
    backgroundColor: "transparent"
    textColor: "{colors.dim-terminal}"
    typography: "{typography.body}"
    rounded: "{rounded.square}"
    padding: "6px 10px"
    height: "44px"
  handle-field:
    backgroundColor: "transparent"
    textColor: "{colors.signal-cyan}"
    typography: "{typography.title}"
    rounded: "{rounded.square}"
    padding: "8px 8px 8px 0"
    height: "44px"
  command-panel:
    backgroundColor: "{colors.panel-black}"
    textColor: "{colors.cold-steel}"
    typography: "{typography.body}"
    rounded: "{rounded.container}"
    padding: "8px 12px"
  modal-panel:
    backgroundColor: "{colors.panel-black}"
    textColor: "{colors.cold-steel}"
    typography: "{typography.body}"
    rounded: "{rounded.panel}"
    padding: "16px 20px"
  protocol-card:
    backgroundColor: "{colors.card-black}"
    textColor: "{colors.cold-steel}"
    typography: "{typography.body}"
    rounded: "{rounded.panel}"
    padding: "9px"
    width: "150px"
    height: "210px"
  daemon-tag:
    backgroundColor: "transparent"
    textColor: "{colors.signal-cyan}"
    typography: "{typography.label}"
    rounded: "{rounded.tag}"
    padding: "4px 8px"
  manual-tabs:
    backgroundColor: "transparent"
    textColor: "{colors.dim-terminal}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    padding: "6px 12px 10px"
---

# Design System: Corrupt Reality

## Overview

**Creative North Star: "The Failing Command Deck"**

Corrupt Reality is a shipboard-grade operations console still functioning while the network collapses around it. The player is an operator reading live system state, not a spectator looking at a themed card table. Near-black surfaces, Signal Cyan, compressed monospace type, framed modules, corner ticks, circuit traces, scanlines, and status language make every screen feel like one instrument.

The character is tense, technical, and decaying. Density is high but disciplined: primary actions are isolated, supporting data recedes through dim steel and terminal green, and category or state colors appear only when the rules demand them. The interface is layered rather than lifted. Tonal surfaces and hairline borders construct depth; glow and pulse are reserved for focus, selection, danger, and corruption. Glitch is an infrequent identity event, not continuous decoration.

Glossy neon arcade styling, playful pixel nostalgia, and generic dashboard polish are explicit anti-references. The system should feel purpose-built, severe, and under pressure without sacrificing the legibility required to play.

**Key Characteristics:**

- Near-black operational canvas with thin, luminous instrumentation.
- Signal Cyan owns normal player agency and live-system feedback.
- Compressed monospace typography carries almost the entire interface; Doto is isolated to the game title.
- Tonal layers and borders establish structure before shadow or glow.
- Motion communicates boot, state change, selection, or failure; it never becomes ambient clutter.
- Cards, panels, and overlays read as connected hardware modules in one failing console.

## Colors

The palette is a dark operational hierarchy: Signal Cyan is the steady-state voice, semantic colors identify game mechanics, and cold neutrals keep dense telemetry readable without flattening everything to white.

### Primary

- **Signal Cyan:** The normal player accent for interactive borders, active controls, human status, system readiness, and positive focus. Use translucent versions for quiet fills and structural lines.

### Secondary

- **Rival Magenta:** AI identity, hostile pressure, negative-event cards, target selection, and conflict overlays.
- **Corruption Red:** The match-wide failure state. It replaces the normal accent across the table, HUD, vignette, and urgent messaging after corruption activates.

### Tertiary

- **Conflict Amber:** Conflict cards, dice-off participants, pause state, and warning treatments that are urgent without indicating corruption.
- **Positive Protocol Blue:** Positive event cards and Quarantine-specific status.
- **Countermeasure Violet:** Counter cards and reactive defense classification.
- **Cycle Gain Green:** Resource cards and confirmed cycle gains.
- **Legendary Gold:** Legendary rarity only; its scarcity is part of the hierarchy.

### Neutral

- **Console Void:** The full-viewport foundation and boot surface.
- **Panel Black:** Modal, HUD, and overlay surfaces placed above the canvas.
- **Protocol Card Black:** The slightly lifted card face and dense game-object surface.
- **Cold Steel:** High-priority supporting text and readable secondary values.
- **Body Steel:** Explanatory text, logs, and inactive data that must remain readable.
- **Grid Steel:** Quiet borders, counters, disabled labels, and instrument scaffolding.
- **Dim Terminal Green:** Low-priority setup labels and inactive cyan-family controls.
- **Pure White:** Reserved for the most important numeric values and card titles.

### Named Rules

**The Signal Discipline Rule.** Signal Cyan owns normal player agency; it is never sprayed across inactive content merely to make the screen feel cyberpunk.

**The Corruption Override Rule.** When corruption activates, Corruption Red becomes the environmental accent and changes the apparent operating condition of the whole interface.

**The Semantic Spectrum Rule.** Green, blue, magenta, amber, violet, and gold identify stable gameplay meanings; do not exchange them for decorative variety.

## Typography

**Display Font:** Doto (with monospace fallback)

**Body Font:** System monospace

**Label/Mono Font:** System monospace

**Character:** The typography resembles terse terminal output and hardware labeling. Strong hierarchy comes from size, weight, uppercase, and extreme tracking rather than from multiple families.

### Hierarchy

- **Display** (700, fluid 1.5–3rem, 1 line-height): Game title only, with restrained split-channel glitch treatment.
- **Headline** (700, 1.1rem, 1.2 line-height): Critical overlay outcomes, conflict declarations, and major state changes.
- **Title** (700, 0.9rem, 1.4 line-height): Primary actions, card names, and high-priority values.
- **Body** (400, 0.7rem, 1.7 line-height): Rules copy, tutorial guidance, card effects, and readable system explanations.
- **Label** (400, 0.55rem, 3px tracking, uppercase): Phase labels, metadata, statuses, tabs, and supporting instrumentation.
- **Readable Label** (400, 0.75rem, 1px tracking): Operational labels and secondary controls that must remain legible at compact web viewports.
- **Readable Body** (400, 0.875rem, 1.7 line-height): Accessible command, modal, and explanatory copy.
- **Control Title** (700, 1rem, 1.4 line-height): Accessible dialog titles and setup values that sit below the headline tier.
- **Canvas Micro / Label / Body / Title** (7px / 11px / 13px / 15px): Native-resolution Phaser typography. Canvas Micro is decorative telemetry only; every game-critical value has a readable DOM equivalent.
- **Canvas Value / Display** (20px / 28px): High-priority numeric output and transient game-state display.

### Named Rules

**The Doto Isolation Rule.** Doto belongs to the Corrupt Reality wordmark; operational UI stays in system monospace.

**The Compressed Transmission Rule.** Labels are short, uppercase, and tracked; longer explanations reduce tracking and increase line-height before they increase size.

**The Brightness Hierarchy Rule.** Pure White and Signal Cyan are emphasis colors, not default body text; most supporting copy lives in the steel and dim-terminal range.

## Layout

The game is a fixed, full-viewport instrument rather than a scrolling document. Phaser owns the table layer; React places setup, HUD, actions, logs, and modal overlays above it. The desktop game anchors utility controls at the upper left, turn state and scoreboard at the upper right, the primary phase action around the centre instrument, the hand at the bottom, and the activity log along the lower edge.

The setup screen uses a narrow single-column control stack (300px maximum) beneath the title and a compact two-by-two utility grid. Game panels are deliberately small—typically 290px wide—so the table remains dominant. Protocol cards keep a 5:7 silhouette (150 × 210px), while player zones and the centre apparatus use wider instrument-panel proportions.

The spacing rhythm is dense and integer-led: 2–8px separates tightly related telemetry, 12–16px separates control groups, and 24–40px is reserved for modal or setup breathing room. Interactive game actions maintain at least a 44px touch target; high-priority phase actions use 48px.

Responsive behavior changes topology, not only scale. Below 700px the HUD becomes narrow and mobile controls become icon-led. Below 768px the hand reduces scale and overlap. Short landscape screens at 620px high or less compress the table, shrink centre and player zones, remove offscreen card peeking, and move bottom-centre actions into a right-side rail. Setup screens begin scrolling and compress the title below 700px high, with a second compression step below 440px. Full-screen overlays use a minimum 12px safe-area-aware inset and let the panel scroll rather than the game beneath it.

**The Fixed Table Rule.** Gameplay must read as one bounded table with stable anchors; do not turn primary play into a vertically scrolling page.

**The Reachability Rule.** On short or notched devices, preserve every action inside the safe viewport before preserving decorative scale or symmetry.

## Elevation & Depth

The system is layered, not lifted. Depth comes first from near-black tonal separation, then from thin accent borders, inset frames, corner hardware, opacity, and overlap. Conventional drop shadows are rare. Cyan glows appear on hover, focused actions, selected cards, modal atmosphere, and live indicators; red vignettes and pulses signal corruption or loss. These effects are functional state cues, not permanent halos.

### Shadow Vocabulary

- **Interactive Signal Glow:** A compact cyan glow around the focused primary action or active slider thumb.
- **Modal Atmosphere:** A broad, extremely faint cyan field behind the Field Manual panel.
- **Status Pulse:** A breathing outline around the currently required action.
- **Corruption Vignette:** A deep inset red field that makes global failure feel environmental.

### Named Rules

**The Layered-Not-Lifted Rule.** Use tonal surfaces and borders for resting hierarchy; reserve visible glow for interaction or state change.

**The No Permanent Halo Rule.** If an element is not active, selected, dangerous, or receiving focus, it should not emit light.

## Shapes

The form language combines hard terminal controls with gently rounded equipment housings. Setup buttons, segmented controls, text fields, and range sliders remain square. Dense HUD buttons use a compact 4px radius; tags and meter tracks use 2–3px; HUD panels use 6px; cards, player zones, and modal panels use 8px. Larger centre frames may reach 10–12px when they read as a physical bezel rather than a software card.

Thin strokes are the default. Corner ticks, clipped circuit paths, diamonds, scanlines, recessed screens, and seven-segment numerals provide the system's distinctive geometry. Small rounded tags are acceptable for daemon state and rarity metadata, but capsule-shaped pills are not part of the language.

**The Hardware Geometry Rule.** Every decorative line should imply circuitry, framing, calibration, or machine construction; avoid arbitrary flourishes.

**The Radius Hierarchy Rule.** Controls are hardest, content containers are gently rounded, and only physical-bezel metaphors receive the largest radii.

## Components

### Buttons

Buttons feel like terminal commands: compact type, deliberate tracking, thin borders, and immediate state feedback.

- **Shape:** Square on setup surfaces; gently rounded (4px) for in-game HUD actions.
- **Primary:** Signal Cyan fill with Console Void text in the HUD, or a translucent cyan fill with a full cyan border on setup and tutorial surfaces. Critical phase actions are 48px high.
- **Hover / Focus:** Increase border brightness or cyan fill, then add a controlled signal glow. Keyboard focus must remain visibly distinct from hover.
- **Secondary / Ghost:** Transparent or faintly tinted, with Dim Terminal Green or alpha-muted semantic text. Never compete with the required action.
- **Danger / Conflict:** Retain the same construction but swap to the matching semantic red or amber family.

### Chips

- **Style:** Small 2–3px-radius metadata tags with a low-alpha semantic fill, thin matching border, and compact monospace label.
- **State:** Daemon and Quarantine tags remain attached to the owning agent panel. Rarity badges use the stable rarity spectrum; they are informational rather than interactive.

### Cards / Containers

- **Corner Style:** Gently rounded equipment corners (6–8px), often reinforced with corner marks or a stronger top/category line.
- **Background:** Protocol Card Black for playable cards and Panel Black for React panels.
- **Shadow Strategy:** Flat at rest. Selection may add category-colored glow, lift, and scale; inactive cards remain border-defined.
- **Border:** Thin and semantic. Card category owns the card edge; current game state owns panels and overlays.
- **Internal Padding:** Dense 8–12px spacing, with the illustrated circuit field given more room than metadata.

### Inputs / Fields

- **Style:** Transparent terminal field with no box, a Signal Cyan baseline, leading prompt symbol, uppercase input, and a custom blinking underscore cursor.
- **Focus:** Keep the baseline and input text at full Signal Cyan; focus is expressed through cursor activity rather than a generic browser glow.
- **Error / Disabled:** Recede toward Grid Steel and retain an explicit textual explanation when an action is blocked.

### Navigation

- **Style:** Field Manual navigation is a low-profile tab strip with uppercase tracked labels, no filled tab shapes, and a two-pixel Signal Cyan underline for the active tab.
- **Default / Hover / Active:** Inactive tabs use Dim Terminal Green; hover brightens; active state adds the underline and a nearly transparent cyan wash.
- **Mobile Treatment:** Controls may collapse to compact symbols when the meaning remains available through title text or context.

### Modal Panels

Modal panels resemble diagnostic windows layered over a darkened system. They use Panel Black, a faint cyan perimeter, safe-area-aware outer spacing, and scroll internally when content is taller than the viewport. The Field Manual receives a stronger cyan top edge and a restrained ambient glow. Opening unfolds in two stages; closing reverses the sequence more quickly.

### Protocol Cards

Playable cards are 5:7 instrument modules. A category header and rarity tag frame a circuit-like visual field; the card name is the brightest line; effect copy is cooler and quieter; the footer carries system metadata. Category color controls the border, art accents, and selection glow. Selection lifts and scales the card only while it is actionable.

### Command Panels and Displays

Agent panels, the centre zone, and the RNG display use nested frames, corner hardware, status dots, bars, and compact telemetry. The RNG display is the most physical object: recessed digit screens, screws, scanlines, seven-segment numerals, and state-dependent cyan, amber, or red illumination.

## Do's and Don'ts

### Do:

- **Do** use Signal Cyan for normal player agency and let semantic colors take over only for their established game states.
- **Do** keep the full table, HUD anchors, hand, and required action legible as one composition at every supported viewport.
- **Do** preserve 44px minimum controls and 48px primary actions where React overlays receive touch input.
- **Do** use tonal layering, thin borders, corners, meters, and calibration marks before adding glow.
- **Do** let reduced-motion mode remove scan, pulse, unfold, glitch, and card-flight effects without hiding information.
- **Do** keep category, rarity, rival, corruption, gain, and warning colors semantically stable.

### Don't:

- **Don't** turn the interface into a glossy neon arcade, playful pixel game, or generic analytics dashboard.
- **Don't** use Doto for body copy, controls, cards, or telemetry; it is the title's signature face.
- **Don't** make every label bright cyan or white; hierarchy depends on Dim Terminal Green and steel neutrals.
- **Don't** use ambient glow on resting surfaces or add conventional floating-card shadows everywhere.
- **Don't** introduce soft capsule pills, oversized rounded cards, or decorative gradients that do not describe system state.
- **Don't** treat corruption as a local red badge; it changes the environmental accent and operating condition of the whole table.
- **Don't** preserve decorative scale when it pushes actions outside a short, narrow, or safe-area-constrained viewport.
