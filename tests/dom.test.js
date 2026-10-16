"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function fixture() {
  const messages = [], handlers = {}, native = [];
  const target = () => ({ listeners: [], addEventListener(type, callback, capture = false) {
    this.listeners.push({ type, callback, capture });
  }, dispatch(type, fields = {}) {
    const event = { code: "", preventDefault() { this.prevented = true; },
      stopImmediatePropagation() { this.stopped = true; }, ...fields };
    for (const capture of [true, false]) for (const listener of this.listeners) {
      if (listener.type === type && listener.capture === capture && !event.stopped) listener.callback(event);
    }
    return event;
  } });
  const window = target(), document = target();
  document.activeElement = { tagName: "CANVAS" };
  // The game registers its bubbling handler before the mod's capture handler.
  window.addEventListener("keydown", event => native.push(event.code));
  const sandbox = { window, document, DOMHandler: class {
    AddRuntimeMessageHandlers(entries) { Object.assign(handlers, Object.fromEntries(entries)); }
    PostToRuntime(type, data) { messages.push([type, { ...data }]); }
  }, RuntimeInterface: { AddDOMHandlerClass(klass) { sandbox.klass = klass; } } };
  sandbox.self = sandbox; vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(`${__dirname}/../src/dom.js`, "utf8"), sandbox);
  const dom = new sandbox.klass(); dom.notify = () => {}; dom.Attach(); handlers.ready();
  return { window, document, messages, native };
}

test("C overrides the native menu shortcut and toggles once per press, never on repeat or release", () => {
  const f = fixture();
  assert.equal(f.window.dispatch("keydown", { code: "KeyC" }).prevented, true);
  f.window.dispatch("keydown", { code: "KeyC", repeat: true });
  f.window.dispatch("keydown", { code: "KeyC" });
  f.window.dispatch("keyup", { code: "KeyC" });
  assert.deepEqual(f.messages, [["combat", {}]]); assert.deepEqual(f.native, []);
  f.window.dispatch("keydown", { code: "KeyC" });
  assert.deepEqual(f.messages, [["combat", {}], ["combat", {}]]);
});
test("typing, modifiers, and IME composition do not toggle combat or consume the key", () => {
  for (const fields of [{ ctrlKey: true }, { altKey: true }, { shiftKey: true }, { metaKey: true }, { isComposing: true }]) {
    const f = fixture(); const event = f.window.dispatch("keydown", { code: "KeyC", ...fields });
    assert.equal(event.prevented, undefined); assert.deepEqual(f.messages, [["cancel", {}]]);
  }
  for (const element of [{ tagName: "INPUT" }, { tagName: "TEXTAREA" }, { isContentEditable: true }]) {
    const f = fixture(); f.document.activeElement = element;
    const event = f.window.dispatch("keydown", { code: "KeyC" });
    assert.equal(event.prevented, undefined); assert.deepEqual(f.messages, [["cancel", {}]]);
  }
});
test("the four formation keys still send down/up and leave numpad keys alone", () => {
  const f = fixture();
  for (let slot = 1; slot <= 4; slot++) {
    f.window.dispatch("keydown", { code: `Digit${slot}` }); f.window.dispatch("keyup", { code: `Digit${slot}` });
    assert.deepEqual(f.messages.slice(-2), [["key", { phase: "down", slot }], ["key", { phase: "up", slot }]]);
  }
  f.window.dispatch("keydown", { code: "Numpad1" }); assert.equal(f.messages.length, 8);
});
test("C overlapping a held formation cancels the hold without toggling combat", () => {
  const f = fixture();
  f.window.dispatch("keydown", { code: "Digit1" }); f.window.dispatch("keydown", { code: "KeyC" });
  f.window.dispatch("keyup", { code: "KeyC" }); f.window.dispatch("keyup", { code: "Digit1" });
  assert.deepEqual(f.messages, [["key", { phase: "down", slot: 1 }], ["cancel", {}], ["key", { phase: "up", slot: 1 }]]);
});
