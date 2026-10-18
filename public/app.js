/* ASAL by Aash — Frontend */
(function () {
  'use strict';

  var WA_NUMBER = '919445991519';
  var WA_CATALOG = 'https://wa.me/c/919445991519';
  var state = {
    content: {},
    catalog: [],
    isOwner: false,
    adminToken: sessionStorage.getItem('asal_admin_token') || null,
  };

  // ---------- Utilities ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function waOrderUrl(fabric, model) {
    var text = 'Hi ASAL by Aash! I would like to order:\nFabric: ' + fabric + '\nModel: ' + model;
    return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(text);
  }

  var smallNumbers = ['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  var tensNumbers = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function numberToWords(value) {
    if (value < 20) return smallNumbers[value];
    if (value < 100) return tensNumbers[Math.floor(value / 10)] + (value % 10 ? '-' + smallNumbers[value % 10].toLowerCase() : '');
    if (value < 1000) return smallNumbers[Math.floor(value / 100)] + ' hundred' + (value % 100 ? ' ' + numberToWords(value % 100).toLowerCase() : '');
    return String(value);
  }

  function getDeviceId() {
    var id = localStorage.getItem('asal_device_id');
    if (!id) {
      id = 'd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('asal_device_id', id);
    }
    return id;
  }

  // ---------- Content ----------
  function applyContent() {
    var c = state.content;
    document.querySelectorAll('[data-content]').forEach(function (el) {
      var key = el.getAttribute('data-content');
      if (c[key] != null) el.textContent = c[key];
    });
    document.querySelectorAll('[data-content-html]').forEach(function (el) {
      var key = el.getAttribute('data-content-html');
      if (c[key] != null) {
        // Preserve <br> and <em> — escape then restore allowed tags
        var safe = esc(c[key])
          .replace(/\n/g, '<br>')
          .replace(/&lt;em&gt;/g, '<em>').replace(/&lt;\/em&gt;/g, '</em>')
          .replace(/&lt;br&gt;/g, '<br>');
        el.innerHTML = safe;
      }
    });
  }

  // ---------- Steps ----------
  var STEP_ICONS = [
    '<img class="step-illustration" src="/images/step1.webp" alt="Folded floral fabrics" />',
    '<img class="step-illustration" src="/images/step2.webp" alt="Pink kurti on a hanger" />',
    '<img class="step-illustration" src="/images/step3.webp" alt="Phone with measurement chat" />',
    '<img class="step-illustration" src="/images/step4.webp" alt="Sewing machine stitching fabric" />',
  ];
  var ARROW_SVG = '<div class="step-arrow" aria-hidden="true"><svg class="icon" viewBox="0 0 24 24"><path d="M5 12h14M14 7l5 5-5 5"/></svg></div>';

  function renderSteps() {
    var c = state.content;
    var list = document.getElementById('steps-list');
    var html = '';
    for (var i = 1; i <= 4; i++) {
      html += '<article class="step">' +
        '<div class="step-visual"><span class="step-number">' + esc(c['step_' + i + '_number'] || ('0' + i)) + '</span>' +
        STEP_ICONS[i - 1] + '</div>' +
        '<div><strong data-content="step_' + i + '_title">' + esc(c['step_' + i + '_title'] || '') + '</strong>' +
        '<p data-content="step_' + i + '_subtitle">' + esc(c['step_' + i + '_subtitle'] || '') + '</p></div>' +
        '</article>';
      if (i < 4) html += ARROW_SVG;
    }
    list.innerHTML = html;
  }

  // ---------- Trust badges ----------
  var BADGE_ICONS = [
    '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
    '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 4c5 0 9 3 9 8 0 4-3 7-7 7-2 0-4-1-4-3 0-3 3-5 6-5 3 0 6 2 8 5"/></svg>',
    '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M7 4v6M17 4v6M5 14h14M8 11v6M16 11v6M6 20h12"/></svg>',
    '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="m12 3 7 6-7 12L5 9l7-6Z"/><path d="m5 9 14 0M9 9l3 12 3-12M9 9l3-6 3 6"/></svg>',
  ];

  function renderBadges() {
    var c = state.content;
    var wrap = document.getElementById('trust-badges');
    var html = '';
    for (var i = 1; i <= 5; i++) {
      html += '<span class="trust-badge">' + BADGE_ICONS[i - 1] +
        '<span data-content="trust_badge_' + i + '">' + esc(c['trust_badge_' + i] || '') + '</span></span>';
    }
    wrap.innerHTML = html;
  }

  // ---------- FAQ ----------
  function renderFaq() {
    var c = state.content;
    var list = document.getElementById('faq-list');
    var html = '';
    for (var i = 1; i <= 5; i++) {
      var q = c['faq_q' + i], a = c['faq_a' + i];
      if (!q && !a) continue;
      html += '<div class="faq-item"><dt data-content="faq_q' + i + '">' + esc(q || '') + '</dt>' +
        '<dd data-content="faq_a' + i + '">' + esc(a || '') + '</dd></div>';
    }
    list.innerHTML = html;
  }

  // ---------- Catalog ----------
  function slugify(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function renderCatalog() {
    var c = state.content;
    var rows = state.catalog;
    var list = document.getElementById('collection-list');
    var total = rows.length;
    var labelWidth = Math.max(2, String(total).length);

    // Update counts
    var title = document.getElementById('collections-title');
    if (title) title.textContent = numberToWords(total) + ' exclusive ' + (total === 1 ? 'print' : 'prints') + '.';
    var btnLabel = document.getElementById('fabric-count-button-label');
    if (btnLabel) btnLabel.textContent = 'Explore ' + total + ' ' + (total === 1 ? 'fabric' : 'fabrics');

    var html = '';
    rows.forEach(function (row, idx) {
      var countLabel = 'Collection ' + String(idx + 1).padStart(labelWidth, '0') + ' / ' + String(total).padStart(labelWidth, '0');
      var fabricSlug = slugify(row.fabric_name);
      var isOwner = state.isOwner;
      html += '<article class="collection' + (isOwner ? ' owner-collection' : '') + '" id="' + esc(fabricSlug) + '" data-row-id="' + row.id + '">' +
        '<header class="collection-head"><div><span class="collection-count">' + esc(countLabel) + '</span>' +
        '<h3>' + esc(row.fabric_name) + '</h3>' +
        (isOwner ? '<p class="collection-sub">Fabric in stock · style ideas shown</p>' : '') +
        '</div>';
      if (isOwner) {
        html += '<div class="collection-owner-actions">' +
          '<button type="button" class="owner-move-btn" data-move-row="' + row.id + '" data-dir="-1" title="Move up">↑</button>' +
          '<button type="button" class="owner-move-btn" data-move-row="' + row.id + '" data-dir="1" title="Move down">↓</button>' +
          '<button type="button" class="owner-edit-btn" data-edit-row="' + row.id + '">' +
          '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17l-1 3Z"/><path d="m13.5 6.5 3 3"/></svg> Edit</button>' +
          '<button type="button" class="owner-delete-btn" data-delete-row="' + row.id + '">' +
          '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M9 4h6M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg> Delete row</button>' +
          '</div>';
      } else {
        var modelCount = row.model_names.filter(function(m) { return m; }).length;
        html += '<p class="collection-note">1 fabric · ' + modelCount + ' model' + (modelCount === 1 ? '' : 's') + '</p>';
      }
      html += '</header>' +
        '<div class="products">';

      // Fabric card (owner: div, no WhatsApp link)
      var fabricCardOpen = isOwner
        ? '<div class="product product-fabric" data-fabric="' + esc(row.fabric_name) + '">'
        : '<a class="product product-fabric order-link" href="' + esc(waOrderUrl(row.fabric_name, 'Fabric enquiry')) + '"' +
          ' data-fabric="' + esc(row.fabric_name) + '" data-model="Fabric enquiry" target="_blank" rel="noreferrer">';
      var fabricCardClose = isOwner ? '</div>' : '</a>';
      var fabricCta = isOwner
        ? '<span class="manage-label">Manage in Edit</span>'
        : '<span>' + esc(c.fabric_order_button || 'Ask about this fabric') + ' <svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14M14 7l5 5-5 5"/></svg></span>';
      html += fabricCardOpen +
        '<div class="product-photo"><img src="' + esc(row.fabric_image_url) + '" alt="' + esc(row.fabric_name) + ' fabric" loading="lazy" />' +
        '<span class="fabric-label" data-content="fabric_badge">' + esc(c.fabric_badge || 'FABRIC IN STOCK') + '</span></div>' +
        '<div class="product-copy"><strong>' + esc(row.fabric_name) + '</strong>' + fabricCta + '</div>' + fabricCardClose;

      // Model cards
      row.model_names.forEach(function (mname, mi) {
        var mimg = row.model_image_urls[mi];
        var price = row.model_prices[mi];
        if (!mname) return;
        var num = String(mi + 1).padStart(2, '0');
        var modelCta = isOwner
          ? '<span class="manage-label">Manage in Edit</span>'
          : (price ? '<span class="price">₹' + esc(price) + '</span>' : '') +
            '<span>' + esc(c.order_button || 'Order on WhatsApp') + ' <svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14M14 7l5 5-5 5"/></svg></span>';
        if (isOwner) {
          html += '<div class="product" data-fabric="' + esc(row.fabric_name) + '" data-model="' + esc(mname) + '">' +
            '<div class="product-photo">' +
            (mimg ? '<img src="' + esc(mimg) + '" alt="' + esc(mname) + ' in ' + esc(row.fabric_name) + '" loading="lazy" />' : '') +
            '<span class="product-number">' + num + '</span></div>' +
            '<div class="product-copy"><strong>' + esc(mname) + '</strong>' + modelCta + '</div></div>';
        } else {
          html += '<a class="product order-link" href="' + esc(waOrderUrl(row.fabric_name, mname)) + '"' +
            ' data-fabric="' + esc(row.fabric_name) + '" data-model="' + esc(mname) + '" target="_blank" rel="noreferrer">' +
            '<div class="product-photo">' +
            (mimg ? '<img src="' + esc(mimg) + '" alt="' + esc(mname) + ' in ' + esc(row.fabric_name) + '" loading="lazy" />' : '') +
            '<span class="product-number">' + num + '</span></div>' +
            '<div class="product-copy"><strong>' + esc(mname) + '</strong>' + modelCta + '</div></a>';
        }
      });

      html += '</div></article>';
    });
    list.innerHTML = html;
    bindPhotoZoom();
    if (state.isOwner) bindOwnerCatalogActions();
  }

  // ---------- Lightbox with pinch zoom ----------
  function bindPhotoZoom() {
    var lightbox = document.getElementById('photo-lightbox');
    var lightboxImage = lightbox.querySelector('.lightbox-image');
    var lightboxStage = lightbox.querySelector('.lightbox-stage');
    var lightboxName = document.getElementById('lightbox-name');
    var closeButton = lightbox.querySelector('.lightbox-close');
    var zoomState = { scale: 1, x: 0, y: 0 };
    var activePointers = {};
    var dragStart = null;
    var pinchStart = null;

    function clampPan(scale, x, y) {
      var iw = lightboxImage.offsetWidth || 0, ih = lightboxImage.offsetHeight || 0;
      var maxX = Math.max(0, (iw * scale - lightboxStage.clientWidth) / 2);
      var maxY = Math.max(0, (ih * scale - lightboxStage.clientHeight) / 2);
      return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
    }
    function applyZoom(scale, x, y) {
      var ns = Math.max(1, Math.min(4, scale));
      var np = ns === 1 ? { x: 0, y: 0 } : clampPan(ns, x, y);
      zoomState.scale = ns; zoomState.x = np.x; zoomState.y = np.y;
      lightboxImage.style.transform = 'translate3d(' + np.x + 'px,' + np.y + 'px,0) scale(' + ns + ')';
    }
    var lightboxPushed = false;
    var lightboxClosing = false;
    function openLightbox(src, name) {
      lightboxImage.src = src;
      lightboxImage.alt = name || '';
      lightboxName.textContent = name || 'Photo preview';
      applyZoom(1, 0, 0);
      lightbox.setAttribute('aria-hidden', 'false');
      lightbox.classList.add('open');
      document.body.style.overflow = 'hidden';
      try {
        history.pushState({ asalOverlay: 'lightbox' }, 'ASAL Photo');
        lightboxPushed = true;
      } catch (e) { lightboxPushed = false; }
    }
    function closeLightbox() {
      if (!lightbox.classList.contains('open')) return;
      lightbox.setAttribute('aria-hidden', 'true');
      lightbox.classList.remove('open');
      document.body.style.overflow = '';
      lightboxImage.src = '';
      // If user closed via UI (not back button), pop the state we pushed
      if (lightboxPushed && !lightboxClosing) {
        lightboxPushed = false;
        try { history.back(); } catch (e) {}
      }
      lightboxClosing = false;
    }
    // Expose for global back handler
    window.__asalCloseLightbox = function () {
      if (lightbox.classList.contains('open')) {
        lightboxClosing = true;
        lightboxPushed = false; // state already popped by back button
        closeLightbox();
        return true;
      }
      return false;
    };
    window.__asalLightboxClosing = function (v) { lightboxClosing = v; };

    // Photo tap opens zoom only (never WhatsApp) — disabled in owner mode
    if (state.isOwner) return;
    document.querySelectorAll('.product-photo img').forEach(function (img) {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var card = img.closest('.product');
        var name = card ? card.querySelector('strong').textContent : '';
        openLightbox(img.src, name);
      });
    });

    closeButton.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lightbox.classList.contains('open')) closeLightbox();
    });

    // Pinch + pan (touch events for reliable mobile pinch)
    var touchStartDist = 0, touchStartScale = 1;
    var touchDrag = null;
    lightboxStage.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        e.preventDefault();
        var dx = e.touches[0].clientX - e.touches[1].clientX;
        var dy = e.touches[0].clientY - e.touches[1].clientY;
        touchStartDist = Math.max(1, Math.hypot(dx, dy));
        touchStartScale = zoomState.scale;
        touchDrag = null;
      } else if (e.touches.length === 1 && zoomState.scale > 1.01) {
        touchDrag = { x: e.touches[0].clientX - zoomState.x, y: e.touches[0].clientY - zoomState.y };
      }
    }, { passive: false });
    lightboxStage.addEventListener('touchmove', function (e) {
      if (e.touches.length === 2) {
        e.preventDefault();
        var dx = e.touches[0].clientX - e.touches[1].clientX;
        var dy = e.touches[0].clientY - e.touches[1].clientY;
        var dist = Math.max(1, Math.hypot(dx, dy));
        applyZoom(touchStartScale * (dist / touchStartDist), zoomState.x, zoomState.y);
      } else if (e.touches.length === 1 && touchDrag) {
        e.preventDefault();
        applyZoom(zoomState.scale, e.touches[0].clientX - touchDrag.x, e.touches[0].clientY - touchDrag.y);
      }
    }, { passive: false });
    lightboxStage.addEventListener('touchend', function (e) {
      if (e.touches.length < 2) touchStartDist = 0;
      if (e.touches.length === 0) touchDrag = null;
    });
    // Reset zoom on screen rotation / resize so full photo is visible
    var resizeTimer = null;
    function fixLightboxLayout() {
      // Force browser to recalculate stage and image dimensions
      lightboxStage.style.display = 'none';
      void lightboxStage.offsetHeight; // force reflow
      lightboxStage.style.display = '';
      applyZoom(1, 0, 0);
    }
    window.addEventListener('orientationchange', function () {
      if (lightbox.classList.contains('open')) {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(fixLightboxLayout, 400);
      }
    });
    window.addEventListener('resize', function () {
      if (lightbox.classList.contains('open')) {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(fixLightboxLayout, 250);
      }
    });
    // Mouse drag fallback (desktop)
    lightboxStage.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && zoomState.scale > 1.01) {
        dragStart = { x: e.clientX - zoomState.x, y: e.clientY - zoomState.y };
        activePointers[e.pointerId] = true;
      }
    });
    lightboxStage.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'mouse' && activePointers[e.pointerId] && dragStart) {
        applyZoom(zoomState.scale, e.clientX - dragStart.x, e.clientY - dragStart.y);
      }
    });
    lightboxStage.addEventListener('pointerup', function (e) {
      delete activePointers[e.pointerId];
      dragStart = null;
    });
  }

  // ---------- Rating ----------
  function initRating() {
    var starsEl = document.getElementById('stars');
    if (!starsEl) return; // Ratings temporarily hidden
    var resultEl = document.getElementById('rating-result');
    var buttons = starsEl.querySelectorAll('button');
    var rated = localStorage.getItem('asal_rated');

    function paint(n) {
      buttons.forEach(function (b) {
        b.classList.toggle('lit', Number(b.dataset.stars) <= n);
      });
    }

    fetch('/api/rating').then(function (r) { return r.json(); }).then(function (d) {
      if (d.count > 0) {
        resultEl.textContent = d.average.toFixed(1) + ' ★ · ' + d.count + (d.count === 1 ? ' rating' : ' ratings');
        paint(Math.round(d.average));
      }
      if (rated) starsEl.classList.add('rated');
    }).catch(function () {});

    buttons.forEach(function (b) {
      b.addEventListener('mouseenter', function () { if (!rated) paint(Number(b.dataset.stars)); });
      b.addEventListener('click', function () {
        if (rated) return;
        var stars = Number(b.dataset.stars);
        fetch('/api/rating', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stars: stars, deviceId: getDeviceId() }),
        }).then(function (r) {
          if (r.status === 409) {
            resultEl.textContent = 'You have already rated on this device.';
            rated = '1'; localStorage.setItem('asal_rated', '1');
            starsEl.classList.add('rated');
            return null;
          }
          return r.json();
        }).then(function (d) {
          if (!d) return;
          rated = '1'; localStorage.setItem('asal_rated', '1');
          starsEl.classList.add('rated');
          paint(stars);
          resultEl.textContent = 'Thank you! ' + d.average.toFixed(1) + ' ★ · ' + d.count + (d.count === 1 ? ' rating' : ' ratings');
        }).catch(function () {
          resultEl.textContent = 'Could not save your rating. Please try again.';
        });
      });
    });
    starsEl.addEventListener('mouseleave', function () {
      if (!rated) paint(0);
    });
  }

  // ---------- Owner mode ----------
  function isOwnerRequested() {
    return new URLSearchParams(window.location.search).get('owner') === '1';
  }

  function initOwner() {
    var link = document.getElementById('owner-link');
    link.addEventListener('click', function (e) {
      e.preventDefault();
      if (state.adminToken) { enterOwnerMode(); return; }
      document.getElementById('admin-login-modal').hidden = false;
      document.getElementById('admin-password').focus();
    });
    document.getElementById('admin-login-cancel').addEventListener('click', function () {
      document.getElementById('admin-login-modal').hidden = true;
    });
    document.getElementById('admin-login-btn').addEventListener('click', doLogin);
    document.getElementById('admin-password').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doLogin();
    });
    document.getElementById('admin-exit').addEventListener('click', exitOwnerMode);

    document.getElementById('admin-save-content').addEventListener('click', saveAllContent);
    var addTop = document.getElementById('admin-add-row-top');
    if (addTop) addTop.addEventListener('click', addRowUI);

    // Row edit modal
    document.getElementById('row-edit-save').addEventListener('click', saveRowFromModal);
    document.getElementById('row-edit-cancel').addEventListener('click', closeRowEditModal);
    document.getElementById('row-edit-modal').addEventListener('click', function (e) {
      if (e.target === this) closeRowEditModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !document.getElementById('row-edit-modal').hidden) closeRowEditModal();
    });

    if (isOwnerRequested()) {
      if (state.adminToken) enterOwnerMode();
      else {
        document.getElementById('admin-login-modal').hidden = false;
      }
    }
  }

  function doLogin() {
    var pw = document.getElementById('admin-password').value;
    var errEl = document.getElementById('admin-login-error');
    fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
    .then(function (res) {
      if (res.ok && res.d.token) {
        state.adminToken = res.d.token;
        sessionStorage.setItem('asal_admin_token', res.d.token);
        document.getElementById('admin-login-modal').hidden = true;
        document.getElementById('admin-password').value = '';
        errEl.hidden = true;
        enterOwnerMode();
      } else {
        errEl.hidden = false;
      }
    }).catch(function () { errEl.hidden = false; });
  }

  function enterOwnerMode() {
    state.isOwner = true;
    document.body.classList.add('owner-mode');
    document.getElementById('admin-panel').hidden = false;
    makeEditable();
    renderCatalog(); // re-render with owner overlays
    applyContent();
    loadStats();
  }

  function exitOwnerMode() {
    state.isOwner = false;
    document.body.classList.remove('owner-mode');
    document.getElementById('admin-panel').hidden = true;
    document.getElementById('row-edit-modal').hidden = true;
    document.querySelectorAll('[data-content],[data-content-html]').forEach(function (el) {
      el.contentEditable = 'false';
    });
    renderCatalog(); // re-render as customer view
    applyContent();
    // Clean URL
    var url = new URL(window.location.href);
    url.searchParams.delete('owner');
    window.history.replaceState({}, '', url.toString());
  }

  // ---------- Visitor stats ----------
  function loadStats() {
    var chart = document.getElementById('stats-chart');
    fetch('/api/admin/stats', { headers: { 'X-Admin-Token': state.adminToken } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        document.getElementById('stat-total').textContent = d.total_visits;
        document.getElementById('stat-today').textContent = d.today_visits;
        document.getElementById('stat-unique').textContent = d.unique_visitors;
        renderStatsChart(d.visits_by_day || []);
      })
      .catch(function () {
        chart.innerHTML = '<p class="stats-loading">Could not load stats.</p>';
      });
  }

  function renderStatsChart(byDay) {
    var chart = document.getElementById('stats-chart');
    var last7 = byDay.slice(-7);
    if (!last7.length) {
      chart.innerHTML = '<p class="stats-loading">No visits yet.</p>';
      return;
    }
    var max = 1;
    last7.forEach(function (d) { if (d.count > max) max = d.count; });
    var html = '<div class="stats-bars">';
    last7.forEach(function (d) {
      var h = Math.max(6, Math.round((d.count / max) * 90));
      var label = d.date.slice(5); // MM-DD
      html += '<div class="stat-bar-col" title="' + d.date + ': ' + d.count + ' visits">' +
        '<span class="stat-bar-val">' + d.count + '</span>' +
        '<div class="stat-bar" style="height:' + h + 'px"></div>' +
        '<span class="stat-bar-label">' + label + '</span></div>';
    });
    html += '</div>';
    chart.innerHTML = html;
  }

  // ---------- Visual owner catalog actions ----------
  function bindOwnerCatalogActions() {
    document.querySelectorAll('[data-edit-row]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openRowEditModal(Number(btn.getAttribute('data-edit-row')));
      });
    });
    document.querySelectorAll('[data-move-row]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = Number(btn.getAttribute('data-move-row'));
        var dir = Number(btn.getAttribute('data-dir'));
        moveRow(id, dir);
      });
    });
    function moveRow(id, dir) {
      var rows = Array.prototype.slice.call(document.querySelectorAll('.collection'));
      var ids = rows.map(function (el) {
        var editBtn = el.querySelector('[data-edit-row]');
        return editBtn ? Number(editBtn.getAttribute('data-edit-row')) : null;
      }).filter(function (x) { return x !== null; });
      var idx = ids.indexOf(id);
      var nidx = idx + dir;
      if (idx < 0 || nidx < 0 || nidx >= ids.length) return;
      var tmp = ids[idx]; ids[idx] = ids[nidx]; ids[nidx] = tmp;
      adminFetch('/api/admin/catalog/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: ids }),
      }).then(function (res) {
        if (res.ok) loadCatalog();
      });
    }
    document.querySelectorAll('[data-delete-row]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = Number(btn.getAttribute('data-delete-row'));
        var row = state.catalog.find(function (r) { return r.id === id; });
        var name = row ? row.fabric_name : 'this fabric row';
        if (!confirm('Delete "' + name + '" entirely? This cannot be undone.')) return;
        fetch('/api/admin/catalog/' + id, {
          method: 'DELETE',
          headers: { 'X-Admin-Token': state.adminToken },
        }).then(function () { return loadCatalog(); })
        .then(function () { renderCatalog(); applyContent(); })
        .catch(function () { alert('Delete failed'); });
      });
    });
  }

  // ---------- Android back button: close overlays instead of exiting ----------
  (function () {
    var handling = false;
    window.addEventListener('popstate', function () {
      if (handling) return;
      handling = true;
      try {
        if (window.__asalCloseLightbox) {
          // Mark as back-button close so we don't push/pop again
          if (window.__asalLightboxClosing) window.__asalLightboxClosing(true);
          window.__asalCloseLightbox();
        }
        else if (window.__asalCloseEditModal && window.__asalCloseEditModal()) { }
      } finally { handling = false; }
    });
  })();

  // ---------- Row edit modal (single-row form) ----------
  var editingRowId = null;

  function rowFormHTML(row) {
    var html = '<div class="admin-row-card">' +
      '<label>Fabric name</label><input type="text" data-f="fabric_name" value="' + esc(row.fabric_name) + '" />' +
      '<label>Fabric photo</label><div class="admin-img-slot"><img src="' + esc(row.fabric_image_url) + '" />' +
      '<input type="file" accept="image/*" data-upload="fabric" /></div>';
    row.model_names.forEach(function (mn, i) {
      html += modelSlotHTML(i, mn, row.model_prices[i], row.model_image_urls[i]);
    });
    html += '<button type="button" class="admin-add-model-btn" id="add-model-slot-btn">+ Add Model Photo</button>';
    html += '</div>';
    return html;
  }

  function modelSlotHTML(i, name, price, imgUrl) {
    return '<div class="admin-model-slot" data-slot="' + i + '">' +
      '<label>Model ' + (i + 1) + ' name</label>' +
      '<input type="text" data-f="model_name_' + i + '" value="' + esc(name || '') + '" />' +
      '<label>Model ' + (i + 1) + ' price (optional)</label>' +
      '<input type="text" data-f="model_price_' + i + '" value="' + esc(price || '') + '" placeholder="Leave blank to hide" />' +
      '<div class="admin-img-slot"><img src="' + esc(imgUrl || '') + '" />' +
      '<input type="file" accept="image/*" data-upload="model_' + i + '" /></div>' +
      (i >= 4 ? '<button type="button" class="admin-remove-model-btn" data-remove-slot="' + i + '">Remove</button>' : '') +
      '</div>';
  }

  function openRowEditModal(id) {
    var row = state.catalog.find(function (r) { return r.id === id; });
    if (!row) return;
    editingRowId = id;
    document.getElementById('row-edit-title').textContent = 'Edit: ' + row.fabric_name;
    var form = document.getElementById('row-edit-form');
    form.innerHTML = rowFormHTML(row);
    // Bind uploads inside modal
    form.querySelectorAll('input[type="file"][data-upload]').forEach(function (input) {
      input.addEventListener('change', function () {
        var file = input.files[0];
        if (!file) return;
        var fd = new FormData();
        fd.append('image', file);
        fetch('/api/admin/upload', {
          method: 'POST',
          headers: { 'X-Admin-Token': state.adminToken },
          body: fd,
        }).then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.url) {
            input.closest('.admin-img-slot').querySelector('img').src = d.url;
            input.closest('.admin-img-slot').dataset.newUrl = d.url;
          }
        }).catch(function () { alert('Upload failed'); });
      });
    });
    // Add Model button
    var addBtn = document.getElementById('add-model-slot-btn');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        var slots = form.querySelectorAll('.admin-model-slot');
        var n = slots.length;
        var tmp = document.createElement('div');
        tmp.innerHTML = modelSlotHTML(n, '', '', '');
        var newSlot = tmp.firstChild;
        addBtn.parentNode.insertBefore(newSlot, addBtn);
        // Bind upload for new slot
        var input = newSlot.querySelector('input[type="file"][data-upload]');
        input.addEventListener('change', function () {
          var file = input.files[0];
          if (!file) return;
          var fd = new FormData();
          fd.append('image', file);
          fetch('/api/admin/upload', {
            method: 'POST',
            headers: { 'X-Admin-Token': state.adminToken },
            body: fd,
          }).then(function (r) { return r.json(); })
          .then(function (d) {
            if (d.url) {
              input.closest('.admin-img-slot').querySelector('img').src = d.url;
              input.closest('.admin-img-slot').dataset.newUrl = d.url;
            }
          }).catch(function () { alert('Upload failed'); });
        });
        // Bind remove
        var rmBtn = newSlot.querySelector('[data-remove-slot]');
        if (rmBtn) rmBtn.addEventListener('click', function () { newSlot.remove(); });
      });
    }
    // Bind remove for existing extra slots
    form.querySelectorAll('[data-remove-slot]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        btn.closest('.admin-model-slot').remove();
        editModalDirty = true;
      });
    });
    // Track unsaved changes
    editModalDirty = false;
    form.querySelectorAll('input[type="text"], input[type="file"]').forEach(function (input) {
      input.addEventListener('input', function () { editModalDirty = true; });
      input.addEventListener('change', function () { editModalDirty = true; });
    });
    document.getElementById('row-edit-modal').hidden = false;
    document.body.style.overflow = 'hidden';
    try { history.pushState({ asalOverlay: 'editModal' }, ''); } catch (e) {}
    window.__asalCloseEditModal = function () {
      var m = document.getElementById('row-edit-modal');
      if (m && !m.hidden) { closeRowEditModal(); return true; }
      return false;
    };
  }

  var editModalDirty = false;
  function closeRowEditModal(force) {
    if (!force && editModalDirty) {
      if (!confirm('You have unsaved changes. Close without saving?')) return;
    }
    document.getElementById('row-edit-modal').hidden = true;
    document.body.style.overflow = '';
    editingRowId = null;
    editModalDirty = false;
  }

  function saveRowFromModal() {
    if (editingRowId == null) return;
    var form = document.getElementById('row-edit-form');
    var body = {
      fabric_name: form.querySelector('[data-f="fabric_name"]').value,
      model_names: [], model_image_urls: [], model_prices: [],
    };
    var fabricSlot = form.querySelector('[data-upload="fabric"]').closest('.admin-img-slot');
    if (fabricSlot.dataset.newUrl) body.fabric_image_url = fabricSlot.dataset.newUrl;

    var modelSlots = form.querySelectorAll('.admin-model-slot');
    modelSlots.forEach(function (slotEl) {
      var idx = slotEl.getAttribute('data-slot');
      var nameEl = form.querySelector('[data-f="model_name_' + idx + '"]');
      var priceEl = form.querySelector('[data-f="model_price_' + idx + '"]');
      var upEl = form.querySelector('[data-upload="model_' + idx + '"]');
      if (!nameEl) return;
      body.model_names.push(nameEl.value);
      body.model_prices.push(priceEl ? priceEl.value : '');
      var imgSlot = upEl ? upEl.closest('.admin-img-slot') : null;
      body.model_image_urls.push(imgSlot && imgSlot.dataset.newUrl ? imgSlot.dataset.newUrl : null);
    });
    var existing = state.catalog.find(function (r) { return r.id === editingRowId; });
    if (existing) {
      if (!body.fabric_image_url) body.fabric_image_url = existing.fabric_image_url;
      for (var j = 0; j < body.model_image_urls.length; j++) {
        if (!body.model_image_urls[j]) body.model_image_urls[j] = existing.model_image_urls[j] || '';
      }
    }
    fetch('/api/admin/catalog/' + editingRowId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': state.adminToken },
      body: JSON.stringify(body),
    }).then(function (r) { return r.json(); })
    .then(function () { return loadCatalog(); })
    .then(function () { renderCatalog(); applyContent(); editModalDirty = false; closeRowEditModal(true); })
    .catch(function () { alert('Save failed'); });
  }

  function makeEditable() {
    document.querySelectorAll('[data-content]').forEach(function (el) {
      el.contentEditable = 'true';
      el.spellcheck = false;
    });
    document.querySelectorAll('[data-content-html]').forEach(function (el) {
      el.contentEditable = 'true';
      el.spellcheck = false;
    });
  }

  function collectContent() {
    var out = {};
    document.querySelectorAll('[data-content]').forEach(function (el) {
      out[el.getAttribute('data-content')] = el.textContent.trim();
    });
    document.querySelectorAll('[data-content-html]').forEach(function (el) {
      // Convert back: <br> -> \n, strip other tags except em
      var html = el.innerHTML;
      var text = html.replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?em>/gi, function (m) { return m; })
        .replace(/<[^>]+>/g, '');
      out[el.getAttribute('data-content-html')] = text.trim();
    });
    return out;
  }

  function saveAllContent() {
    var content = collectContent();
    // Also collect dynamic ones (steps, badges, faq are rendered with data-content attrs)
    fetch('/api/admin/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': state.adminToken },
      body: JSON.stringify({ content: content }),
    }).then(function (r) { return r.json(); })
    .then(function () {
      state.content = Object.assign({}, state.content, content);
      alert('Saved!');
    }).catch(function () { alert('Save failed'); });
  }

  function renderAdminCatalog() {
    var wrap = document.getElementById('admin-catalog-list');
    var html = '';
    state.catalog.forEach(function (row) {
      html += '<div class="admin-row-card" data-row-id="' + row.id + '">' +
        '<h4>' + esc(row.fabric_name) + '</h4>' +
        '<label>Fabric name</label><input type="text" data-f="fabric_name" value="' + esc(row.fabric_name) + '" />' +
        '<label>Fabric photo</label><div class="admin-img-slot"><img src="' + esc(row.fabric_image_url) + '" />' +
        '<input type="file" accept="image/*" data-upload="fabric" /></div>';
      row.model_names.forEach(function (mn, i) {
        html += '<label>Model ' + (i + 1) + ' name</label>' +
          '<input type="text" data-f="model_name_' + i + '" value="' + esc(mn || '') + '" />' +
          '<label>Model ' + (i + 1) + ' price (optional)</label>' +
          '<input type="text" data-f="model_price_' + i + '" value="' + esc(row.model_prices[i] || '') + '" placeholder="Leave blank to hide" />' +
          '<div class="admin-img-slot"><img src="' + esc(row.model_image_urls[i] || '') + '" />' +
          '<input type="file" accept="image/*" data-upload="model_' + i + '" /></div>';
      });
      html += '<div class="admin-row-actions">' +
        '<button class="btn btn-primary" data-act="save">Save row</button>' +
        '<button class="btn btn-ghost" data-act="delete">Delete row</button></div></div>';
    });
    wrap.innerHTML = html;

    // Bind upload inputs
    wrap.querySelectorAll('input[type="file"][data-upload]').forEach(function (input) {
      input.addEventListener('change', function () {
        var file = input.files[0];
        if (!file) return;
        var fd = new FormData();
        fd.append('image', file);
        fetch('/api/admin/upload', {
          method: 'POST',
          headers: { 'X-Admin-Token': state.adminToken },
          body: fd,
        }).then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.url) {
            input.closest('.admin-img-slot').querySelector('img').src = d.url;
            input.closest('.admin-img-slot').dataset.newUrl = d.url;
          }
        }).catch(function () { alert('Upload failed'); });
      });
    });

    // Bind save/delete
    wrap.querySelectorAll('.admin-row-card').forEach(function (card) {
      var id = Number(card.dataset.rowId);
      card.querySelector('[data-act="save"]').addEventListener('click', function () {
        saveRow(card, id);
      });
      card.querySelector('[data-act="delete"]').addEventListener('click', function () {
        if (!confirm('Delete this entire fabric row?')) return;
        fetch('/api/admin/catalog/' + id, {
          method: 'DELETE',
          headers: { 'X-Admin-Token': state.adminToken },
        }).then(function () { loadCatalog().then(renderAdminCatalog); })
        .catch(function () { alert('Delete failed'); });
      });
    });
  }

  function saveRow(card, id) {
    var body = {
      fabric_name: card.querySelector('[data-f="fabric_name"]').value,
      model_names: [], model_image_urls: [], model_prices: [],
    };
    // Check for new uploaded fabric image
    var fabricSlot = card.querySelector('[data-upload="fabric"]').closest('.admin-img-slot');
    if (fabricSlot.dataset.newUrl) body.fabric_image_url = fabricSlot.dataset.newUrl;

    for (var i = 0; i < 4; i++) {
      body.model_names.push(card.querySelector('[data-f="model_name_' + i + '"]').value);
      body.model_prices.push(card.querySelector('[data-f="model_price_' + i + '"]').value);
      var slot = card.querySelector('[data-upload="model_' + i + '"]').closest('.admin-img-slot');
      body.model_image_urls.push(slot.dataset.newUrl || null); // null = keep existing
    }
    // Replace nulls with existing values
    var existing = state.catalog.find(function (r) { return r.id === id; });
    if (existing) {
      if (!body.fabric_image_url) body.fabric_image_url = existing.fabric_image_url;
      for (var j = 0; j < 4; j++) {
        if (!body.model_image_urls[j]) body.model_image_urls[j] = existing.model_image_urls[j];
      }
    }
    fetch('/api/admin/catalog/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': state.adminToken },
      body: JSON.stringify(body),
    }).then(function (r) { return r.json(); })
    .then(function () { return loadCatalog(); })
    .then(function () { renderAdminCatalog(); alert('Row saved!'); })
    .catch(function () { alert('Save failed'); });
  }

  function addRowUI() {
    var name = prompt('Fabric name (e.g. "Pink Floral Print"):');
    if (!name) return;
    fetch('/api/admin/catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': state.adminToken },
      body: JSON.stringify({ fabric_name: name }),
    }).then(function (r) { return r.json(); })
    .then(function () { return loadCatalog(); })
    .then(function () { renderCatalog(); applyContent(); })
    .catch(function () { alert('Add failed'); });
  }

  // ---------- Load ----------
  function loadContent() {
    return fetch('/api/content').then(function (r) { return r.json(); })
      .then(function (d) { state.content = d.content || {}; });
  }
  function loadCatalog() {
    return fetch('/api/catalog').then(function (r) { return r.json(); })
      .then(function (d) { state.catalog = d.rows || []; });
  }

  // ---------- Init ----------
  Promise.all([loadContent(), loadCatalog()]).then(function () {
    applyContent();
    renderSteps();
    renderBadges();
    renderFaq();
    renderCatalog();
    // Re-apply content to dynamically rendered elements
    applyContent();
  }).catch(function (e) {
    console.error('Failed to load site data', e);
  });

  initRating();
  initOwner();
})();
