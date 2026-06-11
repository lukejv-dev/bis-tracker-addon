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
