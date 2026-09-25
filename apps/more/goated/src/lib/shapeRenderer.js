import { SCRAP_TOKEN_PREFIX, VORONOI_TOKEN_PREFIX } from './gameConstants';

// Draws a shape at (cx, cy) with given size, color, filled or outline

export function getSynaesthesiaColor(char, defaultColor = '#ffd700') {
  try {
    const enabled = localStorage.getItem('goated_synaesthesia_enabled') === 'true';
    if (!enabled) return defaultColor;
    
    const saved = localStorage.getItem('goated_synaesthesia_map');
    const map = saved ? JSON.parse(saved) : null;
    const cleanChar = char.toUpperCase();
    if (map && map[cleanChar]) {
      return map[cleanChar];
    }
  } catch (e) {
    console.error(e);
  }
  
  // Fallback to deterministic hash if map is not customized or storage fails
  const SYNAESTHESIA_COLORS = [
    '#ff007f', // hot pink
    '#ff3b3f', // neon orange/red
    '#ff8c00', // vibrant orange
    '#ffd700', // gold
    '#39ff14', // neon green
    '#00f5ff', // bright cyan
    '#1f75fe', // blue
    '#8a2be2', // neon violet
    '#ff00ff', // magenta
    '#00ffcc', // electric teal
  ];
  const charCode = char.charCodeAt(0);
  const colorIdx = (charCode + 17) % SYNAESTHESIA_COLORS.length;
  return SYNAESTHESIA_COLORS[colorIdx];
}

export function drawShape(ctx, shape, cx, cy, size, color, filled = true) {
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  if (typeof shape === 'string' && shape.startsWith(SCRAP_TOKEN_PREFIX)) {
    const seed = Number(shape.slice(SCRAP_TOKEN_PREFIX.length)) || 0;
    if (typeof window !== 'undefined' && window.drawScrapToken) {
      window.drawScrapToken(ctx, seed, cx, cy, size, color);
    }
    ctx.restore();
    return;
  }
  if (typeof shape === 'string' && shape.startsWith(VORONOI_TOKEN_PREFIX)) {
    const seed = shape.slice(VORONOI_TOKEN_PREFIX.length);
    if (typeof window !== 'undefined' && window.drawVoronoiToken) {
      window.drawVoronoiToken(ctx, seed, cx, cy, size, color);
    }
    ctx.restore();
    return;
  }

  const standardShapes = [
    'circle', 'square', 'triangle', 'hexagon', 'pentagon',
    'star', 'diamond', 'cross', 'arrow', 'heart', 'crescent', 'parallelogram'
  ];

  if (typeof shape === 'string' && shape && !standardShapes.includes(shape)) {
    // Render text/emoji/verbal token
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const isEmoji = /\p{Emoji}/u.test(shape);
    // Magnified font size to prevent squinting!
    let fontSize = isEmoji ? size * 1.15 : size * 0.65;
    
    if (!isEmoji) {
      // Dynamic constraint based on length
      const aspectEstimate = 0.6;
      const maxLengthFontSize = (size * 1.05) / (shape.length * aspectEstimate);
      fontSize = Math.min(fontSize, maxLengthFontSize);
      fontSize = Math.max(fontSize, size * 0.28);
    }
    
    ctx.font = isEmoji
      ? `bold ${fontSize}px serif`
      : `bold ${fontSize}px 'JetBrains Mono', monospace`;

    if (isEmoji) {
      ctx.fillStyle = color;
      ctx.fillText(shape, cx, cy);
    } else {
      const synaesthesiaEnabled = localStorage.getItem('goated_synaesthesia_enabled') === 'true';
      
      if (synaesthesiaEnabled) {
        const charWidth = ctx.measureText('M').width;
        const totalWidth = shape.length * charWidth;
        const startX = cx - totalWidth / 2 + charWidth / 2;
        
        for (let i = 0; i < shape.length; i++) {
          const char = shape[i];
          const x = startX + i * charWidth;
          const charColor = getSynaesthesiaColor(char, color);
          
          ctx.save();
          ctx.fillStyle = charColor;
          // Heavy outline to contrast against any shape background
          ctx.strokeStyle = '#090d16'; 
          ctx.lineWidth = Math.max(3.5, fontSize * 0.16);
          ctx.lineJoin = 'round';
          ctx.strokeText(char, x, cy);
          ctx.fillText(char, x, cy);
          ctx.restore();
        }
      } else {
        // Standard clean display
        ctx.fillStyle = color;
        ctx.strokeStyle = '#090d16'; 
        ctx.lineWidth = Math.max(3.5, fontSize * 0.16);
        ctx.lineJoin = 'round';
        ctx.strokeText(shape, cx, cy);
        ctx.fillText(shape, cx, cy);
      }
    }
    
    ctx.restore();
    return;
  }

  ctx.beginPath();

  switch (shape) {
    case 'circle':
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
      break;

    case 'square':
      ctx.rect(cx - size / 2, cy - size / 2, size, size);
      break;

    case 'triangle': {
      const h = (size * Math.sqrt(3)) / 2;
      ctx.moveTo(cx, cy - h / 2);
      ctx.lineTo(cx - size / 2, cy + h / 2);
      ctx.lineTo(cx + size / 2, cy + h / 2);
      ctx.closePath();
      break;
    }

    case 'hexagon': {
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const x = cx + (size / 2) * Math.cos(angle);
        const y = cy + (size / 2) * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    }

    case 'pentagon': {
      for (let i = 0; i < 5; i++) {
        const angle = (2 * Math.PI / 5) * i - Math.PI / 2;
        const x = cx + (size / 2) * Math.cos(angle);
        const y = cy + (size / 2) * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    }

    case 'star': {
      const outerR = size / 2;
      const innerR = size / 4.5;
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    }

    case 'diamond': {
      const half = size / 2;
      ctx.moveTo(cx, cy - half);
      ctx.lineTo(cx + half * 0.6, cy);
      ctx.lineTo(cx, cy + half);
      ctx.lineTo(cx - half * 0.6, cy);
      ctx.closePath();
      break;
    }

    case 'cross': {
      const arm = size / 6;
      const ext = size / 2;
      ctx.moveTo(cx - arm, cy - ext);
      ctx.lineTo(cx + arm, cy - ext);
      ctx.lineTo(cx + arm, cy - arm);
      ctx.lineTo(cx + ext, cy - arm);
      ctx.lineTo(cx + ext, cy + arm);
      ctx.lineTo(cx + arm, cy + arm);
      ctx.lineTo(cx + arm, cy + ext);
      ctx.lineTo(cx - arm, cy + ext);
      ctx.lineTo(cx - arm, cy + arm);
      ctx.lineTo(cx - ext, cy + arm);
      ctx.lineTo(cx - ext, cy - arm);
      ctx.lineTo(cx - arm, cy - arm);
      ctx.closePath();
      break;
    }

    case 'arrow': {
      const w = size * 0.35;
      const h2 = size / 2;
      ctx.moveTo(cx + h2, cy);
      ctx.lineTo(cx, cy - h2 * 0.6);
      ctx.lineTo(cx, cy - w * 0.4);
      ctx.lineTo(cx - h2, cy - w * 0.4);
      ctx.lineTo(cx - h2, cy + w * 0.4);
      ctx.lineTo(cx, cy + w * 0.4);
      ctx.lineTo(cx, cy + h2 * 0.6);
      ctx.closePath();
      break;
    }

    case 'heart': {
      const s = size / 2;
      ctx.moveTo(cx, cy + s * 0.8);
      ctx.bezierCurveTo(cx - s * 1.2, cy - s * 0.2, cx - s * 1.4, cy - s * 1.0, cx, cy - s * 0.4);
      ctx.bezierCurveTo(cx + s * 1.4, cy - s * 1.0, cx + s * 1.2, cy - s * 0.2, cx, cy + s * 0.8);
      ctx.closePath();
      break;
    }

    case 'crescent': {
      const r = size / 2;
      ctx.arc(cx, cy, r, 0.3, Math.PI * 2 - 0.3);
      ctx.closePath();
      // Cut out inner circle to make crescent (only visible when filled)
      if (filled) {
        ctx.fill();
        ctx.fillStyle = ctx.strokeStyle === color ? 'hsl(220 20% 6%)' : ctx.strokeStyle;
        ctx.beginPath();
        ctx.arc(cx + r * 0.35, cy, r * 0.72, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }
      break;
    }

    case 'parallelogram': {
      const pw = size * 0.55;
      const ph = size * 0.35;
      const slant = size * 0.2;
      ctx.moveTo(cx - pw + slant, cy - ph);
      ctx.lineTo(cx + pw + slant, cy - ph);
      ctx.lineTo(cx + pw - slant, cy + ph);
      ctx.lineTo(cx - pw - slant, cy + ph);
      ctx.closePath();
      break;
    }

    default:
      // fallback: circle
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  }

  if (filled) ctx.fill();
  else ctx.stroke();

  ctx.restore();
}