(() => {
  "use strict";
  class FormationsDOM extends self.DOMHandler {
    constructor(runtimeInterface) {
      super(runtimeInterface, "cjs-formations");
      this.ready = false;
      this.held = new Map();
      this.AddRuntimeMessageHandlers([
        ["ready", ({ version }) => {
          this.ready = true;
          this.notify(`Formations ready · v${version} · Hold 1–4 to save, tap to restore · Shift + 1–4 buildings · C combat · F6 Ink Forest loop (default ON).`);
        }],
        ["notify", ({ text }) => this.notify(text)],
        ["forest-status", ({ text }) => this.forestStatus(text)],
        ["recruit-status", state => this.recruitStatus(state)],
      ]);
    }
    Attach() {
      const editable = element => element?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element?.tagName) || this.recruitPanel?.contains(element);
      const cancel = () => {
        this.held.clear();
        if (this.ready) this.PostToRuntime("cancel", {});
      };
      window.addEventListener("keydown", e => {
        if (!this.ready) return;
        const match = /^Digit([1-4])$/.exec(e.code);
        if (e.ctrlKey || e.altKey || e.metaKey || (e.shiftKey && !match) || e.isComposing || editable(document.activeElement)) { cancel(); return; }
        if (!match && e.code !== "KeyC" && e.code !== "F6") return;
        // C is also the native character-menu shortcut. Capture it before the
        // engine's bubbling keyboard listener so one press has one effect.
        if (e.code === "KeyC" || e.code === "F6" || e.shiftKey) { e.preventDefault(); e.stopImmediatePropagation(); }
        if (e.repeat || this.held.has(e.code)) return;
        const channel = e.shiftKey ? "building-key" : "key";
        this.held.set(e.code, channel);
        if (this.held.size > 1) { this.PostToRuntime("cancel", {}); return; }
        if (e.code === "KeyC") this.PostToRuntime("combat", {});
        else if (e.code === "F6") this.PostToRuntime("forest", {});
        else this.PostToRuntime(channel, { phase: "down", slot: Number(match[1]) });
      }, true);
      window.addEventListener("keyup", e => {
        if (!this.ready || !this.held.has(e.code)) return;
        const channel = this.held.get(e.code);
        this.held.delete(e.code);
        if (e.code === "KeyC" || e.code === "F6") { e.preventDefault(); e.stopImmediatePropagation(); return; }
        if (channel === "building-key") { e.preventDefault(); e.stopImmediatePropagation(); }
        if (editable(document.activeElement) || e.ctrlKey || e.altKey || e.metaKey || (e.shiftKey && channel !== "building-key") || e.isComposing) { cancel(); return; }
        this.PostToRuntime(channel, { phase: "up", slot: Number(e.code.slice(-1)) });
      }, true);
      const loseFocus = () => {
        cancel();
        if (this.recruitState?.running) this.PostToRuntime("recruit-stop", {});
      };
      window.addEventListener("blur", loseFocus);
      document.addEventListener("visibilitychange", () => { if (document.hidden) loseFocus(); });
      document.addEventListener("focusin", e => { if (editable(e.target)) cancel(); });
    }
    recruitStatus(state) {
      this.recruitState = state;
      if (!state.visible) { if (this.recruitPanel) this.recruitPanel.hidden = true; return; }
      if (!this.recruitPanel) {
        const make = (tag, text, parent) => {
          const node = document.createElement(tag);
          if (text) node.textContent = text;
          if (parent) parent.appendChild(node);
          return node;
        };
        const panel = this.recruitPanel = make("section");
        panel.id = "cjs-recruit";
        panel.setAttribute("aria-label", "Auto recruit");
        panel.style.cssText = "position:fixed;bottom:12px;right:12px;z-index:2147483646;background:#152025f5;color:#fff;padding:12px 16px;border:1px solid #c0a35b;border-radius:6px;font:14px sans-serif;width:480px;max-width:calc(100vw - 60px);box-shadow:0 3px 16px #0008";
        const row = make("div", "", panel);
        row.style.cssText = "display:flex;align-items:end;gap:10px;flex-wrap:wrap";
        make("strong", "Auto recruit", row).style.cssText = "align-self:center";
        const gradeLabel = make("label", "Minimum grade ", row);
        this.recruitGrade = make("select", "", gradeLabel);
        this.recruitGrade.id = "cjs-recruit-grade";
        for (const [i, name] of state.grades.entries()) {
          const option = make("option", name, this.recruitGrade); option.value = String(i + 1);
        }
        const methodLabel = make("label", "Method ", row);
        this.recruitMethod = make("select", "", methodLabel);
        this.recruitMethod.id = "cjs-recruit-method";
        this.recruitMethod.style.maxWidth = "230px";
        this.recruitButton = make("button", "Start rolling", row);
        this.recruitButton.id = "cjs-recruit-toggle";
        this.recruitButton.type = "button";
        this.recruitButton.style.cssText = "background:#c0a35b;color:#10191d;border:0;border-radius:4px;padding:7px 12px;cursor:pointer;font:inherit";
        this.recruitInfo = make("div", "", panel);
        this.recruitInfo.style.cssText = "margin-top:8px;line-height:1.4";
        this.recruitInfo.setAttribute("role", "status");
        make("div", "Any work category at this grade or better. Matches are locked for you to hire.", panel).style.cssText = "margin-top:5px;color:#c5ced1;font-size:12px";
        this.recruitOptions = { minimum: 5, method: 1 };
        try {
          const saved = JSON.parse(localStorage.getItem("cjs-formations:recruit-options:v1"));
          if (Number.isInteger(saved?.minimum) && saved.minimum >= 1 && saved.minimum <= state.grades.length) this.recruitOptions.minimum = saved.minimum;
          if (Number.isInteger(saved?.method) && saved.method >= 1 && saved.method <= 5) this.recruitOptions.method = saved.method;
        } catch { /* A search still works when browser storage is unavailable. */ }
        this.recruitGrade.value = String(this.recruitOptions.minimum);
        const saveOptions = () => {
          this.recruitOptions = { minimum: Number(this.recruitGrade.value), method: Number(this.recruitMethod.value) };
          try { localStorage.setItem("cjs-formations:recruit-options:v1", JSON.stringify(this.recruitOptions)); } catch { /* Session settings remain usable. */ }
        };
        this.recruitGrade.addEventListener("change", saveOptions);
        this.recruitMethod.addEventListener("change", saveOptions);
        this.recruitButton.addEventListener("click", () => {
          if (this.recruitState.running) this.PostToRuntime("recruit-stop", {});
          else {
            saveOptions();
            this.PostToRuntime("cancel", {});
            this.PostToRuntime("recruit-start", { method: this.recruitOptions.method,
              criteria: [{ type: "work-grade", minimum: this.recruitOptions.minimum }] });
          }
        });
        for (const event of ["pointerdown", "pointerup", "pointermove", "pointerrawupdate", "pointercancel", "mousedown", "mouseup", "mousemove", "click", "dblclick", "touchstart", "touchend", "touchmove", "touchcancel", "keydown", "keyup", "wheel"]) {
          panel.addEventListener(event, e => e.stopPropagation());
        }
        document.body.appendChild(panel);
      }
      this.recruitPanel.hidden = false;
      const methods = JSON.stringify(state.methods);
      if (methods !== this.recruitMethods) {
        this.recruitMethods = methods;
        this.recruitMethod.replaceChildren();
        for (const method of state.methods) {
          const option = document.createElement("option");
          option.value = String(method.id);
          option.textContent = `${method.name} · ${method.cost.toLocaleString()} copper/roll`;
          this.recruitMethod.appendChild(option);
        }
        if (state.methods.some(m => m.id === this.recruitOptions.method)) this.recruitMethod.value = String(this.recruitOptions.method);
      }
      this.recruitGrade.disabled = this.recruitMethod.disabled = state.running;
      this.recruitButton.disabled = !state.running && !state.methods.length;
      this.recruitButton.textContent = state.running ? "Stop" : "Start rolling";
      this.recruitInfo.textContent = `${state.message} · ${state.rolls} rolls · ${state.spent.toLocaleString()} copper spent` +
        (state.methods.length ? "" : " · Unlock paid recruitment refreshes to start.");
    }
    forestStatus(text) {
      if (!this.forestBadge) {
        this.forestBadge = document.createElement("div");
        this.forestBadge.setAttribute("role", "status");
        this.forestBadge.style.cssText = "position:fixed;bottom:12px;left:12px;z-index:2147483646;pointer-events:none;background:#152025ed;color:#fff;padding:8px 12px;border:1px solid #c0a35b;border-radius:6px;font:14px sans-serif;max-width:65vw";
        document.body.appendChild(this.forestBadge);
      }
      this.forestBadge.textContent = text || "";
      this.forestBadge.hidden = !text;
    }
    notify(text) {
      if (!this.toast) {
        this.toast = document.createElement("div");
        this.toast.setAttribute("role", "status");
        this.toast.style.cssText = "position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483647;pointer-events:none;background:#152025ed;color:#fff;padding:12px 20px;border:1px solid #c0a35b;border-radius:6px;font:16px sans-serif;max-width:80vw;text-align:center;box-shadow:0 3px 16px #0008";
        document.body.appendChild(this.toast);
      }
      clearTimeout(this.hideTimer);
      this.toast.textContent = text;
      this.toast.hidden = false;
      this.hideTimer = setTimeout(() => { this.toast.hidden = true; }, 3500);
    }
  }
  self.RuntimeInterface.AddDOMHandlerClass(FormationsDOM);
})();
