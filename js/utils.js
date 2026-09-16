/*
 * Earshot: shared helpers.
 * Every script is a classic script (not an ES module) so index.html works
 * when it is opened straight from disk with a file:// address.
 */
(function (root) {
  'use strict';
  const ES = (root.ES = root.ES || {});

  const TAU = Math.PI * 2;

  const U = {
    TAU,

    clamp(v, lo, hi) {
      return v < lo ? lo : v > hi ? hi : v;
    },
    lerp(a, b, t) {
      return a + (b - a) * t;
    },
    toRad(deg) {
      return (deg * Math.PI) / 180;
    },
    toDeg(rad) {
      return (rad * 180) / Math.PI;
    },
    /** Wrap radians to [-PI, PI). */
    wrapPi(a) {
      a = (a + Math.PI) % TAU;
      if (a < 0) a += TAU;
      return a - Math.PI;
    },
    /** Wrap degrees to [-180, 180). */
    wrapDeg(d) {
      d = (d + 180) % 360;
      if (d < 0) d += 360;
      return d - 180;
    },
    dbToGain(db) {
      return Math.pow(10, db / 20);
    },
    rand(lo, hi) {
      return lo + Math.random() * (hi - lo);
    },
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = arr[i];
        arr[i] = arr[j];
        arr[j] = t;
      }
      return arr;
    },
    sample(arr, k) {
      return U.shuffle(arr.slice()).slice(0, k);
    },
    range(n) {
      return Array.from({ length: n }, (_, i) => i);
    },
    mean(values) {
      if (!values.length) return NaN;
      let s = 0;
      for (const v of values) s += v;
      return s / values.length;
    },
    geoMean(values) {
      if (!values.length) return NaN;
      let s = 0;
      for (const v of values) s += Math.log(v);
      return Math.exp(s / values.length);
    },

    /*
     * Coordinates follow the Web Audio listener defaults: listener at the
     * origin, facing -z, +y is up, +x is to the right.
     * Azimuth: 0 = straight ahead, +90 = right, -90 = left, 180 = behind.
     * Elevation: 0 = ear level, positive = above.
     */
    toCartesian(azDeg, elDeg, r) {
      const az = U.toRad(azDeg);
      const el = U.toRad(elDeg);
      return {
        x: r * Math.cos(el) * Math.sin(az),
        y: r * Math.sin(el),
        z: -r * Math.cos(el) * Math.cos(az),
      };
    },
    toSpherical(p) {
      const r = Math.hypot(p.x, p.y, p.z) || 1e-9;
      return {
        az: U.toDeg(Math.atan2(p.x, -p.z)),
        el: U.toDeg(Math.asin(U.clamp(p.y / r, -1, 1))),
        r,
      };
    },
    clockLabel(azDeg) {
      let h = Math.round((((azDeg % 360) + 360) % 360) / 30) % 12;
      if (h === 0) h = 12;
      return h + ' o’clock';
    },

    fmtSpeed(v) {
      if (!isFinite(v)) return '–';
      return v >= 100 ? v.toFixed(0) : v.toFixed(1);
    },
    fmtDate(ts) {
      return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    },
    fmtTime(ts) {
      return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    },
    plural(n, one, many) {
      return n + ' ' + (n === 1 ? one : many || one + 's');
    },
    uid() {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    },
    escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    },

    /** localStorage wrapper: file:// pages and private modes can refuse storage. */
    store: {
      get(key, fallback) {
        try {
          const raw = root.localStorage.getItem(key);
          return raw == null ? fallback : JSON.parse(raw);
        } catch (e) {
          return fallback;
        }
      },
      set(key, value) {
        try {
          root.localStorage.setItem(key, JSON.stringify(value));
          return true;
        } catch (e) {
          return false;
        }
      },
      remove(key) {
        try {
          root.localStorage.removeItem(key);
        } catch (e) {
          /* storage unavailable */
        }
      },
    },

    download(filename, text, mime) {
      try {
        const blob = new Blob([text], { type: mime || 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        return true;
      } catch (e) {
        return false;
      }
    },

    $(sel, scope) {
      return (scope || document).querySelector(sel);
    },
    $$(sel, scope) {
      return Array.from((scope || document).querySelectorAll(sel));
    },
    cssVar(name) {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    },
  };

  ES.U = U;
})(typeof window !== 'undefined' ? window : globalThis);
