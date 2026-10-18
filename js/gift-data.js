// Personal Log phase 2 (memo phase B, save v9 here; the memo's "v8"): gift catalogue and crew tastes (data only).
// Prices / base opinion per tier live in PROG.gifts.tiers (progression.js). Logic: js/gifts.js.
// GIFT_ITEMS has the DECOR_ITEMS shape (id, name, icon, cost-by-tier, gate) plus categories (`cats`) that tastes match on.
// Where they come from (memo §2): Token + Thoughtful from Delgado's galley replicator (any time); Personal from the DS9
// Promenade while docked; Treasured at a homeworld visit, Lt and up. Bought Personal / Treasured items wait in the gift locker.
export const GIFT_ITEMS = [
  // ---- Token (galley) ----
  { id: "raktajino", name: "Raktajino", a: "a raktajino", tier: "token", icon: "☕", cats: ["coffee", "hot"] },
  { id: "coffee", name: "Real coffee beans", a: "a tin of real coffee beans", tier: "token", icon: "🫘", cats: ["coffee"] },
  { id: "tea", name: "Herbal tea", a: "a pouch of herbal tea", tier: "token", icon: "🍵", cats: ["tea", "hot"] },
  { id: "chocolate", name: "Chocolate box", a: "a box of chocolates", tier: "token", icon: "🍫", cats: ["sweets"] },
  { id: "treat", name: "Replicated pastry", a: "a replicated pastry", tier: "token", icon: "🥐", cats: ["food", "plain"] },
  { id: "candle", name: "Prayer candle", a: "a Bajoran prayer candle", tier: "token", icon: "🕯️", cats: ["spiritual"] },
  { id: "musicchip", name: "Music chip", a: "a music chip", tier: "token", icon: "🎵", cats: ["music"] },
  { id: "cards", name: "Deck of cards", a: "a deck of cards (poker night)", tier: "token", icon: "🃏", cats: ["game"] },
  { id: "trinket", name: "Souvenir trinket", a: "a souvenir trinket", tier: "token", icon: "🧸", cats: ["trinket", "sentimental"] },
  { id: "gizmo", name: "Novelty noisemaker", a: "a novelty noisemaker", tier: "token", icon: "📯", cats: ["gimmick", "noisy", "novelty"] },
  // ---- Thoughtful (galley) ----
  { id: "kaltoh", name: "Kal-toh set", a: "a kal-toh set", tier: "thoughtful", icon: "🔷", cats: ["game", "logic"] },
  { id: "dataset", name: "Clean anomaly data set", a: "a clean anomaly data set", tier: "thoughtful", icon: "📊", cats: ["data", "science"] },
  { id: "warpjournal", name: "Warp theory journal", a: "a warp theory journal", tier: "thoughtful", icon: "📘", cats: ["tech", "book"] },
  { id: "techmanual", name: "Technical manual", a: "a detailed technical manual", tier: "thoughtful", icon: "📗", cats: ["tech", "book"] },
  { id: "cmdtext", name: "Command-track text", a: "a command-track text", tier: "thoughtful", icon: "📕", cats: ["career", "book"] },
  { id: "debate", name: "Debate treatise", a: "a Tellarite debate treatise", tier: "thoughtful", icon: "📜", cats: ["argument", "book"] },
  { id: "holonovel", name: "Holo-novel", a: "a holo-novel", tier: "thoughtful", icon: "💠", cats: ["holo", "story"] },
  { id: "holophoto", name: "Holo-photo frame", a: "a holo-photo frame", tier: "thoughtful", icon: "🖼️", cats: ["holo", "family", "sentimental"] },
  { id: "strings", name: "Instrument strings", a: "a set of instrument strings", tier: "thoughtful", icon: "🎻", cats: ["music"] },
  { id: "spice", name: "Rare spice", a: "a rare spice", tier: "thoughtful", icon: "🌶️", cats: ["cooking", "food"] },
  { id: "recipe", name: "Home-cooking pattern", a: "a home-cooking replicator pattern", tier: "thoughtful", icon: "🍲", cats: ["home", "cooking", "food"] },
  { id: "seed", name: "Rare seed cutting", a: "a rare seed cutting", tier: "thoughtful", icon: "🌱", cats: ["plant"] },
  { id: "mug", name: "Sturdy mug", a: "a sturdy mug", tier: "thoughtful", icon: "🍺", cats: ["keepsake"] },
  { id: "paperweight", name: "Torpedo-casing paperweight", a: "a torpedo-casing paperweight", tier: "thoughtful", icon: "🚀", cats: ["keepsake", "tactical"] },
  // ---- Personal (DS9 Promenade, while docked) ----
  { id: "vulcantext", name: "Ancient Vulcan text", a: "an ancient Vulcan text", tier: "personal", icon: "📖", cats: ["vulcan", "book"] },
  { id: "hyperspanner", name: "Vintage hyperspanner", a: "a vintage hyperspanner", tier: "personal", icon: "🔧", cats: ["tool", "tech"] },
  { id: "mineral", name: "Rare mineral sample", a: "a rare mineral sample", tier: "personal", icon: "💎", cats: ["science", "curio"] },
  { id: "medinstr", name: "Antique medical instrument", a: "an antique medical instrument", tier: "personal", icon: "🩺", cats: ["medical", "curio"] },
  { id: "barberkit", name: "Barber's kit", a: "a barber's kit", tier: "personal", icon: "✂️", cats: ["grooming", "tool"] },
  { id: "springwine", name: "Bajoran springwine", a: "a bottle of Bajoran springwine", tier: "personal", icon: "🍷", cats: ["drink", "bajoran"] },
  { id: "medcreature", name: "Exotic medicinal creature", a: "an exotic medicinal creature", tier: "personal", icon: "🐛", cats: ["creature", "medical", "curio"] },
  { id: "andorianice", name: "Andorian ice carving", a: "an Andorian ice carving", tier: "personal", icon: "🧊", cats: ["cold"] },
  { id: "kanar", name: "Cardassian kanar", a: "a bottle of kanar", tier: "personal", icon: "🍾", cats: ["drink", "cardassian"] },
  { id: "sunlamp", name: "Risian sun lamp", a: "a Risian sun lamp", tier: "personal", icon: "☀️", cats: ["warm", "gimmick"] },
  // ---- Treasured (homeworld visit, Lt+) ----
  { id: "earthbook", name: "First-edition Earth classic", a: "a first-edition Earth classic", tier: "treasured", icon: "📚", cats: ["antique", "book"], at: "earth" },
  { id: "bloodwine", name: "Qo'noS bloodwine", a: "a cask of Qo'noS bloodwine", tier: "treasured", icon: "🍷", cats: ["drink", "klingon"], at: "qonos" },
  { id: "romulanale", name: "Romulan ale", a: "a bottle of Romulan ale", tier: "treasured", icon: "🧪", cats: ["drink", "romulan"], at: "romulus" },
  { id: "lyre", name: "Vulcan ka'athyra", a: "a Vulcan ka'athyra", tier: "treasured", icon: "🪕", cats: ["music", "vulcan"], at: "vulcan" },
  { id: "idic", name: "IDIC pendant", a: "an IDIC pendant", tier: "treasured", icon: "🔺", cats: ["vulcan", "keepsake"], at: "vulcan" },
];
export const GIFT = Object.fromEntries(GIFT_ITEMS.map(g => [g.id, g]));
// what a partial reveal tells the player ("Doru would value something spiritual")
export const CAT_LABEL = {
  coffee: "a proper cup of coffee", tea: "a quiet cup of tea", sweets: "something sweet", spiritual: "something spiritual", music: "something musical",
  game: "a game", tech: "something technical", data: "good, clean data", science: "something scientific", holo: "a holo of some kind",
  family: "something about family", plant: "something growing", keepsake: "a sturdy keepsake", tool: "a proper tool", grooming: "a grooming kit",
  medical: "a piece of medical history", creature: "an unusual living thing", drink: "a good bottle", cold: "something cold", vulcan: "something Vulcan",
  home: "a taste of home", cooking: "something for the kitchen", career: "something for the career", argument: "something to argue about",
  antique: "something old and rare", story: "a good story",
  // dislikes
  sentimental: "sentimental gifts", gimmick: "gadget gimmicks", trinket: "cheap trinkets", plain: "plain, dull gifts", noisy: "loud, noisy things",
  cardassian: "anything Cardassian", warm: "warm-climate things", novelty: "novelty joke gifts",
};
// memo §3 (inferred tastes; ◆ = grounded in existing dialogue). like: { item, cat }; avoid is stored for phase C (Insight)
const T = (i1, c1, i2, c2, dislike, avoid) => ({ like1: { item: i1, cat: c1 }, like2: { item: i2, cat: c2 }, dislike, avoid });
export const CREW_TASTES = {
  tren: T("kaltoh", "game", "vulcantext", "vulcan", "sentimental", "'I had a hunch.'"),
  okafor: T("coffee", "coffee", "hyperspanner", "tool", "gimmick", "'It's good enough.'"),
  diallo: T("dataset", "data", "mineral", "science", "novelty", "'It's just a sensor ghost.'"),
  hale: T("paperweight", "keepsake", "cards", "game", "sentimental", "correcting his torpedo story"),
  orvin: T("medinstr", "medical", "tea", "tea", "novelty", "asking whether Orvin is joined"),
  tull: T("holophoto", "holo", "barberkit", "grooming", "plain", "'Can we skip the story?'"),
  kovac: T("warpjournal", "tech", "cmdtext", "career", "trinket", "taking credit for Kovac's work"),
  seo: T("recipe", "home", "holophoto", "family", "noisy", "'You'll get over missing home.'"),
  doru: T("candle", "spiritual", "springwine", "drink", "cardassian", "calling the Prophets 'wormhole aliens'"),
  rhovan: T("chocolate", "sweets", "holonovel", "holo", "trinket", "feigning feelings"),
  grevv: T("mug", "keepsake", "debate", "argument", "sentimental", "excessive politeness"),
  mollo: T("medcreature", "creature", "holophoto", "family", "plain", "'Your family sounds exhausting.'"),
  vardock: T("techmanual", "tech", "dataset", "data", "gimmick", "'Just wing it.'"),
  natarajan: T("cmdtext", "career", "earthbook", "antique", "trinket", "'A yeoman isn't real Starfleet.'"),
  rmira: T("strings", "music", "musicchip", "music", "noisy", "cat jokes"),
  thelev: T("raktajino", "coffee", "andorianice", "cold", "warm", "remarks about her antennae"),
  delgado: T("spice", "cooking", "recipe", "cooking", "plain", "'The replicator does it better.'"),
  sorvan: T("seed", "plant", "vulcantext", "vulcan", "sentimental", "'How do you feel about it?'"),
};
// replacement crew: one like + the dislike from the species, the second like from the first personality tag (memo §3)
export const SPECIES_TASTES = {
  human: ["coffee", "coffee", "trinket"], vulcan: ["vulcantext", "vulcan", "sentimental"], andorian: ["andorianice", "cold", "warm"],
  bajoran: ["candle", "spiritual", "cardassian"], betazoid: ["chocolate", "sweets", "trinket"], trill: ["tea", "tea", "novelty"],
  bolian: ["holophoto", "holo", "plain"], tellarite: ["debate", "argument", "sentimental"], benzite: ["techmanual", "tech", "gimmick"],
  denobulan: ["medcreature", "creature", "plain"], klingon: ["bloodwine", "drink", "sentimental"], caitian: ["strings", "music", "noisy"],
};
export const TAG_TASTES = {
  gruff: ["mug", "keepsake"], chatty: ["holonovel", "holo"], earnest: ["techmanual", "tech"], dry: ["tea", "tea"], warm: ["holophoto", "family"],
  ambitious: ["cmdtext", "career"], calm: ["seed", "plant"], homesick: ["recipe", "home"], curious: ["mineral", "science"], devout: ["candle", "spiritual"],
  blunt: ["cards", "game"], playful: ["cards", "game"], stoic: ["kaltoh", "game"], musical: ["musicchip", "music"],
};
// Personal Log phase 3 (memo §4): each named crewmate's SECOND like is seeded per save from a pool of 3 (index 0 = the CREW_TASTES entry).
// Alternates never share the dislike category or the first like's category.
export const L2_ALT = {
  tren: [["idic", "vulcan"], ["lyre", "music"]], okafor: [["mug", "keepsake"], ["recipe", "home"]], diallo: [["medcreature", "creature"], ["earthbook", "antique"]],
  hale: [["bloodwine", "drink"], ["warpjournal", "tech"]], orvin: [["holonovel", "story"], ["seed", "plant"]], tull: [["chocolate", "sweets"], ["holonovel", "story"]],
  kovac: [["hyperspanner", "tool"], ["debate", "argument"]], seo: [["tea", "tea"], ["musicchip", "music"]], doru: [["seed", "plant"], ["strings", "music"]],
  rhovan: [["springwine", "drink"], ["musicchip", "music"]], grevv: [["cards", "game"], ["bloodwine", "drink"]], mollo: [["mineral", "science"], ["spice", "cooking"]],
  vardock: [["mineral", "science"], ["kaltoh", "game"]], natarajan: [["holonovel", "story"], ["coffee", "coffee"]], rmira: [["chocolate", "sweets"], ["holonovel", "story"]],
  thelev: [["cards", "game"], ["spice", "cooking"]], delgado: [["coffee", "coffee"], ["seed", "plant"]], sorvan: [["mineral", "science"], ["tea", "tea"]],
};
export function tastesOf(o, l2 = 0) {
  if (!o) return null;
  if (CREW_TASTES[o.id]) { const t = CREW_TASTES[o.id], alt = l2 > 0 && L2_ALT[o.id] && L2_ALT[o.id][l2 - 1]; return alt ? { ...t, like2: { item: alt[0], cat: alt[1] } } : t; }
  // pt07 m10: never love an item in the category they dislike (e.g. a 'warm' Vulcan and the sentimental holophoto): first tag
  // whose item is clear of the dislike, else a neutral fallback
  const s = SPECIES_TASTES[o.species] || SPECIES_TASTES.human, clear = x => x && GIFT[x[0]] && !GIFT[x[0]].cats.includes(s[2]) && x[1] !== s[2];
  const t = (o.tags || []).map(g => TAG_TASTES[g]).find(clear) || [["holonovel", "holo"], ["tea", "tea"], ["mineral", "science"], ["cards", "game"]].find(clear);
  return { like1: { item: s[0], cat: s[1] }, like2: { item: t[0], cat: t[1] }, dislike: s[2], avoid: null };
}
