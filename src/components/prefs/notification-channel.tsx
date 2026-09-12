/**
 * How we reach the traveller. Email is the default; WhatsApp only appears when
 * the channel is configured, and only after the number is confirmed by code.
 */
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  confirmWhatsAppVerification,
  getNotificationSettings,
  removeWhatsAppNumber,
  setNotificationChannel,
  startWhatsAppVerification,
} from "@/lib/notifications.functions";

const inputClass =
  "mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary";

const CHANNELS = [
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "both", label: "Both" },
] as const;

export function NotificationChannel() {
  const fetchSettings = useServerFn(getNotificationSettings);
  const setChannel = useServerFn(setNotificationChannel);
  const startVerification = useServerFn(startWhatsAppVerification);
  const confirmVerification = useServerFn(confirmWhatsAppVerification);
  const removeNumber = useServerFn(removeWhatsAppNumber);
  const queryClient = useQueryClient();

  const settings = useQuery({ queryKey: ["notify"], queryFn: () => fetchSettings() });
  const [phone, setPhone] = useState("+48 ");
  const [code, setCode] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["notify"] });

  const channelMutation = useMutation({
    mutationFn: async (value: "email" | "whatsapp" | "both") =>
      setChannel({ data: { channel: value } }),
    onSuccess: () => {
      setNote(null);
      void invalidate();
    },
    onError: () => setNote("Confirm your WhatsApp number first."),
  });

  const startMutation = useMutation({
    mutationFn: async () => startVerification({ data: { phone } }),
    onSuccess: () => {
      setNote("We sent you a six-digit code on WhatsApp.");
      void invalidate();
    },
    onError: () => setNote("We couldn't send the code to that number."),
  });

  const confirmMutation = useMutation({
    mutationFn: async () => confirmVerification({ data: { code } }),
    onSuccess: () => {
      setNote("Number confirmed.");
      setCode("");
      void invalidate();
    },
    onError: () => setNote("That code didn't match. Try again."),
  });

  const removeMutation = useMutation({
    mutationFn: async () => removeNumber(),
    onSuccess: () => {
      setNote(null);
      void invalidate();
    },
  });

  const data = settings.data;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-display text-lg">Notifications</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Booking confirmations, the day-before reminder and schedule changes.
      </p>

      {data && (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {CHANNELS.filter((c) => c.value === "email" || data.whatsappAvailable).map(
              (channel) => (
                <button
                  key={channel.value}
                  type="button"
                  onClick={() => channelMutation.mutate(channel.value)}
                  aria-pressed={data.channel === channel.value}
                  className={`min-h-11 rounded-xl border px-4 py-2.5 text-sm ${
                    data.channel === channel.value
                      ? "border-primary bg-primary/10 font-medium"
                      : "border-border"
                  }`}
                >
                  {channel.label}
                </button>
              ),
            )}
          </div>

          {data.whatsappAvailable && (
            <div className="mt-4 border-t border-border pt-4">
              {data.verified ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm">
                    WhatsApp number confirmed: {data.phoneMasked}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeMutation.mutate()}
                    className="min-h-11 rounded-xl border border-border px-4 py-2.5 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-medium text-muted-foreground">
                      Phone number with country code
                    </span>
                    <input
                      value={phone}
                      inputMode="tel"
                      onChange={(event) => setPhone(event.target.value)}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => startMutation.mutate()}
                      disabled={startMutation.isPending}
                      className="mt-2 min-h-11 w-full rounded-xl border border-border px-4 py-2.5 text-sm disabled:opacity-60"
                    >
                      {startMutation.isPending ? "Sending…" : "Send code"}
                    </button>
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-muted-foreground">
                      Six-digit code
                    </span>
                    <input
                      value={code}
                      inputMode="numeric"
                      maxLength={6}
                      onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => confirmMutation.mutate()}
                      disabled={code.length !== 6 || confirmMutation.isPending}
                      className="mt-2 min-h-11 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                    >
                      Confirm number
                    </button>
                  </label>
                </div>
              )}
            </div>
          )}

          {note && <p className="mt-3 text-xs text-muted-foreground">{note}</p>}
        </>
      )}
    </section>
  );
}
