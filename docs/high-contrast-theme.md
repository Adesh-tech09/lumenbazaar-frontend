# High-contrast theme

A token-based high-contrast theme is available from the header theme selector
and is persisted in local storage.

## Selection behavior

- **Match system contrast** (default) follows `prefers-contrast: more` and
  updates when the operating-system preference changes.
- **Default contrast** forces the standard palette.
- **High contrast** forces the high-contrast palette until changed.

The resolved theme is applied as `data-theme="light|high-contrast"` on the
document root.

## Tokens and contrast targets

High-contrast values are declared in `src/app/globals.css`:

| Token                       | Value     | Contrast on `#000` |
| --------------------------- | --------- | ------------------ |
| `--foreground`              | `#ffffff` | 21:1               |
| `--border`                  | `#ffffff` | 21:1               |
| `--brand` / `--accent` link | `#7dd3fc` | ~12:1              |
| `--warning`                 | `#fde68a` | ~17:1              |
| `--danger`                  | `#fca5a5` | ~10:1              |
| `--data-viz-positive`       | `#a7f3d0` | ~16:1              |
| `--data-viz-negative`       | `#fecaca` | ~13:1              |
| `--data-viz-neutral`        | `#e5e7eb` | ~16:1              |

Shared surfaces (cards, page shell, badges, notices) and data-visualisation
elements consume the same tokens, so critical routes keep strong separation in
both desktop and mobile layouts. Focus outlines use a 3 px `--focus-ring` outline
with a 2 px offset.
