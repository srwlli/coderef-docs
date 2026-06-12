/* theme.js -- dark/light toggle, persisted in localStorage, prefers-color-scheme
   default. The no-flash init (setting the class before first paint) is inlined in
   each page's <head>; this file wires the toggle button. Vanilla, no framework.
   Ported from the PS-HTML site; storage key is 'cr-theme'. */
(function () {
  function current() {
    var c = localStorage.getItem('cr-theme');
    if (c === 'dark' || c === 'light') return c;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function apply(mode) {
    var el = document.documentElement;
    el.classList.remove('dark', 'light');
    el.classList.add(mode);
  }
  function wire() {
    var btn = document.querySelector('.theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      localStorage.setItem('cr-theme', next);
      apply(next);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
})();
