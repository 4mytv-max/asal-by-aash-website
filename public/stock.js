/* ASAL by Aash — Stock Management page logic (owner only) */
(function () {
  'use strict';

  var token = sessionStorage.getItem('asal_admin_token') || null;
  var fabricUrl = null;

  var loginGate = document.getElementById('login-gate');
  var stockMain = document.getElementById('stock-main');
  var loginBtn = document.getElementById('stock-login-btn');
  var loginError = document.getElementById('login-error');
  var pwInput = document.getElementById('stock-password');

  var fabricInput = document.getElementById('fabric-photo');
  var fabricPreviewWrap = document.getElementById('fabric-preview-wrap');
  var fabricPreview = document.getElementById('fabric-preview');
  var nameInput = document.getElementById('fabric-name');
  var suggestBtn = document.getElementById('suggest-btn');
  var publishBtn = document.getElementById('publish-btn');
  var publishStatus = document.getElementById('publish-status');
  var stockList = document.getElementById('stock-list');
  var stockCount = document.getElementById('stock-count');

  function setStatus(el, msg, kind) {
    el.textContent = msg || '';
    el.className = 'stock-status' + (kind ? ' ' + kind : '');
  }

  function adminFetch(path, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    opts.headers['X-Admin-Token'] = token;
    return fetch(path, opts).then(function (r) {
      return r.json().then(function (d) { return { ok: r.ok, status: r.status, d: d }; });
    });
  }

  function requireAuth(res) {
    if (res.status === 401) {
      token = null;
      sessionStorage.removeItem('asal_admin_token');
      stockMain.hidden = true;
      loginGate.hidden = false;
      loginError.hidden = false;
      loginError.textContent = 'Session expired. Please login again.';
      return true;
    }
    return false;
  }

  function doLogin() {
    var pw = pwInput.value;
    setStatus(loginError, '');
    loginError.hidden = true;
    fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok && res.d.token) {
          token = res.d.token;
          sessionStorage.setItem('asal_admin_token', token);
          pwInput.value = '';
          loginGate.hidden = true;
          stockMain.hidden = false;
          loadStockList();
        } else {
          loginError.hidden = false;
          loginError.textContent = 'Wrong password. Try again.';
        }
      })
      .catch(function () {
        loginError.hidden = false;
        loginError.textContent = 'Login failed. Check your connection.';
      });
  }

  loginBtn.addEventListener('click', doLogin);
  pwInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });

  function uploadImage(file) {
    var fd = new FormData();
    fd.append('image', file);
    return adminFetch('/api/admin/upload', { method: 'POST', body: fd }).then(function (res) {
      if (requireAuth(res)) throw new Error('auth');
      if (!res.ok || !res.d.url) throw new Error((res.d && res.d.error) || 'Upload failed');
      return res.d.url;
    });
  }

  // Fabric photo: preview + upload immediately
  fabricInput.addEventListener('change', function () {
    var file = fabricInput.files[0];
    if (!file) return;
    setStatus(publishStatus, '');
    fabricPreview.src = URL.createObjectURL(file);
    fabricPreviewWrap.style.display = 'block';
    suggestBtn.disabled = true;
    setStatus(publishStatus, 'Uploading fabric photo…');
    uploadImage(file)
      .then(function (url) {
        fabricUrl = url;
        suggestBtn.disabled = false;
        setStatus(publishStatus, 'Photo uploaded. You can suggest a name with AI.', 'ok');
      })
      .catch(function (err) {
        if (err.message !== 'auth') setStatus(publishStatus, 'Photo upload failed: ' + err.message, 'err');
      });
  });

  // AI name suggestion - sends a small preview, original stays full quality
  function makePreview(file, maxSize, cb) {
    var img = new Image();
    img.onload = function () {
      var scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      var w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(img.src);
      cb(c.toDataURL('image/jpeg', 0.7).split(',')[1]);
    };
    img.onerror = function () { cb(null); };
    img.src = URL.createObjectURL(file);
  }

  var fabricFile = null;
  // Store the file when selected
  var origHandler = fabricInput.onchange;
  fabricInput.addEventListener('change', function () {
    if (fabricInput.files && fabricInput.files[0]) fabricFile = fabricInput.files[0];
  });

  suggestBtn.addEventListener('click', function () {
    if (!fabricUrl) return;
    suggestBtn.disabled = true;
    suggestBtn.textContent = '🤖 Thinking…';
    var sendPreview = function (previewB64) {
      var body = previewB64
        ? { image_preview: previewB64 }
        : { image_url: fabricUrl };
      adminFetch('/api/admin/suggest-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      .then(function (res) {
        if (requireAuth(res)) return;
        if (res.ok && res.d.name) {
          nameInput.value = res.d.name;
          setStatus(publishStatus, 'AI suggested a name — you can edit it.', 'ok');
        } else {
          setStatus(publishStatus, (res.d && res.d.error) || 'Could not suggest a name.', 'err');
        }
      })
      .catch(function () {
        setStatus(publishStatus, 'Could not suggest a name. Try again.', 'err');
      })
      .finally(function () {
        suggestBtn.disabled = false;
        suggestBtn.textContent = '🤖 Suggest Name';
      });
    };
    if (fabricFile) {
      makePreview(fabricFile, 512, sendPreview);
    } else {
      sendPreview(null);
    }
  });

  // Model photo previews
  var modelCount = 4;
  function bindModelInput(input) {
    input.addEventListener('change', function () {
      var file = input.files[0];
      var wrap = document.getElementById('model-preview-' + input.dataset.i);
      if (file && wrap) {
        wrap.querySelector('img').src = URL.createObjectURL(file);
        wrap.style.display = 'block';
      }
    });
  }
  document.querySelectorAll('.model-photo').forEach(bindModelInput);

  // Add more model photo slots dynamically
  var addModelBtn = document.getElementById('add-model-btn');
  if (addModelBtn) {
    addModelBtn.addEventListener('click', function () {
      var container = document.querySelector('.stock-models');
      var div = document.createElement('div');
      div.className = 'model-slot';
      div.innerHTML =
        '<input type="file" class="model-photo" data-i="' + modelCount + '" accept="image/*" />' +
        '<div class="stock-preview" id="model-preview-' + modelCount + '" style="display:none"><img alt="Model ' + (modelCount + 1) + ' preview" /></div>' +
        '<button type="button" class="model-remove" title="Remove">×</button>';
      container.appendChild(div);
      bindModelInput(div.querySelector('.model-photo'));
      div.querySelector('.model-remove').addEventListener('click', function () {
        div.remove();
      });
      modelCount++;
    });
  }

  // Publish
  publishBtn.addEventListener('click', function () {
    var name = nameInput.value.trim();
    if (!fabricUrl) {
      setStatus(publishStatus, 'Please choose a fabric photo first.', 'err');
      return;
    }
    if (!name) {
      setStatus(publishStatus, 'Please enter a fabric name (or use Suggest Name).', 'err');
      nameInput.focus();
      return;
    }
    var modelCount = document.querySelectorAll('.model-photo').length;
    var filledModels = 0;
    document.querySelectorAll('.model-photo').forEach(function (i) { if (i.files[0]) filledModels++; });
    if (!confirm('Publish "' + name + '" to the website?\n\nFabric photo: 1\nModel photos: ' + filledModels + '\n\nThis will be visible to customers.')) return;
    publishBtn.disabled = true;
    setStatus(publishStatus, 'Publishing…');

    var modelInputs = Array.prototype.slice.call(document.querySelectorAll('.model-photo'));
    var uploads = modelInputs.map(function (input) {
      var file = input.files[0];
      return file ? uploadImage(file).catch(function () { return ''; }) : Promise.resolve('');
    });

    Promise.all(uploads)
      .then(function (urls) {
        return adminFetch('/api/admin/catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fabric_name: name,
            fabric_image_url: fabricUrl,
            model_image_urls: urls,
          }),
        });
      })
      .then(function (res) {
        if (requireAuth(res)) return;
        if (!res.ok) throw new Error((res.d && res.d.error) || 'Publish failed');
        var uploadedCount = urls.filter(function (u) { return u; }).length;
        var msg = '✅ "' + name + '" is now live on the website!';
        if (uploadedCount === 0) msg += ' Model photos pending — ask Muse in chat to generate them.';
        setStatus(publishStatus, msg, 'ok');
        // Reset form
        fabricInput.value = '';
        fabricUrl = null;
        fabricPreviewWrap.style.display = 'none';
        nameInput.value = '';
        suggestBtn.disabled = true;
        document.querySelectorAll('.model-photo').forEach(function (input, idx) {
          input.value = '';
          var wrap = document.getElementById('model-preview-' + idx);
          if (wrap) wrap.style.display = 'none';
        });
        loadStockList();
      })
      .catch(function (err) {
        if (err.message !== 'auth') setStatus(publishStatus, 'Publish failed: ' + err.message, 'err');
      })
      .finally(function () {
        publishBtn.disabled = false;
      });
  });

  // Current stock list
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function loadStockList() {
    adminFetch('/api/admin/catalog')
      .then(function (res) {
        if (requireAuth(res) || !res.ok) return;
        var rows = res.d.rows || [];
        stockCount.textContent = rows.length + (rows.length === 1 ? ' fabric' : ' fabrics') + ' in stock';
        if (!rows.length) {
          stockList.innerHTML = '<p class="stock-count">No fabrics yet.</p>';
          return;
        }
        var html = '';
        rows.forEach(function (r) {
          var photos = '';
          if (r.fabric_image_url) photos += '<img src="' + esc(r.fabric_image_url) + '" alt="Fabric" loading="lazy" title="Fabric" />';
          (r.model_image_urls || []).forEach(function (u, i) {
            if (u) photos += '<img src="' + esc(u) + '" alt="Model ' + (i+1) + '" loading="lazy" title="' + esc((r.model_names||[])[i]||('Model '+(i+1))) + '" />';
          });
          var photoCount = (r.model_image_urls || []).filter(function(u){return u;}).length + (r.fabric_image_url ? 1 : 0);
          html += '<div class="stock-row" data-row-id="' + r.id + '">' +
            '<div class="stock-row-main">' +
            (r.fabric_image_url ? '<img class="stock-thumb" src="' + esc(r.fabric_image_url) + '" alt="" loading="lazy" />' : '') +
            '<span>' + esc(r.fabric_name) + ' <small>(' + photoCount + ' photos)</small></span>' +
            '<div class="stock-row-actions">' +
            '<button type="button" class="stock-view-btn" data-stock-view="' + r.id + '">👁️ Photos</button>' +
            '<button type="button" class="stock-edit-btn" data-stock-edit="' + r.id + '">✏️ Edit</button>' +
            '<button type="button" class="stock-delete-btn" data-stock-delete="' + r.id + '">🗑️ Delete</button>' +
            '</div></div>' +
            '<div class="stock-photos" id="stock-photos-' + r.id + '" style="display:none">' + photos + '</div>' +
            '</div>';
        });
        stockList.innerHTML = html;
        // Bind photo toggle
        stockList.querySelectorAll('[data-stock-view]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-stock-view');
            var el = document.getElementById('stock-photos-' + id);
            if (el) {
              var show = el.style.display === 'none';
              el.style.display = show ? 'flex' : 'none';
              btn.textContent = show ? '🙈 Hide' : '👁️ Photos';
            }
          });
        });
        // Bind edit/delete
        stockList.querySelectorAll('[data-stock-delete]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-stock-delete');
            var row = rows.find(function (x) { return String(x.id) === String(id); });
            if (!confirm('Delete "' + (row ? row.fabric_name : '') + '"?')) return;
            adminFetch('/api/admin/catalog/' + id, { method: 'DELETE' })
              .then(function (res) {
                if (res.ok) { setStatus(publishStatus, 'Deleted.', 'ok'); loadStockList(); }
                else setStatus(publishStatus, 'Delete failed.', 'err');
              });
          });
        });
        stockList.querySelectorAll('[data-stock-edit]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-stock-edit');
            // Redirect to main site owner mode edit for full editing
            window.location.href = '/?owner=1#edit-' + id;
          });
        });
      })
      .catch(function () {
        stockList.innerHTML = '<p class="stock-count">Could not load stock.</p>';
      });
  }

  // Init
  if (token) {
    loginGate.hidden = true;
    stockMain.hidden = false;
    loadStockList();
  }
})();
