/**
 * Shared styling for the provider's hosted card fields, in Adair's design —
 * one definition for both themes, so the iframe never sits as a bright white
 * box in a dark page (or the reverse). Kept in step with the light/dark
 * tokens in styles.css by hand, because Duffel's form styles are plain
 * colour strings, not CSS variables the iframe could read itself.
 */
export type CardFormTheme = "light" | "dark";

export function cardFormStyles(theme: CardFormTheme) {
  return theme === "dark"
    ? {
        input: {
          default: {
            "background-color": "#221F1A",
            border: "1px solid #3A362F",
            "border-radius": "12px",
            padding: "10px 14px",
            "font-family": "'Plus Jakarta Sans', sans-serif",
            "font-size": "14px",
            color: "#F1ECE1",
          },
          focus: { border: "1px solid #F66D50", outline: "none" },
        },
        select: {
          default: {
            "background-color": "#221F1A",
            border: "1px solid #3A362F",
            "border-radius": "12px",
            padding: "10px 14px",
            "font-family": "'Plus Jakarta Sans', sans-serif",
            "font-size": "14px",
            color: "#F1ECE1",
          },
        },
        label: {
          "font-family": "'Plus Jakarta Sans', sans-serif",
          "font-size": "12px",
          color: "#A8A298",
        },
        inputErrorMessage: { "font-size": "12px", color: "#F05B54" },
        sectionTitle: {
          "font-family": "'Bricolage Grotesque', sans-serif",
          "font-size": "15px",
          color: "#F1ECE1",
        },
      }
    : {
        input: {
          default: {
            "background-color": "#FFFFFF",
            border: "1px solid rgba(0,0,0,0.12)",
            "border-radius": "12px",
            padding: "10px 14px",
            "font-family": "'Plus Jakarta Sans', sans-serif",
            "font-size": "14px",
            color: "#1B1A17",
          },
          focus: { border: "1px solid #E8623F", outline: "none" },
        },
        select: {
          default: {
            "background-color": "#FFFFFF",
            border: "1px solid rgba(0,0,0,0.12)",
            "border-radius": "12px",
            padding: "10px 14px",
            "font-family": "'Plus Jakarta Sans', sans-serif",
            "font-size": "14px",
          },
        },
        label: {
          "font-family": "'Plus Jakarta Sans', sans-serif",
          "font-size": "12px",
          color: "rgba(27,26,23,0.62)",
        },
        inputErrorMessage: { "font-size": "12px", color: "#E8623F" },
        sectionTitle: { "font-family": "'Bricolage Grotesque', sans-serif", "font-size": "15px" },
      };
}
