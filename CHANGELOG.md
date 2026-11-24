# Changelog

## Unreleased

- Pinfall and Glide join the row, for twelve machines, and the arcade pass gives every machine one player card with tokens.
- At night the neon's light no longer drops out: the shader had room for 24 lights and twelve machines need 25.
- A forged card cookie can no longer grow the card past what a cookie holds, which left it unable to save.
- A duplicated tab can no longer be paid twice for the same run.
- Clip ranges are streamed out of the file instead of reading the whole clip first.
- After a slow start the hall tries its full resolution again.

## 2.0.0 (24 November 2026)

The site is now The Arcade, at arcade.ashwinsathian.com.

- The home page is a 3D room drawn live in WebGL 2: ten machines in a row, each playing its game, with Day and Night lighting that follows the system theme.
- The camera frames the machine in whatever space the interface leaves, so phones held either way and tablets get a composed view rather than a cropped one.
- Machines show your personal best from each game, the last machine you played glows, and the hall runs an attract mode when left alone.
- Ambient room sound and attract tunes, synthesised, after the first tap.
- games.ashwinsathian.com redirects every path to the new address.
- Links to the games' own repositories are gone; the arcade itself stays open source.

## 1.x (November 2026)

A static catalogue of the games: a tile per game with its clip, a page per game, social cards and `llms.txt`.
