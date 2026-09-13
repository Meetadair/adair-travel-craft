/**
 * One line about what Adair remembers: the hotel they keep coming back to when
 * it is on the card, or a plain word about it being full when it is not.
 */
export type TripMemory = { hotel: string; stays: number; city: string; offered: boolean };

export function MemoryLine({
  memory,
  offeredName,
  copy,
}: {
  memory: TripMemory;
  offeredName: string | null;
  copy: { asUsual: string; full: string; nothingClose: string };
}) {
  const text = memory.offered
    ? copy.asUsual.replace("{items}", memory.hotel)
    : offeredName
      ? copy.full.replace("{hotel}", memory.hotel).replace("{nearest}", offeredName)
      : copy.nothingClose.replace("{hotel}", memory.hotel);

  return (
    <p data-testid="memory-line" className="mt-3 text-xs leading-relaxed text-muted-foreground">
      {text}
    </p>
  );
}
