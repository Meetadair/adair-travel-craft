import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fontRegularUrl from "@/assets/fonts/PlusJakartaSans-Regular.ttf";
import fontBoldUrl from "@/assets/fonts/PlusJakartaSans-Bold.ttf";

const CREAM = rgb(0.984, 0.973, 0.949);
const CARD = rgb(1, 1, 1);
const INK = rgb(0.18, 0.16, 0.13);
const INK_SOFT = rgb(0.42, 0.4, 0.37);
const MUTED = rgb(0.56, 0.54, 0.5);
const CORAL = rgb(0.91, 0.384, 0.247);
const BORDER = rgb(0.88, 0.86, 0.83);

const M = 48;
const VAT_RATE = 0.23;

/** Placeholder issuer details — replace with the real company data. */
export const SELLER = {
  name: "Adair Travel sp. z o.o.",
  address: "ul. Prosta 51, 00-838 Warsaw, Poland",
  taxId: "VAT ID 000-000-00-00",
  contact: "faktury@adair.travel",
};

export type InvoiceItem = {
  kind: string;
  title: string;
  detail: string;
  provider: string;
  offerReference: string;
  amount: number;
  currency: string;
};

export type InvoiceData = {
  documentNumber: string;
  issueDate: string;
  city: string;
  origin: string;
  startDate: string;
  endDate: string;
  currency: string;
  live: boolean;
  buyer: {
    name: string;
    company: string;
    taxId: string;
    email: string;
  };
  items: InvoiceItem[];
};

const money = (value: number, currency: string) =>
  `${value.toFixed(2).replace(".", ",")} ${currency}`;

const KIND_LABEL: Record<string, string> = {
  flight: "Flight",
  hotel: "Hotel",
  car: "Car",
};

export async function downloadTripInvoice(data: InvoiceData) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await Promise.all([
    fetch(fontRegularUrl).then((r) => r.arrayBuffer()),
    fetch(fontBoldUrl).then((r) => r.arrayBuffer()),
  ]);
  const font = await doc.embedFont(regularBytes, { subset: true });
  const bold = await doc.embedFont(boldBytes, { subset: true });

  const page = doc.addPage([595, 842]);
  const { width } = page.getSize();
  const W = width - M * 2;
  page.drawRectangle({ x: 0, y: 0, width, height: 842, color: CREAM });

  let y = 842 - M;

  // Header
  page.drawText("Adair.", { x: M, y, size: 22, font: bold, color: INK });
  const head = "INVOICE / TRIP CARD";
  page.drawText(head, {
    x: width - M - bold.widthOfTextAtSize(head, 9),
    y: y + 7,
    size: 9,
    font: bold,
    color: CORAL,
  });
  y -= 14;
  page.drawText(`No. ${data.documentNumber} · issued ${data.issueDate}`, {
    x: M,
    y,
    size: 8.5,
    font,
    color: MUTED,
  });

  // Parties
  y -= 34;
  const colW = (W - 16) / 2;
  const partyLines: [string, string[]][] = [
    [
      "SELLER",
      [SELLER.name, SELLER.address, SELLER.taxId, SELLER.contact],
    ],
    [
      "BUYER",
      [
        data.buyer.company || data.buyer.name || "—",
        data.buyer.name && data.buyer.company ? data.buyer.name : data.buyer.email,
        data.buyer.taxId ? `VAT ID ${data.buyer.taxId}` : "VAT ID —",
        data.buyer.email,
      ],
    ],
  ];
  const partyH = 86;
  partyLines.forEach(([label, lines], index) => {
    const x = M + index * (colW + 16);
    page.drawRectangle({
      x,
      y: y - partyH,
      width: colW,
      height: partyH,
      color: CARD,
      borderColor: BORDER,
      borderWidth: 1,
    });
    page.drawText(label, { x: x + 14, y: y - 20, size: 7.5, font: bold, color: CORAL });
    let ly = y - 36;
    for (const line of lines) {
      page.drawText(line.slice(0, 42), { x: x + 14, y: ly, size: 9, font, color: INK_SOFT });
      ly -= 13;
    }
  });
  y -= partyH + 26;

  page.drawText(
    `${data.origin} → ${data.city} · ${data.startDate} – ${data.endDate}`,
    { x: M, y, size: 13, font: bold, color: INK },
  );
  y -= 14;
  page.drawText(
    data.live
      ? "Items priced from provider offers retrieved via the Adair API"
      : "Concept document — items contain sample data",
    { x: M, y, size: 9, font, color: INK_SOFT },
  );

  // Table head
  y -= 26;
  page.drawText("ITEM", { x: M, y, size: 7.5, font: bold, color: MUTED });
  page.drawText("OFFER REFERENCE", { x: M + 250, y, size: 7.5, font: bold, color: MUTED });
  const netHead = "NET";
  page.drawText(netHead, {
    x: M + W - bold.widthOfTextAtSize(netHead, 7.5),
    y,
    size: 7.5,
    font: bold,
    color: MUTED,
  });
  y -= 6;
  page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, color: BORDER, thickness: 1 });

  let net = 0;
  for (const item of data.items) {
    const itemNet = item.amount / (1 + VAT_RATE);
    net += itemNet;
    y -= 20;
    page.drawText(`${KIND_LABEL[item.kind] ?? item.kind} · ${item.title}`.slice(0, 44), {
      x: M,
      y,
      size: 9.5,
      font: bold,
      color: INK,
    });
    const value = money(itemNet, item.currency);
    page.drawText(value, {
      x: M + W - font.widthOfTextAtSize(value, 9.5),
      y,
      size: 9.5,
      font,
      color: INK,
    });
    y -= 12;
    page.drawText(item.detail.slice(0, 70), { x: M, y, size: 8.5, font, color: INK_SOFT });
    page.drawText(`${item.provider} · ${item.offerReference}`.slice(0, 34), {
      x: M + 250,
      y: y + 12,
      size: 8,
      font,
      color: MUTED,
    });
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, color: BORDER, thickness: 0.5 });
  }

  const vat = net * VAT_RATE;
  const gross = net + vat;

  // Totals
  y -= 22;
  const rows: [string, string, boolean][] = [
    ["Net total", money(net, data.currency), false],
    [`VAT ${Math.round(VAT_RATE * 100)}%`, money(vat, data.currency), false],
    ["Total due", money(gross, data.currency), true],
  ];
  for (const [label, value, strong] of rows) {
    const size = strong ? 13 : 9.5;
    const f = strong ? bold : font;
    page.drawText(label, { x: M + W - 240, y, size, font: f, color: strong ? INK : INK_SOFT });
    page.drawText(value, {
      x: M + W - f.widthOfTextAtSize(value, size),
      y,
      size,
      font: f,
      color: strong ? CORAL : INK,
    });
    y -= strong ? 24 : 16;
  }

  // Payment note
  y -= 6;
  page.drawRectangle({
    x: M,
    y: y - 46,
    width: W,
    height: 46,
    color: CARD,
    borderColor: BORDER,
    borderWidth: 1,
  });
  page.drawText("Payment: single company card transaction · 14-day term", {
    x: M + 14,
    y: y - 20,
    size: 9,
    font,
    color: INK_SOFT,
  });
  page.drawText("Hotel billed at negotiated rate", {
    x: M + 14,
    y: y - 34,
    size: 9,
    font,
    color: MUTED,
  });

  // Footer
  page.drawLine({
    start: { x: M, y: 64 },
    end: { x: width - M, y: 64 },
    color: BORDER,
    thickness: 1,
  });
  page.drawText("Adair Travel · One request. The whole trip. · adair.travel", {
    x: M,
    y: 48,
    size: 8,
    font,
    color: MUTED,
  });

  const bytes = await doc.save();
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `adair-${data.documentNumber.replace(/\//g, "-")}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
