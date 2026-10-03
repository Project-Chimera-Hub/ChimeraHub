export function rotatePoint(point, yaw = 0, pitch = 0) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);

  const x1 = point.x * cy + point.z * sy;
  const z1 = -point.x * sy + point.z * cy;
  const y1 = point.y;

  return {
    x: x1,
    y: y1 * cp - z1 * sp,
    z: y1 * sp + z1 * cp,
  };
}

export function projectPoint(point, width, height, cameraDistance = 4, focalLength = 180) {
  const depth = Math.max(0.5, cameraDistance - point.z);
  const scale = focalLength / depth;
  return {
    x: width / 2 + point.x * scale,
    y: height / 2 + point.y * scale,
    scale,
    depth,
  };
}
