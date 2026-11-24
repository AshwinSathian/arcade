// A machine in miniature: counts the keys it hears and starts a run the way every game does.
let keys = 0;
addEventListener("keydown", () => { document.getElementById("keys").textContent = String(++keys); });
window.startRun = (mode) => dispatchEvent(new CustomEvent("arcade:start", { cancelable: true, detail: { mode } }));
window.endRun = (detail) => dispatchEvent(new CustomEvent("arcade:end", { detail }));
