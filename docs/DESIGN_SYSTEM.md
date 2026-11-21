# Visual, interaction and accessibility system

## Product direction

The approved direction is a warm, restrained editorial personal library. Use the Novel Library as the current visual reference for shared chrome, hierarchy and interaction patterns. Manga-specific image reading and domain controls remain Manga-owned.

Do not revert to the early navy/teal scaffold palette or approximate already-approved components from memory. Inspect current Manga source and, for parity work, the corresponding current Novel source.

## Brand and shared chrome

- Product name: Taiyou's Manga Library.
- Use the approved transparent Taiyou Sun mark, theme-aware favicon and PWA icons.
- Full-width two-row header; no persistent sidebar.
- The cloud status control is immediately after the brand wordmark, with a green/red status dot. The icon and dot are a real interactive connection control, not decoration.
- Search, theme swatches and utility controls retain their approved positions and accessible names.
- Six visible primary shelves: Home, Currently Reading, Trying Out, Available Offline, Finished, All Manga. Analytics is inside Master Controls; legacy To Be Read state is preserved without a primary tab.
- Centred footer: © [year] Taiyou's Manga Library · Created by Taiyou.

## Themes and colour

Six persisted themes:
1. Sepia (default)
2. Paper
3. Charcoal
4. Midnight
5. Ocean
6. Plum

Use the existing semantic CSS variables and theme classes in src/styles.css. Do not hard-code one theme's surface/text colour into a component that should adapt across all six. Maintain legible contrast for muted text, ribbons, disabled states, focus rings and interactive controls. Opening the theme picker must not change the selected theme.

## Home and covers

- Editorial hero uses three distinct manga covers.
- The centre cover is selected initially.
- Hover/focus on another cover updates the featured title, creator, synopsis and actions.
- Keep all covers contained in their intended portrait frames; never allow object-fit/transform styling to crop or escape the frame unexpectedly.
- Verify full desktop, split-screen and narrow phone layouts.
- Cover images should remain legible at a useful scale; do not enlarge artwork until only a small part of the cover is visible.

## Details and reader

Use Novel's approved details header/card hierarchy, real Lucide SVG paths, section spacing, scrollable synopsis, chapter-list icons and return-to-top behaviour. Keep manga-specific publication ribbons, chapter ordering and image reader.

The reader displays the entire chapter in one continuous vertical flow. Previous/Next controls navigate chapters only. Preserve image aspect ratio and bounded decoding. Do not port Novel's EPUB page controls.

Publication ribbons are separate from personal reading shelf state. Do not label a manga Finished solely because its publication is complete.

## Master and analytics

Use the Novel Settings2 control and the full-width Master tab layout. Analytics is password-free; owner source corrections remain protected.

The Analytics landing view follows the Novel composition:
- Active app time, Reading time, Offline app time and Today metrics.
- Paired active-app and reading bars over the last 14 days.
- A dynamic date label every three days, including today.
- Most read manga list.
- Compact device-only privacy controls.
- Manga-specific catalogue and journal insights remain available under a collapsed More manga insights disclosure.

## Notifications and feedback

Use the accessible top-right stacked notification treatment, with matching colours and automatic dismissal. The current toast lifetime is 4.5 seconds and stale notices are cleared on navigation. No browser-native alert/confirm dialogs. Every action needs a real result, success/error feedback and a keyboard-operable control.

## Responsive and accessibility requirements

Test at 320, 375, 390, 740, 768, 900 and 1280 px as appropriate. Use 320/390/768/1280 as the minimum acceptance set. Check split-screen and landscape layouts, safe areas, no horizontal overflow, readable cover titles, dialogs, menus and chapter controls.

Use semantic landmarks, labelled form controls, visible keyboard focus, correct focus order, accessible status messages, reduced-motion support and text alternatives for meaningful cover images. Colour alone must not convey connected/disconnected or publication state. Do not claim WCAG compliance without an actual audit.

## Performance

Lazy-load off-screen covers, deduplicate image requests, use the bounded private cover cache, limit page request concurrency and decoded image count, and keep Master code lazy-loaded. Measure bundle/network impact. Preserve scripts/check-bundle.mjs budgets unless measured evidence supports a narrowly justified adjustment.
