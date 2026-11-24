// games.ashwinsathian.com, the arcade's old address: every path moves, permanently, to the same path on the new one.
export const TO = "https://arcade.ashwinsathian.com";
export default {
  fetch(request) {
    const u = new URL(request.url);
    return Response.redirect(TO + u.pathname + u.search, 301);
  },
};
