/** 89000 -> "89.000đ" */
export function formatPrice(value: number) {
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(value))}đ`;
}

/** 24620 -> "24,6k" so long sold counts stay inside the card. */
export function formatSold(value: number | null) {
  if (!value || value <= 0) return null;
  if (value < 1000) return String(value);
  const k = value / 1000;
  return `${k.toFixed(k < 10 ? 1 : 0).replace(".", ",")}k`;
}
