/* nav.js -- sidebar tree collapse/expand, mobile sidebar toggle, and in-page TOC
   scroll-spy. Vanilla, no framework. The active page is already marked at render
   time (.is-active); this adds the interactive behaviors. */
(function () {
  // --- collapsible nav-tree sections ---
  function wireTree() {
    var toggles = document.querySelectorAll('.nav-tree__toggle');
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].addEventListener('click', function () {
        var section = this.closest('.nav-tree__section');
        var open = section.classList.toggle('is-open');
        this.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
  }

  // --- mobile sidebar drawer ---
  function wireMobile() {
    var btn = document.querySelector('.topbar__menu');
    var sidebar = document.getElementById('sidebar');
    if (!btn || !sidebar) return;
    btn.addEventListener('click', function () {
      var open = sidebar.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    // close the drawer when a nav link is followed (mobile)
    sidebar.addEventListener('click', function (e) {
      if (e.target.classList.contains('nav-tree__link')) {
        sidebar.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // --- in-page TOC scroll-spy: highlight the current section ---
  function wireScrollSpy() {
    var links = document.querySelectorAll('.toc__list a');
    if (!links.length) return;
    var map = {};
    var targets = [];
    for (var i = 0; i < links.length; i++) {
      var id = links[i].getAttribute('href').slice(1);
      var el = document.getElementById(id);
      if (el) { map[id] = links[i]; targets.push(el); }
    }
    if (!('IntersectionObserver' in window) || !targets.length) return;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          for (var k in map) map[k].classList.remove('is-current');
          var a = map[entry.target.id];
          if (a) a.classList.add('is-current');
        }
      });
    }, { rootMargin: '0px 0px -70% 0px', threshold: 0 });
    targets.forEach(function (t) { obs.observe(t); });
  }

  function init() { wireTree(); wireMobile(); wireScrollSpy(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
