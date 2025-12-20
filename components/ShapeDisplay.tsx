
import React, { useId } from 'react';
import { Shape, ColorPattern } from '../types';

interface ShapeDisplayProps {
  shape: Shape;
  hues: [number, number, number];
  size: number;
  colorEnabled: boolean;
  shapeEnabled: boolean;
  colorPattern: ColorPattern;
}

const ShapeDisplay: React.FC<ShapeDisplayProps> = ({ shape, hues, size, colorEnabled, shapeEnabled, colorPattern }) => {
  const uniqueClipId = useId();

  // Define the shape polygon path if shape is enabled
  const shapePoints = shapeEnabled ? shape.vertices.map((vertex, i) => {
    const angle = (i / shape.vertices.length) * 2 * Math.PI - (Math.PI / 2);
    const radius = (size / 2) * vertex.radius;
    const x = size / 2 + radius * Math.cos(angle);
    const y = size / 2 + radius * Math.sin(angle);
    return `${x},${y}`;
  }).join(' ') : '';
  
  // Define the color pattern elements
  const renderColorPattern = () => {
    const color1 = `hsl(${hues[0]}, 80%, 50%)`;
    const color2 = `hsl(${hues[1]}, 80%, 50%)`;
    const color3 = `hsl(${hues[2]}, 80%, 50%)`;

    switch (colorPattern) {
      case 'horizontal':
        const stripeHeight = size / 3;
        return (
          <>
            <rect x="0" y="0" width={size} height={stripeHeight} fill={color1} />
            <rect x="0" y={stripeHeight} width={size} height={stripeHeight} fill={color2} />
            <rect x="0" y={stripeHeight * 2} width={size} height={stripeHeight} fill={color3} />
          </>
        );
      case 'triangles':
        const s = size;
        const c = size / 2;
        return (
          <>
            <polygon points={`0,0 ${s},0 ${c},${c}`} fill={color1} />
            <polygon points={`0,0 0,${s} ${c},${c}`} fill={color2} />
            <polygon points={`${s},0 ${s},${s} 0,${s} ${c},${c}`} fill={color3} />
          </>
        );
      case 'vertical':
      default:
        const stripeWidth = size / 3;
        return (
          <>
            <rect x="0" y="0" width={stripeWidth} height={size} fill={color1} />
            <rect x={stripeWidth} y="0" width={stripeWidth} height={size} fill={color2} />
            <rect x={stripeWidth * 2} y="0" width={stripeWidth} height={size} fill={color3} />
          </>
        );
    }
  };

  // Main rendering logic based on which modalities are active
  if (colorEnabled && shapeEnabled) {
    // Both enabled: color pattern clipped by shape
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <clipPath id={uniqueClipId}>
            <polygon points={shapePoints} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${uniqueClipId})`}>
          {renderColorPattern()}
        </g>
      </svg>
    );
  } else if (colorEnabled) {
    // Only color enabled: pattern fills the square
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {renderColorPattern()}
      </svg>
    );
  } else if (shapeEnabled) {
    // Only shape enabled: solid color shape
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <polygon points={shapePoints} fill={'var(--color-primary)'} />
      </svg>
    );
  } else {
    // Neither enabled: solid color circle (default stimulus)
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={size / 2} fill={'var(--color-primary)'} />
      </svg>
    );
  }
};

export default ShapeDisplay;
