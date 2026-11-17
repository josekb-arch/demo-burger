# All Star Burgers — demo replica

Scroll-driven demo (not a real restaurant site): the burger comes apart on scroll, the side items fly in, and the GAME DAY COMBO box opens with real 3D food (burger, loose fries, two dips and an Oreo shake built from geometry with PBR materials, light and shadows), then the lid closes, followed by THE LINEUP, the sides and the closing section.

Stack: Three.js r170 (tree-shaken bundle in `vendor/three-app.js`, built from `src/` with `./build.sh`) + GSAP ScrollTrigger + Lenis, all vendored. The 3D loads on the first interaction (the hero shows the same burger photo until then). `prefers-reduced-motion` (or no WebGL) gets a static, readable page.
