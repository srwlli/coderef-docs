/* search.js -- client-side search over the prebuilt index (assets/search-index.json).
   Zero runtime: the index is a static JSON built by render.mjs at build time; this
   does a simple substring/scored match in the browser. Ctrl/Cmd+K focuses the box.
   Phase 1 covers the ASSISTANT entry section; Phase 3 (SKILLS-SEARCH) widens the
   index across all content -- the same mechanism, more entries. Vanilla, no framework. */
(function () {
  var box = document.getElementById('docs-search');
  var panel = document.getElementById('docs-search-results');
  if (!box || !panel) return;

  var index = null;
  var loading = false;

  function loadIndex(cb) {
    if (index) { cb(index); return; }
    if (loading) return;
    loading = true;
    fetch('assets/search-index.json')
      .then(function (r) { return r.json(); })
      .then(function (data) { index = data; loading = false; cb(index); })
      .catch(function () { loading = false; });
  }

  // Score a page against the query: title hit > heading hit > summary hit.
  function search(q) {
    q = q.trim().toLowerCase();
    if (!q || !index) return [];
    var results = [];
    index.forEach(function (page) {
      var score = 0;
      var hitHeading = null;
      if (page.title.toLowerCase().indexOf(q) !== -1) score += 10;
      if ((page.summary || '').toLowerCase().indexOf(q) !== -1) score += 3;
      (page.headings || []).forEach(function (h) {
        if (h.text.toLowerCase().indexOf(q) !== -1) { score += 5; if (!hitHeading) hitHeading = h; }
      });
      if (score > 0) results.push({ page: page, score: score, heading: hitHeading });
    });
    results.sort(function (a, b) { return b.score - a.score; });
    return results.slice(0, 8);
  }

  function render(results, q) {
    if (!q.trim()) { panel.hidden = true; panel.innerHTML = ''; return; }
    if (!results.length) {
      panel.innerHTML = '<div class="search-results__empty">No matches for &ldquo;' +
        escapeHtml(q) + '&rdquo;</div>';
      panel.hidden = false;
      return;
    }
    panel.innerHTML = results.map(function (r) {
      var url = r.page.url + (r.heading ? '#' + r.heading.id : '');
      var sub = r.heading ? r.heading.text : (r.page.summary || '');
      return '<a class="search-results__item" href="' + escapeHtml(url) + '">' +
        '<span class="search-results__section">' + escapeHtml(r.page.section) + '</span>' +
        '<span class="search-results__title">' + escapeHtml(r.page.title) + '</span>' +
        '<span class="search-results__sub">' + escapeHtml(sub) + '</span>' +
        '</a>';
    }).join('');
    panel.hidden = false;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function onInput() {
    var q = box.value;
    loadIndex(function () { render(search(q), q); });
  }

  box.addEventListener('input', onInput);
  box.addEventListener('focus', function () { loadIndex(function () {}); });
  box.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { box.blur(); panel.hidden = true; }
  });
  // dismiss the panel on outside click
  document.addEventListener('click', function (e) {
    if (!panel.contains(e.target) && e.target !== box) panel.hidden = true;
  });
  // Ctrl/Cmd+K focuses the search box
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      box.focus();
      box.select();
    }
  });
})();
