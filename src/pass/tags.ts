// Player tags in "Adjective Noun": 64 × 64 = 4,096 of them. Night, neon and the kind of animal that
// would hang around an arcade after dark. ASCII only, so every tag is in the font cut.
export const ADJ = [
  "Amber", "Arcane", "Brass", "Bright", "Candid", "Chrome", "Cobalt", "Copper",
  "Cosmic", "Crimson", "Dapper", "Dusky", "Electric", "Ember", "Fizzy", "Gilded",
  "Glossy", "Golden", "Hazy", "Hollow", "Hushed", "Indigo", "Jolly", "Lucky",
  "Lunar", "Magnetic", "Mellow", "Midnight", "Minted", "Misty", "Moonlit", "Neon",
  "Nimble", "Nocturnal", "Opal", "Pixel", "Plucky", "Quartz", "Quiet", "Radiant",
  "Restless", "Rusty", "Scarlet", "Silver", "Sleepy", "Slick", "Sly", "Sonic",
  "Sparky", "Stellar", "Swift", "Tidal", "Turbo", "Twilight", "Velvet", "Vivid",
  "Wandering", "Wild", "Wired", "Witty", "Woolly", "Zany", "Zesty", "Zippy",
];
export const NOUN = [
  "Badger", "Bat", "Beetle", "Bison", "Boar", "Cat", "Cobra", "Comet",
  "Coyote", "Crane", "Cricket", "Crow", "Dingo", "Dragonfly", "Eel", "Falcon",
  "Ferret", "Finch", "Firefly", "Fox", "Gecko", "Goose", "Hare", "Hawk",
  "Hedgehog", "Heron", "Ibis", "Jackal", "Jay", "Koi", "Lemur", "Lynx",
  "Magpie", "Marten", "Mink", "Mole", "Moth", "Newt", "Ocelot", "Orca",
  "Osprey", "Otter", "Owl", "Panther", "Pike", "Puffin", "Quail", "Raccoon",
  "Raven", "Salamander", "Seal", "Shrike", "Sparrow", "Stoat", "Stork", "Tapir",
  "Tern", "Toad", "Viper", "Vole", "Walrus", "Weasel", "Wolf", "Wren",
];

export const randomTag = (rand: () => number) =>
  `${ADJ[Math.floor(rand() * ADJ.length)]} ${NOUN[Math.floor(rand() * NOUN.length)]}`;
