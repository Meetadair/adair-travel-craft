/**
 * English source dictionary. Every other locale file in this folder is a JSON
 * translation of this exact structure, produced by scripts/translate-i18n.ts.
 * Brand names, airline names, hotel names, city codes and prices stay untranslated.
 */
export const en = {
  nav: {
    assistant: "Assistant",
    trips: "My trips",
    investors: "For investors",
    account: "My account",
    signIn: "Sign in",
    language: "Language",
  },

  home: {
    meta: {
      title: "Adair Travel — One request. The whole trip.",
      description:
        "Adair is an AI travel assistant that bundles your flight, hotel, and car into a single booking — all from one chat window.",
      ogTitle: "Adair Travel — One request. The whole trip.",
      ogDescription:
        "Flight, hotel, and car in a single booking card. Instead of five apps — one conversation.",
    },
    hero: {
      badge: "AI travel assistant — concept",
      titleLine1: "One request.",
      titleLine2: "The whole trip.",
      lead: "Adair bundles your flight, hotel, and car into a single booking card — all in one chat window. Instead of five apps, one conversation.",
      ctaPrimary: "See how it works",
      ctaSecondary: "Three principles",
    },
    comparison: {
      label: "Why Adair",
      title: "Five apps, or one window.",
      withoutTitle: "Without Adair",
      withoutTag: "5 apps",
      withoutFooter: "5 bookings · 5 confirmations · 5 places to check",
      withTitle: "With Adair",
      withTag: "1 conversation",
      withFooter: "1 booking · 1 confirmation ·",
      quote:
        "\"I need to be in Milan Thursday morning, back Friday evening, somewhere near the Duomo, and a car on the ground.\"",
      bundle: "Flight + hotel + car — one card",
      apps: [
        { name: "Skyscanner", detail: "flight search, 14 tabs" },
        { name: "Booking.com", detail: "hotel at public rate" },
        { name: "Rental agency", detail: "separate car booking" },
        { name: "Uber", detail: "getting around locally" },
        { name: "OpenTable", detail: "restaurants, separately" },
      ],
    },
    demo: {
      label: "Conversation demo",
      title: "One message is all it takes.",
      userMessage:
        "I need to be in Milan Thursday morning, back Friday evening, somewhere near the Duomo, and a car on the ground.",
      you: "You",
      cardTitle: "Milan · Thu – Fri",
      cardSubtitle: "Composed to match your travel profile",
      flightTitle: "LOT 391 · Warsaw → Milan",
      flightDetail:
        "Thu 6:55 – 9:05 AM · returns Fri 7:40 PM · window seat, preferred airline",
      flightTagClass: "Premium Economy",
      hotelTitle: "Park Hyatt Milano",
      hotelDetail: "1 night · King room, quiet floor · 200 m from the Duomo",
      hotelTag: "negotiated rate",
      carTitle: "BMW 3 Series · pickup at Linate",
      carDetail: "Thu 9:30 AM – Fri 6:30 PM · full insurance, no deposit",
      carTag: "automatic",
      total: "Total, one booking",
      bookAll: "Book it all",
      footnote: "3 items · 1 payment · 1 booking number",
    },
    trips: {
      label: "My trips",
      title: "Everything in one place after you book.",
      flight: "Flight",
      hotel: "Hotel",
      car: "Car",
      flightTitle: "LOT 391 · WAW → MXP",
      flightDetail: "Thu, Sep 18 · 6:55 AM · seat 7A",
      flightCode: "Booking ADR-8K2M4F",
      hotelTitle: "Park Hyatt Milano",
      hotelDetail: "Check-in Sep 18 · 1 night · King",
      hotelCode: "Confirmation PH-55271",
      carTitle: "BMW 3 Series · Linate",
      carDetail: "Pickup 9:30 AM · return Fri 6:30 PM",
      carCode: "Voucher ADR-CAR-0912",
      dates: "Thu 18 – Fri 19 Sep",
      place: "Milan, Italy",
      departs: "departs in 6 days",
      paid: "paid",
      pdfIdle: "Download trip card (PDF)",
      pdfBusy: "Generating PDF…",
    },
    profile: {
      label: "Travel profile",
      titleLine1: "Set it once.",
      titleLine2: "It works every time.",
      lead: "Adair learns your preferences once — and every trip after that honors them automatically. No filters to click, nothing to compare.",
      activeCount: "18 active preferences",
      groups: [
        {
          title: "Flights",
          items: [
            "LOT, Lufthansa, Air France",
            "Premium Economy for 2h+ flights",
            "Window seat, front of cabin",
          ],
        },
        {
          title: "Hotels",
          items: [
            "Hyatt, Small Luxury Hotels",
            "Quiet floor, King bed",
            "Max 10 min walk from destination",
          ],
        },
        {
          title: "Diet & timing",
          items: ["Gluten-free", "Breakfast included", "Late checkout after 11:00 AM"],
        },
        {
          title: "Budget",
          items: ["Up to €1,500 / 2-day trip", "Company VAT invoice", "EUR, one card"],
        },
      ],
    },
    principles: {
      label: "Three principles",
      title: "This is what Adair stands on.",
      items: [
        {
          title: "One trip, not three bookings",
          text: "A flight, a hotel, and a car are one trip — so they should be one booking. One window, one payment, one confirmation.",
        },
        {
          title: "A price no one else gets you",
          text: "Hotels at our own negotiated rates — not public Booking.com pricing. You see the difference right in the summary.",
        },
        {
          title: "One place after you book",
          text: "Confirmation numbers, vouchers, changes, and cancellations — all in one My Trips view, right up to the last day of your trip.",
        },
      ],
    },
    footer: "Product concept — sample data. Adair Travel, 2026.",
  },

  assistant: {
    meta: {
      title: "Adair Assistant — compose your whole trip in one conversation",
      description:
        "Tell us where and when you need to be. Adair searches real flight, hotel and car offers and composes them into one card.",
      ogTitle: "Adair Assistant — a whole trip in one conversation",
      ogDescription: "Real flight, hotel and car offers in one bookable card.",
    },
    title: "Tell us where you need to be.",
    lead: "Adair understands everyday language, checks availability with providers, and composes a flight, hotel and car into one bookable card.",
    placeholder: "e.g. I need to be in Milan Thursday morning, back Friday evening…",
    submitIdle: "Compose trip",
    submitBusy: "Searching…",
    examples: [
      "I need to be in Milan Thursday morning, back Friday evening, something near the Duomo and a car waiting.",
      "Conference in Barcelona Oct 12–14, premium economy, hotel near the convention center.",
      "Trip to London on Monday, back Wednesday, no car needed.",
    ],
    error: "We couldn't compose this trip. Try again or give dates explicitly.",
    sourceLive: "prices from provider APIs",
    sourcePartial: "some items from provider APIs",
    sourceDemo: "sample data",
    hideAlternatives: "Hide alternatives",
    showAlternatives: "Show alternatives",
    backToRecommendation: "Back to Adair's recommendation",
    total: "Total, one booking",
    saveIdle: "Save trip",
    saveBusy: "Saving…",
    savedAs: "Saved as",
    openDashboard: "Open dashboard",
    galleryPrev: "Previous photo",
    galleryNext: "Next photo",
    galleryGoTo: "Go to photo",
  },

  auth: {
    meta: {
      title: "Adair account — sign in or sign up",
      description:
        "Sign in to Adair Travel to store your trips, preferences, and download PDF invoices.",
      ogTitle: "Adair account — sign in or sign up",
      ogDescription: "Your trips, preferences, and invoices in one client dashboard.",
    },
    signInTitle: "Sign in",
    signUpTitle: "Create an account",
    lead: "Your trips, preferences, and invoices in one place.",
    fullName: "Full name",
    email: "Email",
    password: "Password",
    submitBusy: "One moment…",
    signIn: "Sign in",
    signUp: "Sign up",
    toSignUp: "I don't have an account yet",
    toSignIn: "I already have an account",
    confirmSent: "Check your inbox — we've sent you a confirmation link.",
    genericError: "Something went wrong",
    demoHint: "Prefer to see a demo first?",
    demoLink: "Open the assistant",
  },

  dashboard: {
    meta: {
      title: "Adair client dashboard — trips and invoices",
      description:
        "Your saved Adair trips, travel preferences, and invoices available for PDF download.",
      ogTitle: "Adair client dashboard",
      ogDescription: "Trips, preferences, and invoices in one place.",
    },
    loadError: "We couldn't load the dashboard. Please refresh the page.",
    title: "My trips",
    signOut: "Sign out",
    loading: "Loading trips…",
    empty: "You don't have any saved trips yet.",
    emptyCta: "Book your first trip",
    invoice: "Download invoice (PDF)",
    deleteTrip: "Delete trip",
    profileTitle: "Travel profile",
    profileLead: "Set it once — every future trip and invoice will follow these preferences.",
    fields: {
      fullName: "Full name",
      company: "Company (invoice bill-to)",
      taxId: "VAT number",
      airlines: "Preferred airlines",
      cabin: "Cabin class",
      seat: "Seat preference",
      chains: "Hotel chains",
      diet: "Diet",
      budget: "Budget per trip",
      currency: "Currency",
    },
    saveIdle: "Save preferences",
    saveBusy: "Saving…",
    saved: "Saved.",
  },

  investors: {
    meta: {
      title: "Adair Travel for investors — model, margin, round",
      description:
        "Adair Travel bundles a flight, hotel, and car into a single booking. Revenue model, margin from negotiated hotel rates, and seed round terms.",
      ogTitle: "Adair Travel for investors",
      ogDescription:
        "One assistant instead of five apps. Margin from our own negotiated hotel rates, not OTA commissions.",
    },
    badge: "Seed round · investor material",
    titleLine1: "Business travel today means five apps.",
    titleLine2: "With us, it's one sentence.",
    lead: "Adair Travel is an assistant that turns a single request into a flight, hotel, and car bundled into one card and one invoice. We earn on our own negotiated hotel rates, not on a comparison-site commission — that's why our price is lower and our margin is higher.",
    metrics: [
      { label: "Average trip value", value: "€1,240" },
      { label: "Gross margin per trip", value: "11–17%" },
      { label: "Time to book a trip", value: "< 40 s" },
      { label: "Apps replaced", value: "5" },
    ],
    revenueTitle: "Where the revenue comes from",
    revenue: [
      {
        title: "Negotiated rate",
        body: "We buy rooms at our own corporate rate and sell them below the public OTA price. The margin stays with us, not with a middleman.",
        margin: "8–14%",
      },
      {
        title: "Airline commission (NDC)",
        body: "Flights through the NDC channel: a distribution commission plus a service fee for handling changes and refunds in a single window.",
        margin: "1–3%",
      },
      {
        title: "Corporate subscription",
        body: "Teams pay for a travel profile, expense policy, and a single VAT invoice for the whole trip instead of three documents.",
        margin: "€29 / user / mo.",
      },
    ],
    unitTitle: "Sample trip — unit economics",
    colItem: "Item",
    colPrice: "Customer price",
    colMargin: "Our margin",
    unit: [
      { item: "Flight (LOT, NDC)", price: "€312", margin: "€6" },
      { item: "Hotel, 1 night (negotiated rate)", price: "€742", margin: "€96" },
      { item: "Car, 2 days", price: "€186", margin: "€22" },
    ],
    unitTotal: "Total, one booking",
    unitNote: "Warsaw–Milan route, illustrative figures based on test supplier rates.",
    askTitle: "What we're looking for",
    askBody:
      "We're raising a seed round to expand our negotiated hotel rate base across ten business cities, deliver full booking-change support in a single window, and sell into teams of 20–200 people.",
    contact: "Get in touch",
    seeProduct: "See the product live",
  },

  invoice: {
    documentTitle: "Trip invoice",
    seller: "Seller",
    buyer: "Buyer",
    route: "Route",
    dates: "Dates",
    item: "Item",
    reference: "Reference",
    net: "Net",
    vat: "VAT 23%",
    gross: "Total gross",
    issued: "Issue date",
    number: "Document no.",
    demoNote: "Sample data — not a fiscal document.",
    liveNote: "Prices confirmed with providers at the time of composing the trip.",
  },
} as const;

export type Dict = typeof en;
