import type { ImageMetadata } from "astro";
import cloverPoster from "../assets/posters/clover.png";
import coilPoster from "../assets/posters/coil.png";
import lightkeeperPoster from "../assets/posters/lightkeeper.png";
import minefieldPoster from "../assets/posters/minefield.png";
import nonetPoster from "../assets/posters/nonet.png";
import noughtsPoster from "../assets/posters/noughts.png";
import rallyPoster from "../assets/posters/rally.png";
import spillwayPoster from "../assets/posters/spillway.png";
import swishPoster from "../assets/posters/swish.png";
import typesterPoster from "../assets/posters/typester.png";
import cloverDesktop from "../assets/shots/clover-desktop.jpg";
import cloverPhone from "../assets/shots/clover-phone.jpg";
import coilDesktop from "../assets/shots/coil-desktop.png";
import coilPhone from "../assets/shots/coil-phone.png";
import lightkeeperDesktop from "../assets/shots/lightkeeper-desktop.jpg";
import lightkeeperPhone from "../assets/shots/lightkeeper-phone.jpg";
import minefieldDesktop from "../assets/shots/minefield-desktop.png";
import minefieldPhone from "../assets/shots/minefield-phone.png";
import nonetDesktop from "../assets/shots/nonet-desktop.jpg";
import nonetPhone from "../assets/shots/nonet-phone.jpg";
import noughtsDesktop from "../assets/shots/noughts-desktop.jpg";
import noughtsPhone from "../assets/shots/noughts-phone.jpg";
import rallyDesktop from "../assets/shots/rally-desktop.png";
import rallyPhone from "../assets/shots/rally-phone.png";
import spillwayDesktop from "../assets/shots/spillway-desktop.jpg";
import spillwayPhone from "../assets/shots/spillway-phone.jpg";
import swishDesktop from "../assets/shots/swish-desktop.jpg";
import swishPhone from "../assets/shots/swish-phone.jpg";
import typesterDesktop from "../assets/shots/typester-desktop.png";
import typesterPhone from "../assets/shots/typester-phone.png";

export type Shot = { src: ImageMetadata; alt: string };
export type Game = {
  slug: string;
  name: string;
  /** What it is, in the words people search with. */
  kind: string;
  /** The kind as it reads mid-sentence, for page titles. */
  noun: string;
  /** schema.org genre values. */
  genre: string[];
  /** One sentence: what you do in it. */
  line: string;
  about: string[];
  modes: string[];
  controls: string;
  /** Compressed size of the whole game page in KB, measured from the live site on 2026-11-20; null when it is an app bundle. */
  kb: number | null;
  sizeNote: string;
  stack: string;
  highlights: { title: string; detail: string }[];
  url: string;
  post?: { title: string; url: string };
  /** The game's own colours: the tile ground and its one bright. */
  ground: string;
  bright: string;
  poster: ImageMetadata;
  clipAlt: string;
  desktop: Shot;
  phone: Shot;
};

const writing = (slug: string) => `https://ashwinsathian.com/writing/${slug}`;

export const games: Game[] = [
  {
    slug: "clover",
    name: "Clover",
    kind: "Maze chase",
    noun: "3D maze game",
    genre: ["Arcade", "Maze"],
    line: "A top-down 3D maze game: cut the long grass in a hedge maze with a robot mower while four geese try to catch it.",
    about: [
      "Clover is a maze game seen from above. You steer a robot mower through a hedge maze and cut every patch of long grass to finish the lawn. Four geese live in the pond in the middle, and one that reaches your mower ends it. Each breed hunts its own way: one comes straight at you, one heads for the junction in front of you, one walks your trail and one grazes until you come close. Drive over a four-leaf clover and they panic for a few seconds, and any goose you drive into then flies back to the pond. Day and Night follow your device's light or dark setting; at night the lanterns and the mower's headlights light the maze.",
      "Garden is lawn after lawn with three mowers, each one a new maze and a little faster. Daily is one maze for the day, the same for everyone, and the result can be sent as a link: whoever opens it races a ghost of your mower. Calm has no geese at all.",
    ],
    modes: ["Garden", "Daily", "Calm", "Ghost race"],
    controls: "Swipe, arrow keys, WASD or a gamepad",
    kb: 35,
    sizeNote: "One HTML file of about 35 KB compressed, plus a 36 KB font, with no image, model or audio files",
    stack: "TypeScript, WebGL 2, Web Audio, Cloudflare Workers",
    highlights: [
      { title: "A new maze from a seed", detail: "Every lawn is generated, and the tests check 10,000 seeds for symmetry, connectivity and no dead ends." },
      { title: "A whole run in a link", detail: "The game runs on whole numbers at 120 ticks a second, so a Daily run is its list of turns. The receiver's browser replays it for the score and races it as a ghost." },
      { title: "Geese that read the maze", detail: "Each goose turns by real path distance to its own target: you, the junction ahead of you, your trail or the nearest long grass." },
      { title: "Grass with no instance buffer", detail: "Thousands of blades are one instanced draw, shaped in the vertex shader from the instance number and a 19 by 21 state texture." },
    ],
    url: "https://clover.ashwinsathian.com",
    ground: "#14201a",
    bright: "#8fdc72",
    poster: cloverPoster,
    clipAlt: "A game of Clover that turns from night to day and back: a yellow robot mower cuts long grass in a hedge maze seen from above while geese walk the paths and the lanterns go off and on.",
    desktop: { src: cloverDesktop, alt: "Clover on a laptop by day: a hedge maze from above with cut lawn, patches of long grass, a pond in the middle and the score card on the left." },
    phone: { src: cloverPhone, alt: "Clover on a phone at night: the maze lit by lanterns and the mower's headlights, with the score along the top." },
  },
  {
    slug: "coil",
    name: "Coil",
    kind: "Snake",
    noun: "snake game",
    genre: ["Arcade", "Snake"],
    line: "Snake on a 3D board seen from above, with five modes, shareable replays and a daily board the server scores itself.",
    about: [
      "Coil is snake for phone, tablet and desktop, played on a 3D board seen from directly above. Classic speeds up as you grow, Gates is a run of generated rooms whose edges open onto the far side, Daily is one room a day that is the same for everyone, Blitz gives you sixty seconds on a board that wraps, and Zen never ends.",
      "Every run is stored as its seed and the moments it turned, so a whole game fits in a link. The Daily leaderboard never takes a score from the browser: it replays each submitted run on the server and keeps the score that replay reaches.",
      "There are two worlds, Retro glazed tile and a polished Modern floor, each with a day and a night. Coil follows your system theme until you pick one, and switching worlds turns over the whole screen.",
    ],
    modes: ["Classic", "Gates", "Daily", "Blitz", "Zen"],
    controls: "Swipe, arrow keys or a gamepad",
    kb: 41,
    sizeNote: "One HTML file of about 41 KB compressed, plus a 28 KB font",
    stack: "TypeScript, WebGL 2, Web Audio, Cloudflare Workers and D1",
    highlights: [
      { title: "The server scores the run", detail: "A Daily submission carries a replay, never a score. A Worker plays the run to its end with the same simulation and stores what it scored." },
      { title: "Replays in a link", detail: "Seed plus turns, packed as varints in base64url: a 55-segment Classic game fits in 192 characters." },
      { title: "Walls and gates, cell by cell", detail: "Any stretch of an edge can be a wall or a gate to the opposite side, and a flood fill keeps every room solvable." },
      { title: "Two worlds, day and night", detail: "Retro glazed tile or a polished Modern floor, in real-time 3D. Day and night follow your system until you choose." },
    ],
    url: "https://coil.ashwinsathian.com",
    post: { title: "Coil’s leaderboard never asks the browser for a score", url: writing("coils-leaderboard-never-asks-the-browser-for-a-score") },
    ground: "#1c1915",
    bright: "#ffc23a",
    poster: coilPoster,
    clipAlt: "Coil replaying a Gates run from above: a block snake crosses a tiled night board between stone walls, then the screen ripples into the polished Modern world and turns back tile by tile.",
    desktop: { src: coilDesktop, alt: "Coil on a desktop at night: a block snake on a 3D tiled board with brass walls and lit gates, and the score and replay controls on the right." },
    phone: { src: coilPhone, alt: "Coil on a phone by day: a golden snake on a pale 3D floor between white walls, with replay controls below." },
  },
  {
    slug: "lightkeeper",
    name: "Lightkeeper",
    kind: "Pinball",
    noun: "pinball table",
    genre: ["Arcade", "Pinball"],
    line: "A pinball table of a lighthouse on a night sea, with multiball, timed watches and replays.",
    about: [
      "Lightkeeper is a full pinball table: three pop bumpers, slingshots, a spinner orbit, a ramp, drop targets and a lamp room that locks three balls for multiball. Three timed watches, Fog, Squall and Rescue, lead to Long Night, where every shot scores 50,000.",
      "The physics runs at a fixed 480 steps a second and is deterministic, so every game can be watched again at 1×, 2× or 4× or shared as a link. All the art is painted with WebGL 2 when the page opens; there are no image files.",
    ],
    modes: ["3 balls", "3 minutes", "Practice"],
    controls: "Touch the left or right half, Z and / on a keyboard, or a gamepad",
    kb: 35,
    sizeNote: "One HTML file of about 35 KB compressed, with no image files",
    stack: "TypeScript, WebGL 2, Web Audio, Cloudflare Workers",
    highlights: [
      { title: "Deterministic at 480 Hz", detail: "The same inputs always give the same game, which is what makes replay links possible." },
      { title: "Art painted at boot", detail: "The table, the lighthouse and the dot-matrix display are drawn in code when the page loads." },
      { title: "A full rule set", detail: "Skill shot, bonus multipliers, kickback, ball save, combos, nudging and tilt." },
      { title: "Built for every screen", detail: "Phones get the whole table; wide screens get a tilted cabinet view with the score beside it." },
    ],
    url: "https://lightkeeper.ashwinsathian.com",
    post: { title: "A pinball replay is a promise about the last bit of every float", url: writing("a-pinball-replay-is-a-promise-about-the-last-bit-of-every-float") },
    ground: "#070d18",
    bright: "#f7b23b",
    poster: lightkeeperPoster,
    clipAlt: "Lightkeeper's attract loop: the ball rattles between red pop bumpers while the lighthouse beam sweeps the table.",
    desktop: { src: lightkeeperDesktop, alt: "Lightkeeper on a desktop: an amber dot-matrix score of 21,250 on the left and the lighthouse table on the right." },
    phone: { src: lightkeeperPhone, alt: "Lightkeeper on a phone, the whole table in view." },
  },
  {
    slug: "minefield",
    name: "Minefield",
    kind: "Minesweeper",
    noun: "Minesweeper game",
    genre: ["Puzzle", "Minesweeper", "Logic"],
    line: "Minesweeper where every board can be cleared by logic, with hints that show the proof.",
    about: [
      "Minefield is Minesweeper for phone, tablet and desktop: Beginner, Intermediate, Expert, custom boards up to 60 by 40, and a Daily board that is the same for everyone.",
      "With No guessing on, a board is dealt only after an exact solver has cleared it from your first click. The same solver gives hints that ring the numbers behind a move, shows every hidden cell's exact chance of a mine, and tells you after a loss whether a safe move was open.",
    ],
    modes: ["Beginner", "Intermediate", "Expert", "Custom", "Daily"],
    controls: "Tap, click or the keyboard",
    kb: 21,
    sizeNote: "One HTML file of about 21 KB compressed, with no fonts or images",
    stack: "TypeScript, Web Workers, CSS Grid, Web Audio, Cloudflare Workers",
    highlights: [
      { title: "No-guess boards", detail: "Only 15.8% of random Expert deals can be solved without a guess; the solver finds one in 2.5 ms on the median." },
      { title: "Hints with their reasons", detail: "A hint outlines a safe cell or a mine and rings the numbers that prove it." },
      { title: "Exact odds", detail: "The odds view shades every hidden cell by its true chance of a mine, counted over every arrangement." },
      { title: "Loss review", detail: "After a mine, it says whether a safe move was open, or that the guess was forced and what the odds were." },
    ],
    url: "https://minefield.ashwinsathian.com",
    post: { title: "A no-guess Minesweeper board is only as honest as its solver", url: writing("a-no-guess-minesweeper-board-is-only-as-honest-as-its-solver") },
    ground: "#121417",
    bright: "#e8743f",
    poster: minefieldPoster,
    clipAlt: "Minefield clearing an Intermediate board by following its own hints: safe cells open and mines are flagged one by one.",
    desktop: { src: minefieldDesktop, alt: "Minefield on a desktop: an Expert board with the odds view on, cells shaded by their chance of a mine." },
    phone: { src: minefieldPhone, alt: "Minefield on a phone with a hint outlining a safe cell." },
  },
  {
    slug: "nonet",
    name: "Nonet",
    kind: "Sudoku",
    noun: "sudoku",
    genre: ["Puzzle", "Sudoku", "Logic"],
    line: "Sudoku graded by the techniques you need, with hints that teach and a mode that adapts to you.",
    about: [
      "Nonet is sudoku for phone, tablet and desktop with five levels from Easy to Master, a Daily puzzle and an adaptive mode. It plays offline and saves after every move.",
      "Every puzzle is graded by a solver that only uses the techniques a person uses, 24 of them from hidden singles to alternating chains. The hardest step sets the level and the hint is the next step from your own notes. In the adaptive mode your rating moves after each game, and the next puzzle is set to match.",
    ],
    modes: ["Easy", "Medium", "Hard", "Expert", "Master", "Daily", "Adaptive"],
    controls: "Tap, click or the keyboard",
    kb: 24,
    sizeNote: "One HTML file of about 24 KB compressed, plus a 23 KB font",
    stack: "TypeScript, Web Workers, CSS Grid, Cloudflare Workers",
    highlights: [
      { title: "Graded like a person solves", detail: "Levels come from the hardest of 24 human techniques a puzzle needs, not from how long a computer takes." },
      { title: "Hints that explain", detail: "A hint names the technique, then shows the cells and the digits it removes, then applies it as one move you can undo." },
      { title: "An adaptive rating", detail: "An Elo update that scores time against par, mistakes and hints sets the next puzzle." },
      { title: "A Daily with no server", detail: "The Daily is generated on your device from the date, so it is the same everywhere and works offline." },
    ],
    url: "https://nonet.ashwinsathian.com",
    post: { title: "A computer can’t tell you how hard a sudoku is", url: writing("a-computer-cant-tell-you-how-hard-a-sudoku-is") },
    ground: "#18202b",
    bright: "#8fb0ff",
    poster: nonetPoster,
    clipAlt: "Nonet in its dark theme: digits are filled in across a Medium puzzle, box by box.",
    desktop: { src: nonetDesktop, alt: "Nonet on a desktop: a Hard puzzle with pencil notes beside a 3 by 3 keypad." },
    phone: { src: nonetPhone, alt: "Nonet on a phone, a puzzle finished." },
  },
  {
    slug: "noughts",
    name: "Noughts",
    kind: "Noughts and crosses",
    noun: "noughts and crosses game",
    genre: ["Board game", "Tic-tac-toe", "Strategy"],
    line: "Noughts and crosses in three versions, against a bot that has every position worked out or a friend over a link.",
    about: [
      "Noughts is noughts and crosses for phone, tablet and desktop. Classic is the 3×3 game. In Fading each side keeps three marks and placing a fourth wipes out your oldest, so the grid never fills. Ultimate is nine grids in one, where the square you take decides which grid your opponent plays in next. Play the bot at three strengths, someone on the same screen, or anyone you send a link to.",
      "Classic and Fading are solved when you open them: 5,478 positions in one and 128,170 in the other. That is how the bot plays them perfectly, how “Show odds” labels each empty square with what it leads to, and how the review grades every move after a game. Solving Fading also shows that X wins it by force, but only by opening on an edge square.",
    ],
    modes: ["Classic", "Fading", "Ultimate", "Online"],
    controls: "Tap, click or the keyboard",
    kb: 22,
    sizeNote: "One HTML file of about 22 KB compressed, plus a 38 KB font",
    stack: "TypeScript, SVG, Web Workers, Web Audio, Cloudflare Workers and Durable Objects",
    highlights: [
      { title: "Solved when it opens", detail: "Classic by negamax over 5,478 positions in about 1.5 ms. Fading has positions that repeat, so it is solved backwards from every finished position." },
      { title: "Every move graded", detail: "After a Classic or Fading game the review marks each mistake, names the one that decided the game and shows the better squares." },
      { title: "Ultimate by tree search", detail: "Monte Carlo tree search on bitboards in a Web Worker, up to 40,000 playouts a move." },
      { title: "Online rooms", detail: "Each room is a Durable Object that checks every move with the same rules file the browser plays by. Reload or lose signal and your seat waits for you." },
    ],
    url: "https://noughts.ashwinsathian.com",
    ground: "#1b2420",
    bright: "#ff8a7b",
    poster: noughtsPoster,
    clipAlt: "Noughts playing Fading on its blackboard theme: crosses and noughts are drawn in, the oldest cross turns pale and is wiped, and three crosses along the bottom are struck through.",
    desktop: { src: noughtsDesktop, alt: "Noughts on a desktop reviewing a Classic game against the bot: move 5 is marked as the mistake that decided it, with the better square dashed." },
    phone: { src: noughtsPhone, alt: "Noughts on a phone, an Ultimate game with the grid you must play in outlined." },
  },
  {
    slug: "rally",
    name: "Rally",
    kind: "Table tennis",
    noun: "table tennis game",
    genre: ["Sports", "Table tennis"],
    line: "Table tennis to eleven against an opponent that reads the ball like a person, or keep-ups on your own.",
    about: [
      "Rally is table tennis you play with one finger or a mouse. In Match you play first to eleven against a computer opponent at Casual, Club or Pro. In Solo you hold the bat flat and bounce the ball on it for as long as you can, with clean hits in a row raising the multiplier.",
      "Where the ball meets your paddle decides where it lands, pushing forward adds pace and moving sideways adds spin. The opponent predicts the ball with the same physics you play against, then reacts late and misreads it a little, the way a person would.",
    ],
    modes: ["Match: Casual", "Match: Club", "Match: Pro", "Solo keep-ups"],
    controls: "Drag, move the mouse, or the arrow keys",
    kb: 20,
    sizeNote: "One HTML file of about 20 KB compressed, with no fonts, images or audio files",
    stack: "TypeScript, Canvas 2D, Web Audio, Cloudflare Workers",
    highlights: [
      { title: "Exact at any speed", detail: "Collision is solved as a sweep of the ball against the paddle's capsule, so a fast ball can never pass through it." },
      { title: "An opponent with reflexes", detail: "It reacts late, misjudges the ball a little and has limits on speed and acceleration." },
      { title: "Aim by contact point", detail: "Centred hits are safe; the corners take a hit near the tip." },
      { title: "Slow-motion finish", detail: "The last two seconds of a game play back in slow motion before the result." },
    ],
    url: "https://rally.ashwinsathian.com",
    ground: "#0b1220",
    bright: "#ff8d3a",
    poster: rallyPoster,
    clipAlt: "Rally: an orange ball crossing a blue table between your red paddle and the opponent's.",
    desktop: { src: rallyDesktop, alt: "Rally on a desktop: the Match and Solo menu beside a blue table with a rally in progress." },
    phone: { src: rallyPhone, alt: "A Rally match on a phone, seen from behind your paddle." },
  },
  {
    slug: "spillway",
    name: "Spillway",
    kind: "Endless runner",
    noun: "3D endless runner",
    genre: ["Arcade", "Endless runner"],
    line: "A 3D endless runner: ride a front door on a hydrofoil through a flooded town and deliver the post.",
    about: [
      "Spillway is a 3D endless runner played from behind the rider, a courier called Tavi who surfs a salvaged front door through a town under monsoon water. Jump timber booms, tuck under washing lines and footbridges, and dodge pilings, barges and ferries across three channels. The town has a Day and a Night that follow your device's light or dark setting, each with four weathers of its own, and switching mid-run sends the street lights on or off in a wave.",
      "Letters fill your bag, and riding through a red post buoy hands them in and raises your multiplier. Late dodges charge Surge, which smashes through anything for about three seconds. Open Water is a new course every run, Daily Route is one course a day for everyone, Slack Water is the gentler speed, and any finished run can be sent as a ghost for someone else to race.",
    ],
    modes: ["Open Water", "Daily Route", "Slack Water", "Ghost"],
    controls: "Swipe, arrow keys or a gamepad",
    kb: 51,
    sizeNote: "One HTML file of about 51 KB compressed, plus a 34 KB font, with no image, model or audio files",
    stack: "TypeScript, WebGL 2, Web Audio, Cloudflare Workers",
    highlights: [
      { title: "Courses checked before you see them", detail: "A search over every channel and jump or tuck timing must find a route from all three channels, or the section is thrown away." },
      { title: "Ghosts in a link", detail: "A run is its seed and inputs, replayed by a deterministic 120 Hz simulation, so anyone with the link can race it." },
      { title: "Nothing to download", detail: "Every model, texture and sound is generated in the browser when the page opens." },
      { title: "Water on a phone budget", detail: "Reflections and bloom fit in ordinary 8-bit render targets, and resolution and effects step down if frames run long." },
    ],
    url: "https://spillway.ashwinsathian.com",
    ground: "#10222c",
    bright: "#ff6f52",
    poster: spillwayPoster,
    clipAlt: "A Spillway run that turns from night to day and back: a courier in a red raincoat rides a blue door down a flooded street as the sky changes and the street lights go off and on in a wave.",
    desktop: { src: spillwayDesktop, alt: "Spillway on a desktop at night: lit windows reflected in the flooded street, with the score at the top left." },
    phone: { src: spillwayPhone, alt: "Spillway on a phone in the rain: the rider on a blue door, seen from behind, on a flooded street." },
  },
  {
    slug: "swish",
    name: "Swish",
    kind: "Free throws",
    noun: "3D free throw game",
    genre: ["Sports", "Arcade"],
    line: "A 3D free throw game: pull the ball back on a slingshot rig, read the dotted arc and shoot on a rooftop court.",
    about: [
      "Swish is a free throw game played side-on, on a rooftop court above a city. The ball sits in a slingshot rig at the free throw line. Drag back to set the angle and speed, read the dotted arc and let go. A swish scores 3, a shot off the glass 2 and one off the rim 1, and makes in a row multiply your points. The court has a Day and a Night that follow your device's light or dark setting, and switching runs the sun down and strikes the floodlights one at a time.",
      "Free Throws is ten shots from the line. Step Back moves you back after every make and ends on your first miss. Shot Clock gives you 24 seconds and adds time for makes, and a shot in the air at the buzzer still counts. Daily is ten spots with wind, the same for everyone that day. A finished round can be sent as a link, and whoever opens it shoots with your shots flying beside theirs as ghost balls.",
    ],
    modes: ["Free Throws", "Step Back", "Shot Clock", "Daily", "Challenge"],
    controls: "Mouse, touch, or arrow keys and Space",
    kb: 37,
    sizeNote: "One HTML file of about 37 KB compressed, plus a 21 KB font, with no image, model or audio files",
    stack: "TypeScript, WebGL 2, Web Audio, Cloudflare Workers",
    highlights: [
      { title: "Physics with no timestep", detail: "A flight is a chain of exact parabolas, and each contact time is the root of a polynomial, so frame rate can't change a shot." },
      { title: "A map of every free throw", detail: "The record screen solves 24,000 combinations of angle and speed on your device and plots your own shots on top." },
      { title: "Challenges in a link", detail: "A shot is two integers, so a link can carry a whole round. The receiver's browser replays it to work out the score." },
      { title: "A ball with no mesh", detail: "The ball is ray-traced in a fragment shader, and the net is a small cloth simulation that the ball pushes through." },
    ],
    url: "https://swish.ashwinsathian.com",
    ground: "#0e171f",
    bright: "#37c5b4",
    poster: swishPoster,
    clipAlt: "A round of Swish that turns from night to day and back: a basketball flies from a slingshot rig to the hoop on a teal rooftop court as the sky changes and the floodlights go off and on.",
    desktop: { src: swishDesktop, alt: "Swish on a desktop at night: a ball in flight towards the hoop, with the lit city behind the rooftop court." },
    phone: { src: swishPhone, alt: "Swish on a phone in daylight: a ball in flight above a teal court, with the hoop at the right." },
  },
  {
    slug: "typester",
    name: "Typester",
    kind: "Typing game",
    noun: "typing game",
    genre: ["Typing", "Word", "Arcade"],
    line: "A typing game where every word buys time, each letter is a keycap and your best run races you as a ghost.",
    about: [
      "Typester shows each word as a row of keycaps. A correct letter presses its key down and plays the next note of a tune; a wrong one never enters the word, so there is no backspace and no Enter. In Rush you start with 15 seconds and every word buys more, but words get longer and each level pays 12% less, so every run ends. Sprint gives you sixty seconds, the Daily is a Rush with the same words for everyone, and Drill builds words from the letters you miss most.",
      "Clean keystrokes in a row raise a multiplier from ×1 to ×5, and one miss drops it back. While you type, a counter shows how many words ahead of or behind your best run you are at that second; the results put both runs on one chart beside a keyboard tinted by where you slipped.",
    ],
    modes: ["Rush", "Sprint", "Daily", "Drill"],
    controls: "A keyboard, or the on-screen one on a phone",
    kb: null,
    sizeNote: "A prerendered Angular app: about 86 KB of compressed script on first load and a 106 KB font. Installs and plays offline",
    stack: "Angular 22 (zoneless, signals), Web Audio, Canvas 2D, Cloudflare Workers",
    highlights: [
      { title: "No Enter, no backspace", detail: "Every keystroke is the next letter or a miss. The last letter finishes the word, and a miss costs your combo and, in Rush, 0.4 seconds." },
      { title: "Your best run as a ghost", detail: "Each best stores when every word was finished, so a live run can show how far ahead or behind it you are at any moment." },
      { title: "Drill learns your weak keys", detail: "Every hit and miss is counted per letter. Drill ranks about 3,100 bundled words by how many of your worst letters they hold." },
      { title: "Typing plays a tune", detail: "Each correct letter is the next note of a pentatonic scale, synthesized with Web Audio, an octave up from ×3." },
    ],
    url: "https://typester.ashwinsathian.com",
    ground: "#15162a",
    bright: "#a59bff",
    poster: typesterPoster,
    clipAlt: "A Typester Rush: each word appears as a row of keycaps that press down and turn violet letter by letter, keycap confetti bursts as words finish, and the time bank refills.",
    desktop: { src: typesterDesktop, alt: "Typester on a desktop, mid-Rush: the word annual as keycaps with two pressed, the next words below, the score and a gold ×2 multiplier." },
    phone: { src: typesterPhone, alt: "Typester on a phone, mid-Rush, the word and the score stacked at the top of the screen." },
  },
];

export const bySlug = (slug: string) => games.find((g) => g.slug === slug)!;
export const site = {
  url: "https://arcade.ashwinsathian.com",
  name: "The Arcade by Ashwin Sathian",
  author: "Ashwin Sathian",
  authorUrl: "https://ashwinsathian.com",
  github: "https://github.com/AshwinSathian",
  repo: "https://github.com/AshwinSathian/arcade",
};
