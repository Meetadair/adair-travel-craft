import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Star,
  Coffee,
  Wifi,
  Bath,
  Tv,
  Wind,
  ShieldCheck,
  Clock,
  BedDouble,
  Wine,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { getHotelDetail } from "@/lib/hotel-detail.functions";
import type { StayBedType, StayRoomOption } from "@/lib/trip/types";

type Props = {
  hotelId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  childAges?: number[];
  currency: string;
  locale: string;
  /** The rate currently reflected in the offer card, if the traveller already picked one. */
  selectedRateId?: string | null;
  onChooseRoom?: (room: StayRoomOption) => void;
};

const AMENITY_ICON: Array<[RegExp, typeof Wifi]> = [
  [/wifi|internet/, Wifi],
  [/minibar/, Wine],
  [/safe/, ShieldCheck],
  [/\btv\b|television/, Tv],
  [/air ?condition|\bac\b/, Wind],
  [/bath|shower/, Bath],
  [/coffee|tea/, Coffee],
];

function amenityIcon(name: string): typeof Wifi {
  const lower = name.toLowerCase();
  for (const [pattern, Icon] of AMENITY_ICON) if (pattern.test(lower)) return Icon;
  return Check;
}

function capitalize(text: string): string {
  return text.length ? text[0]!.toUpperCase() + text.slice(1) : text;
}

function bedSummary(bedTypes: StayBedType[]): { text: string; separate: boolean } {
  if (!bedTypes.length) return { text: "", separate: false };
  const separate =
    bedTypes.length > 1 ||
    (bedTypes[0]!.quantity > 1 && /single|twin/i.test(bedTypes[0]!.bedType));
  const text = bedTypes
    .map((b) => (b.quantity > 1 ? `${b.quantity} × ${b.bedType}` : b.bedType))
    .join(", ");
  return { text, separate };
}

/** 9+ "exceptional", 8+ "excellent" — the same bands guests recognise from booking sites. */
function reviewBand(
  score: number,
  t: ReturnType<typeof useT>,
): string {
  if (score >= 9) return t.assistant.roomOptionsBandExceptional;
  if (score >= 8) return t.assistant.roomOptionsBandExcellent;
  if (score >= 7) return t.assistant.roomOptionsBandVeryGood;
  if (score >= 6) return t.assistant.roomOptionsBandGood;
  return t.assistant.roomOptionsBandFair;
}

export function HotelRoomOptions({
  hotelId,
  checkIn,
  checkOut,
  adults,
  childAges,
  currency,
  locale,
  selectedRateId,
  onChooseRoom,
}: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const fetchDetail = useServerFn(getHotelDetail);

  const detail = useQuery({
    queryKey: ["hotel-detail", hotelId, checkIn, checkOut, adults, childAges ?? [], currency],
    queryFn: () =>
      fetchDetail({
        data: { hotelId, checkIn, checkOut, adults, childAges: childAges ?? [], currency },
      }),
    enabled: open && hotelId.length > 0,
    staleTime: 5 * 60_000,
  });

  const money = (amount: number, cur: string) => {
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: cur,
        maximumFractionDigits: amount >= 100 ? 0 : 2,
      }).format(amount);
    } catch {
      return `${amount.toLocaleString(locale, { maximumFractionDigits: 0 })} ${cur}`;
    }
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs font-medium text-primary underline underline-offset-4"
      >
        {open ? t.assistant.roomOptionsHide : t.assistant.roomOptionsShow}
        {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
      </button>

      {open && (
        <div className="mt-3 space-y-4 rounded-xl border border-border bg-background p-4">
          {detail.isPending && (
            <p className="text-xs text-muted-foreground">{t.assistant.roomOptionsLoading}</p>
          )}

          {!detail.isPending && (!detail.data || (!detail.data.roomOptions.length && !detail.data.reviews.length)) && (
            <p className="text-xs text-muted-foreground">{t.assistant.roomOptionsEmpty}</p>
          )}

          {detail.data && (detail.data.checkinFrom || detail.data.checkoutUntil) && (
            <div className="grid gap-3 border-b border-border pb-4 sm:grid-cols-2">
              {detail.data.checkinFrom && (
                <div className="flex items-start gap-2">
                  <Clock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-medium">
                      {t.assistant.roomOptionsCheckIn} {detail.data.checkinFrom}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.assistant.roomOptionsEarlyCheckIn} — {t.assistant.roomOptionsEarlyCheckInNote}:{" "}
                      {t.assistant.roomOptionsOnRequest}
                    </p>
                  </div>
                </div>
              )}
              {detail.data.checkoutUntil && (
                <div className="flex items-start gap-2">
                  <Clock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-medium">
                      {t.assistant.roomOptionsCheckOut} {detail.data.checkoutUntil}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.assistant.roomOptionsLateCheckOut} — {t.assistant.roomOptionsLateCheckOutNote}:{" "}
                      {t.assistant.roomOptionsOnRequest}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {detail.data && detail.data.roomOptions.length > 0 && (
            <div className="space-y-3">
              {detail.data.roomOptions.map((room) => {
                const beds = bedSummary(room.bedTypes);
                const chosen = selectedRateId === room.rateId;
                return (
                  <div
                    key={room.rateId}
                    className={`rounded-lg border p-3 ${
                      chosen ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{room.roomName}</p>
                        {(room.sizeSqm || beds.text) && (
                          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            {room.sizeSqm && <span>{room.sizeSqm} m²</span>}
                            {room.sizeSqm && beds.text && <span>·</span>}
                            {beds.text && (
                              <span className="inline-flex items-center gap-1">
                                <BedDouble className="size-3.5" />
                                {beds.text}
                              </span>
                            )}
                            {beds.separate && (
                              <span className="tag-pill">{t.assistant.roomOptionsSeparateBeds}</span>
                            )}
                          </p>
                        )}
                        {room.amenities.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {room.amenities.slice(0, 6).map((a) => {
                              const Icon = amenityIcon(a);
                              return (
                                <span key={a} className="tag-pill">
                                  <Icon className="size-3" />
                                  {capitalize(a)}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                          {room.breakfastIncluded !== null && (
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <Coffee className="size-3.5" />
                              {room.breakfastIncluded
                                ? t.assistant.roomOptionsBreakfastIncluded
                                : t.assistant.roomOptionsRoomOnly}
                            </span>
                          )}
                          {room.refundable && room.freeCancellationUntil ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <ShieldCheck className="size-3.5" />
                              {t.assistant.roomOptionsFreeCancellationUntil} {room.freeCancellationUntil}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">{t.assistant.roomOptionsNonRefundable}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <p className="text-sm font-semibold text-primary">{money(room.amount, room.currency)}</p>
                        <button
                          type="button"
                          onClick={() => onChooseRoom?.(room)}
                          disabled={chosen}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                            chosen
                              ? "border border-primary/40 text-primary"
                              : "bg-primary text-primary-foreground hover:bg-primary/90"
                          }`}
                        >
                          {chosen ? t.assistant.roomOptionsChosen : t.assistant.roomOptionsChoose}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {detail.data && detail.data.reviews.length > 0 && (
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2">
                {detail.data.reviewScore !== null && (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                    {detail.data.reviewScore.toFixed(1)}
                  </span>
                )}
                <div>
                  {detail.data.reviewScore !== null && (
                    <p className="text-xs font-semibold">{reviewBand(detail.data.reviewScore, t)}</p>
                  )}
                  {detail.data.reviewCount !== null && (
                    <p className="text-[11px] text-muted-foreground">
                      {detail.data.reviewCount} {t.assistant.roomOptionsReviewCount}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {detail.data.reviews.slice(0, 2).map((r, i) => (
                  <div key={i} className="rounded-lg bg-secondary/50 px-3 py-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <Star className="size-3 fill-current text-primary" />
                      {r.reviewerName}
                      {r.country && <span className="text-muted-foreground">· {r.country.toUpperCase()}</span>}
                    </div>
                    {r.pros && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{r.pros}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
