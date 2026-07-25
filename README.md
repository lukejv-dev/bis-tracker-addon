# BisWatcher

WoW 3.3.5a (Wrath Classic) addon that watches chat for linked items on your imported BiS list and pops a Roll MS / Roll OS / Pass prompt.

Companion to the BiS planner at [my-bis.mnty.us](https://my-bis.mnty.us). Pick your class/spec/phase there, click **Copy as MS** (or OS), paste the resulting `/biswatch import …` string into WoW chat, and the addon takes over.

## Install

1. Download the latest release zip from the [Releases page](https://github.com/lukejv-dev/bis-tracker-addon/releases) (or `Code → Download ZIP` on the repo root for bleeding-edge).
2. Unzip into `World of Warcraft/_classic_era_/Interface/AddOns/` (or `_classic_/`, or `_retail_/` — wherever your 3.3.5a client lives).
3. The folder layout should be `Interface/AddOns/BisWatcher/BisWatcher.lua` (single nested directory, not a double-wrap).
4. Restart the WoW client. Enable the addon at the character select screen if needed.

## Slash commands

| Command | What it does |
|---|---|
| `/biswatch` | Open the in-game config GUI. |
| `/biswatch import ms <string>` | Import your Main Spec watchlist from the site. |
| `/biswatch import os <string>` | Import an Off Spec watchlist. Supports multiple OS lists. |
| `/biswatch list` | Print currently-loaded MS / OS items. |
| `/biswatch clear` | Wipe stored watchlists. |

## How it works

- Scans `CHAT_MSG_LOOT`, `CHAT_MSG_SAY`, `CHAT_MSG_PARTY`, `CHAT_MSG_RAID`, `CHAT_MSG_RAID_LEADER` for `[Item Link]` matches against your imported lists.
- On a hit, pops a small frame with **Roll MS** / **Roll OS** / **Pass** buttons. MS issues `/roll`, OS issues `/roll 1-50`, Pass does nothing.
- SR-flagged items show the SR badge so you don't roll on something you've already secured.
- All state lives in `BisWatcherDB` saved variables. No external network calls. No data leaves the client.

## Compatibility

- Built for `Interface: 30403` (Wrath 3.3.5a, ChromieCraft target).
- May work on retail Wrath Classic with a Toc bump to the current interface number, but untested. Pull requests welcome.

## License

MIT — see [LICENSE](LICENSE).

## Import format

The web tool emits `BISWATCH2`:

```
BISWATCH2~<source>~<class>~<spec>~<phase>~<raid>~<item>;<item>;...
item := <id>|<rank>|<slot>[|sr]
```

`<raid>` is the raid the list was scoped to, or `all` for a whole phase. It's
what lets the roll prompt tell you *which* list just fired — useful when you're
running several specs.

**`BISWATCH1` strings still import.** Anything you saved before upgrading keeps
working; v1 lists simply report their raid as `all`.

## Notification sound

A sound plays when the roll prompt appears — on by default, since the point is
catching a link you'd otherwise miss while looking at your bags. One prompt
gives one sound even if the item is on several of your lists.

```
/biswatch sound              -- show current state
/biswatch sound off          -- silence it
/biswatch sound on
/biswatch sound test         -- hear the current one
/biswatch sound RaidWarning  -- pick another and hear it
```

There's also a checkbox and a Test button in `/biswatch config`.

## Pasting a list

```
/biswatch paste
```

Opens the config window with the paste box focused, which is the thing you
actually want at a raid invite. Pasting the whole `/biswatch import ms ...`
command works too — the leading command is stripped either way.

## Tests

The pure logic — import parsing, list matching, the debounce — runs outside the
game in a real Lua VM:

```
npm install
npm test
```

Two honest limits. [fengari](https://fengari.io) is Lua 5.3 while WoW 3.3.5a is
5.1; the tested code is string and table work where the two agree, but it is not
the same runtime. And frames and sound are stubs that record calls rather than
render or play anything — **the popup and the sound still need a look in a real
client.** What the suite does catch is the thing worth catching: that a
`BISWATCH1` list saved before the upgrade still parses.
