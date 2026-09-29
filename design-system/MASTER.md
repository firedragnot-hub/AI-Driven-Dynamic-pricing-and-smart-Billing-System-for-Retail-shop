# TEGL Smart Retail — Master Design System (MASTER.md)

## 1. Product Positioning & Design Philosophy
**TEGL Retail Solutions** is an Enterprise Smart Retail Operating System combining Point-of-Sale billing, real-time inventory synchronization, AI demand forecasting, dynamic pricing optimization, and automated GST/Financial compliance.

### Brand Core Tenets:
- **Fast & Precise**: Zero latency for cashiers; high information throughput with zero cognitive friction.
- **Enterprise Credibility**: High-contrast, clean typography, disciplined slate neutrals, and a refined amber-gold brand identity.
- **Action-Oriented AI**: Every AI prediction provides *What?*, *Why?*, and *What should I do?*.
- **Accessible & Robust**: Keyboard-friendly, WCAG AA compliant contrast ratios, tabular numbers for currency and data, and seamless mobile responsiveness.

---

## 2. Design Tokens & Palette

### Semantic Color System
| Token | Hex Value | Purpose |
| :--- | :--- | :--- |
| `--brand-primary` | `#d97706` (Amber 600) | Primary brand accent & main CTA |
| `--brand-primary-hover` | `#b45309` (Amber 700) | Interactive hover state |
| `--brand-primary-light` | `#fef3c7` (Amber 100) | Subtle tinted background |
| `--brand-primary-dark` | `#92400e` (Amber 800) | Deep accent & active state |
| `--brand-secondary` | `#0f172a` (Slate 900) | Sidebar background & bold headers |
| `--brand-accent` | `#3b82f6` (Blue 500) | Secondary data visualization & links |
| `--bg-canvas` | `#f8fafc` (Slate 50) | Main application background |
| `--bg-surface` | `#ffffff` | Elevated cards, tables, and modal sheets |
| `--bg-surface-subtle` | `#f1f5f9` (Slate 100) | Table headers, secondary toolbars |
| `--border-subtle` | `#e2e8f0` (Slate 200) | Card borders, dividers, row rules |
| `--border-strong` | `#cbd5e1` (Slate 300) | Input fields, active toggles |
| `--text-primary` | `#0f172a` (Slate 900) | Primary headlines, main data figures |
| `--text-secondary` | `#475569` (Slate 600) | Descriptive body text, table cells |
| `--text-muted` | `#94a3b8` (Slate 400) | Captions, timestamps, disabled items |
| `--status-success` | `#059669` (Emerald 600)| Completed orders, positive margins |
| `--status-warning` | `#d97706` (Amber 600) | Low stock warnings, pending verification |
| `--status-error` | `#e11d48` (Rose 600) | Stockouts, filing errors, failed syncs |
| `--status-info` | `#2563eb` (Blue 600) | Info notifications, system status |

---

## 3. Typography Hierarchy
- **Display & Headings**: `Plus Jakarta Sans`, system-ui, sans-serif
- **Body & Controls**: `Inter`, system-ui, sans-serif
- **Financial & Data Numbers**: `Inter`, `font-variant-numeric: tabular-nums`

| Level | Size | Weight | Line Height | Application |
| :--- | :--- | :--- | :--- | :--- |
| **Display** | 2.25rem (36px) | 800 | 1.2 | Hero banners, high-impact totals |
| **H1** | 1.75rem (28px) | 700 | 1.25 | Page titles, major section headers |
| **H2** | 1.35rem (21.6px)| 700 | 1.3 | Card titles, dashboard module headers|
| **H3** | 1.1rem (17.6px) | 600 | 1.35 | Modal headers, sub-section titles |
| **H4** | 0.95rem (15.2px)| 600 | 1.4 | Stat card labels, table section headers|
| **Body Large** | 1.0rem (16px) | 500 | 1.5 | Form fields, primary descriptions |
| **Body** | 0.875rem (14px)| 400 / 500 | 1.5 | Standard table data, paragraphs |
| **Body Small** | 0.75rem (12px) | 500 / 600 | 1.4 | Badges, metadata, secondary timestamps|
| **Label / Caption**| 0.7rem (11.2px) | 700 | 1.3 | All-caps field tags, mini badges |

---

## 4. Spacing & Elevation System
- **Spacing Scale**: `4px` (xs), `8px` (sm), `12px` (md), `16px` (lg), `24px` (xl), `32px` (2xl), `48px` (3xl)
- **Radii**: 
  - `sm`: `6px` (Badges, tags, mini buttons)
  - `md`: `10px` (Inputs, buttons, dropdowns)
  - `lg`: `14px` (Cards, panels, modal dialogs)
  - `xl`: `20px` (Feature banners, main shell containers)
  - `full`: `9999px` (Pill badges, avatars)
- **Elevation (Subtle Enterprise Depth)**:
  - `shadow-xs`: `0 1px 2px 0 rgba(15, 23, 42, 0.05)`
  - `shadow-sm`: `0 2px 4px -1px rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04)`
  - `shadow-md`: `0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -2px rgba(15, 23, 42, 0.04)`
  - `shadow-lg`: `0 12px 28px -4px rgba(15, 23, 42, 0.12), 0 4px 12px -2px rgba(15, 23, 42, 0.06)`
  - `shadow-glow`: `0 0 16px rgba(217, 119, 6, 0.2)`

---

## 5. Component Standards
- **Buttons**:
  - `btn-primary`: Solid Amber (`#d97706`), white text, bold font, subtle lift on hover.
  - `btn-secondary`: Crisp Slate border (`#e2e8f0`), `#ffffff` surface, `#0f172a` text.
  - `btn-ghost`: Transparent background, hover background `#f1f5f9`.
  - `btn-danger`: Solid Rose (`#e11d48`) or soft Rose tint with red text for destructive confirmations.
- **Form Controls**:
  - Standardized height: `40px` (compact) to `44px` (regular).
  - Clear label above input, optional helper text below.
  - Interactive focus state: `box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.18); border-color: #d97706;`.
- **Badges & Status**:
  - Always pair icon with text (e.g., `<CheckCircle size={12} /> Paid`).
  - Subtle tinted backgrounds with matching border and high-contrast text.
- **Empty States**:
  - Clear visual illustration/icon, descriptive title, instructional guidance, and a prominent call-to-action button.
