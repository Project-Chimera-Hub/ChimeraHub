/*
 * Earshot: motion simulation.
 * Each trial's trajectories are computed up front. The audio engine then
 * applies them as automation curves, so movement is sample-accurate and does
 * not depend on the screen's frame rate.
 *
 * Arenas
 *   ring  sounds glide along a circle at ear level (only azimuth changes)
 *   disc  sounds roam a flat ring-shaped floor around you (azimuth + distance)
 *   dome  sounds travel over a dome from below ear level to well above it
 *
 * Sounds bounce off each other and off the arena's edges, like the balls in
 * visual 3D-MOT. All sounds move at the nominal speed (the ring spreads the
 * individual speeds ±20% so sounds moving the same way can still meet).
 */
(function (root) {
  'use strict';
  const ES = (root.ES = root.ES || {});
  const U = ES.U;

  const ARENAS = {
    ring: { radius: 2.0, collisionDeg: 20 },
    disc: { rMin: 1.2, rMax: 3.2, collision: 0.55 },
    dome: { radius: 2.0, elMin: -20, elMax: 50, collisionDeg: 22 },
  };

  const FRONT_LIMIT_DEG = 80; // "Front only" keeps sounds within about ±80° of straight ahead
  const SIM_HZ = 400; // physics substeps per second
  const REC_HZ = 100; // stored trajectory resolution
  const REVERSAL_RATE = 0.12; // ring: spontaneous direction changes per sound per second

  function recorder(n, duration) {
    const count = Math.max(2, Math.round(duration * REC_HZ) + 1);
    const make = () => U.range(n).map(() => new Float32Array(count));
    return { count, xs: make(), ys: make(), zs: make() };
  }

  function substeps(rec, duration) {
    const recDt = duration / (rec.count - 1);
    const sub = Math.max(1, Math.ceil(recDt * SIM_HZ));
    return { sub, h: recDt / sub };
  }

  function angleBetweenDeg(a, b) {
    const la = Math.hypot(a.x, a.y, a.z);
    const lb = Math.hypot(b.x, b.y, b.z);
    const c = (a.x * b.x + a.y * b.y + a.z * b.z) / (la * lb || 1e-9);
    return U.toDeg(Math.acos(U.clamp(c, -1, 1)));
  }

  /** Random starting points kept apart in angle (and optionally in metres). Relaxes if it can't fit. */
  function placeApart(n, generate, minSepDeg, minDist) {
    let sep = minSepDeg;
    let dist = minDist || 0;
    for (let round = 0; round < 10; round++) {
      for (let attempt = 0; attempt < 60; attempt++) {
        const pts = [];
        for (let tries = 0; tries < 400 && pts.length < n; tries++) {
          const s = generate();
          const p = U.toCartesian(s.az, s.el, s.r);
          let ok = true;
          for (const q of pts) {
            if (angleBetweenDeg(p, q) < sep || Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) < dist) {
              ok = false;
              break;
            }
          }
          if (ok) pts.push(p);
        }
        if (pts.length === n) return pts;
      }
      sep *= 0.85;
      dist *= 0.85;
    }
    const s = generate();
    return U.range(n).map((i) => U.toCartesian(-70 + (140 * i) / Math.max(1, n - 1), 0, s.r));
  }

  /* ---------------- ring ---------------- */

  function simulateRing(o) {
    const n = o.n;
    const R = ARENAS.ring.radius;
    const front = !!o.frontOnly;
    const lim = U.toRad(FRONT_LIMIT_DEG);
    const span = front ? 2 * lim : U.TAU;
    const col = Math.min(U.toRad(ARENAS.ring.collisionDeg), span / (2 * n));
    const base = U.toRad(o.speed);

    const th = new Float64Array(n);
    const om = new Float64Array(n);

    // Start evenly spread (with a little jitter) so every sound is distinct during the cue.
    const spacing = span / n;
    const offset = front ? -lim : Math.random() * U.TAU;
    const slots = U.shuffle(U.range(n));
    for (let i = 0; i < n; i++) {
      const a = offset + spacing * (slots[i] + 0.5) + U.rand(-0.15, 0.15) * spacing;
      th[i] = front ? a : U.wrapPi(a);
    }
    const factors = U.shuffle(U.range(n).map((i) => 0.8 + (0.4 * i) / Math.max(1, n - 1)));
    for (let i = 0; i < n; i++) om[i] = base * factors[i] * (Math.random() < 0.5 ? -1 : 1);

    const rec = recorder(n, o.duration);
    const { sub, h } = substeps(rec, o.duration);
    let bounces = 0;

    for (let k = 0; k < rec.count; k++) {
      for (let i = 0; i < n; i++) {
        rec.xs[i][k] = R * Math.sin(th[i]);
        rec.ys[i][k] = 0;
        rec.zs[i][k] = -R * Math.cos(th[i]);
      }
      if (k === rec.count - 1) break;
      for (let s = 0; s < sub; s++) {
        for (let i = 0; i < n; i++) {
          if (Math.random() < REVERSAL_RATE * h) om[i] = -om[i];
          th[i] += om[i] * h;
          if (front) {
            if (th[i] > lim) {
              th[i] = 2 * lim - th[i];
              om[i] = -Math.abs(om[i]);
            } else if (th[i] < -lim) {
              th[i] = -2 * lim - th[i];
              om[i] = Math.abs(om[i]);
            }
          } else {
            th[i] = U.wrapPi(th[i]);
          }
        }
        // Equal-mass collisions on a line: the two sounds swap velocities.
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            const d = front ? th[j] - th[i] : U.wrapPi(th[j] - th[i]);
            if (Math.abs(d) < col && (om[i] - om[j]) * Math.sign(d) > 0) {
              const t = om[i];
              om[i] = om[j];
              om[j] = t;
              bounces++;
            }
          }
        }
      }
    }
    return finish(o, rec, n, bounces);
  }

  /* ---------------- disc (floor) ---------------- */

  function simulateDisc(o) {
    const n = o.n;
    const A = ARENAS.disc;
    const front = !!o.frontOnly;
    const v = U.toRad(o.speed) * ((A.rMin + A.rMax) / 2); // m/s at the middle radius
    const lim = U.toRad(FRONT_LIMIT_DEG);

    const azLim = front ? 70 : 180;
    const minSep = front ? Math.min(30, 150 / n) : Math.min(45, 320 / n);
    const pts = placeApart(
      n,
      () => ({ az: U.rand(-azLim, azLim), el: 0, r: U.rand(A.rMin + 0.25, A.rMax - 0.25) }),
      minSep,
      A.collision * 1.6
    );

    const px = new Float64Array(n);
    const pz = new Float64Array(n);
    const vx = new Float64Array(n);
    const vz = new Float64Array(n);
    const renorm = (i) => {
      const m = Math.hypot(vx[i], vz[i]);
      if (m < 1e-9) {
        const a = Math.random() * U.TAU;
        vx[i] = v * Math.cos(a);
        vz[i] = v * Math.sin(a);
      } else {
        vx[i] *= v / m;
        vz[i] *= v / m;
      }
    };
    for (let i = 0; i < n; i++) {
      px[i] = pts[i].x;
      pz[i] = pts[i].z;
      const a = Math.random() * U.TAU;
      vx[i] = v * Math.cos(a);
      vz[i] = v * Math.sin(a);
    }

    const rec = recorder(n, o.duration);
    const { sub, h } = substeps(rec, o.duration);
    let bounces = 0;

    for (let k = 0; k < rec.count; k++) {
      for (let i = 0; i < n; i++) {
        rec.xs[i][k] = px[i];
        rec.ys[i][k] = 0;
        rec.zs[i][k] = pz[i];
      }
      if (k === rec.count - 1) break;
      for (let s = 0; s < sub; s++) {
        for (let i = 0; i < n; i++) {
          px[i] += vx[i] * h;
          pz[i] += vz[i] * h;
          const r = Math.hypot(px[i], pz[i]);
          if (r > 1e-9) {
            const ux = px[i] / r;
            const uz = pz[i] / r;
            const vr = vx[i] * ux + vz[i] * uz;
            if ((r > A.rMax && vr > 0) || (r < A.rMin && vr < 0)) {
              vx[i] -= 2 * vr * ux;
              vz[i] -= 2 * vr * uz;
              const rc = r > A.rMax ? A.rMax : A.rMin;
              px[i] = ux * rc;
              pz[i] = uz * rc;
            }
          }
          if (front) {
            // Keep the azimuth within ±FRONT_LIMIT_DEG by reflecting off the boundary ray.
            const az = Math.atan2(px[i], -pz[i]);
            if (Math.abs(az) > lim) {
              const side = az > 0 ? 1 : -1;
              const turning = (-pz[i] * vx[i] + px[i] * vz[i]) * side; // > 0 when moving further out
              const dx = Math.sin(side * lim);
              const dz = -Math.cos(side * lim);
              if (turning > 0) {
                const along = vx[i] * dx + vz[i] * dz;
                vx[i] = 2 * along * dx - vx[i];
                vz[i] = 2 * along * dz - vz[i];
              }
              const rr = Math.hypot(px[i], pz[i]);
              px[i] = rr * dx;
              pz[i] = rr * dz;
            }
          }
        }
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            const dx = px[j] - px[i];
            const dz = pz[j] - pz[i];
            const d = Math.hypot(dx, dz);
            if (d < A.collision && d > 1e-9) {
              const nx = dx / d;
              const nz = dz / d;
              const rel = (vx[i] - vx[j]) * nx + (vz[i] - vz[j]) * nz;
              if (rel > 0) {
                vx[i] -= rel * nx;
                vz[i] -= rel * nz;
                vx[j] += rel * nx;
                vz[j] += rel * nz;
                renorm(i);
                renorm(j);
                bounces++;
              }
            }
          }
        }
      }
    }
    return finish(o, rec, n, bounces);
  }

  /* ---------------- dome ---------------- */

  function simulateDome(o) {
    const n = o.n;
    const A = ARENAS.dome;
    const R = A.radius;
    const front = !!o.frontOnly;
    const w = U.toRad(o.speed); // angular speed over the dome, rad/s
    const sinMax = Math.sin(U.toRad(A.elMax));
    const sinMin = Math.sin(U.toRad(A.elMin));
    const cosCol = Math.cos(U.toRad(A.collisionDeg));
    const frontMin = Math.cos(U.toRad(FRONT_LIMIT_DEG));

    const azLim = front ? 68 : 180;
    const minSep = front ? Math.min(32, 150 / n) : Math.min(45, 320 / n);
    const pts = placeApart(n, () => ({ az: U.rand(-azLim, azLim), el: U.rand(A.elMin + 8, A.elMax - 8), r: 1 }), minSep, 0);

    const ux = new Float64Array(n);
    const uy = new Float64Array(n);
    const uz = new Float64Array(n);
    const wx = new Float64Array(n);
    const wy = new Float64Array(n);
    const wz = new Float64Array(n);

    // Keep the velocity tangent to the sphere and at the nominal speed.
    const tangentize = (i) => {
      const d = wx[i] * ux[i] + wy[i] * uy[i] + wz[i] * uz[i];
      wx[i] -= d * ux[i];
      wy[i] -= d * uy[i];
      wz[i] -= d * uz[i];
      let m = Math.hypot(wx[i], wy[i], wz[i]);
      if (m < 1e-9) {
        let gx = Math.random() - 0.5;
        let gy = Math.random() - 0.5;
        let gz = Math.random() - 0.5;
        const gd = gx * ux[i] + gy * uy[i] + gz * uz[i];
        gx -= gd * ux[i];
        gy -= gd * uy[i];
        gz -= gd * uz[i];
        m = Math.hypot(gx, gy, gz) || 1;
        wx[i] = gx;
        wy[i] = gy;
        wz[i] = gz;
      }
      const s = w / m;
      wx[i] *= s;
      wy[i] *= s;
      wz[i] *= s;
    };

    for (let i = 0; i < n; i++) {
      const m = Math.hypot(pts[i].x, pts[i].y, pts[i].z) || 1;
      ux[i] = pts[i].x / m;
      uy[i] = pts[i].y / m;
      uz[i] = pts[i].z / m;
      wx[i] = Math.random() - 0.5;
      wy[i] = (Math.random() - 0.5) * 0.6; // favour sideways motion; height cues are weak
      wz[i] = Math.random() - 0.5;
      tangentize(i);
    }

    const rec = recorder(n, o.duration);
    const { sub, h } = substeps(rec, o.duration);
    let bounces = 0;

    for (let k = 0; k < rec.count; k++) {
      for (let i = 0; i < n; i++) {
        rec.xs[i][k] = R * ux[i];
        rec.ys[i][k] = R * uy[i];
        rec.zs[i][k] = R * uz[i];
      }
      if (k === rec.count - 1) break;
      for (let s = 0; s < sub; s++) {
        for (let i = 0; i < n; i++) {
          let x = ux[i] + wx[i] * h;
          let y = uy[i] + wy[i] * h;
          let z = uz[i] + wz[i] * h;
          const m = Math.hypot(x, y, z);
          x /= m;
          y /= m;
          z /= m;
          ux[i] = x;
          uy[i] = y;
          uz[i] = z;
          tangentize(i);

          // Height limits: reflect the vertical part of the motion.
          const ex = -y * x;
          const ey = 1 - y * y;
          const ez = -y * z;
          const em = Math.hypot(ex, ey, ez);
          if (em > 1e-6) {
            const kUp = (wx[i] * ex + wy[i] * ey + wz[i] * ez) / em;
            if ((y > sinMax && kUp > 0) || (y < sinMin && kUp < 0)) {
              const f = (2 * kUp) / em;
              wx[i] -= f * ex;
              wy[i] -= f * ey;
              wz[i] -= f * ez;
            }
          }
          // Front only: reflect the forward part of the motion near the side limit.
          if (front && -z < frontMin) {
            const fx = z * x;
            const fy = z * y;
            const fz = -1 + z * z;
            const fm = Math.hypot(fx, fy, fz);
            if (fm > 1e-6) {
              const kFwd = (wx[i] * fx + wy[i] * fy + wz[i] * fz) / fm;
              if (kFwd < 0) {
                const f = (2 * kFwd) / fm;
                wx[i] -= f * fx;
                wy[i] -= f * fy;
                wz[i] -= f * fz;
              }
            }
          }
        }
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            const c = ux[i] * ux[j] + uy[i] * uy[j] + uz[i] * uz[j];
            if (c > cosCol) {
              let nx = ux[j] - ux[i];
              let ny = uy[j] - uy[i];
              let nz = uz[j] - uz[i];
              const nm = Math.hypot(nx, ny, nz);
              if (nm > 1e-9) {
                nx /= nm;
                ny /= nm;
                nz /= nm;
                const rel = (wx[i] - wx[j]) * nx + (wy[i] - wy[j]) * ny + (wz[i] - wz[j]) * nz;
                if (rel > 0) {
                  wx[i] -= rel * nx;
                  wy[i] -= rel * ny;
                  wz[i] -= rel * nz;
                  wx[j] += rel * nx;
                  wy[j] += rel * ny;
                  wz[j] += rel * nz;
                  tangentize(i);
                  tangentize(j);
                  bounces++;
                }
              }
            }
          }
        }
      }
    }
    return finish(o, rec, n, bounces);
  }

  /* ---------------- shared ---------------- */

  function finish(o, rec, n, bounces) {
    const last = rec.count - 1;
    const at = (i, k) => ({ x: rec.xs[i][k], y: rec.ys[i][k], z: rec.zs[i][k] });
    return {
      mode: o.mode,
      n,
      speed: o.speed,
      duration: o.duration,
      frontOnly: !!o.frontOnly,
      count: rec.count,
      xs: rec.xs,
      ys: rec.ys,
      zs: rec.zs,
      initial: U.range(n).map((i) => at(i, 0)),
      final: U.range(n).map((i) => at(i, last)),
      bounces,
    };
  }

  function simulate(options) {
    const o = Object.assign({ mode: 'ring', n: 4, speed: 20, duration: 8, frontOnly: false }, options);
    if (o.mode === 'disc') return simulateDisc(o);
    if (o.mode === 'dome') return simulateDome(o);
    o.mode = 'ring';
    return simulateRing(o);
  }

  /** Position of sound i, t seconds after motion starts (clamped to the trajectory). */
  function positionAt(traj, i, t) {
    if (!(t > 0)) return traj.initial[i];
    if (t >= traj.duration) return traj.final[i];
    const f = (t / traj.duration) * (traj.count - 1);
    const k = Math.min(traj.count - 2, Math.floor(f));
    const a = f - k;
    return {
      x: traj.xs[i][k] + (traj.xs[i][k + 1] - traj.xs[i][k]) * a,
      y: traj.ys[i][k] + (traj.ys[i][k + 1] - traj.ys[i][k]) * a,
      z: traj.zs[i][k] + (traj.zs[i][k + 1] - traj.zs[i][k]) * a,
    };
  }

  /**
   * Order used to number the sounds when choosing: clockwise from straight ahead,
   * or left to right when the arena is front only.
   */
  function labelOrder(points, frontOnly) {
    const items = points.map((p, i) => ({ i, az: U.toSpherical(p).az }));
    if (frontOnly) items.sort((a, b) => a.az - b.az);
    else items.sort((a, b) => ((a.az + 360) % 360) - ((b.az + 360) % 360));
    return items.map((d) => d.i);
  }

  ES.Motion = { ARENAS, FRONT_LIMIT_DEG, simulate, positionAt, labelOrder };
})(typeof window !== 'undefined' ? window : globalThis);
