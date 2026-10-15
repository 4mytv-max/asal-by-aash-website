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
      html += '<article class="collection" id="' + esc(fabricSlug) + '">' +
        '<header class="collection-head"><div><span class="collection-count">' + esc(countLabel) + '</span>' +
        '<h3>' + esc(row.fabric_name) + '</h3></div>' +
        '<p class="collection-note">1 fabric · 4 models</p></header>' +
        '<div class="products">';

      // Fabric card
      html += '<a class="product product-fabric order-link" href="' + esc(waOrderUrl(row.fabric_name, 'Fabric enquiry')) + '"' +
        ' data-fabric="' + esc(row.fabric_name) + '" data-model="Fabric enquiry" target="_blank" rel="noreferrer">' +
        '<div class="product-photo"><img src="' + esc(row.fabric_image_url) + '" alt="' + esc(row.fabric_name) + ' fabric" loading="lazy" />' +
        '<span class="fabric-label" data-content="fabric_badge">' + esc(c.fabric_badge || 'FABRIC IN STOCK') + '</span></div>' +
        '<div class="product-copy"><strong>' + esc(row.fabric_name) + '</strong>' +
        '<span>' + esc(c.fabric_order_button || 'Ask about this fabric') + ' <svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14M14 7l5 5-5 5"/></svg></span></div></a>';

      // Model cards
      row.model_names.forEach(function (mname, mi) {
        var mimg = row.model_image_urls[mi];
        var price = row.model_prices[mi];
        if (!mname) return;
        var num = String(mi + 1).padStart(2, '0');
        html += '<a class="product order-link" href="' + esc(waOrderUrl(row.fabric_name, mname)) + '"' +
          ' data-fabric="' + esc(row.fabric_name) + '" data-model="' + esc(mname) + '" target="_blank" rel="noreferrer">' +
          '<div class="product-photo">' +
          (mimg ? '<img src="' + esc(mimg) + '" alt="' + esc(mname) + ' in ' + esc(row.fabric_name) + '" loading="lazy" />' : '') +
          '<span class="product-number">' + num + '</span></div>' +
          '<div class="product-copy"><strong>' + esc(mname) + '</strong>' +
          (price ? '<span class="price">₹' + esc(price) + '</span>' : '') +
          '<span>' + esc(c.order_button || 'Order on WhatsApp') + ' <svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14M14 7l5 5-5 5"/></svg></span></div></a>';
      });

      html += '</div></article>';
    });
    list.innerHTML = html;
    bindPhotoZoom();
  }

  // ---------- Lightbox with pinch zoom ----------
  function bindPhotoZoom() {
    var lightbox = document.getElementById('photo-lightbox');
    var lightboxImage = lightbox.querySelector('.lightbox-image');
    var lightboxStage = lightbox.querySelector('.lightbox-stage');
    var lightboxName = document.getElementById('lightbox-name');
    var closeButton = lightbox.querySelector('.lightbox-close');
    var zoomButton = lightbox.querySelector('.lightbox-zoom');
    var zoomButtonText = zoomButton.querySelector('span');
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
      zoomButtonText.textContent = ns > 1.01 ? 'Fit to screen' : 'Zoom in';
    }
    function openLightbox(src, name) {
      lightboxImage.src = src;
      lightboxImage.alt = name || '';
      lightboxName.textContent = name || 'Photo preview';
      applyZoom(1, 0, 0);
      lightbox.setAttribute('aria-hidden', 'false');
      lightbox.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function closeLightbox() {
      lightbox.setAttribute('aria-hidden', 'true');
      lightbox.classList.remove('open');
      document.body.style.overflow = '';
      lightboxImage.src = '';
    }

    // Photo tap opens zoom only (never WhatsApp)
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
    zoomButton.addEventListener('click', function () {
      applyZoom(zoomState.scale > 1.01 ? 1 : 2, 0, 0);
    });

    // Pinch + pan
    lightboxStage.addEventListener('pointerdown', function (e) {
      activePointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      lightboxStage.setPointerCapture(e.pointerId);
      var keys = Object.keys(activePointers);
      if (keys.length === 2) {
        var p1 = activePointers[keys[0]], p2 = activePointers[keys[1]];
        pinchStart = {
          distance: Math.max(1, Math.hypot(p2.x - p1.x, p2.y - p1.y)),
          scale: zoomState.scale,
        };
        dragStart = null;
      } else if (keys.length === 1 && zoomState.scale > 1.01) {
        dragStart = { x: e.clientX - zoomState.x, y: e.clientY - zoomState.y };
      }
    });
    lightboxStage.addEventListener('pointermove', function (e) {
      if (!activePointers[e.pointerId]) return;
      activePointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var keys = Object.keys(activePointers);
      if (keys.length === 2 && pinchStart) {
        var p1 = activePointers[keys[0]], p2 = activePointers[keys[1]];
        var dist = Math.max(1, Math.hypot(p2.x - p1.x, p2.y - p1.y));
        applyZoom(pinchStart.scale * (dist / pinchStart.distance), zoomState.x, zoomState.y);
      } else if (keys.length === 1 && dragStart) {
        applyZoom(zoomState.scale, e.clientX - dragStart.x, e.clientY - dragStart.y);
      }
    });
    function endPointer(e) {
      delete activePointers[e.pointerId];
      if (Object.keys(activePointers).length < 2) pinchStart = null;
      if (Object.keys(activePointers).length === 0) dragStart = null;
    }
    lightboxStage.addEventListener('pointerup', endPointer);
    lightboxStage.addEventListener('pointercancel', endPointer);
  }

  // ---------- Rating ----------
  function initRating() {
    var starsEl = document.getElementById('stars');
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

    // Tabs
    document.querySelectorAll('.admin-tabs button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.admin-tabs button').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var tab = btn.dataset.tab;
        document.querySelectorAll('.admin-tab-content [data-pane]').forEach(function (p) {
          p.hidden = p.dataset.pane !== tab;
        });
      });
    });

    document.getElementById('admin-save-content').addEventListener('click', saveAllContent);
    document.getElementById('admin-add-row').addEventListener('click', addRowUI);

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
    renderAdminCatalog();
  }

  function exitOwnerMode() {
    state.isOwner = false;
    document.body.classList.remove('owner-mode');
    document.getElementById('admin-panel').hidden = true;
    document.querySelectorAll('[data-content],[data-content-html]').forEach(function (el) {
      el.contentEditable = 'false';
    });
    // Clean URL
    var url = new URL(window.location.href);
    url.searchParams.delete('owner');
    window.history.replaceState({}, '', url.toString());
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
    .then(function () { renderAdminCatalog(); })
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
