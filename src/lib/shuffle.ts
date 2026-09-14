/** Random permutation of 0 … length-1 that differs from ladder order whenever length ≥ 2. */
export function shuffledOrder(length: number, random: () => number = Math.random): number[] {
  const identity = Array.from({ length }, (_, i) => i);
  if (length < 2) return identity;
  for (let attempt = 0; attempt < 10; attempt++) {
    const order = [...identity];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    if (order.some((value, i) => value !== i)) return order;
  }
  return identity.map((i) => (i + 1) % length);
}
