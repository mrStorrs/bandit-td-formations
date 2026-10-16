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
    const event = { code: "", preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; },
      stopImmediatePropagation() { this.stopped = true; }, ...fields };
    for (const capture of [true, false]) for (const listener of this.listeners) {
      if (listener.type === type && listener.capture === capture && !event.stopped) listener.callback(event);
    }
    return event;
  } });
  const window = target(), document = target();
  document.createElement = tag => Object.assign(target(), { tagName: tag.toUpperCase(), style: {}, children: [],
    setAttribute(name, value) { this[name] = value; },
    appendChild(child) { this.children.push(child); },
    replaceChildren() { this.children = []; },
    contains(node) { return this === node || this.children.some(c => c.contains(node)); } });
  document.body = document.createElement("body");
  document.activeElement = { tagName: "CANVAS" };
  // The game registers its bubbling handler before the mod's capture handler.
  window.addEventListener("keydown", event => native.push(event.code));
  const stored = new Map();
  const sandbox = { window, document, localStorage: { getItem: k => stored.get(k), setItem: (k, v) => stored.set(k, v) }, DOMHandler: class {
    AddRuntimeMessageHandlers(entries) { Object.assign(handlers, Object.fromEntries(entries)); }
    PostToRuntime(type, data) { messages.push([type, { ...data }]); }
  }, RuntimeInterface: { AddDOMHandlerClass(klass) { sandbox.klass = klass; } } };
  sandbox.self = sandbox; vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(`${__dirname}/../src/dom.js`, "utf8"), sandbox);
  const dom = new sandbox.klass(); dom.notify = () => {}; dom.Attach(); handlers.ready({ version: "1.1.1" });
  return { window, document, messages, native, dom, handlers, stored };
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
test("F6 toggles the forest loop once per press and consumes browser/native shortcuts", () => {
  const f = fixture();
  assert.equal(f.window.dispatch("keydown", { code: "F6" }).prevented, true);
  f.window.dispatch("keydown", { code: "F6", repeat: true });
  f.window.dispatch("keyup", { code: "F6" });
  assert.deepEqual(f.messages, [["forest", {}]]); assert.deepEqual(f.native, []);
  f.window.dispatch("keydown", { code: "F6", ctrlKey: true });
  assert.deepEqual(f.messages.at(-1), ["cancel", {}]);
  f.document.activeElement = { tagName: "INPUT" };
  f.window.dispatch("keydown", { code: "F6" });
  assert.deepEqual(f.messages.at(-1), ["cancel", {}]);
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

const recruitState = { visible: true, running: false, rolls: 0, spent: 0, message: "Ready",
  grades: ["E", "D", "C", "B", "A", "S", "SS"], methods: [{ id: 1, name: "Visit", cost: 3000 }] };
test("recruit controls submit the chosen grade/method and remember settings without starting automatically", () => {
  const f = fixture();
  f.stored.set("cjs-formations:recruit-options:v1", JSON.stringify({ minimum: 6, method: 1 }));
  f.handlers["recruit-status"](recruitState);
  assert.equal(f.dom.recruitGrade.value, "6"); assert.equal(f.messages.length, 0);
  f.dom.recruitGrade.value = "5"; f.dom.recruitButton.dispatch("click");
  assert.deepEqual(JSON.parse(JSON.stringify(f.messages)), [["cancel", {}], ["recruit-start", { method: 1, criteria: [{ type: "work-grade", minimum: 5 }] }]]);
  assert.equal(JSON.parse(f.stored.get("cjs-formations:recruit-options:v1")).minimum, 5);
  f.handlers["recruit-status"]({ ...recruitState, running: true, rolls: 3, spent: 9000 });
  assert.equal(f.dom.recruitGrade.disabled, true); assert.equal(f.dom.recruitMethod.disabled, true);
  assert.equal(f.dom.recruitButton.textContent, "Stop"); assert.match(f.dom.recruitInfo.textContent, /3 rolls/);
  f.dom.recruitButton.dispatch("click"); assert.deepEqual(f.messages.at(-1), ["recruit-stop", {}]);
});
test("recruit controls protect keyboard focus and stop on focus loss", () => {
  const f = fixture(); f.handlers["recruit-status"]({ ...recruitState, running: true });
  f.document.activeElement = f.dom.recruitButton;
  f.window.dispatch("keydown", { code: "Digit1" });
  assert.deepEqual(f.messages.at(-1), ["cancel", {}]);
  f.window.dispatch("blur"); assert.deepEqual(f.messages.at(-1), ["recruit-stop", {}]);
  f.document.hidden = true; f.document.dispatch("visibilitychange");
  assert.deepEqual(f.messages.at(-1), ["recruit-stop", {}]);
  assert.equal(f.dom.recruitPanel.dispatch("pointerdown").stopped, true);
  assert.equal(f.dom.recruitPanel.dispatch("pointermove").stopped, true);
});
test("closed recruitment screens hide the panel and locked refresh methods disable Start", () => {
  const f = fixture(); f.handlers["recruit-status"]({ ...recruitState, methods: [] });
  assert.equal(f.dom.recruitButton.disabled, true); assert.match(f.dom.recruitInfo.textContent, /Unlock/);
  f.handlers["recruit-status"]({ ...recruitState, visible: false });
  assert.equal(f.dom.recruitPanel.hidden, true);
});
