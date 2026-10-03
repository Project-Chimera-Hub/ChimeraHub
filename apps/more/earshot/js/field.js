/*
 * Earshot: the polar listening field.
 * A top view of the space around your head, drawn like a microphone polar
 * chart: degree ticks on the rim, straight ahead at the top.
 *
 * Ring: sounds sit on one circle. Floor: distance from the centre is real
 * distance. Dome: distance from the centre shows height (the centre is
 * straight overhead, the dashed circle is ear level).
 */
(function (root) {
  'use strict';
  const ES = (root.ES = root.ES || {});
  const U = ES.U;

  const RING_FRACTION = 0.78;

  class PolarField {
    constructor(canvas) {
      this.canvas = canvas;
      this.g = canvas.getContext('2d');
      this.mode = 'ring';
      this.frontOnly = false;
      this.dots = []; // { id, pos:{x,y,z}, label, state, flash }
      this.hoverId = -1;
      this.focusId = -1;
      this.progress = null; // 0..1 arc around the rim, or null
      this.pointerAz = null; // headphone check pointer
      this.markers = []; // headphone check: [{ az, kind: 'truth' | 'answer' }]
      this.interactive = false;
      this.pointerMode = false;
      this.onHover = null;
      this.onPick = null;
      this.onPoint = null;
      this.onFrame = null;
      this.size = 0;
      this.dpr = 1;
      this.running = false;
      this._raf = 0;
      this._pending = false;
      this._pointerType = 'mouse';
      this.readColors();
      this._bindPointer();
      this._observeSize();
    }

    readColors() {
      const v = (n) => U.cssVar(n);
      this.c = {
        field: v('--field'),
        fieldAlt: v('--field-alt'),
        line: v('--line'),
        lineStrong: v('--line-strong'),
        ink: v('--ink'),
        inkSoft: v('--ink-soft'),
        sound: v('--sound'),
        soundFill: v('--sound-fill'),
        target: v('--target'),
        targetSoft: v('--target-soft'),
        onTarget: v('--on-target'),
        wrong: v('--wrong'),
        shade: v('--shade'),
      };
      this.fontUi = v('--font-ui') || 'sans-serif';
      this.fontDisplay = v('--font-display') || 'sans-serif';
    }

    setArena(mode, frontOnly) {
      this.mode = mode;
      this.frontOnly = !!frontOnly;
      this.requestDraw();
    }

    refresh() {
      this.readColors();
      this._measure();
      this.requestDraw();
    }

    _observeSize() {
      this._measure = () => {
        const w = this.canvas.clientWidth;
        const h = this.canvas.clientHeight;
        const size = Math.min(w, h || w);
        const dpr = Math.min(2.5, root.devicePixelRatio || 1);
        if (!size || (size === this.size && dpr === this.dpr)) return;
        this.size = size;
        this.dpr = dpr;
        this.canvas.width = Math.round(size * dpr);
        this.canvas.height = Math.round(size * dpr);
        this.draw();
      };
      if (root.ResizeObserver) new ResizeObserver(() => this._measure()).observe(this.canvas);
      root.addEventListener('resize', () => this._measure());
      this._measure();
    }

    get center() {
      return this.size / 2;
    }

    get radius() {
      return Math.max(10, this.size / 2 - Math.max(30, this.size * 0.09));
    }

    radialFraction(p) {
      if (this.mode === 'dome') {
        const A = ES.Motion.ARENAS.dome;
        const el = U.toSpherical(p).el;
        return 0.95 * U.clamp((90 - el) / (90 - A.elMin), 0, 1.05);
      }
      if (this.mode === 'disc') {
        return 0.95 * U.clamp(Math.hypot(p.x, p.z) / ES.Motion.ARENAS.disc.rMax, 0, 1.05);
      }
      return RING_FRACTION;
    }

    toScreen(p) {
      const az = U.toRad(U.toSpherical(p).az);
      const r = this.radialFraction(p) * this.radius;
      return { x: this.center + r * Math.sin(az), y: this.center - r * Math.cos(az) };
    }

    azToScreen(azDeg, fraction) {
      const a = U.toRad(azDeg);
      const r = fraction * this.radius;
      return { x: this.center + r * Math.sin(a), y: this.center - r * Math.cos(a) };
    }

    screenToAz(x, y) {
      return U.toDeg(Math.atan2(x - this.center, -(y - this.center)));
    }

    get dotRadius() {
      return Math.max(10, Math.round(this.size * 0.03));
    }

    hitTest(x, y) {
      const reach = this.dotRadius + 8;
      let best = -1;
      let bestD = Infinity;
      for (const d of this.dots) {
        const p = this.toScreen(d.pos);
        const dist = Math.hypot(p.x - x, p.y - y);
        if (dist < reach && dist < bestD) {
          best = d.id;
          bestD = dist;
        }
      }
      return best;
    }

    _bindPointer() {
      const local = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        return {
          x: ((e.clientX - rect.left) / (rect.width || 1)) * this.size,
          y: ((e.clientY - rect.top) / (rect.height || 1)) * this.size,
        };
      };
      const farEnough = (p) => Math.hypot(p.x - this.center, p.y - this.center) > this.radius * 0.12;

      this.canvas.addEventListener('pointerdown', (e) => {
        this._pointerType = e.pointerType || 'mouse';
      });
      this.canvas.addEventListener('pointermove', (e) => {
        const p = local(e);
        if (this.pointerMode) {
          if (farEnough(p)) {
            this.pointerAz = this.screenToAz(p.x, p.y);
            this.requestDraw();
          }
          return;
        }
        if (!this.interactive) return;
        const id = this.hitTest(p.x, p.y);
        this.canvas.style.cursor = id >= 0 ? 'pointer' : '';
        if (id !== this.hoverId) {
          this.hoverId = id;
          this.requestDraw();
          if (this.onHover && e.pointerType === 'mouse') this.onHover(id);
        }
      });
      this.canvas.addEventListener('pointerleave', () => {
        if (this.hoverId !== -1) {
          this.hoverId = -1;
          this.requestDraw();
          if (this.onHover) this.onHover(-1);
        }
      });
      this.canvas.addEventListener('click', (e) => {
        const p = local(e);
        if (this.pointerMode) {
          if (farEnough(p) && this.onPoint) this.onPoint(this.screenToAz(p.x, p.y));
          return;
        }
        if (!this.interactive) return;
        const id = this.hitTest(p.x, p.y);
        if (id >= 0 && this.onPick) this.onPick(id, this._pointerType);
      });
    }

    start() {
      if (this.running) return;
      this.running = true;
      const loop = () => {
        if (!this.running) return;
        if (this.onFrame) this.onFrame();
        this.draw();
        this._raf = root.requestAnimationFrame(loop);
      };
      this._raf = root.requestAnimationFrame(loop);
    }

    stop() {
      this.running = false;
      root.cancelAnimationFrame(this._raf);
      this.requestDraw();
    }

    requestDraw() {
      if (this.running || this._pending) return;
      this._pending = true;
      root.requestAnimationFrame(() => {
        this._pending = false;
        this.draw();
      });
    }

    draw() {
      const S = this.size;
      if (!S) return;
      const g = this.g;
      const c = this.c;
      const cx = this.center;
      const R = this.radius;
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.clearRect(0, 0, S, S);

      g.beginPath();
      g.arc(cx, cx, R, 0, U.TAU);
      g.fillStyle = c.field;
      g.fill();

      this._drawArena(g, cx, R);

      g.strokeStyle = c.line;
      g.lineWidth = 1;
      g.setLineDash([2, 5]);
      g.beginPath();
      g.moveTo(cx, cx - R);
      g.lineTo(cx, cx + R);
      g.moveTo(cx - R, cx);
      g.lineTo(cx + R, cx);
      g.stroke();
      g.setLineDash([]);

      if (this.frontOnly) {
        const lim = ES.Motion.FRONT_LIMIT_DEG;
        g.beginPath();
        g.moveTo(cx, cx);
        g.arc(cx, cx, R, U.toRad(lim - 90), U.toRad(270 - lim));
        g.closePath();
        g.fillStyle = c.shade;
        g.fill();
      }

      this._drawRim(g, cx, R);
      this._drawHead(g, cx, Math.max(11, R * 0.075));

      if (this.progress != null) {
        g.beginPath();
        g.arc(cx, cx, R, -Math.PI / 2, -Math.PI / 2 + U.TAU * this.progress);
        g.strokeStyle = c.ink;
        g.lineWidth = 3;
        g.stroke();
      }

      const r = this.dotRadius;
      this._drawMarkers(g, cx, r);
      const ordered = this.dots.slice().sort((a, b) => this._rank(a) - this._rank(b));
      for (const d of ordered) this._drawDot(g, d, r);
    }

    _rank(d) {
      return (d.id === this.focusId ? 2 : 0) + (d.id === this.hoverId ? 3 : 0);
    }

    _drawArena(g, cx, R) {
      const c = this.c;
      if (this.mode === 'ring') {
        g.beginPath();
        g.arc(cx, cx, R * RING_FRACTION, 0, U.TAU);
        g.strokeStyle = c.lineStrong;
        g.lineWidth = 2;
        g.stroke();
        return;
      }
      if (this.mode === 'disc') {
        const A = ES.Motion.ARENAS.disc;
        const rIn = 0.95 * (A.rMin / A.rMax) * R;
        const rOut = 0.95 * R;
        g.beginPath();
        g.arc(cx, cx, rOut, 0, U.TAU);
        g.arc(cx, cx, rIn, 0, U.TAU, true);
        g.fillStyle = c.fieldAlt;
        g.fill();
        g.strokeStyle = c.lineStrong;
        g.lineWidth = 1.5;
        for (const rr of [rIn, rOut]) {
          g.beginPath();
          g.arc(cx, cx, rr, 0, U.TAU);
          g.stroke();
        }
        g.strokeStyle = c.line;
        g.lineWidth = 1;
        g.setLineDash([3, 4]);
        for (const m of [2, 3]) {
          g.beginPath();
          g.arc(cx, cx, 0.95 * (m / A.rMax) * R, 0, U.TAU);
          g.stroke();
        }
        g.setLineDash([]);
        this._ringLabel(g, cx, 0.95 * (2 / A.rMax) * R, '2 m');
        this._ringLabel(g, cx, 0.95 * (3 / A.rMax) * R, '3 m');
        return;
      }
      const A = ES.Motion.ARENAS.dome;
      const frac = (el) => (0.95 * (90 - el)) / (90 - A.elMin);
      g.beginPath();
      g.arc(cx, cx, frac(A.elMin) * R, 0, U.TAU);
      g.arc(cx, cx, frac(A.elMax) * R, 0, U.TAU, true);
      g.fillStyle = c.fieldAlt;
      g.fill();
      g.strokeStyle = c.lineStrong;
      g.lineWidth = 2;
      g.setLineDash([6, 4]);
      g.beginPath();
      g.arc(cx, cx, frac(0) * R, 0, U.TAU);
      g.stroke();
      g.setLineDash([]);
      g.strokeStyle = c.line;
      g.lineWidth = 1;
      g.beginPath();
      g.arc(cx, cx, frac(30) * R, 0, U.TAU);
      g.stroke();
      this._ringLabel(g, cx, frac(0) * R, 'ear level');
      this._ringLabel(g, cx, frac(30) * R, '30° up');
    }

    _ringLabel(g, cx, r, text) {
      const fs = Math.max(10, Math.round(this.size * 0.022));
      const a = U.toRad(218);
      g.font = `500 ${fs}px ${this.fontUi}`;
      g.fillStyle = this.c.inkSoft;
      g.textAlign = 'right';
      g.textBaseline = 'middle';
      g.fillText(text, cx + r * Math.sin(a) - 6, cx - r * Math.cos(a));
    }

    _drawRim(g, cx, R) {
      const c = this.c;
      g.strokeStyle = c.lineStrong;
      g.lineWidth = 1;
      for (let d = 0; d < 360; d += 10) {
        const long = d % 30 === 0;
        const a = U.toRad(d);
        const r0 = R + 3;
        const r1 = R + (long ? 11 : 6);
        g.beginPath();
        g.moveTo(cx + r0 * Math.sin(a), cx - r0 * Math.cos(a));
        g.lineTo(cx + r1 * Math.sin(a), cx - r1 * Math.cos(a));
        g.stroke();
      }
      g.beginPath();
      g.arc(cx, cx, R, 0, U.TAU);
      g.strokeStyle = c.line;
      g.stroke();

      const fs = Math.max(11, Math.round(this.size * 0.027));
      const off = R + Math.max(20, this.size * 0.052);
      g.font = `500 ${fs}px ${this.fontUi}`;
      g.fillStyle = c.inkSoft;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('Front', cx, cx - off);
      g.fillText('Behind', cx, cx + off);
      g.save();
      g.translate(cx + off, cx);
      g.rotate(Math.PI / 2);
      g.fillText('Right', 0, 0);
      g.restore();
      g.save();
      g.translate(cx - off, cx);
      g.rotate(-Math.PI / 2);
      g.fillText('Left', 0, 0);
      g.restore();
    }

    _drawHead(g, cx, r) {
      const c = this.c;
      g.fillStyle = c.inkSoft;
      g.beginPath();
      g.ellipse(cx - r * 1.02, cx, r * 0.22, r * 0.42, 0, 0, U.TAU);
      g.fill();
      g.beginPath();
      g.ellipse(cx + r * 1.02, cx, r * 0.22, r * 0.42, 0, 0, U.TAU);
      g.fill();
      g.beginPath();
      g.moveTo(cx - r * 0.34, cx - r * 0.84);
      g.lineTo(cx, cx - r * 1.4);
      g.lineTo(cx + r * 0.34, cx - r * 0.84);
      g.closePath();
      g.fillStyle = c.ink;
      g.fill();
      g.beginPath();
      g.arc(cx, cx, r, 0, U.TAU);
      g.fillStyle = c.field;
      g.fill();
      g.strokeStyle = c.ink;
      g.lineWidth = 2;
      g.stroke();
    }

    _drawMarkers(g, cx, r) {
      const c = this.c;
      if (this.pointerAz != null) {
        const p = this.azToScreen(this.pointerAz, RING_FRACTION);
        g.strokeStyle = c.inkSoft;
        g.lineWidth = 1.5;
        g.setLineDash([4, 4]);
        g.beginPath();
        g.moveTo(cx, cx);
        g.lineTo(p.x, p.y);
        g.stroke();
        g.setLineDash([]);
        g.beginPath();
        g.arc(p.x, p.y, r * 0.85, 0, U.TAU);
        g.strokeStyle = c.ink;
        g.lineWidth = 2;
        g.stroke();
      }
      for (const m of this.markers) {
        const p = this.azToScreen(m.az, RING_FRACTION);
        g.beginPath();
        g.arc(p.x, p.y, r, 0, U.TAU);
        if (m.kind === 'truth') {
          g.fillStyle = c.target;
          g.fill();
        } else {
          g.strokeStyle = c.sound;
          g.lineWidth = 3;
          g.stroke();
        }
      }
    }

    _drawDot(g, d, r) {
      const c = this.c;
      const p = this.toScreen(d.pos);
      const hovered = d.id === this.hoverId;
      const focused = d.id === this.focusId;

      if (d.flash > 0) {
        g.beginPath();
        g.arc(p.x, p.y, r + 3 + 9 * d.flash, 0, U.TAU);
        g.fillStyle = d.state === 'cue' || d.state === 'hit' || d.state === 'miss' ? c.targetSoft : c.soundFill;
        g.globalAlpha = Math.min(1, d.flash * 1.5);
        g.fill();
        g.globalAlpha = 1;
      }

      let fill = c.soundFill;
      let stroke = c.sound;
      let text = c.ink;
      let dash = null;
      let width = 2;
      switch (d.state) {
        case 'selected':
        case 'cue':
        case 'hit':
          fill = c.target;
          stroke = c.target;
          text = c.onTarget;
          break;
        case 'miss':
          fill = c.field;
          stroke = c.target;
          text = c.target;
          dash = [4, 3];
          width = 2.5;
          break;
        case 'false':
          fill = c.wrong;
          stroke = c.wrong;
          text = c.onTarget;
          break;
        case 'other':
          fill = c.field;
          stroke = c.lineStrong;
          text = c.inkSoft;
          break;
        default:
          break;
      }

      if (hovered || focused) {
        g.beginPath();
        g.arc(p.x, p.y, r + 5, 0, U.TAU);
        g.strokeStyle = c.ink;
        g.lineWidth = 2;
        if (!hovered) g.setLineDash([3, 3]);
        g.stroke();
        g.setLineDash([]);
      }

      g.beginPath();
      g.arc(p.x, p.y, r, 0, U.TAU);
      g.fillStyle = fill;
      g.fill();
      if (dash) g.setLineDash(dash);
      g.strokeStyle = stroke;
      g.lineWidth = width;
      g.stroke();
      g.setLineDash([]);

      if (d.state === 'hit') {
        g.beginPath();
        g.arc(p.x, p.y, r + 4, 0, U.TAU);
        g.strokeStyle = c.target;
        g.lineWidth = 2;
        g.stroke();
      }

      if (d.label) {
        g.fillStyle = text;
        g.font = `700 ${Math.round(r * 1.05)}px ${this.fontDisplay}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(d.label, p.x, p.y + r * 0.06);
      }
    }
  }

  ES.PolarField = PolarField;
})(typeof window !== 'undefined' ? window : globalThis);
