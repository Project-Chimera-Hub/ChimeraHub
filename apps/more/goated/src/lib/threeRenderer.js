import * as THREE from 'three';
import { renderRelationship, is3D, drawScrapToken, drawVoronoiToken } from './relationshipRenderer';
import { getSynaesthesiaColor } from './shapeRenderer';
import { SCRAP_TOKEN_PREFIX, VORONOI_TOKEN_PREFIX } from './gameConstants';

// 3D shapes using Three.js
const SHAPES_3D = ['cube', 'sphere', 'pyramid', 'cone', 'torus', 'octahedron'];

function createThreeTextSprite(text, colorHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; // double size for high-DPI crisp rendering of text sprites
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // If this is a procedural clipart token (Junk-Journal or Voronoi), render it as gorgeous clipart!
  if (typeof text === 'string' && text.startsWith(SCRAP_TOKEN_PREFIX)) {
    const seed = Number(text.slice(SCRAP_TOKEN_PREFIX.length)) || 0;
    ctx.clearRect(0, 0, 512, 512);
    // Draw the procedural hand-torn paper scrap collage clipping!
    drawScrapToken(ctx, seed, 256, 256, 420, colorHex);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(3, 3, 1);
    return sprite;
  }
  
  if (typeof text === 'string' && text.startsWith(VORONOI_TOKEN_PREFIX)) {
    const seed = text.slice(VORONOI_TOKEN_PREFIX.length);
    ctx.clearRect(0, 0, 512, 512);
    // Draw the procedural organic Voronoi diagram!
    drawVoronoiToken(ctx, seed, 256, 256, 420, colorHex);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(3, 3, 1);
    return sprite;
  }
  
  const isEmoji = /\p{Emoji}/u.test(text);
  
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  if (isEmoji) {
    const size = 420; // scaled up from 320 to prevent squinting!
    ctx.font = `bold ${size}px serif`;
    ctx.fillStyle = colorHex;
    ctx.shadowColor = colorHex;
    ctx.shadowBlur = 20;
    ctx.fillText(text, 256, 256);
  } else {
    // Determine responsive font size based on text length to fit perfectly in 512x512 canvas
    let size = 175; // scaled up from 130 to prevent squinting!
    const aspectEstimate = 0.6;
    const maxLengthSize = (512 * 0.95) / (text.length * aspectEstimate);
    size = Math.min(size, maxLengthSize);
    size = Math.max(size, 60);

    ctx.font = `bold ${size}px 'JetBrains Mono', monospace`;
    const charWidth = ctx.measureText('M').width;
    const totalWidth = text.length * charWidth;
    const startX = 256 - totalWidth / 2 + charWidth / 2;
    
    const synaesthesiaEnabled = localStorage.getItem('goated_synaesthesia_enabled') === 'true';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const x = startX + i * charWidth;
      const charColor = synaesthesiaEnabled ? getSynaesthesiaColor(char, colorHex) : colorHex;
      
      ctx.save();
      ctx.fillStyle = charColor;
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = Math.max(5.5, size * 0.16);
      ctx.lineJoin = 'round';
      ctx.strokeText(char, x, 256);
      ctx.fillText(char, x, 256);
      ctx.restore();
    }
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(3, 3, 1);
  return sprite;
}

function createShape3D(shapeType, size, color) {
  if (typeof shapeType === 'string' && shapeType && !SHAPES_3D.includes(shapeType)) {
    const colorHex = '#' + (typeof color === 'number' ? color.toString(16).padStart(6, '0') : String(color).replace('#',''));
    return createThreeTextSprite(shapeType, colorHex);
  }

  let geometry;
  switch (shapeType) {
    case 'cube':
      geometry = new THREE.BoxGeometry(size, size, size);
      break;
    case 'sphere':
      geometry = new THREE.SphereGeometry(size / 2, 16, 12);
      break;
    case 'pyramid':
      geometry = new THREE.TetrahedronGeometry(size);
      break;
    case 'cone':
      geometry = new THREE.ConeGeometry(size / 2, size, 16);
      break;
    case 'torus':
      geometry = new THREE.TorusGeometry(size / 2, size / 4, 8, 32);
      break;
    case 'octahedron':
      geometry = new THREE.OctahedronGeometry(size);
      break;
    default:
      geometry = new THREE.BoxGeometry(size, size, size);
  }
  const material = new THREE.MeshStandardMaterial({ 
    color, 
    metalness: 0.2, 
    roughness: 0.5,
    side: THREE.FrontSide
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

// Position two meshes per a SPATIAL_3D relationship's semantics. Shared by
// the standalone 3D renderer and the offscreen still-render used inside
// alien-cube / square / tesseract panels.
function applySpatial3DPositioning(relationship, mesh1, mesh2) {
  switch (relationship) {
    case 'DEPTH_LAYERED':       mesh1.position.z = -2; mesh2.position.z = 2; break;
    case 'ORBITING':            mesh1.position.set(0, 0, 0); mesh2.position.set(3, 0, 0); break;
    case 'ROTATING_PAIR':       mesh1.position.set(-2, 0, 0); mesh2.position.set(2, 0, 0); break;
    case 'NESTED_VOLUME':       mesh1.position.set(0, 0, 0); mesh2.position.set(0, 0, 0); mesh2.scale.set(0.5, 0.5, 0.5); break;
    case 'ASCENDING_SPIRAL':    mesh1.position.set(0, -2, 0); mesh2.position.set(2, 2, 0); break;
    case 'COLLIDING':           mesh1.position.set(-1.5, 0, 0); mesh2.position.set(1.5, 0, 0); break;
    case 'REPELLING':           mesh1.position.set(-3, 0, 0); mesh2.position.set(3, 0, 0); break;
    case 'BOUND_BY_GRAVITY':    mesh1.position.set(0, 0, 0); mesh2.position.set(0, -3, 0); break;
    case 'INTERSECTING_PLANES': mesh1.position.set(-1, 0, 0); mesh2.position.set(1, 0, 0); mesh2.rotation.z = Math.PI / 4; break;
    case 'IN_FRONT_OF':         mesh1.position.z = 2; mesh2.position.z = -1; break;
    case 'BEHIND':              mesh1.position.z = -2; mesh2.position.z = 1; break;
    case 'STACKED_3D':          mesh1.position.set(0, 0.8, 0); mesh2.position.set(0, -0.8, 0); break;
    case 'LEANING_AGAINST':     mesh1.position.set(-1.5, 0, 0); mesh1.rotation.z = 0.3; mesh2.position.set(1.5, 0, 0); break;
    case 'FLOATING_ABOVE':      mesh1.position.set(0, 2, 0); mesh2.position.set(0, -1, 0); break;
    case 'CASTING_SHADOW':      mesh1.position.set(-1, 1.5, 1); mesh2.position.set(-1, -1.5, -2); break;
  }
}

// Add decoration geometry that makes each SPATIAL_3D relation visually
// distinguishable from every other one. Returns optional per-frame
// updaters which the caller can drive from its animation loop.
//
// Without these, every SPATIAL_3D rel was just "two shapes at slightly
// different coords" — and most players couldn't tell DEPTH_LAYERED from
// IN_FRONT_OF from BEHIND, or ROTATING_PAIR from COLLIDING from REPELLING.
// The decorations give each relation a semantic signature: orbit ring for
// ORBITING, ground plane + shadow for FLOATING_ABOVE / CASTING_SHADOW,
// tether for BOUND_BY_GRAVITY, depth grid for IN_FRONT_OF / BEHIND, etc.
function decorateSpatial3DScene(scene, relationship, mesh1, mesh2, colorHexes) {
  const updaters = [];
  const toC = (c) => typeof c === 'string' && c.startsWith('#') ? parseInt(c.slice(1), 16) : c;
  const accent = toC(colorHexes?.[0] ?? '#22d3ee');

  switch (relationship) {
    case 'ORBITING': {
      // Dashed elliptical orbit at y=0 plane
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(2.85, 3.05, 64),
        new THREE.MeshBasicMaterial({ color: 0x9aa8ff, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
      );
      ring.rotation.x = Math.PI / 2;
      scene.add(ring);
      // Small directional marker showing the orbit direction
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.36, 12),
        new THREE.MeshBasicMaterial({ color: 0x9aa8ff })
      );
      tip.rotation.x = Math.PI / 2;
      scene.add(tip);
      updaters.push((t) => {
        const a = t * 0.6 + Math.PI / 2;
        tip.position.set(Math.cos(a) * 3, 0, Math.sin(a) * 3);
        tip.rotation.z = -a + Math.PI / 2;
      });
      break;
    }
    case 'ROTATING_PAIR': {
      // Bar connecting the two meshes — readable as a "barbell" rotating
      // around its center.
      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 5, 12),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.5, roughness: 0.4 })
      );
      bar.rotation.z = Math.PI / 2;
      scene.add(bar);
      updaters.push(() => {
        // Bar tracks the mesh1↔mesh2 axis so it visibly rotates with them.
        const cx = (mesh1.position.x + mesh2.position.x) / 2;
        const cy = (mesh1.position.y + mesh2.position.y) / 2;
        const cz = (mesh1.position.z + mesh2.position.z) / 2;
        bar.position.set(cx, cy, cz);
        const dx = mesh2.position.x - mesh1.position.x;
        const dy = mesh2.position.y - mesh1.position.y;
        const angle = Math.atan2(dy, dx);
        bar.rotation.set(0, 0, angle - Math.PI / 2);
        const len = Math.max(0.1, Math.hypot(dx, dy));
        bar.scale.y = len / 5;
      });
      // Pivot dot at center
      const pivot = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
      );
      scene.add(pivot);
      break;
    }
    case 'REPELLING': {
      // Two outward-pointing arrows
      [-1, 1].forEach(dir => {
        const arrow = new THREE.ArrowHelper(
          new THREE.Vector3(dir, 0, 0),
          new THREE.Vector3(dir * 0.6, 0, 0),
          1.4,
          0xf87171,
          0.4,
          0.28
        );
        scene.add(arrow);
      });
      break;
    }
    case 'COLLIDING': {
      // Starburst at midpoint that pulses
      const burst = new THREE.Group();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const geo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0),
          new THREE.Vector3(Math.cos(a) * 1.0, Math.sin(a) * 1.0, 0),
        ]);
        const mat = new THREE.LineBasicMaterial({ color: 0xfbbf24 });
        burst.add(new THREE.Line(geo, mat));
      }
      scene.add(burst);
      updaters.push((t) => {
        const s = 0.85 + Math.sin(t * 6) * 0.2;
        burst.scale.setScalar(s);
        burst.rotation.z = t * 0.4;
      });
      break;
    }
    case 'BOUND_BY_GRAVITY': {
      // Make the bottom anchor visually heavier and tether the top mesh
      // to it with a dashed line.
      mesh2.scale.setScalar(1.5);
      const tetherGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, -3, 0),
      ]);
      const tetherMat = new THREE.LineDashedMaterial({ color: 0xa78bfa, dashSize: 0.25, gapSize: 0.18, transparent: true, opacity: 0.7 });
      const tether = new THREE.Line(tetherGeo, tetherMat);
      tether.computeLineDistances();
      scene.add(tether);
      break;
    }
    case 'INTERSECTING_PLANES': {
      // Make the meshes thin slabs that visibly intersect at the origin.
      mesh1.scale.set(0.15, 1.6, 1.6);
      mesh2.scale.set(1.6, 1.6, 0.15);
      mesh2.rotation.z = 0;
      mesh1.position.set(0, 0, 0);
      mesh2.position.set(0, 0, 0);
      break;
    }
    case 'LEANING_AGAINST': {
      // Floor line so the lean has a clear reference
      const floor = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-4, -2, 0), new THREE.Vector3(4, -2, 0)]),
        new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.7 })
      );
      scene.add(floor);
      mesh1.position.y = -0.5;
      mesh2.position.y = -0.5;
      break;
    }
    case 'FLOATING_ABOVE': {
      // Ground plane + shadow ellipse below the floating mesh
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 8),
        new THREE.MeshBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -2.5;
      scene.add(ground);
      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.9, 32),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(0, -2.45, 0);
      scene.add(shadow);
      break;
    }
    case 'CASTING_SHADOW': {
      // Ground + a stretched offset shadow cast from the lit mesh
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 10),
        new THREE.MeshBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -2.5;
      scene.add(ground);
      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(1.0, 32),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.scale.set(1.8, 1, 1);
      shadow.position.set(1.6, -2.45, 0);
      scene.add(shadow);
      break;
    }
    case 'STACKED_3D': {
      // Move meshes flush and add a base platform under them
      mesh1.position.set(0, 1.0, 0);
      mesh2.position.set(0, -1.0, 0);
      const platform = new THREE.Mesh(
        new THREE.CylinderGeometry(1.7, 1.7, 0.25, 32),
        new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.3, roughness: 0.7 })
      );
      platform.position.y = -2.4;
      scene.add(platform);
      break;
    }
    case 'NESTED_VOLUME': {
      // Outer cage (transparent wireframe) holding the inner mesh.
      mesh1.scale.setScalar(1.7);
      if (mesh1.material) {
        mesh1.material.transparent = true;
        mesh1.material.opacity = 0.18;
        mesh1.material.wireframe = true;
      }
      mesh2.scale.setScalar(0.55);
      break;
    }
    case 'ASCENDING_SPIRAL': {
      // Helix line + small markers ascending along the spiral
      const pts = [];
      for (let i = 0; i <= 64; i++) {
        const t = i / 64;
        pts.push(new THREE.Vector3(Math.cos(t * Math.PI * 3) * 1.5, t * 4 - 2, Math.sin(t * Math.PI * 3) * 1.5));
      }
      const helix = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.6 })
      );
      scene.add(helix);
      // Two small markers travelling up the helix to give a sense of "ascending"
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0x22d3ee })
      );
      scene.add(marker);
      updaters.push((t) => {
        const phase = (t * 0.4) % 1;
        marker.position.set(Math.cos(phase * Math.PI * 3) * 1.5, phase * 4 - 2, Math.sin(phase * Math.PI * 3) * 1.5);
      });
      break;
    }
    case 'IN_FRONT_OF':
    case 'BEHIND': {
      // Depth-grid floor so "front" vs "back" is unambiguous
      const grid = new THREE.GridHelper(8, 8, 0x475569, 0x334155);
      grid.position.y = -2.2;
      grid.material.transparent = true;
      grid.material.opacity = 0.55;
      scene.add(grid);
      // Soft drop-shadow under each mesh so depth reads visually
      const makeShadow = (mesh, radius) => {
        const s = new THREE.Mesh(
          new THREE.CircleGeometry(radius, 32),
          new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 })
        );
        s.rotation.x = -Math.PI / 2;
        s.position.set(mesh.position.x, -2.15, mesh.position.z);
        scene.add(s);
      };
      makeShadow(mesh1, 0.8);
      makeShadow(mesh2, 0.8);
      break;
    }
    case 'DEPTH_LAYERED': {
      // Add atmospheric fog so depth is felt + two ghost back-meshes for scale
      scene.fog = new THREE.Fog(0x080d16, 4, 14);
      const ghostMat = new THREE.MeshStandardMaterial({ color: accent, transparent: true, opacity: 0.35 });
      const g1 = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), ghostMat);
      g1.position.set(-1.6, 0, -4);
      scene.add(g1);
      const g2 = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), ghostMat);
      g2.position.set(1.3, 0, -6);
      scene.add(g2);
      break;
    }
  }

  return updaters;
}

// Singleton offscreen renderer for one-shot 3D snapshots used as 2D
// textures inside the alien panels. Reusing a single GL context avoids
// hitting the browser's per-page WebGL context cap (typically ~16) when
// trials fire in rapid succession.
let _stillRenderer = null;
let _stillRendererSize = { w: 0, h: 0 };
function getStillRenderer(width, height) {
  if (!_stillRenderer) {
    const canvas = document.createElement('canvas');
    _stillRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: true });
    _stillRenderer.setPixelRatio(1);
  }
  if (_stillRendererSize.w !== width || _stillRendererSize.h !== height) {
    _stillRenderer.setSize(width, height, false);
    _stillRendererSize = { w: width, h: height };
  }
  return _stillRenderer;
}

// Animated 3D-snapshot controller. Returns { canvas, update, dispose }.
// `canvas` is a 2D canvas the caller can drawImage from. Each update() call
// rotates the meshes by elapsed time, applies any relation-specific motion
// (ORBITING, ROTATING_PAIR), renders the scene through the singleton
// renderer, and copies the freshly-rendered pixels into the snapshot canvas.
//
// Multiple snapshot instances coexist by sharing the singleton renderer
// sequentially — each update() resets the renderer's size, renders its own
// scene, then immediately copies the pixels out, so callers never read each
// other's output. This keeps total WebGL context usage to 1 regardless of
// how many alien streams are on screen.
export function createSpatial3DSnapshot(width, height, relationship, stimulus, colors) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080d16);

  // Camera pulled back to z=14 with FOV 45 so even the widest SPATIAL_3D
  // arrangements (REPELLING ±3, BOUND_BY_GRAVITY y=-3, ORBITING radius 4)
  // sit comfortably inside the frustum and aren't clipped by the panel.
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 1, 14);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const directional = new THREE.DirectionalLight(0xffffff, 1);
  directional.position.set(8, 10, 8);
  scene.add(directional);

  const toColor = c => typeof c === 'string' && c.startsWith('#') ? parseInt(c.slice(1), 16) : c;
  const shape1 = stimulus?.shape3DA || SHAPES_3D[0];
  const shape2 = stimulus?.shape3DB || SHAPES_3D[1];
  const size1 = stimulus?.size3DA || 2.5;
  const size2 = stimulus?.size3DB || 2.5;
  const mesh1 = createShape3D(shape1, size1, toColor((colors && colors[0]) || stimulus?.colorA || '#22d3ee'));
  const mesh2 = createShape3D(shape2, size2, toColor((colors && colors[1]) || stimulus?.colorB || '#a78bfa'));
  applySpatial3DPositioning(relationship, mesh1, mesh2);
  scene.add(mesh1);
  scene.add(mesh2);
  // Decoration geometry — per-rel cues that make the rels look different
  // from each other (orbit ring, tether, ground, etc.).
  const decoUpdaters = decorateSpatial3DScene(scene, relationship, mesh1, mesh2, [stimulus?.colorA, stimulus?.colorB]);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  let elapsed = 0;
  let lastT = performance.now();

  function update() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastT) / 1000);
    lastT = now;
    elapsed += dt;

    // Spin both meshes so the player sees them as 3D, not flat.
    mesh1.rotation.x += dt * 0.55;
    mesh1.rotation.y += dt * 0.75;
    mesh2.rotation.x += dt * 0.50;
    mesh2.rotation.y += dt * 0.65;

    // Relation-specific motion (mirrors the standalone 3D renderer so the
    // semantics of ORBITING / ROTATING_PAIR are still legible inside the
    // alien panels).
    if (relationship === 'ORBITING') {
      const a = elapsed * 0.6;
      mesh2.position.x = Math.cos(a) * 3;
      mesh2.position.z = Math.sin(a) * 3;
    } else if (relationship === 'ROTATING_PAIR') {
      const a = elapsed * 0.6;
      mesh1.position.x = Math.cos(a) * 2.5;
      mesh2.position.x = -Math.cos(a) * 2.5;
    } else if (relationship === 'COLLIDING') {
      // Meshes bounce together → apart so the "colliding" idea reads visually
      const a = (Math.sin(elapsed * 2.5) + 1) / 2; // 0..1
      mesh1.position.x = -0.4 - a * 1.1;
      mesh2.position.x = 0.4 + a * 1.1;
    } else if (relationship === 'REPELLING') {
      const a = (Math.sin(elapsed * 1.8) + 1) / 2;
      mesh1.position.x = -2.5 - a * 0.6;
      mesh2.position.x = 2.5 + a * 0.6;
    } else if (relationship === 'FLOATING_ABOVE') {
      mesh1.position.y = 2 + Math.sin(elapsed * 1.6) * 0.25;
    }
    decoUpdaters.forEach(fn => fn(elapsed));

    const renderer = getStillRenderer(width, height);
    renderer.render(scene, camera);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(renderer.domElement, 0, 0, width, height);
  }

  function dispose() {
    scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) object.material.forEach(m => m.dispose());
        else object.material.dispose();
      }
    });
  }

  // Prime the canvas so callers can draw it immediately.
  update();

  return { canvas, update, dispose };
}

function createRelationPanelTexture(relationship, stimulus, alienCubeScale = 1) {
  const panelCanvas = document.createElement('canvas');
  panelCanvas.width = 900;
  panelCanvas.height = 560;
  const ctx = panelCanvas.getContext('2d');

  const contentCanvas = document.createElement('canvas');
  contentCanvas.width = 900;
  contentCanvas.height = 560;
  const contentCtx = contentCanvas.getContext('2d');

  const snapshot = is3D(relationship)
    ? createSpatial3DSnapshot(contentCanvas.width, contentCanvas.height, relationship, stimulus, [stimulus?.colorA, stimulus?.colorB])
    : null;
  const contentScale = Math.min(1.28, 1 + Math.max(0, alienCubeScale - 1) * 0.75);
  const zoom = Math.min(1.32, 1.08 * alienCubeScale);
  const scaledW = panelCanvas.width * zoom;
  const scaledH = panelCanvas.height * zoom;

  function refresh() {
    // Refresh content area first (snapshot tick OR 2D re-render)
    contentCtx.clearRect(0, 0, contentCanvas.width, contentCanvas.height);
    if (snapshot) {
      contentCtx.drawImage(snapshot.canvas, 0, 0);
    } else {
      renderRelationship(contentCtx, contentCanvas.width, contentCanvas.height, relationship, null, {
        ...stimulus,
        renderScale: contentScale,
      });
    }

    // Re-composite the panel: background fill, border, scaled content.
    ctx.clearRect(0, 0, panelCanvas.width, panelCanvas.height);
    ctx.fillStyle = 'rgba(8, 13, 22, 0.92)';
    ctx.fillRect(0, 0, panelCanvas.width, panelCanvas.height);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(18, 18, panelCanvas.width - 36, panelCanvas.height - 36, 22);
    ctx.stroke();
    ctx.drawImage(
      contentCanvas,
      (panelCanvas.width - scaledW) / 2,
      (panelCanvas.height - scaledH) / 2,
      scaledW,
      scaledH
    );
  }

  // Prime once so the texture's first paint is non-empty.
  refresh();

  const texture = new THREE.CanvasTexture(panelCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return { texture, snapshot, refresh };
}

function setupScene(canvas) {
  const scene = new THREE.Scene();
  // Keep background transparent so custom wrapper visual themes show through cleanly

  const starGeometry = new THREE.BufferGeometry();
  const starPositions = [];
  for (let i = 0; i < 120; i++) {
    starPositions.push((Math.random() - 0.5) * 28, (Math.random() - 0.5) * 18, -Math.random() * 24);
  }
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const starMaterial = new THREE.PointsMaterial({ color: 0x94a3b8, size: 0.035, transparent: true, opacity: 0.65 });
  scene.add(new THREE.Points(starGeometry, starMaterial));

  const camera = new THREE.PerspectiveCamera(72, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
  camera.position.set(0, 0.85, 3.15);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: true });
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.shadowMap.enabled = false;

  // Lighting
  const light1 = new THREE.DirectionalLight(0xffffff, 1);
  light1.position.set(8, 10, 8);
  light1.castShadow = false;
  scene.add(light1);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);


  return { scene, camera, renderer };
}

export function render3DRelationship(canvas, relationship, colors, rintChain = null, stimulus = null, options = {}) {
  const streamCount = options.streamCount || 1;
  const alienSettings = options.alienSettings || stimulus?.alienSettings || {};
  const cubeDirection = alienSettings.cubeDirection === 'ccw' ? -1 : 1;
  const cubeSpeed = Number(alienSettings.cubeSpeed || 1);
  const streamDepthOffset = Math.max(0, streamCount - 1);
  const alienCubeScale = stimulus?.cubePosition || stimulus?.tesseractPosition ? Math.min(1.36, 1.12 + streamDepthOffset * 0.04) : 1;
  const { scene, camera, renderer } = setupScene(canvas);
  if (stimulus?.cubePosition || stimulus?.tesseractPosition) {
    camera.position.z = Math.min(4.85, 3.65 + streamDepthOffset * 0.14);
    camera.lookAt(0, 0, 0);
  } else if (!rintChain || rintChain.length === 0) {
    // Non-alien SPATIAL_3D meshes are placed at z = ±2-3 with size ~2-3.5;
    // the default camera at z=3.15 puts them ~1 unit from the lens. Pull
    // back and widen FOV slightly so even the broadest arrangements
    // (REPELLING ±3 with shapes up to size 3.5) fit comfortably.
    camera.position.set(0, 1.0, 12);
    camera.fov = 50;
    camera.updateProjectionMatrix();
    camera.lookAt(0, 0, 0);
  }

  const toThreeColor = (c) => {
    if (typeof c === 'number') return c;
    if (typeof c === 'string' && c.startsWith('#')) return parseInt(c.slice(1), 16);
    return 0xffffff;
  };

  let meshes = [];
  // Collected panel snapshot+texture controllers so the animate loop can
  // tick them each frame (and the cleanup can dispose them).
  const panelInfos = [];

  if (stimulus?.tesseractPosition) {
    const tesseractGroup = new THREE.Group();
    scene.add(tesseractGroup);

    const p = stimulus.tesseractPosition;
    const tesseractDirection = alienSettings.tesseractDirection === 'ccw' ? -1 : 1;
    const tesseractSpeed = Number(alienSettings.tesseractSpeed || cubeSpeed || 1);
    const targetX = p.y > 0 ? -0.42 : p.y < 0 ? 0.42 : 0;
    const targetY = p.x > 0 ? -0.52 : p.x < 0 ? 0.52 : 0;
    tesseractGroup.rotation.set(targetX * 0.72, targetY * 0.72, (Math.random() - 0.5) * 0.2);
    tesseractGroup.userData.rotationSpeed = {
      x: tesseractDirection * tesseractSpeed * (targetX || 0.2) / 95,
      y: tesseractDirection * tesseractSpeed * (targetY || 0.25) / 95,
      z: tesseractDirection * tesseractSpeed * 0.0025,
    };

    const outerSize = 3;
    const innerSize = 1.85;
    const gridMaterial = new THREE.LineBasicMaterial({ color: 0x9aa8ff, transparent: true, opacity: 0.2 });
    const innerMaterial = new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.34 });
    const connectorMaterial = new THREE.LineBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.3 });

    const outerEdges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(outerSize, outerSize, outerSize)), gridMaterial);
    const innerEdges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(innerSize, innerSize, innerSize)), innerMaterial);
    tesseractGroup.add(outerEdges);
    tesseractGroup.add(innerEdges);

    [-1, 1].forEach(x => [-1, 1].forEach(y => [-1, 1].forEach(z => {
      const a = new THREE.Vector3(x * outerSize / 2, y * outerSize / 2, z * outerSize / 2);
      const b = new THREE.Vector3(x * innerSize / 2, y * innerSize / 2, z * innerSize / 2);
      const geometry = new THREE.BufferGeometry().setFromPoints([a, b]);
      tesseractGroup.add(new THREE.Line(geometry, connectorMaterial));
    })));

    const layerScale = p.w < 0 ? 1 : p.w > 0 ? innerSize / outerSize : 0.72;
    const activeCellEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.86, 0.86, 0.86)),
      new THREE.LineBasicMaterial({ color: toThreeColor(colors[0]), transparent: true, opacity: 0.98 })
    );
    activeCellEdges.scale.setScalar(layerScale);
    activeCellEdges.position.set(p.x * layerScale, p.y * layerScale, p.z * layerScale);
    tesseractGroup.add(activeCellEdges);

    const isCompactView = canvas.clientWidth < 420 || canvas.clientHeight < 320;
    const panelWidth = (isCompactView ? 2.0 : 2.5) * alienCubeScale;
    const panelHeight = (isCompactView ? 1.25 : 1.55) * alienCubeScale;
    const panelInfo = createRelationPanelTexture(relationship, stimulus, alienCubeScale);
    panelInfos.push(panelInfo);
    const relPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(panelWidth, panelHeight),
      new THREE.MeshBasicMaterial({ map: panelInfo.texture, transparent: false, side: THREE.DoubleSide })
    );
    relPanel.position.set(
      THREE.MathUtils.clamp(p.x * 0.36, -0.42, 0.42),
      THREE.MathUtils.clamp(p.y * 0.36, -0.42, 0.42),
      0.46 + p.w * 0.12 + streamDepthOffset * 0.03
    );
    relPanel.lookAt(camera.position);

    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(panelWidth * 0.84, panelHeight * 0.82, 0.08),
      new THREE.MeshBasicMaterial({ color: toThreeColor(colors[0]), transparent: true, opacity: 0.16 })
    );
    glow.position.copy(relPanel.position);
    glow.lookAt(camera.position);
    tesseractGroup.add(glow);
    tesseractGroup.add(relPanel);

    const layerLabel = p.w < 0 ? 'OUTER W-' : p.w > 0 ? 'INNER W+' : 'MID W0';
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 512;
    labelCanvas.height = 96;
    const labelCtx = labelCanvas.getContext('2d');
    labelCtx.fillStyle = 'rgba(8,13,22,0.8)';
    labelCtx.fillRect(0, 0, labelCanvas.width, labelCanvas.height);
    labelCtx.font = "bold 38px 'JetBrains Mono', monospace";
    labelCtx.textAlign = 'center';
    labelCtx.textBaseline = 'middle';
    labelCtx.fillStyle = '#22d3ee';
    labelCtx.fillText(layerLabel, labelCanvas.width / 2, labelCanvas.height / 2);
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    labelTexture.colorSpace = THREE.SRGBColorSpace;
    const labelMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 0.32),
      new THREE.MeshBasicMaterial({ map: labelTexture, transparent: true, side: THREE.DoubleSide })
    );
    labelMesh.position.set(0, -1.82, 0.65);
    labelMesh.lookAt(camera.position);
    tesseractGroup.add(labelMesh);

    meshes = [tesseractGroup, relPanel, labelMesh];
  } else if (stimulus?.cubePosition) {
    const cubeGroup = new THREE.Group();
    scene.add(cubeGroup);

    const p = stimulus.cubePosition;
    const targetX = p.y > 0 ? -0.45 : p.y < 0 ? 0.45 : 0;
    const targetY = p.x > 0 ? -0.58 : p.x < 0 ? 0.58 : 0;
    const startsReadable = Math.random() < 0.5;
    cubeGroup.rotation.set(
      startsReadable ? targetX : targetX * -0.65,
      startsReadable ? targetY : targetY * -0.65,
      (Math.random() - 0.5) * 0.28
    );
    cubeGroup.userData.rotationSpeed = {
      x: cubeDirection * cubeSpeed * (targetX || 0.22) / 90,
      y: cubeDirection * cubeSpeed * (targetY || 0.28) / 90,
      z: cubeDirection * cubeSpeed * 0.002,
    };

    const gridMaterial = new THREE.LineBasicMaterial({ color: 0x9aa8ff, transparent: true, opacity: 0.22 });
    for (let i = -1.5; i <= 1.5; i += 1) {
      for (let j = -1.5; j <= 1.5; j += 1) {
        [[[-1.5, i, j], [1.5, i, j]], [[i, -1.5, j], [i, 1.5, j]], [[i, j, -1.5], [i, j, 1.5]]].forEach(([a, b]) => {
          const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]);
          cubeGroup.add(new THREE.Line(geometry, gridMaterial));
        });
      }
    }

    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(3, 3, 3),
      new THREE.MeshBasicMaterial({ color: 0x6d7cff, transparent: true, opacity: 0.045, side: THREE.BackSide })
    );
    cubeGroup.add(shell);

    const axisConfigs = [
      { color: 0xff1744, points: [new THREE.Vector3(-1.5, 0, 0), new THREE.Vector3(0, 0, 0)] },
      { color: 0xffc400, points: [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1.5, 0, 0)] },
      { color: 0x7c3aed, points: [new THREE.Vector3(0, -1.5, 0), new THREE.Vector3(0, 0, 0)] },
      { color: 0x39ff14, points: [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1.5, 0)] },
      { color: 0x0066ff, points: [new THREE.Vector3(0, 0, -1.5), new THREE.Vector3(0, 0, 0)] },
      { color: 0x00f5ff, points: [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1.5)] },
    ];

    axisConfigs.forEach(({ color, points }) => {
      const axis = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 2, 0.022, 8, false),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 })
      );
      cubeGroup.add(axis);
    });

    const activeCellEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({ color: toThreeColor(colors[0]), transparent: true, opacity: 0.98 })
    );
    activeCellEdges.position.set(p.x, p.y, p.z);
    cubeGroup.add(activeCellEdges);

    const isCompactView = canvas.clientWidth < 420 || canvas.clientHeight < 320;
    const panelWidth = (isCompactView ? 2.1 : 2.65) * alienCubeScale;
    const panelHeight = (isCompactView ? 1.3 : 1.65) * alienCubeScale;
    const panelInfo = createRelationPanelTexture(relationship, stimulus, alienCubeScale);
    panelInfos.push(panelInfo);
    const relPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(panelWidth, panelHeight),
      new THREE.MeshBasicMaterial({ map: panelInfo.texture, transparent: false, side: THREE.DoubleSide })
    );
    const safePanelX = THREE.MathUtils.clamp(p.x * 0.48, -0.52, 0.52);
    const safePanelY = THREE.MathUtils.clamp(p.y * 0.48, -0.52, 0.52);
    const safePanelZ = THREE.MathUtils.clamp(p.z * 0.42, -0.42, 0.62);
    relPanel.position.set(safePanelX, safePanelY, safePanelZ + 0.24 + streamDepthOffset * 0.03);
    relPanel.lookAt(camera.position);

    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(panelWidth * 0.82, panelHeight * 0.81, 0.08),
      new THREE.MeshBasicMaterial({ color: toThreeColor(colors[0]), transparent: true, opacity: 0.18 })
    );
    glow.position.copy(relPanel.position);
    glow.lookAt(camera.position);
    cubeGroup.add(glow);
    cubeGroup.add(relPanel);
    meshes = [cubeGroup, relPanel];
  } else if (rintChain && rintChain.length > 0) {
    // RINT mode: show entity chain (A > B, B > C)
    const ENTITY_COLORS = {
      alpha: 0x22d3ee,  // cyan
      beta:  0xa78bfa,  // purple
      gamma: 0x34d399,  // emerald
    };
    
    const entities = ['alpha', 'beta', 'gamma'];
    const positions = [
      { x: -3.5, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 3.5, y: 0, z: 0 },
    ];

    entities.forEach((entity, idx) => {
      const mesh = createShape3D('sphere', 1.2, ENTITY_COLORS[entity]);
      mesh.position.set(positions[idx].x, positions[idx].y, positions[idx].z);
      scene.add(mesh);
      meshes.push(mesh);
    });

    // Draw relationship lines
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setFromPoints([
      new THREE.Vector3(-3.5, 0, 0),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(3.5, 0, 0),
    ]);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x64748b, linewidth: 2 });
    const lines = new THREE.Line(lineGeometry, lineMaterial);
    scene.add(lines);
  } else {
    // Normal mode: use saved 3D attributes so preview/replay stays identical
    const shape1 = stimulus?.shape3DA || SHAPES_3D[0];
    const shape2 = stimulus?.shape3DB || SHAPES_3D[1];
    const size1 = stimulus?.size3DA || 2.5;
    const size2 = stimulus?.size3DB || 2.5;

    const mesh1 = createShape3D(shape1, size1, toThreeColor(colors[0]));
    const mesh2 = createShape3D(shape2, size2, toThreeColor(colors[1]));
    meshes = [mesh1, mesh2];
  }

  // Position based on relationship (only for normal 3D relationships)
  let standaloneDecoUpdaters = [];
  if (!stimulus?.cubePosition && !stimulus?.tesseractPosition && (!rintChain || rintChain.length === 0)) {
    const mesh1 = meshes[0];
    const mesh2 = meshes[1];
    applySpatial3DPositioning(relationship, mesh1, mesh2);
    standaloneDecoUpdaters = decorateSpatial3DScene(scene, relationship, mesh1, mesh2, [stimulus?.colorA, stimulus?.colorB]);
    scene.add(mesh1);
    scene.add(mesh2);
  }

  // Animation loop: keep rotating for the full trial duration
  let animationId;
  let lastPanelTick = 0;
  const animate = () => {
    animationId = requestAnimationFrame(animate);

    meshes.forEach((mesh, index) => {
      if ((stimulus?.cubePosition || stimulus?.tesseractPosition) && index > 0) return;
      const speed = mesh.userData?.rotationSpeed;
      mesh.rotation.x += speed?.x || 0.003;
      mesh.rotation.y += speed?.y || 0.005;
      mesh.rotation.z += speed?.z || 0;
    });

    if ((stimulus?.cubePosition || stimulus?.tesseractPosition) && meshes[1]) {
      meshes[1].lookAt(camera.position);
      if (meshes[2]) meshes[2].lookAt(camera.position);
    }

    if (!stimulus?.cubePosition && !stimulus?.tesseractPosition && (!rintChain || rintChain.length === 0)) {
      const mesh1 = meshes[0];
      const mesh2 = meshes[1];
      const tSec = performance.now() / 1000;

      if (relationship === 'ORBITING') {
        const angle = tSec * 0.6;
        mesh2.position.x = Math.cos(angle) * 3;
        mesh2.position.z = Math.sin(angle) * 3;
      } else if (relationship === 'ROTATING_PAIR') {
        const angle = tSec * 0.6;
        mesh1.position.x = Math.cos(angle) * 2.5;
        mesh2.position.x = -Math.cos(angle) * 2.5;
      } else if (relationship === 'COLLIDING') {
        const a = (Math.sin(tSec * 2.5) + 1) / 2;
        mesh1.position.x = -0.4 - a * 1.1;
        mesh2.position.x = 0.4 + a * 1.1;
      } else if (relationship === 'REPELLING') {
        const a = (Math.sin(tSec * 1.8) + 1) / 2;
        mesh1.position.x = -2.5 - a * 0.6;
        mesh2.position.x = 2.5 + a * 0.6;
      } else if (relationship === 'FLOATING_ABOVE') {
        mesh1.position.y = 2 + Math.sin(tSec * 1.6) * 0.25;
      }
      standaloneDecoUpdaters.forEach(fn => fn(tSec));
    }

    // Tick any animated SPATIAL_3D snapshots embedded in alien panels.
    // Throttled to ~30 fps so we don't double the GPU work per stream.
    const now = performance.now();
    if (now - lastPanelTick > 33 && panelInfos.length > 0) {
      lastPanelTick = now;
      for (const info of panelInfos) {
        if (info.snapshot) {
          info.snapshot.update();
          info.refresh();
          info.texture.needsUpdate = true;
        }
      }
    }

    renderer.render(scene, camera);
  };

  animate();

  // Cleanup function
  return () => {
    cancelAnimationFrame(animationId);
    panelInfos.forEach(info => info.snapshot?.dispose());
    scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
        else object.material.dispose();
      }
    });
    renderer.dispose();
  };
}