// Apply a forced Light/Dark theme, pure black and the accent colour before first paint
// (see src/lib/theme.ts and src/lib/accent.ts). A plain blocking script in <head>, loaded as a
// file rather than inline so the Content Security Policy doesn't need to allow inline scripts.
try {
  var root = document.documentElement;
  var t = localStorage.getItem("cubeTimer.theme");
  if (t === "light" || t === "dark") root.setAttribute("data-theme", t);
  if (localStorage.getItem("cubeTimer.black") === "1") root.setAttribute("data-black", "");
  var a = (localStorage.getItem("cubeTimer.accentVars") || "").split(" ");
  if (a.length === 2) { root.style.setProperty("--accent-l", a[0]); root.style.setProperty("--accent-d", a[1]); }
} catch (e) {}
