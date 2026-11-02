/* Mi bitácora 2026 — cuaderno virtual
 * Usa StPageFlip (assets/vendor/page-flip.browser.js) para el paso de hojas realista.
 */
(function () {
  'use strict';

  /* ---------- Configuración ---------- */
  // La página 1 del PDF es la tapa; las hojas del cuaderno son las páginas 2 a 10.
  var TOTAL_SHEETS = 9; // cantidad de hojas (sin contar la tapa)
  var RATIO = 1600 / 2263; // ancho / alto de cada hoja (A4)
  var STORAGE_KEY = 'mi-bitacora-2026:leido';

  var pad = function (n) { return String(n).padStart(2, '0'); };
  // n = número de hoja (1..TOTAL_SHEETS) → página n + 1 del PDF
  var sheetSrc = function (n) { return 'assets/paginas/pagina-' + pad(n + 1) + '.webp'; };
  var thumbSrc = function (n) { return 'assets/miniaturas/pagina-' + pad(n + 1) + '.webp'; };

  var $ = function (s) { return document.querySelector(s); };
  var body = document.body;
  var bookEl = $('#book');
  var turnEl = $('#turn');
  var stageEl = $('#stage');
  var hintEl = $('#hint');
  var btnPrev = $('#btn-prev');
  var btnNext = $('#btn-next');
  var btnIndex = $('#btn-index');
  var btnZoom = $('#btn-zoom');
  var coverHit = $('#cover-hit');
  var headerSub = $('.header__subtitle');

  /* ---------- Insertar las hojas ---------- */
  var backCover = bookEl.querySelector('.page--back');
  for (var i = 1; i <= TOTAL_SHEETS; i++) {
    var page = document.createElement('div');
    page.className = 'page page--sheet';
    page.dataset.density = 'soft';
    page.dataset.sheet = i;
    page.innerHTML = '<div class="sheet"><img src="' + sheetSrc(i) + '" alt="Hoja ' + i + ' del cuaderno" decoding="async" draggable="false"></div>';
    bookEl.insertBefore(page, backCover);
  }
  // Doble hoja: 0 tapa · 1 interior de tapa · 2..10 hojas · 11 contratapa (cantidad par, como pide StPageFlip)
  // Una hoja (celular): se quita el interior de tapa → 0 tapa · 1..9 hojas · 10 contratapa
  var allPages = Array.prototype.slice.call(bookEl.querySelectorAll('.page'));
  var loadedPortrait = false;
  function pagesFor(p) { return p ? allPages.filter(function (el) { return !el.classList.contains('page--inner'); }) : allPages; }
  function lastIndex() { return loadedPortrait ? TOTAL_SHEETS + 1 : TOTAL_SHEETS + 2; }
  function sheetToIndex(n) { return loadedPortrait ? n : n + 1; }

  /* ---------- Tamaño del libro (que entre en pantalla) ---------- */
  var portrait = false;
  var pageFlip;
  var SIDE = 310; // ancho de la columna del título cuando va al costado del libro
  function layout() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var gutter = vw < 640 ? 10 : 24;
    var availW = vw - gutter * 2;
    // 1) Título arriba
    body.classList.remove('side');
    var hintH = hintEl.offsetHeight + 12;
    var topH = Math.max(200, stageEl.getBoundingClientRect().height - hintH - 20);
    var pwLandscape = Math.min(availW / 2, topH * RATIO);
    var pwPortrait = Math.min(availW, topH * RATIO);
    // Una sola hoja en celulares o cuando así la hoja se ve bastante más grande (tablets verticales)
    portrait = vw < 640 || pwPortrait > pwLandscape * 1.25;
    var pw = portrait ? pwPortrait : pwLandscape;
    // 2) Título al costado: en pantallas anchas el libro aprovecha todo el alto
    var side = false;
    if (!portrait) {
      var pwSide = Math.min((availW - SIDE) / 2, (vh - hintH - 36) * RATIO);
      if (pwSide > pw * 1.05) { side = true; pw = pwSide; }
    }
    body.classList.toggle('side', side);
    pw = Math.floor(pw);
    var ph = Math.floor(pw / RATIO);
    var w = portrait ? pw : pw * 2;
    turnEl.style.width = w + 'px';
    turnEl.style.height = ph + 'px';
    bookEl.style.width = w + 'px';
    bookEl.style.height = ph + 'px';
    document.documentElement.style.setProperty('--pw', pw + 'px');
    body.classList.toggle('portrait', portrait);
    // StPageFlip decide la orientación con "ancho < minWidth * 2": con minWidth = ancho de hoja
    // queda en una hoja cuando el bloque mide pw y en doble hoja cuando mide 2·pw.
    if (typeof pageFlip !== 'undefined') pageFlip.getSettings().minWidth = pw;
    bookEl.style.minWidth = '0';
    bookEl.style.minHeight = '0';
  }
  layout();

  /* ---------- Libro ---------- */
  pageFlip = new St.PageFlip(bookEl, {
    width: 1600,
    height: 2263,
    size: 'stretch',
    minWidth: 280,
    maxWidth: 3000,
    minHeight: 200,
    maxHeight: 5000,
    autoSize: false,
    showCover: true,
    usePortrait: true,
    drawShadow: true,
    maxShadowOpacity: 0.55,
    flippingTime: 900,
    mobileScrollSupport: false,
    showPageCorners: true,
    disableFlipByClick: true
  });
  loadedPortrait = portrait;
  pageFlip.loadFromHTML(pagesFor(portrait));
  window.bitacora = pageFlip; // útil para depurar desde la consola
  layout();
  pageFlip.update();

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var prevState = state;
      var sheet = currentSheet();
      layout();
      if (portrait !== loadedPortrait) {
        loadedPortrait = portrait;
        pageFlip.updateFromHtml(pagesFor(portrait));
        pageFlip.update();
        pageFlip.turnToPage(prevState === 'front' ? 0 : prevState === 'back' ? lastIndex() : sheetToIndex(sheet));
        sync();
      }
      pageFlip.update();
      cacheCoverRects();
    }, 60);
  });

  /* ---------- Textos que viajan de la tapa al título ---------- */
  var FLY_KEYS = ['subject', 'course', 'student'];
  var flown = false;
  var coverRects = null;

  function coverItem(k) { return bookEl.querySelector('.cover [data-fly="' + k + '"]'); }
  function headerItem(k) { return headerSub.querySelector('[data-fly="' + k + '"]'); }

  function cacheCoverRects() {
    if (state !== 'front') return;
    coverRects = {};
    FLY_KEYS.forEach(function (k) { coverRects[k] = coverItem(k).getBoundingClientRect(); });
  }

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // dir = 'out' (salen de la tapa y van al título) o 'in' (vuelven a la tapa)
  function fly(dir) {
    var toHeader = dir === 'out';
    if (toHeader === flown) return;
    flown = toHeader;
    if (!coverRects) cacheCoverRects();
    headerSub.classList.add('is-on');
    var anims = FLY_KEYS.map(function (k, idx) {
      var hEl = headerItem(k);
      hEl.classList.remove('is-hidden');
      var hRect = hEl.getBoundingClientRect();
      hEl.classList.add('is-hidden');
      var cRect = (coverRects && coverRects[k]) || coverItem(k).getBoundingClientRect();
      var clone = hEl.cloneNode(true);
      clone.removeAttribute('data-fly');
      clone.classList.remove('is-hidden');
      clone.classList.add('fly-clone');
      clone.style.left = hRect.left + 'px';
      clone.style.top = hRect.top + 'px';
      clone.style.width = hRect.width + 'px';
      document.body.appendChild(clone);
      var s = cRect.width / Math.max(1, hRect.width);
      var atCover = { transform: 'translate(' + (cRect.left - hRect.left) + 'px, ' + (cRect.top - hRect.top) + 'px) scale(' + s + ')', opacity: 0 };
      var atHeader = { transform: 'translate(0px, 0px) scale(1)', opacity: 1 };
      var a = clone.animate(toHeader ? [atCover, atHeader] : [atHeader, atCover], {
        duration: reduceMotion ? 1 : 1000,
        delay: reduceMotion ? 0 : idx * 110,
        easing: 'cubic-bezier(.65,0,.3,1)',
        fill: 'forwards'
      });
      return a.finished.then(function () {
        if (flown && toHeader) hEl.classList.remove('is-hidden');
        clone.remove();
      });
    });
    Promise.all(anims).then(function () {
      if (flown !== toHeader) return;
      FLY_KEYS.forEach(function (k) { headerItem(k).classList.toggle('is-hidden', !flown); });
      if (!flown) headerSub.classList.remove('is-on');
    });
  }

  /* ---------- Estados: front (tapa) · open · back (contratapa) ---------- */
  var state = 'front';
  var unlocked = false;
  try { unlocked = localStorage.getItem(STORAGE_KEY) === '1'; } catch (e) {}

  function setState(next) {
    state = next;
    body.classList.toggle('is-closed', next === 'front');
    body.classList.toggle('is-open', next === 'open');
    body.classList.toggle('is-back', next === 'back');
    coverHit.setAttribute('aria-label', next === 'back' ? 'Volver a la tapa' : 'Abrir el cuaderno');
    btnZoom.hidden = next !== 'open';
    renderHint();
  }

  function renderHint() {
    if (state === 'front') {
      hintEl.textContent = 'Tocá la tapa para abrir el cuaderno';
    } else if (state === 'back') {
      hintEl.innerHTML = '<span>Fin del cuaderno · tocá la contratapa para volver a la tapa</span>';
    } else {
      hintEl.textContent = '';
    }
  }

  function unlockIndex() {
    if (!unlocked) {
      unlocked = true;
      try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
    }
    btnIndex.hidden = false;
  }
  if (unlocked) btnIndex.hidden = false;

  var backTimer = null;
  function sync() {
    var idx = pageFlip.getCurrentPageIndex();
    clearTimeout(backTimer);
    if (idx === 0) {
      setState('front');
      fly('in');
      requestAnimationFrame(cacheCoverRects);
    } else if (idx >= lastIndex()) {
      setState('back');
      unlockIndex();
      // Después de ver la contratapa, el cuaderno vuelve solo a la tapa
      backTimer = setTimeout(returnToCover, 3500);
    } else {
      setState('open');
      fly('out');
    }
  }

  pageFlip.on('flip', sync);
  pageFlip.on('changeOrientation', function () { cacheCoverRects(); });
  pageFlip.on('changeState', function (e) {
    // Empieza a abrirse desde la tapa: los textos viajan mientras gira
    if ((e.data === 'flipping' || e.data === 'user_fold') && state === 'front' && !flown) {
      fly('out');
    }
  });
  // Si el usuario suelta la tapa sin abrirla, los textos vuelven
  pageFlip.on('changeState', function (e) {
    if (e.data === 'read' && pageFlip.getCurrentPageIndex() === 0 && flown) fly('in');
  });

  function fadeJump(index, after) {
    turnEl.classList.add('is-fading');
    setTimeout(function () {
      pageFlip.turnToPage(index);
      sync();
      turnEl.classList.remove('is-fading');
      if (after) after();
    }, reduceMotion ? 0 : 300);
  }

  function returnToCover() {
    clearTimeout(backTimer);
    if (state !== 'back') return;
    fadeJump(0);
  }

  /* ---------- Controles ---------- */
  btnNext.addEventListener('click', function () { pageFlip.flipNext('bottom'); });
  btnPrev.addEventListener('click', goPrev);
  // En modo una hoja, flipPrev de StPageFlip apunta fuera de las "esquinas" y se ignora
  // si disableFlipByClick está activo: lo desactivamos solo durante esta llamada.
  function goPrev() {
    var st = pageFlip.getSettings();
    var prev = st.disableFlipByClick;
    st.disableFlipByClick = false;
    pageFlip.flipPrev('bottom');
    st.disableFlipByClick = prev;
  }
  coverHit.addEventListener('click', function () {
    if (state === 'front') { fly('out'); pageFlip.flipNext('bottom'); }
    else if (state === 'back') returnToCover();
  });

  // Clic en cualquier parte de la tapa / contratapa (sin tapar las esquinas que se arrastran)
  bookEl.addEventListener('click', function () {
    if (pageFlip.getState() !== 'read') return;
    if (state === 'front') { fly('out'); pageFlip.flipNext('bottom'); }
    else if (state === 'back') returnToCover();
  });

  document.addEventListener('keydown', function (e) {
    if (!viewer.hidden) {
      if (e.key === 'Escape') closeViewer();
      if (e.key === 'ArrowRight') viewerGo(1);
      if (e.key === 'ArrowLeft') viewerGo(-1);
      return;
    }
    if (!panel.hidden) { if (e.key === 'Escape') closePanel(); return; }
    if (e.key === 'ArrowRight') { if (state === 'back') returnToCover(); else pageFlip.flipNext('bottom'); }
    if (e.key === 'ArrowLeft' && state !== 'front') goPrev();
  });

  /* ---------- Índice ---------- */
  var panel = $('#index-panel');
  var grid = $('#index-grid');
  for (var n = 0; n <= TOTAL_SHEETS; n++) {
    var li = document.createElement('li');
    li.innerHTML = '<button type="button" data-sheet="' + n + '"><img src="' + thumbSrc(n) + '" alt="" loading="lazy"><span>' + (n ? 'Hoja ' + n : 'Tapa') + '</span></button>';
    grid.appendChild(li);
  }
  grid.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-sheet]');
    if (!b) return;
    closePanel();
    goToSheet(+b.dataset.sheet);
  });
  function goToSheet(n) {
    if (n === 0) { clearTimeout(backTimer); if (state !== 'front') fadeJump(0); return; }
    var target = sheetToIndex(n);
    var cur = pageFlip.getCurrentPageIndex();
    clearTimeout(backTimer);
    if (state === 'open' && Math.abs(target - cur) <= (loadedPortrait ? 1 : 2)) {
      pageFlip.flip(target, 'bottom');
    } else {
      fadeJump(target);
    }
  }
  var lastFocus = null;
  function openPanel() { lastFocus = document.activeElement; clearTimeout(backTimer); panel.hidden = false; grid.querySelector('button').focus(); }
  function closePanel() { panel.hidden = true; if (lastFocus) lastFocus.focus(); if (state === 'back') backTimer = setTimeout(returnToCover, 3500); }
  btnIndex.addEventListener('click', openPanel);
  panel.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) closePanel(); });

  /* ---------- Visor ampliado (para leer cómodo) ---------- */
  var viewer = $('#viewer');
  var viewerImg = $('#viewer-img');
  var viewerLabel = $('#viewer-label');
  var viewerSheet = 1;
  function currentSheet() {
    var idx = pageFlip.getCurrentPageIndex();
    var n = loadedPortrait ? idx : (idx <= 1 ? 1 : idx - 1);
    return Math.min(TOTAL_SHEETS, Math.max(1, n));
  }
  function showViewer(n) {
    viewerSheet = n;
    viewerImg.src = sheetSrc(n);
    viewerImg.alt = 'Hoja ' + n + ' ampliada';
    viewerLabel.textContent = 'Hoja ' + n + ' de ' + TOTAL_SHEETS;
    $('#viewer-scroll').scrollTop = 0;
    $('#viewer-prev').disabled = n <= 1;
    $('#viewer-next').disabled = n >= TOTAL_SHEETS;
  }
  function viewerGo(d) {
    var n = viewerSheet + d;
    if (n >= 1 && n <= TOTAL_SHEETS) showViewer(n);
  }
  function openViewer(n) { lastFocus = document.activeElement; viewer.hidden = false; showViewer(n || currentSheet()); $('#viewer-close').focus(); }
  function closeViewer() {
    viewer.hidden = true;
    var target = sheetToIndex(viewerSheet);
    var idx = pageFlip.getCurrentPageIndex();
    var visible = loadedPortrait ? [idx] : [idx, idx + 1];
    if (visible.indexOf(target) === -1) { pageFlip.turnToPage(target); sync(); }
    if (lastFocus) lastFocus.focus();
  }
  btnZoom.addEventListener('click', function () { openViewer(); });
  $('#viewer-close').addEventListener('click', closeViewer);
  $('#viewer-prev').addEventListener('click', function () { viewerGo(-1); });
  $('#viewer-next').addEventListener('click', function () { viewerGo(1); });
  // Doble clic sobre una hoja la abre ampliada
  bookEl.addEventListener('dblclick', function (e) {
    var p = e.target.closest('.page--sheet');
    if (p && state === 'open') openViewer(+p.dataset.sheet);
  });

  /* ---------- Inicio ---------- */
  setState('front');
  FLY_KEYS.forEach(function (k) { headerItem(k).classList.add('is-hidden'); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(cacheCoverRects);
  window.addEventListener('load', cacheCoverRects);
  cacheCoverRects();
})();
