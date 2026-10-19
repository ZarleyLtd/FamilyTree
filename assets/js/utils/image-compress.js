/**
 * Resize a photo in the browser and encode it as a JPEG near a byte budget.
 * ImageCompress.compressToTarget(file, { targetBytes, maxWidth }) →
 * { blob, base64, width, height, mimeType, byteSize }
 */
(function (global) {
  'use strict';

  function loadSource(file) {
    if (typeof createImageBitmap === 'function') {
      var opts = { imageOrientation: 'from-image' };
      return createImageBitmap(file, opts).catch(function () {
        return createImageBitmap(file);
      });
    }
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Could not read that image'));
      };
      img.src = url;
    });
  }

  function closeSource(src) {
    if (src && typeof src.close === 'function') src.close();
  }

  function render(src, width, height, quality) {
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(src, 0, 0, width, height);
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (!blob) reject(new Error('Could not compress that image'));
        else resolve(blob);
      }, 'image/jpeg', quality);
    });
  }

  function toBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var text = String(reader.result || '');
        var i = text.indexOf(',');
        resolve(i >= 0 ? text.slice(i + 1) : text);
      };
      reader.onerror = function () {
        reject(new Error('Could not read the compressed image'));
      };
      reader.readAsDataURL(blob);
    });
  }

  function compressToTarget(file, opts) {
    opts = opts || {};
    var cfg = global.FAMILYTREE_CONFIG || {};
    var target = opts.targetBytes || cfg.IMAGE_TARGET_BYTES || 100 * 1024;
    var maxEdge = opts.maxWidth || opts.maxEdge || cfg.IMAGE_MAX_EDGE || 1080;
    if (!file) return Promise.reject(new Error('Choose a photo first'));
    return loadSource(file).then(function (src) {
      var sw = src.width || src.naturalWidth;
      var sh = src.height || src.naturalHeight;
      if (!sw || !sh) {
        closeSource(src);
        throw new Error('Could not read that image');
      }
      var scale = Math.min(1, maxEdge / Math.max(sw, sh));
      var quality = 0.82;
      var best = null;
      var steps = 0;

      function attempt() {
        var w = Math.max(1, Math.round(sw * scale));
        var h = Math.max(1, Math.round(sh * scale));
        return render(src, w, h, quality).then(function (blob) {
          if (!best || blob.size < best.blob.size) best = { blob: blob, width: w, height: h };
          if (blob.size <= target) return best;
          steps += 1;
          if (steps > 14 || (w < 280 && h < 280)) return best;
          if (quality > 0.46) quality = Math.round((quality - 0.08) * 100) / 100;
          else {
            scale *= 0.8;
            quality = 0.72;
          }
          return attempt();
        });
      }

      return attempt().then(function (done) {
        closeSource(src);
        if (!done || done.blob.size > 150 * 1024) {
          throw new Error('That photo is still too large after compression. Try a smaller one.');
        }
        return toBase64(done.blob).then(function (base64) {
          return {
            blob: done.blob,
            base64: base64,
            width: done.width,
            height: done.height,
            mimeType: 'image/jpeg',
            byteSize: done.blob.size
          };
        });
      }, function (err) {
        closeSource(src);
        throw err;
      });
    });
  }

  global.ImageCompress = { compressToTarget: compressToTarget };
})(typeof window !== 'undefined' ? window : this);
