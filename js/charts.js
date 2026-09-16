/*
 * Earshot: small canvas charts (speed per trial, threshold per session).
 * Speeds are plotted on a log axis because the staircase moves in ratios.
 */
(function (root) {
  'use strict';
  const ES = (root.ES = root.ES || {});
  const U = ES.U;

  const TICKS = [1, 2, 3, 4, 5, 7, 10, 12, 15, 20, 25, 30, 40, 50, 70, 100, 150, 200, 300];

  function prepare(canvas) {
    const w = canvas.clientWidth || 600;
    const h = canvas.clientHeight || 240;
    const dpr = Math.min(2.5, root.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    return { g, w, h };
  }

  /**
   * spec: { points: [{ x, y, filled }], xMin, xMax, threshold, empty }
   */
  function speedChart(canvas, spec) {
    const { g, w, h } = prepare(canvas);
    const col = {
      ink: U.cssVar('--ink'),
      soft: U.cssVar('--ink-soft'),
      line: U.cssVar('--line'),
      strong: U.cssVar('--line-strong'),
      target: U.cssVar('--target'),
      bg: U.cssVar('--bg'),
    };
    const font = U.cssVar('--font-ui') || 'sans-serif';
    const pts = spec.points || [];
    if (!pts.length) {
      g.fillStyle = col.soft;
      g.font = `500 15px ${font}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(spec.empty || 'Nothing to show yet', w / 2, h / 2);
      return;
    }

    const pad = { l: 44, r: spec.threshold ? 86 : 14, t: 18, b: 30 };
    let yMin = Math.min(...pts.map((p) => p.y));
    let yMax = Math.max(...pts.map((p) => p.y));
    if (spec.threshold) {
      yMin = Math.min(yMin, spec.threshold);
      yMax = Math.max(yMax, spec.threshold);
    }
    yMin = Math.max(1, yMin / 1.3);
    yMax = Math.max(yMin * 2, yMax * 1.3);
    const lMin = Math.log(yMin);
    const lMax = Math.log(yMax);
    const Y = (v) => pad.t + (1 - (Math.log(v) - lMin) / (lMax - lMin)) * (h - pad.t - pad.b);
    const xMin = spec.xMin != null ? spec.xMin : 1;
    const xMax = Math.max(spec.xMax != null ? spec.xMax : pts.length, xMin + 1);
    const X = (v) => pad.l + ((v - xMin) / (xMax - xMin)) * (w - pad.l - pad.r);

    g.font = `500 12px ${font}`;
    g.textBaseline = 'middle';
    let ticks = TICKS.filter((t) => t >= yMin && t <= yMax);
    if (ticks.length > 6) ticks = ticks.filter((_, i) => i % 2 === 0);
    for (const t of ticks) {
      const y = Y(t);
      g.strokeStyle = col.line;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(pad.l, y);
      g.lineTo(w - pad.r, y);
      g.stroke();
      g.fillStyle = col.soft;
      g.textAlign = 'right';
      g.fillText(String(t), pad.l - 8, y);
    }
    g.save();
    g.translate(11, pad.t + (h - pad.t - pad.b) / 2);
    g.rotate(-Math.PI / 2);
    g.textAlign = 'center';
    g.fillText('°/s', 0, 0);
    g.restore();

    g.textAlign = 'center';
    g.textBaseline = 'top';
    const step = Math.max(1, Math.ceil((xMax - xMin) / 10));
    for (let x = xMin; x <= xMax; x += step) g.fillText(String(x), X(x), h - pad.b + 9);

    if (spec.threshold) {
      const y = Y(spec.threshold);
      g.strokeStyle = col.target;
      g.lineWidth = 1.5;
      g.setLineDash([6, 4]);
      g.beginPath();
      g.moveTo(pad.l, y);
      g.lineTo(w - pad.r, y);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = col.target;
      g.textAlign = 'left';
      g.textBaseline = 'bottom';
      g.font = `500 12px ${font}`;
      g.fillText('Threshold', w - pad.r + 10, y - 1);
      g.textBaseline = 'top';
      g.font = `600 14px ${font}`;
      g.fillText(U.fmtSpeed(spec.threshold), w - pad.r + 10, y + 1);
    }

    if (pts.length > 1) {
      g.strokeStyle = col.strong;
      g.lineWidth = 1.5;
      g.beginPath();
      pts.forEach((p, i) => (i ? g.lineTo(X(p.x), Y(p.y)) : g.moveTo(X(p.x), Y(p.y))));
      g.stroke();
    }
    for (const p of pts) {
      g.beginPath();
      g.arc(X(p.x), Y(p.y), 4.5, 0, U.TAU);
      g.fillStyle = p.filled ? col.ink : col.bg;
      g.fill();
      g.strokeStyle = col.ink;
      g.lineWidth = 1.5;
      g.stroke();
    }
  }

  ES.Charts = { speedChart };
})(typeof window !== 'undefined' ? window : globalThis);
