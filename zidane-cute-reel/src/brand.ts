// All on-screen copy lives here. Edit this file to change the video's wording.
// English + Roman Urdu, per the brand voice.
export const brand = {
  url: "zidane.com.pk",
  whatsapp: "0339 2639315",
  uan: "021 111 ZIDANE",
  hook: { small: "Psst…", line1: "Ramadan 2027", line2: "aa raha hai!" },
  squadHeading: "Ration squad ready!",
  squad: [
    { img: "cut/atta.png", say: "Roti meri zimmedari", w: 300 },
    { img: "cut/moong.png", say: "Protein wali daal", w: 300 },
    { img: "cut/oil.png", say: "Tarka mera kaam", w: 300 },
    { img: "cut/tea.png", say: "Sehri ki jaan", w: 300 },
    { img: "cut/rooh-afza.png", say: "Iftar ka hero", w: 128 },
    { img: "cut/vermicelli.png", say: "Eid special", w: 190 },
  ],
  jumpHeading: { pre: "Sab", accent: "ek bag", post: "mein!" },
  price: { pre: "Sirf", amount: 2149, currency: "PKR", post: "se shuru", sub: "Custom items · Aapki branding" },
  audience: ["Corporate", "Factory", "NGO", "Employees"],
  cta: "Early booking open!",
} as const;
