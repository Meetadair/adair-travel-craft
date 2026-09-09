import { PDFDocument, rgb } from "pdf-lib";
import fontUrl from "@/assets/fonts/PlusJakartaSans.ttf";

const CREAM = rgb(0.984, 0.973, 0.949); // #FBF8F2
const CARD = rgb(1, 1, 1);
const INK = rgb(0.18, 0.16, 0.13);
const INK_SOFT = rgb(0.42, 0.4, 0.37);
const MUTED = rgb(0.56, 0.54, 0.5);
const CORAL = rgb(0.91, 0.384, 0.247); // #E8623F
const BORDER = rgb(0.88, 0.86, 0.83);

const M = 48; // margin

export async function downloadTripPdf() {
  const doc = await PDFDocument.create();
  const fontBytes = await fetch(fontUrl).then((r) => r.arrayBuffer());
  const font = await doc.embedFont(fontBytes);
  const bold = await doc.embedFont(fontBytes, { subset: true });

  const page = doc.addPage([595, 842]); // A4
  const { width } = page.getSize();
  const W = width - M * 2;

  page.drawRectangle({ x: 0, y: 0, width, height: 842, color: CREAM });

  let y = 842 - M;

  // Header
  page.drawText("Adair.", { x: M, y, size: 22, font: bold, color: INK });
  page.drawText("KARTA PODRÓŻY", {
    x: width - M - bold.widthOfTextAtSize("KARTA PODRÓŻY", 9),
    y: y + 7,
    size: 9,
    font: bold,
    color: CORAL,
  });
  y -= 14;
  page.drawText("Wygenerowano przez asystenta Adair · dane rezerwacji klienta", {
    x: M,
    y,
    size: 8.5,
    font,
    color: MUTED,
  });

  // Trip title
  y -= 34;
  page.drawText("Mediolan · czwartek 18 – piątek 19 września", {
    x: M,
    y,
    size: 15,
    font: bold,
    color: INK,
  });
  y -= 15;
  page.drawText("Jedna rezerwacja · jedna płatność · skomponowane pod profil podróży", {
    x: M,
    y,
    size: 9.5,
    font,
    color: INK_SOFT,
  });

  const rows: {
    kind: string;
    title: string;
    lines: string[];
    tags: string[];
    price: string;
  }[] = [
    {
      kind: "LOT",
      title: "LOT 391 · Warszawa (WAW) → Mediolan (MXP)",
      lines: [
        "Wylot: czwartek 18 wrz, 06:55 – 09:05",
        "Powrót: piątek 19 wrz, 19:40 – 21:50",
        "Premium Economy · miejsce 7A przy oknie",
      ],
      tags: ["Duffel · NDC", "Premium Economy"],
      price: "412 €",
    },
    {
      kind: "HOTEL",
      title: "Park Hyatt Milano",
      lines: [
        "1 noc · pokój King, ciche piętro",
        "200 m od Duomo · śniadanie w cenie (bez glutenu)",
      ],
      tags: ["Adair Direct · stawka negocjowana"],
      price: "610 €",
    },
    {
      kind: "SAMOCHÓD",
      title: "BMW serii 3 · odbiór Linate",
      lines: [
        "Czwartek 09:30 – piątek 18:30",
        "Automat · pełne ubezpieczenie, bez kaucji",
      ],
      tags: ["Duffel"],
      price: "218 €",
    },
  ];

  const codes: [string, string][] = [
    ["Lot", "Rezerwacja ADR-8K2M4F"],
    ["Hotel", "Potwierdzenie PH-55271"],
    ["Samochód", "Voucher ADR-CAR-0912"],
  ];

  // Cards
  for (const r of rows) {
    const cardH = 96;
    y -= 26 + cardH;
    page.drawRectangle({
      x: M,
      y,
      width: W,
      height: cardH,
      color: CARD,
      borderColor: BORDER,
      borderWidth: 1,

    });
    page.drawText(r.kind, { x: M + 16, y: y + cardH - 22, size: 8, font: bold, color: CORAL });
    page.drawText(r.title, { x: M + 16, y: y + cardH - 38, size: 11.5, font: bold, color: INK });
    let ly = y + cardH - 54;
    for (const line of r.lines) {
      page.drawText(line, { x: M + 16, y: ly, size: 9, font, color: INK_SOFT });
      ly -= 13;
    }
    let tx = M + 16;
    for (const t of r.tags) {
      const tw = font.widthOfTextAtSize(t, 7.5) + 14;
      page.drawRectangle({
        x: tx,
        y: y + 12,
        width: tw,
        height: 15,
        borderColor: t.startsWith("Adair") ? CORAL : BORDER,
        borderWidth: 1,

      });
      page.drawText(t, {
        x: tx + 7,
        y: y + 16.5,
        size: 7.5,
        font,
        color: t.startsWith("Adair") ? CORAL : INK_SOFT,
      });
      tx += tw + 6;
    }
    const pw = bold.widthOfTextAtSize(r.price, 12);
    page.drawText(r.price, { x: M + W - 16 - pw, y: y + cardH - 34, size: 12, font: bold, color: INK });
  }

  // Total bar
  const totalH = 52;
  y -= 18 + totalH;
  page.drawRectangle({
    x: M,
    y,
    width: W,
    height: totalH,
    color: CARD,
    borderColor: CORAL,
    borderWidth: 1,

  });
  page.drawText("Razem — jedna rezerwacja", { x: M + 16, y: y + 30, size: 8.5, font, color: MUTED });
  page.drawText("1 240 €", { x: M + 16, y: y + 12, size: 17, font: bold, color: CORAL });
  const note = "opłacone · faktura VAT firmowa";
  page.drawText(note, {
    x: M + W - 16 - font.widthOfTextAtSize(note, 9),
    y: y + 22,
    size: 9,
    font,
    color: INK_SOFT,
  });

  // Confirmation codes
  y -= 40;
  page.drawText("NUMERY REZERWACJI", { x: M, y, size: 8, font: bold, color: MUTED });
  for (const [label, code] of codes) {
    y -= 20;
    page.drawText(label, { x: M, y, size: 9.5, font, color: INK_SOFT });
    page.drawText(code, { x: M + 110, y, size: 9.5, font: bold, color: INK });
  }

  // Footer
  page.drawLine({
    start: { x: M, y: 64 },
    end: { x: width - M, y: 64 },
    color: BORDER,
    thickness: 1,
  });
  page.drawText(
    "Adair Travel · Jedna prośba. Cała podróż. · Dokument koncepcyjny, dane przykładowe",
    { x: M, y: 48, size: 8, font, color: MUTED }
  );

  const bytes = await doc.save();
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "adair-karta-podrozy-mediolan.pdf";
  a.click();
  URL.revokeObjectURL(url);
}
