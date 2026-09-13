/**
 * English source dictionary. Every other locale file in this folder is a JSON
 * translation of this exact structure, produced by scripts/translate-i18n.ts.
 * Brand names, airline names, hotel names, city codes and prices stay untranslated.
 */
export const en = {
  nav: {
    assistant: "Assistant",
    trips: "My trips",
    business: "For companies",
    investors: "For investors",
    account: "My account",
    signIn: "Sign in",
    language: "Language",
  },

  home: {
    meta: {
      title: "Adair Travel — One sentence. The whole trip.",
      description: "Flight, hotel, car and dinner — booked from a single sentence.",
      ogTitle: "Adair Travel — One sentence. The whole trip.",
      ogDescription: "Flight, hotel, car and dinner — booked from a single sentence.",
    },
    hero: {
      titleLine1: "One sentence.",
      titleLine2: "The whole trip.",
      lead: "Flight, hotel, car and dinner — booked from a single sentence.",
      ctaPrimary: "See how it works",
      inputLabel: "Describe your trip in one sentence",
      inputPlaceholder: "e.g. Rome, Friday to Sunday, hotel with a terrace, invoice to my company",
      inputSubmit: "Show me the trip",
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
      flightDetail: "Thu 6:55 – 9:05 AM · returns Fri 7:40 PM · window seat, preferred airline",
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
      typing: "Adair is building your trip…",
      saved: "You saved €96 and 2 h 40 min vs. booking it yourself",
      savedNote: "vs. average public rates and time to book the same trip across separate sites",
      invoiceLine: "Invoice → your company",
      share: "Share this trip card",
      shareCopied: "Copied",
      testMode: "Test mode — sample airline data",
      bookTooltip: "Booking opens at launch",
      remove: "Remove this item",
      removedNote: "Removed from this trip",
      restoreAll: "Add everything back",
      approx: "approx.",
      searchFailed:
        "We couldn't reach live availability right now — showing our sample trip instead.",
      savedLive: "You saved about {amount} and 2 h 40 min vs. booking it yourself",
      savedEstimate: "estimate",
      nightsOne: "1 night",
      nightsMany: "{count} nights",
      cardTitleTpl: "{city} · {day1} – {day2}",
      flightTitleTpl: "LOT 391 · Warsaw → {city}",
      flightDetailTpl:
        "{day1} 6:55 – 9:05 AM · returns {day2} 7:40 PM · window seat, preferred airline",
      hotelDetailTpl: "1 night · King room, quiet floor · in the historic centre",
      carTitleTpl: "BMW 3 Series · pickup at {code}",
      carDetailTpl: "{day1} 9:30 AM – {day2} 6:30 PM · full insurance, no deposit",
      weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      weekdaysShort: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    },
    campaign: {
      earlyAccess: "Get early access",
      emailLabel: "Your email",
      emailPlaceholder: "you@company.com",
      join: "Join",
      joining: "One moment…",
      success:
        "You're in. Share your link — €40 in travel credit for you, €20 for every friend who books.",
      referralLabel: "Your referral link",
      copy: "Copy link",
      copied: "Copied",
      error: "That didn't go through. Please try again.",
      teamsLabel: "For teams",
      teamsTitle: "Adair for Teams",
      teamsLine:
        "One travel policy, one invoice, one place for the whole team. Coming after launch.",
      teamsCta: "Join the Teams waitlist",
      teamsMore: "See the offer for companies",
    },
    demoLine: "Five apps, five confirmations, five places to check — or this.",
    after: {
      items: [
        {
          title: "Everything in one place",
          text: "Confirmations, vouchers and changes, in My trips.",
        },
        {
          title: "It learns you",
          text: "Set preferences once. Every trip after honours them.",
        },
        {
          title: "Someone to call",
          text: "Support with your booking in front of them.",
        },
      ],
    },
    close: {
      title: "Adair launches in October.",
      line: "First 100 accounts get 3 months of Signature free.",
      teams: "Adair for Teams — one policy, one invoice.",
      teamsLink: "Join the list",
    },
    footer: "Adair Kft. · Budapest",
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
    remove: "Remove this item",
    removedNote: "Removed from this trip",
    restoreAll: "Add everything back",

    // What Adair understood, shown before anything is searched.
    strip: {
      heading: "Here's what I understood.",
      from: "From",
      to: "To",
      depart: "Out",
      back: "Back",
      arriveBy: "There by",
      travellers: "Travelling",
      travellerOne: "1 person",
      travellerMany: "{count} people",
      wishes: "Also noted",
      edit: "Change {field}",
      find: "Find it",
      searching: "Searching…",
      done: "Done",
      airportSearch: "Search airports",
      travellersLabel: "How many people",
    },

    // The one or two things Adair asks before searching.
    questions: {
      dates: "Which dates?",
      arrivalTime: "What time do you need to be there?",
      whichAirport: "{city} has more than one airport. Which one?",
      skip: "Skip",
      done: "Done",
    },

    // What Adair notices about the proposal it just built.
    advice: {
      tightFlight:
        "This flight lands at {land} for a {meeting} meeting — tight. The {alt} gives you {spare} for {extra} more.",
      tightFlightNoOption: "This flight lands at {land} for a {meeting} meeting — that is tight.",
      tightFlightAction: "Take the earlier flight",
      peak: "Prices are {ratio}× the usual{event}.",
      peakEvent: " — {event} week",
      peakSaving: " {days} days later saves {saving}.",
      peakAction: "Show cheaper dates",
      transfer:
        "The hotel is {minutes} minutes from the airport and has no garage — a transfer is simpler than the car.",
      transferCheaper:
        "The hotel is {minutes} minutes from the airport and has no garage — a transfer is {saving} cheaper than the car.",
      transferAction: "Swap the car for a transfer",
      breakfast: "Breakfast isn't included at this rate; the one with breakfast is {amount} more.",
      breakfastAction: "Add breakfast",
    },

    // One suggestion that would make next time easier.
    nudge: {
      connectCalendar:
        "Next time I could pick this up from your calendar myself — connecting takes about three minutes.",
      connectCalendarAction: "Connect the calendar",
      addLoyalty: "You'd earn miles on this flight — add your frequent flyer number in Settings.",
      addLoyaltyAction: "Add the number",
      saveCompany: "Save the company once and I'll invoice it automatically.",
      saveCompanyAction: "Save the company",
      dismiss: "Not now",
    },
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
    documentTitle: "INVOICE / TRIP CARD",
    seller: "SELLER",
    buyer: "BUYER",
    item: "ITEM",
    reference: "OFFER REFERENCE",
    net: "NET",
    netTotal: "Net total",
    vat: "VAT",
    totalDue: "Total due",
    issued: "issued",
    number: "No.",
    vatId: "VAT ID",
    kindFlight: "Flight",
    kindHotel: "Hotel",
    kindCar: "Car",
    demoNote: "Concept document — items contain sample data",
    liveNote: "Items priced from provider offers retrieved via the Adair API",
    paymentNote: "Payment: single company card transaction · 14-day term",
    hotelNote: "Hotel billed at negotiated rate",
    tagline: "Adair Travel · One request. The whole trip. · adair.travel",
  },

  business: {
    meta: {
      title: "Adair for companies — team travel, budgets, and analytics",
      description:
        "One window for the whole team: an assistant that books flight, hotel, and car, keeps travel inside budget, and turns every trip into one invoice and one report.",
      ogTitle: "Adair for companies — team travel in one window",
      ogDescription:
        "Budgets, approvals, and travel analytics for teams. One conversation instead of five apps.",
    },
    badge: "For companies and teams",
    titleLine1: "The whole team's travel",
    titleLine2: "in one window.",
    lead: "Adair composes each trip from one sentence, keeps it inside your travel policy, and returns one invoice and one clear report. Assistants stop juggling tabs, finance stops chasing receipts.",
    ctaPrimary: "Talk to us about your team",
    ctaSecondary: "See the packages",

    rolesLabel: "Who it's for",
    rolesTitle: "Three people, one window.",
    roles: [
      {
        role: "Assistant / office manager",
        title: "Book for someone else in one sentence",
        items: [
          "Book on behalf of any colleague",
          "One shared inbox for every team trip",
          "One VAT invoice instead of three documents",
        ],
      },
      {
        role: "Manager / finance",
        title: "Costs visible before they happen",
        items: [
          "Budget caps per trip, per person, per month",
          "Approval only above the threshold you set",
          "Live spend, no month-end surprises",
        ],
      },
      {
        role: "Traveller",
        title: "Preferences honoured every time",
        items: [
          "Personal travel profile set once",
          "Flight, hotel, and car in one card",
          "Confirmations in one place until the last day",
        ],
      },
    ],

    budgetLabel: "Costs and budgets",
    budgetTitle: "Spending rules the assistant follows.",
    budgetLead:
      "You define the frame once. Every proposal Adair composes already respects it — nothing to police afterwards.",
    budgets: [
      {
        title: "Cap per trip",
        value: "€1,500",
        note: "Adair never proposes a bundle above the cap",
      },
      {
        title: "Monthly team budget",
        value: "€28,000",
        note: "Live usage visible to finance at any moment",
      },
      {
        title: "Approval threshold",
        value: "€900",
        note: "Above it, a manager confirms before booking",
      },
      {
        title: "Travel policy",
        value: "Cabin, chains, radius",
        note: "Premium Economy over 2 h, preferred chains only",
      },
    ],

    dashLabel: "Company view",
    dashTitle: "Everything finance asks for, on one screen.",
    dashNote: "Preview only — sample data",
    dash: {
      budgetTitle: "September budget",
      budgetOf: "of €28,000 used",
      tripsTitle: "Recent team trips",
      statusPaid: "paid",
      statusPending: "awaiting approval",
      peopleTitle: "Spend by person",
      routesTitle: "Most frequent routes",
      savedTitle: "Saved vs. public rates",
      savedValue: "€2,340",
      savedNote: "this quarter, across 21 trips",
      tripsCount: "trips",
      trips: [
        {
          who: "Anna K.",
          route: "Warsaw → Milan",
          dates: "18–19 Sep",
          amount: "€1,240",
          paid: true,
        },
        {
          who: "Tomasz W.",
          route: "Warsaw → Berlin",
          dates: "22–23 Sep",
          amount: "€780",
          paid: true,
        },
        {
          who: "Kitti F.",
          route: "Budapest → London",
          dates: "25–27 Sep",
          amount: "€1,610",
          paid: false,
        },
      ],
      people: [
        { name: "Anna K.", amount: "€4,120", share: 78 },
        { name: "Kitti F.", amount: "€3,480", share: 66 },
        { name: "Tomasz W.", amount: "€2,260", share: 43 },
        { name: "Marek D.", amount: "€1,180", share: 22 },
      ],
      routes: [
        { route: "Warsaw → Milan", count: "7", amount: "€8,190" },
        { route: "Budapest → London", count: "5", amount: "€7,340" },
        { route: "Warsaw → Berlin", count: "4", amount: "€3,120" },
      ],
    },

    analyticsLabel: "Travel analytics",
    analyticsTitle: "What you get in the monthly report.",
    analytics: [
      {
        title: "Cost per person",
        text: "Who travels, how often, and what it costs — per person, team, or cost centre.",
      },
      {
        title: "Route patterns",
        text: "The routes you fly most, so we know where a negotiated rate is worth having.",
      },
      {
        title: "Average night rate",
        text: "What your team actually pays per night, and how it moves month to month.",
      },
      {
        title: "Policy compliance",
        text: "Which trips stayed inside the policy and which needed an approval.",
      },
      {
        title: "Savings vs. public rates",
        text: "The difference between what you paid and the public rate for the same trip.",
      },
      {
        title: "Accounting export",
        text: "One file per month with every invoice, reference, and VAT line already matched.",
      },
    ],

    plansLabel: "Packages",
    plansTitle: "Pick the frame that fits your team.",
    plansNote:
      "Teams starts with a 14-day trial, no card required. Prices exclude VAT. Enterprise is priced on the size of your team and your policy.",
    plansTrial: "14 days free",
    quote: "Request a quote",
    plans: [
      {
        name: "Starter",
        forWho: "Up to 5 travellers",
        price: "Free",
        priceNote: "no card required",
        features: [
          "Travel profile per person",
          "One invoice per trip",
          "Trip archive and PDF trip cards",
          "Email support",
        ],
      },
      {
        name: "Teams",
        forWho: "5–50 travellers",
        price: "19 USD",
        priceNote: "per traveller, per month — minimum 5",
        features: [
          "Budgets and approval thresholds",
          "Booking on behalf of colleagues",
          "Monthly travel report",
          "Shared team trip view",
        ],
      },
      {
        name: "Enterprise",
        forWho: "50+ travellers",
        price: "On request",
        priceNote: "quoted for your team",
        features: [
          "Cost centres and custom policy rules",
          "Accounting export on your format",
          "Negotiated rates on your key routes",
          "Named account manager",
        ],
      },
    ],

    contactLabel: "Talk to us",
    contactTitle: "Tell us about your team.",
    contactLead:
      "Leave your details and we'll come back with a quote and a walkthrough for your travel setup.",
    form: {
      email: "Work email",
      emailPlaceholder: "you@company.com",
      company: "Company",
      companyPlaceholder: "Company name",
      size: "Team size",
      sizePlaceholder: "e.g. 12 travellers",
      message: "Anything we should know? (optional)",
      messagePlaceholder: "Routes you fly most, current tools, invoicing needs…",
      submit: "Send request",
      submitBusy: "Sending…",
      success: "Thank you — we'll get back to you within one business day.",
      error: "That didn't go through. Please try again.",
    },
    footer: "Adair Kft. · Budapest",
  },
} as const;

export type Dict = typeof en;
