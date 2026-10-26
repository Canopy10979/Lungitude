# Rendering and CSP review

All HTML sinks were inspected. Survey names, labels, errors, external text and clinic fields use `esc()` or `textContent`; external website schemes are restricted to HTTP(S). Research feature and follow-up responses escape text and numeric-looking API fields. Fixed markup and arithmetic-only canvas/SVG coordinates do not need HTML escaping. Doctor-note table cells are escaped. Page scripts and large styles were extracted from HTML.

`script-src` no longer allows `unsafe-inline`. `style-src` retains it because result charts and movable research-camera overlays generate inline style attributes and CSS properties. Removing that allowance without replacing those mechanisms would break existing behavior. No inline event-handler attributes are used. CSP is defense in depth, not a replacement for escaping.

The main interface has no CDN dependencies. No server credentials are bundled in the PWA allowlist. Only explicit public interface assets are cached; API requests are never intercepted for caching. Browser installation does not make PHP endpoints available offline.
