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
  const window = Object.assign(target(), { innerWidth: 1280, innerHeight: 800 }), document = target();
  document.createElement = tag => Object.assign(target(), { tagName: tag.toUpperCase(), style: {}, children: [],
    setAttribute(name, value) { this[name] = value; },
    appendChild(child) { this.children.push(child); child.parentElement = this; },
    remove() { this.parentElement.children = this.parentElement.children.filter(child => child !== this); },
    getBoundingClientRect() { return { width: 300, height: 130 }; },
    replaceChildren() { this.children = []; },
    checkValidity() { return !this.validity?.badInput && (this.value === "" || (Number.isFinite(Number(this.value)) && Number(this.value) >= Number(this.min))); },
    reportValidity() { this.validityReported = true; return this.checkValidity(); },
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

const inventoryState = token => ({ active: true, token, items: [{ uid: 123, key: "piece-1", left: 80, top: 150, right: 120, bottom: 190 }] });
function inventoryPointer(f, type, extra = {}) {
  return f.window.dispatch(type, { button: 0, detail: 1, pointerId: 1, pointerType: "mouse", ctrlKey: true,
    target: { tagName: "CANVAS" }, clientX: 100, clientY: 170, ...extra });
}
test("inventory role sorting shows the supplied jobs, sends its current page token and hides with the menu", () => {
  const f = fixture(), state = { ...inventoryState("page-one"), sort: { value: "forge",
    roles: [{ id: "forge", name: "Forger" }, { id: "combat-str", name: "Combat — STR" }] } };
  f.handlers["inventory-status"](state);
  const select = f.dom.inventorySort;
  assert.deepEqual(select.children.map(o => o.value), ["", "forge", "combat-str"]);
  assert.equal(select.value, "forge"); assert.equal(select.hidden, false);
  select.value = "combat-str"; select.dispatch("change");
  assert.deepEqual(f.messages.at(-1), ["inventory-sort", { token: "page-one", role: "combat-str" }]);
  f.document.activeElement = select; f.window.dispatch("keydown", { code: "KeyC" });
  assert.equal(f.messages.at(-1)[0], "cancel");
  assert.equal(select.dispatch("click").stopped, true);
  f.handlers["inventory-status"]({ active: false, items: [] }); assert.equal(select.hidden, true);
  const count = f.messages.length; select.dispatch("change"); assert.equal(f.messages.length, count);
  f.handlers["inventory-status"]({ ...state, token: "page-two", sort: { ...state.sort, value: "" } });
  assert.equal(select.value, ""); assert.equal(select.hidden, false);
});

test("the role selector stays fixed while native anchors, window size and page items change", () => {
  const f = fixture(); f.window.innerWidth = 700;
  f.handlers["inventory-status"]({ ...inventoryState("small"), sort: { value: "", roles: [],
    anchor: { left: 600, top: 80, right: 690, bottom: 100 } } });
  const select = f.dom.inventorySort, styles = { ...select.style };
  assert.match(select.style.cssText, /position:fixed;top:12px;left:12px/);
  for (const width of [400, 1600]) {
    f.window.innerWidth = width;
    f.handlers["inventory-status"]({ ...inventoryState("small"), items: [], sort: { value: "", roles: [] } });
    assert.deepEqual(select.style, styles); assert.equal(select.hidden, false);
  }
  f.handlers["inventory-status"]({ ...inventoryState("modal"), sort: null });
  assert.equal(f.dom.inventorySort.hidden, true);
});

test("native filters and item status updates do not hide or reset an open role choice", () => {
  const f = fixture(), state = { ...inventoryState("page"), sort: { value: "forge", roles: [],
    anchor: { left: 100, top: 100, right: 230, bottom: 130 } } };
  f.handlers["inventory-status"](state); const select = f.dom.inventorySort;
  select.value = "building";
  f.handlers["inventory-status"]({ ...state, active: false, items: [] });
  assert.equal(select.hidden, false); assert.equal(select.value, "building");
  select.dispatch("change");
  assert.deepEqual(f.messages.at(-1), ["inventory-sort", { token: "page", role: "building" }]);
  assert.equal(select.dispatch("mousemove").stopped, true);
  f.handlers["inventory-status"]({ ...state, sort: { ...state.sort, value: "" } });
  assert.equal(select.value, "", "a native sort choice still overrides the role");
  f.handlers["inventory-status"]({ active: false, items: [] }); assert.equal(select.hidden, true);
});
test("Ctrl-click captures the whole native mouse gesture and sends one inventory action on release", () => {
  const f = fixture(); f.handlers["inventory-status"](inventoryState("inventory-1"));
  for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click", "dblclick"]) {
    assert.equal(inventoryPointer(f, type).prevented, true, type);
  }
  assert.deepEqual(f.messages, [
    ["inventory-click", { phase: "down", token: "inventory-1", uid: 123, key: "piece-1", x: 100, y: 170 }],
    ["inventory-click", { phase: "up", token: "inventory-1", x: 100, y: 170 }],
  ]);
  assert.equal(inventoryPointer(f, "click", { detail: 0, target: { tagName: "BUTTON" } }).prevented, undefined,
    "a later keyboard-activated button must still work");
  assert.equal(inventoryPointer(f, "pointerdown", { ctrlKey: false }).prevented, undefined);
  assert.equal(inventoryPointer(f, "mousedown", { ctrlKey: false }).prevented, undefined);
  assert.equal(inventoryPointer(f, "mouseup", { ctrlKey: false }).prevented, undefined);
  assert.equal(f.messages.length, 2);
});
test("Ctrl-click ignores normal clicks, other modifiers, non-mouse pointers, inputs and closed inventory", () => {
  for (const extra of [{ ctrlKey: false }, { button: 2 }, { altKey: true }, { shiftKey: true }, { metaKey: true },
    { pointerType: "touch" }, { target: { tagName: "INPUT" } }, { target: { tagName: "BUTTON" } }]) {
    const f = fixture(); f.handlers["inventory-status"](inventoryState("one"));
    assert.equal(inventoryPointer(f, "pointerdown", extra).prevented, undefined);
    assert.equal(f.messages.length, 0);
  }
  const f = fixture(); assert.equal(inventoryPointer(f, "pointerdown").prevented, undefined);
  f.handlers["inventory-status"](inventoryState("one"));
  assert.equal(inventoryPointer(f, "pointerdown", { clientX: 500 }).prevented, undefined); assert.equal(f.messages.length, 0);
  f.document.activeElement = { tagName: "INPUT" };
  assert.equal(inventoryPointer(f, "pointerdown").prevented, true, "clicking the canvas leaves a previously focused input");
});
test("releasing Control first or releasing over a control cancels without toggling the native item lock", () => {
  for (const extra of [{ ctrlKey: false }, { target: { tagName: "BUTTON" } }]) {
    const f = fixture(); f.handlers["inventory-status"](inventoryState("one"));
    inventoryPointer(f, "pointerdown"); assert.equal(inventoryPointer(f, "pointerup", extra).prevented, true);
    assert.equal(f.messages.at(-1)[1].phase, "cancel");
    assert.equal(inventoryPointer(f, "mouseup", { ctrlKey: false }).prevented, true);
    assert.equal(inventoryPointer(f, "click", { ctrlKey: false }).prevented, true);
  }
});
test("focus loss and pointer cancellation discard a pending sale; page changes keep the original token", () => {
  for (const type of ["blur", "pointercancel"]) {
    const f = fixture(); f.handlers["inventory-status"](inventoryState("one"));
    inventoryPointer(f, "pointerdown"); f.window.dispatch(type); inventoryPointer(f, "pointerup");
    assert.deepEqual(f.messages.at(-1), ["inventory-click", { phase: "cancel" }]);
  }
  const f = fixture(); f.handlers["inventory-status"](inventoryState("one"));
  inventoryPointer(f, "pointerdown"); f.handlers["inventory-status"](inventoryState("two"));
  inventoryPointer(f, "pointerup"); assert.equal(f.messages.at(-1)[1].token, "one");
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

test("Shift + 1–4 routes only to building formations and consumes native shortcuts", () => {
  const f = fixture();
  for (let slot = 1; slot <= 4; slot++) {
    const down = f.window.dispatch("keydown", { code: `Digit${slot}`, shiftKey: true });
    f.window.dispatch("keydown", { code: `Digit${slot}`, shiftKey: true, repeat: true });
    const up = f.window.dispatch("keyup", { code: `Digit${slot}`, shiftKey: true });
    assert.equal(down.prevented, true); assert.equal(up.prevented, true);
    assert.deepEqual(f.messages.slice(-2), [["building-key", { phase: "down", slot }], ["building-key", { phase: "up", slot }]]);
  }
  assert.deepEqual(f.native, []);
});
test("releasing Shift first still recalls buildings; adding Shift midway cancels a character hold", () => {
  const f = fixture();
  f.window.dispatch("keydown", { code: "Digit1", shiftKey: true });
  f.window.dispatch("keyup", { code: "ShiftLeft" });
  f.window.dispatch("keyup", { code: "Digit1" });
  assert.deepEqual(f.messages, [["building-key", { phase: "down", slot: 1 }], ["building-key", { phase: "up", slot: 1 }]]);
  f.messages.length = 0;
  f.window.dispatch("keydown", { code: "Digit1" });
  f.window.dispatch("keydown", { code: "ShiftLeft", shiftKey: true });
  f.window.dispatch("keyup", { code: "Digit1", shiftKey: true });
  assert.deepEqual(f.messages, [["key", { phase: "down", slot: 1 }], ["cancel", {}]]);
});
test("building shortcuts respect typing, other modifiers, focus loss, and overlapping numbers", () => {
  for (const fields of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { isComposing: true }]) {
    const f = fixture(); f.window.dispatch("keydown", { code: "Digit1", shiftKey: true, ...fields });
    assert.deepEqual(f.messages, [["cancel", {}]]);
  }
  const f = fixture(); f.document.activeElement = { tagName: "INPUT" };
  f.window.dispatch("keydown", { code: "Digit1", shiftKey: true }); assert.deepEqual(f.messages, [["cancel", {}]]);
  f.document.activeElement = { tagName: "CANVAS" }; f.messages.length = 0;
  f.window.dispatch("keydown", { code: "Digit1", shiftKey: true }); f.window.dispatch("blur");
  f.window.dispatch("keyup", { code: "Digit1" }); assert.equal(f.messages.at(-1)[0], "cancel");
  f.window.dispatch("keydown", { code: "Digit1", shiftKey: true });
  f.window.dispatch("keydown", { code: "Digit2", shiftKey: true }); assert.equal(f.messages.at(-1)[0], "cancel");
});

const recruitState = { visible: true, running: false, rolls: 0, spent: 0, message: "Ready",
  grades: ["E", "D", "C", "B", "A", "S", "SS"], methods: [{ id: 1, name: "Visit", cost: 3000 }] };
test("recruit controls submit the chosen grade/method and remember settings without starting automatically", () => {
  const f = fixture();
  f.stored.set("cjs-formations:recruit-options:v1", JSON.stringify({ minimum: 6, method: 1 }));
  f.handlers["recruit-status"](recruitState);
  assert.equal(f.dom.recruitGrade.value, "6"); assert.equal(f.messages.length, 0);
  f.dom.recruitGrade.value = "5"; f.dom.recruitButton.dispatch("click");
  assert.equal(f.dom.recruitMoney.value, "0", "old preferences default to no reserve");
  assert.deepEqual(JSON.parse(JSON.stringify(f.messages)), [["cancel", {}], ["recruit-start", { method: 1, minimumMoney: 0, criteria: [{ type: "work-grade", minimum: 5 }] }]]);
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
test("recruit controls remember separate stat thresholds, support stats alone, and freeze targets while rolling", () => {
  const f = fixture();
  f.stored.set("cjs-formations:recruit-options:v1", JSON.stringify({ minimum: 4, method: 1, stats: { str: 20.5, agi: 0, int: null } }));
  f.handlers["recruit-status"](recruitState);
  assert.equal(f.dom.recruitStats.str.value, "20.5"); assert.equal(f.dom.recruitStats.agi.value, "0");
  assert.equal(f.dom.recruitStats.int.value, ""); assert.equal(f.messages.length, 0);
  f.dom.recruitStats.int.value = "30"; f.dom.recruitButton.dispatch("click");
  assert.deepEqual(JSON.parse(JSON.stringify(f.messages.at(-1))), ["recruit-start", { method: 1, minimumMoney: 0, criteria: [
    { type: "work-grade", minimum: 4 }, { type: "stat", stat: "str", above: 20.5 },
    { type: "stat", stat: "agi", above: 0 }, { type: "stat", stat: "int", above: 30 },
  ] }]);
  assert.deepEqual(JSON.parse(f.stored.get("cjs-formations:recruit-options:v1")).stats, { str: 20.5, agi: 0, int: 30 });
  f.handlers["recruit-status"]({ ...recruitState, running: true });
  assert.ok(Object.values(f.dom.recruitStats).every(input => input.disabled));
  f.handlers["recruit-status"](recruitState);
  assert.ok(Object.values(f.dom.recruitStats).every(input => !input.disabled));
  f.dom.recruitGrade.value = "0"; f.dom.recruitStats.agi.value = ""; f.dom.recruitStats.int.value = "";
  f.dom.recruitButton.dispatch("click");
  assert.deepEqual(JSON.parse(JSON.stringify(f.messages.at(-1))), ["recruit-start", { method: 1, minimumMoney: 0,
    criteria: [{ type: "stat", stat: "str", above: 20.5 }] }]);
  f.document.activeElement = f.dom.recruitStats.str;
  f.window.dispatch("keydown", { code: "Digit1" }); assert.equal(f.messages.at(-1)[0], "cancel");
});
test("invalid stat inputs cannot start or overwrite preferences, and invalid saved targets are ignored", () => {
  const f = fixture();
  const saved = JSON.stringify({ minimum: 0, method: 1, stats: { str: -1, agi: "20", int: null } });
  f.stored.set("cjs-formations:recruit-options:v1", saved);
  f.handlers["recruit-status"](recruitState);
  assert.equal(f.dom.recruitGrade.value, "0");
  assert.ok(Object.values(f.dom.recruitStats).every(input => input.value === ""));
  for (const [value, badInput] of [["-1", false], ["", true], ["Infinity", false]]) {
    f.dom.recruitStats.str.value = value; f.dom.recruitStats.str.validity = { badInput };
    f.dom.recruitStats.str.dispatch("change"); f.dom.recruitButton.dispatch("click");
    assert.equal(f.messages.length, 0); assert.equal(f.stored.get("cjs-formations:recruit-options:v1"), saved);
    assert.equal(f.dom.recruitStats.str.validityReported, true);
  }
});
test("closed recruitment screens hide the panel and locked refresh methods disable Start", () => {
  const f = fixture(); f.handlers["recruit-status"]({ ...recruitState, methods: [] });
  assert.equal(f.dom.recruitButton.disabled, true); assert.match(f.dom.recruitInfo.textContent, /Unlock/);
  f.handlers["recruit-status"]({ ...recruitState, visible: false });
  assert.equal(f.dom.recruitPanel.hidden, true);
});
test("minimum copper is restored, editable while stopped, sent with Start, and saved across panels", () => {
  const key = "cjs-formations:recruit-options:v1", f = fixture();
  f.stored.set(key, JSON.stringify({ minimum: 4, method: 1, minimumMoney: 10000 }));
  f.handlers["recruit-status"](recruitState);
  assert.equal(f.dom.recruitMoney.value, "10000"); assert.equal(f.messages.length, 0);
  f.dom.recruitMoney.value = "25000"; f.dom.recruitMoney.dispatch("change");
  assert.equal(JSON.parse(f.stored.get(key)).minimumMoney, 25000);
  f.dom.recruitButton.dispatch("click"); assert.equal(f.messages.at(-1)[1].minimumMoney, 25000);
  f.handlers["recruit-status"]({ ...recruitState, running: true }); assert.equal(f.dom.recruitMoney.disabled, true);
  f.handlers["recruit-status"](recruitState); assert.equal(f.dom.recruitMoney.disabled, false);
  const reload = fixture(); reload.stored.set(key, f.stored.get(key)); reload.handlers["recruit-status"](recruitState);
  assert.equal(reload.dom.recruitMoney.value, "25000"); assert.equal(reload.messages.length, 0);
  f.dom.recruitMoney.value = ""; f.dom.recruitButton.dispatch("click");
  assert.equal(f.messages.at(-1)[1].minimumMoney, 0); assert.equal(JSON.parse(f.stored.get(key)).minimumMoney, 0);
  f.document.activeElement = f.dom.recruitMoney;
  f.window.dispatch("keydown", { code: "Digit1" }); assert.equal(f.messages.at(-1)[0], "cancel");
});
test("invalid minimum copper is rejected without overwriting preferences; invalid stored values use zero", () => {
  const key = "cjs-formations:recruit-options:v1";
  for (const minimumMoney of [-1, "6000", null]) {
    const f = fixture(); f.stored.set(key, JSON.stringify({ minimumMoney })); f.handlers["recruit-status"](recruitState);
    assert.equal(f.dom.recruitMoney.value, "0");
  }
  const f = fixture(), saved = JSON.stringify({ minimum: 5, method: 1, minimumMoney: 6000 });
  f.stored.set(key, saved); f.handlers["recruit-status"](recruitState);
  for (const [value, badInput] of [["-1", false], ["", true], ["Infinity", false]]) {
    f.dom.recruitMoney.value = value; f.dom.recruitMoney.validity = { badInput };
    f.dom.recruitMoney.dispatch("change"); f.dom.recruitButton.dispatch("click");
    assert.equal(f.messages.length, 0); assert.equal(f.stored.get(key), saved);
    assert.equal(f.dom.recruitMoney.validityReported, true);
  }
});

const outfitState = { visible: true, token: "campaign:character:job", name: "Worker", jobName: "Forging", enabled: true, saved: false, busy: false, error: "" };
test("outfit lock tooltips show every owner as text, follow coordinates, and disappear with the item", () => {
  const f = fixture(), marker = { uid: 7, x: 120, y: 200, size: 20, owners: [
    { name: "Panda", job: "Forging" }, { name: "<img src=x>", job: "Research" },
  ] };
  f.handlers["outfit-locks"]({ markers: [marker] });
  const button = f.dom.outfitLockButtons.get(7);
  assert.equal(button.style.left, "120px"); assert.equal(button.style.top, "200px");
  button.dispatch("pointerenter"); assert.equal(f.dom.outfitLockTooltip.hidden, false);
  assert.match(f.dom.outfitLockTooltip.textContent, /Panda · Forging\n<img src=x> · Research/);
  assert.equal(f.dom.outfitLockTooltip.children.length, 0);
  assert.equal(button.dispatch("click").stopped, true);
  assert.equal(button.dispatch("pointerdown").stopped, true);
  f.document.activeElement = button; f.window.dispatch("keydown", { code: "KeyC" });
  assert.equal(f.messages.some(([name]) => name === "combat"), false);
  f.handlers["outfit-locks"]({ markers: [{ ...marker, x: 1200, y: 750 }] });
  assert.equal(f.dom.outfitLockButtons.get(7), button);
  assert.equal(f.dom.outfitLockTooltip.style.left, "968px");
  assert.equal(f.dom.outfitLockTooltip.style.top, "658px");
  f.handlers["outfit-locks"]({ markers: [] });
  assert.equal(f.dom.outfitLockButtons.size, 0); assert.equal(f.dom.outfitLockTooltip.hidden, true);
  button.dispatch("click"); assert.equal(f.dom.outfitLockTooltip.hidden, true);
  f.handlers["outfit-locks"]({ markers: [{ ...marker, x: -10 }] });
  assert.equal(f.dom.outfitLockButtons.size, 0);
});
test("outfit controls save/forget only the displayed character and job and submit the auto-equip toggle", () => {
  const f = fixture(); f.handlers["outfit-status"](outfitState);
  assert.equal(f.dom.outfitSave.textContent, "Save outfit for Forging");
  assert.equal(f.dom.outfitForget.disabled, true);
  f.dom.outfitSave.dispatch("click");
  assert.deepEqual(f.messages, [["cancel", {}], ["outfit-save", { token: outfitState.token }]]);
  f.handlers["outfit-status"]({ ...outfitState, token: "different-character:mining", jobName: "Mining", saved: true });
  f.dom.outfitForget.dispatch("click");
  assert.deepEqual(f.messages.at(-1), ["outfit-forget", { token: "different-character:mining" }]);
  f.dom.outfitEnabled.checked = false; f.dom.outfitEnabled.dispatch("change");
  assert.deepEqual(f.messages.at(-1), ["outfit-enabled", { token: "different-character:mining", enabled: false }]);
});
test("outfit controls block game input and stale or busy actions and hide outside character screens", () => {
  const f = fixture(); f.handlers["outfit-status"](outfitState);
  f.document.activeElement = f.dom.outfitSave; f.window.dispatch("keydown", { code: "Digit1" });
  assert.deepEqual(f.messages.at(-1), ["cancel", {}]);
  for (const event of ["pointerdown", "pointermove", "pointerup", "keydown", "wheel"]) assert.equal(f.dom.outfitPanel.dispatch(event).stopped, true);
  const count = f.messages.length;
  f.handlers["outfit-status"]({ ...outfitState, busy: true }); f.dom.outfitSave.dispatch("click");
  assert.equal(f.messages.length, count); assert.equal(f.dom.outfitEnabled.disabled, true);
  f.handlers["outfit-status"]({ visible: false }); f.dom.outfitSave.dispatch("click");
  assert.equal(f.dom.outfitPanel.hidden, true); assert.equal(f.messages.length, count);
});

const craftState = { visible:true,token:"campaign:layout:3",station:{id:3,kind:4,name:"Forge"},enabled:true,running:false,busy:false,message:"Ready",kept:0,sold:0,
  options:{mode:"repeat",loop:"all",roles:["forge","research"],tier:1,minimum:3,multiplier:1,autoSell:true},
  roles:[{id:"forge",name:"Forger",stat:1},{id:"research",name:"Researcher",stat:3},{id:"combat-agi",name:"Combat — AGI",stat:2,combat:true}] };
test("crafting controls offer mode, role checkboxes, single-role override, tier, rarity and material multiplier",()=>{
  const f=fixture();f.handlers["craft-status"](craftState);
  assert.equal(f.dom.craftBody.hidden,false);assert.match(f.dom.craftToggle.textContent,/Forge #3/);
  f.dom.craftMode.value="sets";f.dom.craftMode.dispatch("change");
  f.dom.craftLoop.value="combat-agi";f.dom.craftLoop.dispatch("change");
  assert.ok(Object.values(f.dom.craftRoles).every(i=>i.disabled));
  f.dom.craftTier.value="2";f.dom.craftMinimum.value="5";f.dom.craftMultiplier.value="10";f.dom.craftSell.checked=false;
  f.dom.craftButton.dispatch("click");
  assert.deepEqual(JSON.parse(JSON.stringify(f.messages.at(-1))),["craft-configure",{token:craftState.token,options:{
    mode:"sets",loop:"combat-agi",roles:["forge","research"],tier:2,minimum:5,multiplier:10,autoSell:false,keepLimit:null,forgeOutput:"all",
  }}]);
});
test("crafting status preserves unsaved edits and permits disabling sales during an active loop",()=>{
  const f=fixture();f.handlers["craft-status"](craftState);f.dom.craftTier.value="4";
  f.handlers["craft-status"]({...craftState,message:"Updated"});assert.equal(f.dom.craftTier.value,"4");
  const active={...craftState,running:true,options:{...craftState.options,mode:"sets"}};
  f.handlers["craft-status"](active);assert.equal(f.dom.craftTier.disabled,false);assert.equal(f.dom.craftSell.disabled,false);
  f.dom.craftSell.checked=false;f.dom.craftSell.dispatch("change");assert.deepEqual(f.messages.at(-1),["craft-sell",{token:craftState.token,autoSell:false}]);
  f.dom.craftPause.dispatch("click");assert.deepEqual(f.messages.at(-1),["craft-pause",{token:craftState.token}]);
  f.document.activeElement=f.dom.craftButton;f.window.dispatch("keydown",{code:"KeyC"});assert.equal(f.messages.at(-1)[0],"cancel");
  for(const event of ["pointerdown","pointermove","pointerup","wheel","keydown"])assert.equal(f.dom.craftPanel.dispatch(event).stopped,true);
  f.handlers["craft-status"]({visible:false});assert.equal(f.dom.craftPanel.hidden,true);
  const count=f.messages.length;f.dom.craftButton.dispatch("click");assert.equal(f.messages.length,count);
});

test("station output controls save limits in either mode without applying draft recipe changes",()=>{
  const f=fixture();f.handlers["craft-status"](craftState);
  assert.equal(f.dom.craftOutput.value,"normal");assert.equal(f.dom.craftKeepLabel.hidden,true);
  f.dom.craftTier.value="4";f.dom.craftOutput.value="surplus";f.dom.craftKeep.value="3";f.dom.craftOutput.dispatch("change");
  assert.deepEqual(f.messages.at(-1),["craft-output",{token:craftState.token,keepLimit:3}]);
  const saved={...craftState,options:{...craftState.options,keepLimit:3}};f.handlers["craft-status"](saved);
  assert.equal(f.dom.craftTier.value,"4");assert.equal(f.dom.craftKeep.value,"3");assert.equal(f.dom.craftKeepLabel.hidden,false);
  f.dom.craftKeep.value="1.5";const count=f.messages.length;f.dom.craftKeep.dispatch("change");assert.equal(f.messages.length,count);
  f.dom.craftKeep.value="2";f.dom.craftKeep.dispatch("change");assert.equal(f.messages.at(-1)[1].keepLimit,2);
  f.dom.craftOutput.value="all";f.dom.craftOutput.dispatch("change");assert.equal(f.messages.at(-1)[1].keepLimit,0);
  for(const change of [{busy:true},{error:true},{visible:false},{station:{id:5,kind:6,name:"Brewery"}}]){
    f.handlers["craft-status"]({...saved,...change});const count=f.messages.length;f.dom.craftOutput.dispatch("change");assert.equal(f.messages.length,count);
  }
  f.handlers["craft-status"]({...craftState,token:"station:other"});assert.equal(f.dom.craftOutput.value,"normal");
});

test("Sell excess now sends saved station settings, works paused and blocks unapplied sale filters",()=>{
  const f=fixture(),state={...craftState,enabled:false,options:{...craftState.options,keepLimit:5,forgeOutput:"all"}};
  f.handlers["craft-status"](state);
  assert.equal(f.dom.craftExcess.hidden,false);assert.equal(f.dom.craftExcess.disabled,false);
  assert.equal(f.dom.craftTier.disabled,false);assert.equal(f.dom.craftForgeOutput.disabled,false);
  f.dom.craftExcess.dispatch("click");
  assert.deepEqual(JSON.parse(JSON.stringify(f.messages.at(-1))),["craft-sell-excess",{token:state.token,options:state.options}]);
  for(const [name,value] of [["craftTier","2"],["craftMinimum","5"],["craftForgeOutput","weapons"],["craftKeep","3"],["craftOutput","all"]]){
    const input=f.dom[name],old=input.value;input.value=value;
    const count=f.messages.length;f.dom.craftExcess.dispatch("click");
    assert.equal(f.messages.length,count,name);assert.equal(f.dom.craftExcess.disabled,true,name);input.value=old;
  }
  for(const change of [{busy:true},{error:true},{visible:false},{station:{id:5,kind:6,name:"Brewery"}},{options:{...state.options,keepLimit:null}}]){
    f.handlers["craft-status"]({...state,...change});const count=f.messages.length;f.dom.craftExcess.dispatch("click");assert.equal(f.messages.length,count);
  }
  f.handlers["craft-status"]({...state,token:"another-station",saleMessage:"Sold 6 excess items."});
  f.dom.craftExcess.dispatch("click");assert.equal(f.messages.at(-1)[1].token,"another-station");
  assert.match(f.dom.craftInfo.textContent,/Sold 6 excess items/);
});

test("research controls open on their station and hide unrelated drill settings",()=>{
  const f=fixture(),state={visible:true,token:"campaign:study:1",station:{id:1,kind:8,name:"Research station"},enabled:true,busy:false,error:false,message:"Research: Manual · Team"};
  f.handlers["study-status"](state);f.handlers["craft-status"]({visible:false});
  assert.equal(f.dom.studyToggle.textContent,"Research station #1 · Automation ▾");assert.equal(f.dom.craftPanel,undefined);
  assert.equal(f.dom.studyBody.hidden,false);assert.equal(f.dom.studyLabels.research.hidden,false);
  assert.equal(f.dom.studyLabels.drill.hidden,true);assert.equal(f.dom.studyJobsBox.hidden,true);
  assert.equal(f.dom.studyLabels.drill.style.display,"none");assert.equal(f.dom.studyLabels.research.style.display,"block");
  assert.equal(f.dom.studyInputs.research.checked,true);assert.equal(f.dom.studyInputs.drill.disabled,true);
  f.dom.studyInputs.research.checked=false;f.dom.studyInputs.research.dispatch("change");
  assert.deepEqual(f.messages.at(-1),["study-enabled",{token:state.token,kind:"research",enabled:false}]);
  assert.equal(f.dom.studyInfo.textContent,state.message);
  assert.match(f.dom.studyHelp.textContent,/Research Tech can reach the full academy cap/);
  assert.match(f.dom.studyHelp.textContent,/60 → 120 → 180 → 240 → 300/);
  assert.match(f.dom.studyHelp.textContent,/Logging Tech → Barracks Tech → Training Tech → Mining Tech → Great Hall Tech → Recruit Tech/);
  const before=f.messages.length;f.dom.studyInputs.drill.dispatch("change");assert.equal(f.messages.length,before);
  f.handlers["study-status"]({...state,busy:true});const count=f.messages.length;
  f.dom.studyInputs.research.dispatch("change");assert.equal(f.messages.length,count);assert.equal(f.dom.studyInputs.research.disabled,true);
  f.handlers["study-status"]({visible:false});f.dom.studyInputs.research.dispatch("change");
  assert.equal(f.messages.length,count);assert.equal(f.dom.studyPanel.hidden,true);
});

test("switching drill stations restores their own checkboxes and ignores hidden controls",()=>{
  const f=fixture(),state={visible:true,token:"campaign:study:2",station:{id:2,kind:9,name:"Drill station"},enabled:true,busy:false,error:false,message:"Drill: Auto",
    drillJobs:[{id:32,name:"Blade master",family:1,selected:true},{id:44,name:"Forge master",family:4,selected:false}]};
  f.handlers["study-status"](state);
  const inputs=f.dom.studyJobInputs;
  assert.equal(f.dom.studyLabels.research.hidden,true);assert.equal(f.dom.studyLabels.drill.hidden,false);
  assert.equal(f.dom.studyLabels.research.style.display,"none");assert.equal(f.dom.studyLabels.drill.style.display,"block");
  assert.equal(f.dom.studyJobsBox.hidden,false);assert.equal(inputs[32].checked,true);assert.equal(inputs[44].checked,false);
  inputs[44].checked=true;inputs[44].dispatch("change");
  assert.deepEqual(f.messages.at(-1),["study-drill-job",{token:state.token,id:44,enabled:true}]);
  f.dom.studyToggle.dispatch("click");assert.equal(f.dom.studyBody.hidden,true);
  f.handlers["study-status"]({...state,token:"campaign:study:3",station:{...state.station,id:3},enabled:false,
    drillJobs:state.drillJobs.map(job=>({...job,selected:job.id===44}))});
  assert.equal(f.dom.studyBody.hidden,false);assert.match(f.dom.studyToggle.textContent,/Drill station #3/);
  assert.equal(f.dom.studyInputs.drill.checked,false);
  assert.equal(f.dom.studyJobInputs,inputs,"status updates preserve focused controls");
  assert.equal(inputs[32].checked,false);assert.equal(inputs[44].checked,true);assert.equal(inputs[32].disabled,false);
  inputs[44].checked=false;inputs[44].dispatch("change");
  assert.equal(f.messages.at(-1)[1].token,"campaign:study:3");
  for(const change of [{busy:true},{error:true},{visible:false},{station:{id:1,kind:8,name:"Research station"}}]){
    f.handlers["study-status"]({...state,...change});const count=f.messages.length;inputs[32].dispatch("change");
    assert.equal(f.messages.length,count);
  }
  f.handlers["study-status"]({...state,drillJobs:[{id:45,name:"Artisan",family:4,selected:true}]});
  assert.deepEqual(Object.keys(f.dom.studyJobInputs),["45"]);assert.equal(f.dom.studyJobInputs[45].checked,true);
});

test("station study controls contain input and only one station popup is visible",()=>{
  const f=fixture(),state={visible:true,token:"study:1",station:{id:1,kind:8,name:"Research station"},enabled:true,busy:false,error:false,message:""};
  f.handlers["craft-status"](craftState);f.handlers["study-status"](state);
  assert.equal(f.dom.craftPanel.hidden,true);assert.equal(f.dom.studyPanel.hidden,false);
  for(const event of ["pointerdown","pointerup","click","keydown","keyup","wheel"]) assert.equal(f.dom.studyPanel.dispatch(event).stopped,true);
  f.document.activeElement=f.dom.studyInputs.research;f.window.dispatch("keydown",{code:"KeyC"});
  assert.equal(f.messages.at(-1)[0],"cancel");
  f.handlers["craft-status"](craftState);assert.equal(f.dom.studyPanel.hidden,true);assert.equal(f.dom.craftPanel.hidden,false);
});

test("selecting another station opens its own settings and discards unapplied edits",()=>{
  const f=fixture();f.handlers["craft-status"](craftState);f.dom.craftTier.value="9";
  f.dom.craftToggle.dispatch("click");assert.equal(f.dom.craftBody.hidden,true);
  const second={...craftState,token:"campaign:layout:4",station:{id:4,kind:5,name:"Crafting station"},options:{...craftState.options,tier:2}};
  f.handlers["craft-status"](second);assert.equal(f.dom.craftBody.hidden,false);assert.equal(f.dom.craftTier.value,"2");
  assert.match(f.dom.craftToggle.textContent,/Crafting station #4/);
  f.dom.craftButton.dispatch("click");assert.equal(f.messages.at(-1)[1].token,second.token);
  f.dom.craftTier.value="7";f.handlers["craft-status"]({visible:false});f.handlers["craft-status"](second);
  assert.equal(f.dom.craftTier.value,"2");assert.equal(f.dom.craftBody.hidden,false);
});
test("breweries offer repeat or lowest-stock automation with their own multiplier and pause",()=>{
  const f=fixture();f.handlers["craft-status"]({...craftState,station:{id:5,kind:6,name:"Brewery"}});
  assert.equal(f.dom.craftGear.hidden,true);assert.equal(f.dom.craftMode.disabled,false);assert.equal(f.dom.craftPause.disabled,false);
  assert.deepEqual(f.dom.craftMode.children.filter(o=>!o.hidden).map(o=>o.value),["repeat","brew"]);
  f.dom.craftMode.value="brew";f.dom.craftMode.dispatch("change");
  assert.equal(f.dom.craftBrew.hidden,false);assert.equal(f.dom.craftBrewMultiplier.disabled,false);
  assert.equal(f.dom.craftButton.textContent,"Apply / Start");
  f.dom.craftBrewMultiplier.value="10";f.dom.craftButton.dispatch("click");
  assert.equal(f.messages.at(-1)[0],"craft-configure");assert.equal(f.messages.at(-1)[1].options.mode,"brew");
  assert.equal(f.messages.at(-1)[1].options.multiplier,10);assert.equal(f.messages.at(-1)[1].options.keepLimit,null);
  f.handlers["craft-status"]({...craftState,station:{id:5,kind:6,name:"Brewery"},message:"Still waiting"});
  assert.equal(f.dom.craftMode.value,"brew");assert.equal(f.dom.craftBrewMultiplier.value,"10");
  assert.equal(f.dom.craftInfo.textContent,"Still waiting");
  f.dom.craftPause.dispatch("click");assert.equal(f.messages.at(-1)[0],"craft-pause");
  f.handlers["craft-status"]({...craftState,token:"forge",station:{id:3,kind:4,name:"Forge"}});
  assert.equal(f.dom.craftGear.hidden,false);assert.equal(f.dom.craftMode.disabled,false);
  assert.equal(f.dom.craftBrew.hidden,true);assert.deepEqual(f.dom.craftMode.children.filter(o=>!o.hidden).map(o=>o.value),["repeat","sets"]);
});
test("forge output offers All, Weapon only and No weapon, and is saved only for forges",()=>{
  const f=fixture();f.handlers["craft-status"](craftState);
  assert.equal(f.dom.craftForgeLabel.hidden,false);assert.equal(f.dom.craftForgeOutput.disabled,true);assert.equal(f.dom.craftForgeOutput.value,"all");
  assert.deepEqual(Array.from(f.dom.craftForgeOutput.children,c=>c.textContent),["All","Weapon only","No weapon"]);
  f.dom.craftMode.value="sets";f.dom.craftMode.dispatch("change");assert.equal(f.dom.craftForgeOutput.disabled,false);
  for(const output of ["weapons","hands","all"]) {
    f.dom.craftForgeOutput.value=output;f.handlers["craft-status"]({...craftState,message:"Updated"});
    assert.equal(f.dom.craftForgeOutput.value,output);f.dom.craftButton.dispatch("click");assert.equal(f.messages.at(-1)[1].options.forgeOutput,output);
  }
  const stored={...craftState,options:{...craftState.options,mode:"sets",forgeOutput:"hands"}};
  f.handlers["craft-status"](stored);assert.equal(f.dom.craftForgeOutput.value,"hands");
  for(const kind of [5,6]) {
    f.handlers["craft-status"]({...stored,token:`station:${kind}`,station:{id:kind,kind,name:"Station"}});
    assert.equal(f.dom.craftForgeLabel.hidden,true);assert.equal(f.dom.craftForgeOutput.disabled,true);
    f.dom.craftButton.dispatch("click");assert.equal(f.messages.at(-1)[1].options.forgeOutput,"all");
  }
});
