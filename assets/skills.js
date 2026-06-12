/* skills.js -- client-side filtering for the generated skills catalog.
   Zero-runtime model (same as search.js): the page is fully server-rendered
   and readable without JS; this script only adds live narrowing. */
(function () {
  'use strict';
  var input = document.getElementById('skill-filter');
  if (!input) return;

  var chips = Array.prototype.slice.call(document.querySelectorAll('.catalog-chips .chip'));
  var cards = Array.prototype.slice.call(document.querySelectorAll('.skill-card'));
  var groups = Array.prototype.slice.call(document.querySelectorAll('.catalog-group'));
  var empty = document.getElementById('catalog-empty');
  var activeCat = '*';

  function apply() {
    var q = input.value.trim().toLowerCase();
    var visible = 0;
    cards.forEach(function (card) {
      var okCat = activeCat === '*' || card.getAttribute('data-cat') === activeCat;
      var okText = !q || card.getAttribute('data-text').indexOf(q) !== -1;
      var show = okCat && okText;
      card.hidden = !show;
      if (show) visible++;
    });
    groups.forEach(function (g) {
      var any = g.querySelector('.skill-card:not([hidden])');
      g.hidden = !any;
    });
    if (empty) empty.hidden = visible !== 0;
  }

  input.addEventListener('input', apply);
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      activeCat = chip.getAttribute('data-cat');
      chips.forEach(function (c) { c.classList.toggle('is-on', c === chip); });
      apply();
    });
  });
})();
