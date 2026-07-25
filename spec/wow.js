// Loads BisWatcher.lua into a real Lua VM with the WoW API stubbed out, so
// the parts that are pure logic — import parsing, list matching, the debounce
// — can be tested outside the game.
//
// Two honest limitations:
//   1. fengari is Lua 5.3; WoW 3.3.5a runs 5.1. The addon's logic is string
//      and table work where the two agree, but this is not the same runtime.
//   2. Frames, textures and sound output are stubs. They record that a call
//      happened, not that anything appeared or was audible. The popup and the
//      notification sound still need a manual check in a real client.
//
// What this does catch, and what motivated it: BISWATCH1 strings must keep
// parsing after the v2 bump, or everyone's saved lists break silently.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { lua, lauxlib, lualib, to_luastring, to_jsstring } from 'fengari';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ADDON_FILE = path.resolve(HERE, '../BisWatcher/BisWatcher.lua');

/** Minimal stand-ins for the globals the addon touches at load time. */
const STUB_PRELUDE = `
_G.__calls = { sound = {}, slash = {}, chat = {}, frames = {} }

local function recorder(bucket)
  return function(...) table.insert(_G.__calls[bucket], { ... }) end
end

PlaySound = function(...)
  table.insert(_G.__calls.sound, { ... })
end
PlaySoundFile = function(...)
  table.insert(_G.__calls.sound, { ... })
end

local frameMeta = {}
frameMeta.__index = function(tbl, key)
  local existing = rawget(tbl, key)
  if existing ~= nil then return existing end
  -- WoW API methods are PascalCase; the addon's own fields on a frame are
  -- not. Only stub the former, or an unset field such as popup.timer comes
  -- back as a function and indexing it blows up.
  if type(key) == 'string' and key:match('^%u') then
    return function(self, ...) return self end
  end
  return nil
end

local function newFrame(kind, name)
  local f = setmetatable({ __kind = kind, __name = name, __shown = false }, frameMeta)
  f.Show = function(self) self.__shown = true; return self end
  f.Hide = function(self) self.__shown = false; return self end
  f.IsShown = function(self) return self.__shown end
  f.SetScript = function(self, event, fn) self['__on' .. event] = fn; return self end
  f.GetScript = function(self, event) return self['__on' .. event] end
  f.RegisterEvent = function(self, e) self['__evt_' .. e] = true; return self end
  f.SetText = function(self, t) self.__text = t; return self end
  f.GetText = function(self) return self.__text or '' end
  f.Enable = function(self) self.__enabled = true; return self end
  f.Disable = function(self) self.__enabled = false; return self end
  f.SetChecked = function(self, v) self.__checked = v; return self end
  f.GetChecked = function(self) return self.__checked end
  table.insert(_G.__calls.frames, f)
  return f
end

CreateFrame = function(kind, name, parent, template) return newFrame(kind, name) end
UIParent = newFrame('Frame', 'UIParent')

GetTime = function() return _G.__now or 0 end
GetItemInfo = function(id) return 'Item ' .. tostring(id), '|cff0070dd|Hitem:' .. tostring(id) .. '|h[Item]|h|r' end
IsAddOnLoaded = function() return false end

SlashCmdList = {}
DEFAULT_CHAT_FRAME = { AddMessage = function(self, msg) table.insert(_G.__calls.chat, msg) end }
ChatEdit_SendText = function(edit, ...) table.insert(_G.__calls.slash, edit and edit.__text or '') end
ChatFrame1EditBox = newFrame('EditBox', 'ChatFrame1EditBox')

C_Timer = {
  NewTimer = function(delay, fn) return { Cancel = function() end, __delay = delay, __fn = fn } end,
  After = function(delay, fn) end,
}

BackdropTemplateMixin = {}
`;

/**
 * Boot a fresh VM with the addon loaded.
 * Returns helpers for poking at it from JS.
 */
export function loadAddon() {
  const L = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(L);

  const run = (chunk, name) => {
    if (lauxlib.luaL_loadbuffer(L, to_luastring(chunk), null, to_luastring(name)) !== lua.LUA_OK) {
      throw new Error(`load ${name}: ${to_jsstring(lua.lua_tostring(L, -1))}`);
    }
    if (lua.lua_pcall(L, 0, lua.LUA_MULTRET, 0) !== lua.LUA_OK) {
      throw new Error(`run ${name}: ${to_jsstring(lua.lua_tostring(L, -1))}`);
    }
  };

  run(STUB_PRELUDE, 'stubs');

  // WoW passes the addon name and a private table as varargs to each file.
  const source = readFileSync(ADDON_FILE, 'utf8');
  run(`local ADDON_ARGS = { 'BisWatcher', {} }\n${source}`, 'BisWatcher.lua');

  return {
    /** Evaluate a Lua expression and return the result as a JS value. */
    eval(expression) {
      run(`__result = (function() ${expression} end)()`, 'eval');
      lua.lua_getglobal(L, to_luastring('__result'));
      const value = toJs(L, -1);
      lua.lua_pop(L, 1);
      return value;
    },
    /** Run statements for their side effects. */
    exec(statements) {
      run(statements, 'exec');
    },
  };
}

function toJs(L, index) {
  const type = lua.lua_type(L, index);
  if (type === lua.LUA_TNIL || type === lua.LUA_TNONE) return null;
  if (type === lua.LUA_TBOOLEAN) return lua.lua_toboolean(L, index);
  if (type === lua.LUA_TNUMBER) return lua.lua_tonumber(L, index);
  if (type === lua.LUA_TSTRING) return to_jsstring(lua.lua_tostring(L, index));
  if (type === lua.LUA_TTABLE) return tableToJs(L, index);
  return `<${to_jsstring(lauxlib.luaL_typename(L, index))}>`;
}

function tableToJs(L, index) {
  const absolute = index < 0 ? lua.lua_gettop(L) + index + 1 : index;
  const out = {};
  lua.lua_pushnil(L);
  while (lua.lua_next(L, absolute) !== 0) {
    const key = toJs(L, -2);
    out[String(key)] = toJs(L, -1);
    lua.lua_pop(L, 1);
  }
  const keys = Object.keys(out);
  // Present a Lua array as a JS array — 1..n integer keys and nothing else.
  const isArray = keys.length > 0 && keys.every((k, i) => Number(k) === i + 1);
  return isArray ? keys.map((k) => out[k]) : out;
}
