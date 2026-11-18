# Visual, Interaction and Accessibility Guidelines

## North star
A polished, warm editorial personal library. Prefer restrained surfaces, strong media cover art, generous spacing and consistent hierarchy over dashboards filled with controls. The existing Novel Library is inspiration only; do not copy its full implementation wholesale.

## Starter tokens
Current `src/styles.css` uses a dark navy surface (#101b2b), deeper panels (#192b40), light text and muted gold (#d7ba80). These are **starter tokens**, not a final universal theme API. Future themes (sepia, light, dark, plum) require semantic CSS variables, contrast checks and explicit owner approval.

## Layout and responsiveness
Build mobile first: 320px, 375px, 390px phones; 768px tablet; 1280/1440/1920 desktop. Maintain touch targets of about 44 CSS pixels where practical. Avoid horizontal scrolling, fixed-width modal overflow, clipped tooltips, cramped shelf layouts and controls stacked beside long titles. Preserve aspect ratios of legitimate covers. Use scrollable dialogs with a visible Close action and escape/focus management.

## Behaviour
A visible control must perform the stated action. Do not render inactive search, settings, import, sync or playback buttons. Empty state must explicitly say no data is connected. Explain ratings 1–10 with the existing novel scale when adopted; don't assume zero means unrated.

## Accessibility
Semantic landmarks, labelled inputs, consistent focus rings, keyboard navigation, reduced-motion support, readable high-contrast text, aria-current for the sole selected navigation item, and meaningful text alternatives for covers. Do not depend on colour alone for connected/disconnected state.

## Domain notes
Panel and page ordering, right-to-left versus left-to-right reading, vertical scrolling, chapter/volume structure, image dimensions, page preload limits and full-screen touch navigation.

## Performance
Use responsive images, lazy decoding, bounded preloading and virtualised large lists. Avoid shipping unnecessary media assets in the frontend bundle. Measure improvements instead of guessing. Never introduce client-side code that repeatedly fetches private data on every keystroke or navigation event.
