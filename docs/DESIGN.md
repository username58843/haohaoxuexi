# HaoHao XueXi — Design System (v2 "Ink & Cinnabar")

Identity: modern Chinese study tool — deep **ink** canvas, translucent layered
surfaces, hairline borders, one saturated accent (default **cinnabar vermilion**,
user-switchable), serif hanzi as the visual hero, mono uppercase eyebrows.
Aesthetic lineage: `.design-ref/wisperv` (surfaces/typography rhythm) fused with
Chinese ink-and-seal identity. No Bootstrap. No `!important` wars — single token
layer.

## 1. Tokens (`styles/_tokens.scss` → CSS custom properties on `:root`)

### Canvas & surfaces (dark, default)
```
--bg:            #0e1113        // ink canvas (blue-green black)
--bg-glow:       radial gradient overlay, accent-tinted 4%
--surface:       rgba(255,255,255,.045)   // card
--surface-2:     rgba(255,255,255,.08)    // elevated / hover
--surface-3:     rgba(255,255,255,.12)    // pressed / active nav block
--hairline:      rgba(255,255,255,.09)
--hairline-2:    rgba(255,255,255,.16)
--text:          #eceff1
--text-2:        #9aa3a9        // secondary
--text-3:        #5f676d        // muted
--shadow-card:   0 24px 70px -32px rgba(0,0,0,.85)
--on-accent computed for contrast (existing luminance logic — keep)
```

### Light theme (`[data-theme="light"]`) — "rice paper"
```
--bg: #f7f5f0   --surface: #ffffff9c  --surface-2:#ffffff  --surface-3:#ede9df
--hairline: rgba(28,25,20,.10)  --hairline-2: rgba(28,25,20,.18)
--text:#1c1917  --text-2:#57534e  --text-3:#a8a29e
--shadow-card: 0 20px 50px -28px rgba(60,50,30,.25)
```

### Accent (runtime-switchable — keep the 8-color picker)
```
--accent           default #e0533d (cinnabar) — keep existing THEME_COLORS map but
                   replace red value with #e0533d and make it the default
--accent-rgb       r,g,b ints
--accent-soft      rgba(var(--accent-rgb), .14)
--accent-glow      0 8px 30px -6px rgba(var(--accent-rgb), .45)
```
SettingsContext keeps writing these vars at runtime (existing contract).

### Semantic
`--ok #4ade80 · --warn #fbbf24 · --danger #f87171` (+ `-soft` rgba .14 washes)

### Type
```
--font-ui:    'Manrope', 'Inter', system-ui, sans-serif     (variable 400–800)
--font-hanzi: 'Noto Serif SC','Songti SC','STSong','SimSun',serif
--font-mono:  'JetBrains Mono','SF Mono',monospace
Scale: 12 · 13.5 · 15 (body) · 17 · 20 · 24 · 30 · clamp hero
.hanzi { font-family: var(--font-hanzi); font-synthesis: none; }  + lang="zh"
Eyebrow: mono 11px uppercase tracking .14em color var(--text-2)
Two-tone headline: <h_ class="u-two-tone"><span>bright</span> muted rest</h_>
```

### Geometry & motion
```
Radii: 18 card · 12 control · 999 pill      Spacing: 4-based scale
Content column: 720px app / 1080px landing+admin
Transitions: 150ms ease-out controls, 250ms cards; respect prefers-reduced-motion
Focus: 2px accent ring (:focus-visible), never removed
Touch targets ≥ 44px; safe-area insets on dock
```

## 2. Core components (`components/ui/`, styles in `styles/_components.scss`)

| Component | API |
|---|---|
| `Button` | `variant: primary(accent pill+glow) / soft / ghost / danger`, `size: sm/md/lg`, `loading`, renders `<button>` or Link `href` |
| `Card` | surface + hairline + radius-18; `interactive` adds hover lift |
| `Field` | label + input/textarea + error line; all form inputs |
| `Modal` | portal, overlay blur, Esc/overlay close, focus trap, `title`, `footer` |
| `Tabs` / `Segmented` | pill segmented control (accent active block) |
| `Chip` | selectable pill chip (deck/limit/mode pickers) |
| `Toast` | `useToast()` context — success/error/info, top center, auto-dismiss |
| `Spinner` / `PageLoader` | accent ring |
| `EmptyState` | big hanzi glyph icon + title + action |
| `ProgressRing` | SVG ring for goal/accuracy |
| `StatCard` | value + label + optional trend, for dashboard/admin |
| `WordCard` / `WordSheet` | word row/tile + bottom-sheet detail (pinyin, defs, RU/EN, stroke order, TTS button, add-to-deck) |
| `AppShell` | replaces SiteLayout: bottom dock (<1024px) / left rail (≥1024px), guest = plain |

Icon set: existing `NavIcons.js` line style (1.8px stroke), extend as needed.

## 3. Page blueprints

- **Landing `/` (guest)**: floating pill nav (blur on scroll); centered hero —
  mono eyebrow, hero `好好学习` in serif with accent seal-dot, two-tone subtitle,
  pill CTA + text link; live flashcard demo card (auto-cycling answer states);
  4 feature cards (tinted icon tiles: SRS, HSK 1–6, decks, progress);
  3-step "how it works" joined by dashed line with glowing dot; stats strip
  (5000+ words · 6 levels · 33 packs); final CTA; footer with
  privacy/terms/about links. All i18n'd.
- **Dashboard `/` (authed)**: greeting + date; hero row: streak flame StatCard,
  due-cards StatCard, goal ProgressRing; "Continue" primary card (due > 0 →
  start review); weekly activity bar chart (last 14 local days); HSK level
  progress bars (seen/mature per level); quick actions (browse HSK, decks).
- **Learn hub `/learn`**: mode switch (Review due · Quiz); pack/deck multiselect
  (chips grouped: My decks / HSK / Textbook packs); quiz options (count, modes);
  big start button showing count.
- **Session `/learn/session`**: minimal chrome, progress bar, card area
  (Flashcard: tap-to-flip, grade buttons Again/Hard/Good/Easy with interval
  preview; MCQ: 4 answers, hotkeys 1–4, immediate feedback); results screen
  (accuracy ring, streak delta, mistakes list with add-to-deck, review-mistakes CTA).
- **HSK `/hsk`**: level segmented control + search field; virtualized-ish word
  grid (chunked rendering); WordSheet on tap; known-toggle preserved.
- **Decks `/decks`**: deck cards (name, count, preview glyphs, study/edit);
  create modal; `/decks/[id]`: word list w/ inline add (search-powered),
  remove, rename, import/export JSON+CSV (UTF-8 BOM), delete.
- **Auth `/auth`**: centered card, logo, segmented login/register, proper field
  errors, password visibility toggle, ban notice state.
- **Settings**: theme (dark/light/system), 8 accent swatches, UI language,
  daily goal stepper, pinyin/translation display toggles — all instant-apply.
- **Profile**: avatar initial, name edit, password change, badges (role/premium),
  danger zone: delete account (typed confirmation modal).
- **More**: account hub rows + feedback modal + about/privacy/terms + version.
- **Admin `/admin`**: left subnav (Overview, Users, Feedback, Audit);
  Overview: StatCards + signups/reviews charts; Users: search + filters +
  paginated table, row → drawer (details, role/premium/ban controls with
  confirmations); Feedback: inbox w/ status toggle; Audit: table. Desktop-first,
  fully i18n'd.
- **Docs pages `/privacy` `/terms` `/about`**: clean prose template.

## 4. Rules

1. Every Chinese string in UI: `<span className="hanzi" lang="zh">`.
2. Every page sets `<Head><title>… · 好好学习</title></Head>`.
3. No native `alert/confirm/prompt` — use Modal/Toast.
4. Loading, empty, and error states for every data view.
5. All strings through `t('key', 'English default')`.
6. No inline styles except dynamic values (chart bar heights etc.).
7. Per-page SCSS partial `styles/pages/_<page>.scss`, BEM-ish, tokens only —
   no raw hex except in `_tokens.scss`.
