import React, { useRef, useEffect } from 'react';
import { renderRelationship, renderAlienSquare, is3D, renderTrajectoryBoard } from '@/lib/relationshipRenderer';
import { render3DRelationship, createSpatial3DSnapshot } from '@/lib/threeRenderer';

export default function GameCanvas({ relationship, stimulus, clearCanvas, rintChain, streamCount = 1 }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const cleanupRef = useRef(null);

  useEffect(() => {
    if (clearCanvas || !relationship) {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (container) {
        container.querySelectorAll('canvas[data-three-canvas="true"]').forEach(node => node.remove());
      }
      if (canvas && container && canvas.parentElement !== container) container.appendChild(canvas);
      if (canvas) canvas.style.display = 'block';
      if (canvas && canvas.getContext) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const rect = canvas.getBoundingClientRect();
          ctx.clearRect(0, 0, rect.width, rect.height);
        }
      }
      return;
    }

    // Trajectory N-Back / Schema Transfer (SR + TEM): a graph-traversal stim,
    // not a relation. Route to the dedicated trajectory board renderer
    // before any 3D/square/relation logic kicks in. Map fading is handled
    // by the renderer based on stimulus._tjn.learnPhase.
    if (stimulus?._tjn) {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas) return;
      if (container) {
        container.querySelectorAll('canvas[data-three-canvas="true"]').forEach(node => node.remove());
        if (canvas.parentElement !== container) container.appendChild(canvas);
      }
      canvas.style.display = 'block';
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      renderTrajectoryBoard(ctx, rect.width, rect.height, stimulus);
      return;
    }

    if (stimulus?.squarePosition) {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas) return;
      if (container) {
        container.querySelectorAll('canvas[data-three-canvas="true"]').forEach(node => node.remove());
        if (canvas.parentElement !== container) container.appendChild(canvas);
      }
      canvas.style.display = 'block';
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const panelCanvas = document.createElement('canvas');
      panelCanvas.width = 640;
      panelCanvas.height = 400;
      const panelCtx = panelCanvas.getContext('2d');

      // For SPATIAL_3D rels, build a live 3D-snapshot controller and refresh
      // its frame inside the square's animation loop. For other rels we
      // render the 2D depiction once into the panel.
      const snapshot = is3D(relationship)
        ? createSpatial3DSnapshot(panelCanvas.width, panelCanvas.height, relationship, stimulus, [stimulus?.colorA, stimulus?.colorB])
        : null;
      const paintPanel = () => {
        if (snapshot) {
          panelCtx.clearRect(0, 0, panelCanvas.width, panelCanvas.height);
          panelCtx.drawImage(snapshot.canvas, 0, 0);
        } else {
          renderRelationship(panelCtx, panelCanvas.width, panelCanvas.height, relationship, null, { ...stimulus, renderScale: 0.95 });
        }
      };
      paintPanel();

      let animationId;
      let lastPanelTick = 0;
      const draw = () => {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const now = performance.now();
        if (snapshot && now - lastPanelTick > 33) {
          lastPanelTick = now;
          snapshot.update();
          paintPanel();
        }
        renderAlienSquare(ctx, rect.width, rect.height, relationship, stimulus, panelCanvas);
        animationId = requestAnimationFrame(draw);
      };
      draw();
      cleanupRef.current = () => {
        cancelAnimationFrame(animationId);
        snapshot?.dispose();
      };
    } else if (stimulus?.cubePosition || stimulus?.tesseractPosition || is3D(relationship)) {
      // Use 3D renderer
      if (cleanupRef.current) cleanupRef.current();
      const container = containerRef.current;
      if (!container) return;
      
      container.querySelectorAll('canvas[data-three-canvas="true"]').forEach(node => node.remove());
      if (canvasRef.current) canvasRef.current.style.display = 'none';
      const tempCanvas = document.createElement('canvas');
      tempCanvas.dataset.threeCanvas = 'true';
      tempCanvas.style.width = '100%';
      tempCanvas.style.height = '100%';
      tempCanvas.className = 'rounded-lg';
      container.appendChild(tempCanvas);

      const colors = [stimulus?.colorA || '#22d3ee', stimulus?.colorB || '#a78bfa'];
      cleanupRef.current = render3DRelationship(tempCanvas, relationship, colors, rintChain, stimulus, { streamCount, alienSettings: stimulus?.alienSettings });
    } else {
      // Use 2D renderer
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }

      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas) return;
      if (container) {
        container.querySelectorAll('canvas[data-three-canvas="true"]').forEach(node => node.remove());
        if (canvas.parentElement !== container) container.appendChild(canvas);
      }
      canvas.style.display = 'block';
      const ctx = canvas.getContext('2d');
      
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      renderRelationship(ctx, rect.width, rect.height, relationship, null, stimulus);
    }
  }, [relationship, clearCanvas, stimulus, rintChain, streamCount]);

  return (
    <div ref={containerRef} className="w-full h-full" style={{ display: 'block' }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: 'block' }}
      />
    </div>
  );
}