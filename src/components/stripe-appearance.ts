/**
 * Stripe's Payment/Setup Element appearance, in Adair's palette — without
 * this, Elements defaults to a light theme regardless of the page around it,
 * so a traveller on dark mode got a bright white card form. Kept in step
 * with the light/dark tokens in styles.css by hand: Stripe's appearance API
 * takes plain colour strings, not CSS variables it could read itself.
 */
import type { Appearance } from "@stripe/stripe-js";
import type { ResolvedTheme } from "@/lib/theme";

export function stripeAppearance(theme: ResolvedTheme): Appearance {
  return theme === "dark"
    ? {
        theme: "night",
        variables: {
          colorPrimary: "#F66D50",
          colorBackground: "#221F1A",
          colorText: "#F1ECE1",
          colorTextSecondary: "#A8A298",
          colorDanger: "#F05B54",
          borderRadius: "12px",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        },
        rules: {
          ".Input": { border: "1px solid #3A362F" },
          ".Input:focus": { border: "1px solid #F66D50" },
        },
      }
    : {
        theme: "stripe",
        variables: {
          colorPrimary: "#E8623F",
          colorBackground: "#FFFFFF",
          colorText: "#1B1A17",
          colorTextSecondary: "rgba(27,26,23,0.62)",
          colorDanger: "#E8623F",
          borderRadius: "12px",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        },
        rules: {
          ".Input": { border: "1px solid rgba(0,0,0,0.12)" },
        },
      };
}
