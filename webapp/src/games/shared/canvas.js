export function drawGrid(ctx, width, height) {
  ctx.fillStyle = '#122321';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#243b36';
  for (let i = 0; i < 20; i++) {
    ctx.beginPath(); ctx.moveTo(i * width / 20, 0); ctx.lineTo(i * width / 20, height); ctx.stroke();
  }
}

export function drawCircle(ctx, point, radius, color, width, height) {
  ctx.beginPath(); ctx.fillStyle = color;
  ctx.arc(point.x * width, point.y * height, radius, 0, Math.PI * 2); ctx.fill();
}
