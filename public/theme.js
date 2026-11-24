// Runs before first paint so the page never flashes the wrong lights. Day and Night follow the system unless chosen.
(function () {
  var pick = null;
  try { pick = localStorage.getItem("games:lights"); } catch (e) {}
  var root = document.documentElement;
  var night = pick === "night" || (pick !== "day" && matchMedia("(prefers-color-scheme: dark)").matches);
  root.dataset.lights = pick === "day" || pick === "night" ? pick : "auto";
  root.dataset.theme = night ? "night" : "day";
})();
