import { describe, it, expect, beforeEach } from 'vitest';
import { loadAddon } from './wow.js';

let vm;

beforeEach(() => {
  vm = loadAddon();
  vm.exec(`
    ensureDB_forTests()
    BisWatcherDB.ms = BisWatcher._test.parseImport(
      'BISWATCH2~wowhead~mage~frost~1~naxx-25~40255|top|Trinkets;40260|top|Waist')
    BisWatcherDB.os = {}
    _G.__now = 0
  `);
});

const soundCount = () => vm.eval('return #_G.__calls.sound');
const seeItem = (id) => vm.exec(`BisWatcher._test.onItemLinkSeen(${id})`);
const advance = (seconds) => vm.exec(`_G.__now = _G.__now + ${seconds}`);

describe('notification sound', () => {
  it('plays when a watched item is linked', () => {
    seeItem(40255);
    expect(soundCount()).toBe(1);
  });

  it('stays silent for an item on no list', () => {
    seeItem(99999);
    expect(soundCount()).toBe(0);
  });

  // The popup is one prompt, so it gets one sound — even when the item is on
  // several lists. Otherwise a hybrid with three OS lists gets a triple beep.
  it('plays once per popup, not once per matching list', () => {
    vm.exec(`
      BisWatcherDB.os = {
        BisWatcher._test.parseImport('BISWATCH2~wowhead~mage~arcane~1~all~40255|alt|Trinkets'),
        BisWatcher._test.parseImport('BISWATCH2~wowhead~mage~fire~1~all~40255|opt|Trinkets'),
      }
    `);
    seeItem(40255);
    expect(vm.eval('return #BisWatcher._test.findMatches(40255)')).toBe(3);
    expect(soundCount()).toBe(1);
  });

  it('can be turned off', () => {
    vm.exec('BisWatcherDB.sound = false');
    seeItem(40255);
    expect(soundCount()).toBe(0);
  });

  it('is on by default', () => {
    expect(vm.eval('return BisWatcherDB.sound')).toBe(true);
  });

  it('uses the configured sound', () => {
    vm.exec("BisWatcherDB.soundName = 'RaidWarning'");
    seeItem(40255);
    expect(JSON.stringify(vm.eval('return _G.__calls.sound'))).toContain('RaidWarning');
  });

  it('can be previewed without an item link, so you can pick one', () => {
    vm.exec('BisWatcher._test.previewSound()');
    expect(soundCount()).toBe(1);
  });
});

describe('debounce', () => {
  it('suppresses a repeat prompt for the same item inside the window', () => {
    seeItem(40255);
    advance(3);
    seeItem(40255);
    expect(soundCount()).toBe(1);
  });

  it('prompts again once the window has passed', () => {
    seeItem(40255);
    advance(9);
    seeItem(40255);
    expect(soundCount()).toBe(2);
  });

  it('does not suppress a different item', () => {
    seeItem(40255);
    seeItem(40260);
    expect(soundCount()).toBe(2);
  });
});

describe('scanning', () => {
  it('picks item ids out of a chat message', () => {
    vm.exec('BisWatcher._test.scanMessage("Gratz |cffa335ee|Hitem:40255:0:0|h[Dying Curse]|h|r to Bob")');
    expect(soundCount()).toBe(1);
  });

  it('ignores a message with no item link', () => {
    vm.exec('BisWatcher._test.scanMessage("anyone need trinkets?")');
    expect(soundCount()).toBe(0);
  });

  it('does nothing at all when scanning is disabled', () => {
    vm.exec('BisWatcherDB.enabled = false');
    seeItem(40255);
    expect(soundCount()).toBe(0);
  });
});

describe('popup contents', () => {
  it('names the raid the list was imported for', () => {
    seeItem(40255);
    expect(vm.eval('return BisWatcher._test.lastPopupSummary()')).toMatch(/naxx-25/);
  });

  it('names the spec, so a hybrid can tell which list fired', () => {
    seeItem(40255);
    expect(vm.eval('return BisWatcher._test.lastPopupSummary()')).toMatch(/frost/);
  });
});
