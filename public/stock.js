/* ASAL by Aash — Stock Management page logic (owner only) */
(function () {
  'use strict';

  var token = sessionStorage.getItem('asal_admin_token') || null;
  var fabricUrl = null;
  var editingId = null;
  var editingModels = []; // existing models when editing: [{name, image_url, price}]

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

  function uploadImage(file, onProgress) {
    return new Promise(function (resolve, reject) {
      if (file.size > 15 * 1024 * 1024) {
        reject(new Error('Photo is too large (max 15MB). Please use a smaller photo.'));
        return;
      }
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/admin/upload');
      var token = localStorage.getItem('asal_admin_token') || sessionStorage.getItem('asal_admin_token') || '';
      if (token) xhr.setRequestHeader('X-Admin-Token', token);
      xhr.upload.onprogress = function (e) {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = function () {
        try {
          var d = JSON.parse(xhr.responseText);
          if (xhr.status === 401) { requireAuth({ ok: false, status: 401 }); reject(new Error('auth')); return; }
          if (xhr.status >= 200 && xhr.status < 300 && d.url) resolve(d.url);
          else reject(new Error((d && d.error) || 'Upload failed (code ' + xhr.status + ')'));
        } catch (e) { reject(new Error('Upload failed')); }
      };
      xhr.onerror = function () { reject(new Error('Upload failed - network error')); };
      xhr.ontimeout = function () { reject(new Error('Upload timed out')); };
      xhr.timeout = 120000;
      var fd = new FormData();
      fd.append('image', file);
      xhr.send(fd);
    });
  }
  function showUploadProgress(pct) {
    setStatus(publishStatus, 'Uploading… ' + pct + '%', 'ok');
  }

  // Fabric photo: preview + upload immediately
  fabricInput.addEventListener('change', function () {
    var file = fabricInput.files[0];
    if (!file) return;
    setStatus(publishStatus, '');
    fabricPreview.src = URL.createObjectURL(file);
    fabricPreviewWrap.style.display = 'block';
    suggestBtn.disabled = true;
    setStatus(publishStatus, 'Uploading fabric photo… 0%');
    uploadImage(file, function(pct) { setStatus(publishStatus, 'Uploading fabric photo… ' + pct + '%', 'ok'); })
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

  // Model photo slots (uses addModelSlot defined above)
  var modelCount = 0;

  // Add more model photo slots dynamically
  var addModelBtn = document.getElementById('add-model-btn');
  if (addModelBtn) {
    addModelBtn.addEventListener('click', function () {
      addModelSlot('', '', '');
    });
  }

  // Multi-select from gallery: pick many photos at once
  var multiBtn = document.getElementById('multi-select-btn');
  var multiInput = document.getElementById('multi-file-input');
  if (multiBtn && multiInput) {
    multiBtn.addEventListener('click', function () { multiInput.click(); });
    multiInput.addEventListener('change', function () {
      var files = Array.prototype.slice.call(multiInput.files);
      if (!files.length) return;
      setStatus(publishStatus, 'Adding ' + files.length + ' photos…', 'ok');
      files.forEach(function (file) {
        addModelSlot('', '', '');
        // Get the last added slot and set the file
        var slots = document.querySelectorAll('.model-slot');
        var div = slots[slots.length - 1];
        var fi = div.querySelector('.model-photo');
        var dt = new DataTransfer();
        dt.items.add(file);
        fi.files = dt.files;
        div.querySelector('.stock-preview img').src = URL.createObjectURL(file);
        div.querySelector('.stock-preview').style.display = 'block';
      });
      multiInput.value = '';
      setStatus(publishStatus, files.length + ' photos added! You can remove any before publishing.', 'ok');
    });
  }

  // Publish (add) or Update (edit)
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
    var isEdit = editingId !== null;
    var slots = Array.prototype.slice.call(document.querySelectorAll('.model-slot'));
    var filledModels = slots.filter(function (s) {
      return s.querySelector('.model-photo').files[0] || s.dataset.existingUrl;
    }).length;
    var actionWord = isEdit ? 'Update' : 'Publish';
    if (!confirm(actionWord + ' "' + name + '"?\n\nFabric photo: 1\nModel photos: ' + filledModels + '\n\n' + (isEdit ? 'Changes will be saved.' : 'This will be visible to customers.'))) return;
    publishBtn.disabled = true;
    setStatus(publishStatus, isEdit ? 'Updating…' : 'Publishing…');

    // Upload new files, keep existing URLs
    var uploads = slots.map(function (slot) {
      var fileInput = slot.querySelector('.model-photo');
      var file = fileInput.files[0];
      if (file) {
        return uploadImage(file, showUploadProgress).catch(function (err) {
          setStatus(publishStatus, 'Upload failed: ' + err.message, 'err');
          return '';
        }).then(function (url) {
          return { url: url, name: slot.querySelector('.model-name').value.trim(), price: slot.querySelector('.model-price').value.trim() };
        });
      } else if (slot.dataset.existingUrl) {
        return Promise.resolve({ url: slot.dataset.existingUrl, name: slot.querySelector('.model-name').value.trim(), price: slot.querySelector('.model-price').value.trim() });
      }
      return Promise.resolve(null);
    });

    Promise.all(uploads)
      .then(function (results) {
        var models = results.filter(function (r) { return r && r.url; });
        var body = {
          fabric_name: name,
          fabric_image_url: fabricUrl,
          model_names: models.map(function (m) { return m.name; }),
          model_image_urls: models.map(function (m) { return m.url; }),
          model_prices: models.map(function (m) { return m.price; }),
        };
        var url = isEdit ? '/api/admin/catalog/' + editingId : '/api/admin/catalog';
        var method = isEdit ? 'PUT' : 'POST';
        return adminFetch(url, {
          method: method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).then(function (res) {
          if (requireAuth(res)) return;
          if (!res.ok) throw new Error((res.d && res.d.error) || (isEdit ? 'Update failed' : 'Publish failed'));
          var msg = isEdit ? '✅ "' + name + '" updated!' : '✅ "' + name + '" is now live on the website!';
          setStatus(publishStatus, msg, 'ok');
          if (isEdit) exitEditMode();
          else {
            fabricInput.value = '';
            fabricUrl = null;
            fabricPreviewWrap.style.display = 'none';
            nameInput.value = '';
            suggestBtn.disabled = true;
            document.querySelector('.stock-models').innerHTML = '';
            modelCount = 0;
            for (var i = 0; i < 4; i++) addModelSlot('', '', '');
          }
          loadStockList();
        });
      })
      .catch(function (err) {
        if (err.message !== 'auth') setStatus(publishStatus, (isEdit ? 'Update' : 'Publish') + ' failed: ' + err.message, 'err');
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

  function enterEditMode(row) {
    editingId = row.id;
    editingModels = (row.model_image_urls || []).map(function (u, i) {
      return { name: (row.model_names || [])[i] || '', image_url: u || '', price: (row.model_prices || [])[i] || '' };
    }).filter(function (m) { return m.image_url || m.name; });
    // Populate form
    nameInput.value = row.fabric_name || '';
    fabricUrl = row.fabric_image_url || null;
    if (fabricUrl) {
      fabricPreview.src = fabricUrl;
      fabricPreviewWrap.style.display = 'block';
    }
    // Clear model slots and add existing as slots
    var container = document.querySelector('.stock-models');
    container.innerHTML = '';
    modelCount = 0;
    editingModels.forEach(function (m, i) {
      addModelSlot(m.name, m.price, m.image_url);
    });
    // Update UI
    publishBtn.textContent = '💾 Update Fabric';
    var cancelBtn = document.getElementById('cancel-edit-btn');
    if (!cancelBtn) {
      cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.id = 'cancel-edit-btn';
      cancelBtn.className = 'stock-add-btn';
      cancelBtn.textContent = '❌ Cancel Edit';
      cancelBtn.style.marginLeft = '8px';
      publishBtn.parentNode.insertBefore(cancelBtn, publishBtn.nextSibling);
      cancelBtn.addEventListener('click', exitEditMode);
    }
    cancelBtn.style.display = '';
    document.querySelector('.stock-add-section h2').textContent = '✏️ Edit: ' + row.fabric_name;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setStatus(publishStatus, 'Editing "' + row.fabric_name + '". Make changes and tap Update.', 'ok');
  }
  function exitEditMode() {
    editingId = null;
    editingModels = [];
    nameInput.value = '';
    fabricUrl = null;
    fabricInput.value = '';
    fabricPreviewWrap.style.display = 'none';
    var container = document.querySelector('.stock-models');
    container.innerHTML = '';
    modelCount = 0;
    // Re-add 4 empty slots
    for (var i = 0; i < 4; i++) addModelSlot('', '', '');
    publishBtn.textContent = '🚀 Publish to Website';
    var cancelBtn = document.getElementById('cancel-edit-btn');
    if (cancelBtn) cancelBtn.style.display = 'none';
    document.querySelector('.stock-add-section h2').textContent = 'Add New Fabric';
    setStatus(publishStatus, '');
  }
  function addModelSlot(name, price, imgUrl) {
    var container = document.querySelector('.stock-models');
    var div = document.createElement('div');
    div.className = 'model-slot';
    div.dataset.existing = imgUrl ? '1' : '';
    var idx = modelCount++;
    div.innerHTML =
      '<div class="stock-preview"' + (imgUrl ? ' style="display:block"' : ' style="display:none"') + '>' +
      '<img src="' + (imgUrl || '') + '" alt="Model preview" /></div>' +
      '<input type="text" class="model-name" placeholder="Model name (e.g. Kurti)" value="' + (name || '').replace(/"/g, '&quot;') + '" />' +
      '<input type="text" class="model-price" placeholder="Price (optional)" value="' + (price || '').replace(/"/g, '&quot;') + '" />' +
      '<input type="file" class="model-photo" accept="image/*" style="display:none" />' +
      '<button type="button" class="model-pick">📷 ' + (imgUrl ? 'Replace' : 'Choose') + ' Photo</button>' +
      '<button type="button" class="model-remove" title="Remove">×</button>';
    if (imgUrl) div.dataset.existingUrl = imgUrl;
    container.appendChild(div);
    var fileInput = div.querySelector('.model-photo');
    div.querySelector('.model-pick').addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      var f = fileInput.files[0];
      if (!f) return;
      div.querySelector('.stock-preview img').src = URL.createObjectURL(f);
      div.querySelector('.stock-preview').style.display = 'block';
      div.dataset.existing = '';
      div.dataset.existingUrl = '';
    });
    div.querySelector('.model-remove').addEventListener('click', function () { div.remove(); });
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
            '<button type="button" class="stock-move-btn" data-stock-move="' + r.id + '" data-dir="up" title="Move up">⬆️</button>' +
            '<button type="button" class="stock-move-btn" data-stock-move="' + r.id + '" data-dir="down" title="Move down">⬇️</button>' +
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
            adminFetch('/api/catalog').then(function (res) {
              if (res.ok) {
                var row = (res.d.rows || []).find(function (r) { return String(r.id) === String(id); });
                if (row) enterEditMode(row);
                else setStatus(publishStatus, 'Could not load fabric.', 'err');
              }
            });
          });
        });
        // Reorder buttons
        stockList.querySelectorAll('[data-stock-move]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-stock-move');
            var dir = btn.getAttribute('data-dir');
            adminFetch('/api/catalog').then(function (res) {
              if (!res.ok) return;
              var rows = res.d.rows || [];
              var idx = rows.findIndex(function (r) { return String(r.id) === String(id); });
              if (idx < 0) return;
              var newIdx = dir === 'up' ? idx - 1 : idx + 1;
              if (newIdx < 0 || newIdx >= rows.length) return;
              var tmp = rows[idx]; rows[idx] = rows[newIdx]; rows[newIdx] = tmp;
              var order = rows.map(function (r) { return r.id; });
              adminFetch('/api/admin/catalog/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order: order }),
              }).then(function (r2) {
                if (r2.ok) { setStatus(publishStatus, 'Order updated!', 'ok'); loadStockList(); }
              });
            });
          });
        });
      })
      .catch(function () {
        stockList.innerHTML = '<p class="stock-count">Could not load stock.</p>';
      });
  }

  // Restore original fabrics (safety net for accidental deletes)
  var restoreBtn = document.getElementById('restore-btn');
  if (restoreBtn) {
    restoreBtn.addEventListener('click', function () {
      if (!confirm('Restore the 7 original fabrics? Existing fabrics will be kept.')) return;
      restoreBtn.disabled = true;
      restoreBtn.textContent = 'Restoring…';
      adminFetch('/api/admin/catalog/restore-seed', { method: 'POST' })
        .then(function (res) {
          if (res.ok) {
            setStatus(publishStatus, '✅ Restored ' + (res.d.restored || 0) + ' fabrics!', 'ok');
            loadStockList();
          } else {
            setStatus(publishStatus, 'Restore failed.', 'err');
          }
        })
        .catch(function () { setStatus(publishStatus, 'Restore failed.', 'err'); })
        .finally(function () { restoreBtn.disabled = false; restoreBtn.textContent = '♻️ Restore Original 7 Fabrics'; });
    });
  }

  // Init
  if (token) {
    loginGate.hidden = true;
    stockMain.hidden = false;
    // Initialize 4 empty model slots
    for (var _i = 0; _i < 4; _i++) addModelSlot('', '', '');
    loadStockList();
  }
})();
