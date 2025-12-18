
import React from 'react';
import { Shape } from '../types';

interface ShapeDisplayProps {
  shape: Shape;
  colorHue: number;
  size: number;
  isCircle: boolean;
  useThemeColor: boolean;
}

const ShapeDisplay: React.FC<ShapeDisplayProps> = ({ shape, colorHue, size, isCircle, useThemeColor }) => {
  const color = useThemeColor ? 'var(--color-primary)' : `hsl(${colorHue}, 80%, 50%)`;

  if (isCircle) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={size / 2} fill={color} />
      </svg>
    );
  }

  const points = shape.vertices.map((vertex, i) => {
    const angle = (i / shape.vertices.length) * 2 * Math.PI - (Math.PI / 2);
    const radius = (size / 2) * vertex.radius;
    const x = size / 2 + radius * Math.cos(angle);
    const y = size / 2 + radius * Math.sin(angle);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <polygon points={points} fill={color} />
    </svg>
  );
};

export default ShapeDisplay;
