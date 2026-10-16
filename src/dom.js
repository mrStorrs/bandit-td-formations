(() => {
  "use strict";
  class FormationsDOM extends self.DOMHandler {
    constructor(runtimeInterface) {
      super(runtimeInterface, "cjs-formations");
      this.ready = false;
      this.held = new Set();
      this.AddRuntimeMessageHandlers([
        ["ready", ({ version }) => {
          this.ready = true;
          this.notify(`Formations ready · v${version} · Hold 1–4 to save, tap to restore · C combat · F6 Ink Forest loop (default ON).`);
        }],
        ["notify", ({ text }) => this.notify(text)],
        ["forest-status", ({ text }) => this.forestStatus(text)],
      ]);
    }
    Attach() {
      const editable = element => element?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element?.tagName);
      const cancel = () => {
        this.held.clear();
        if (this.ready) this.PostToRuntime("cancel", {});
      };
      window.addEventListener("keydown", e => {
        if (!this.ready) return;
        if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || e.isComposing || editable(document.activeElement)) { cancel(); return; }
        const match = /^Digit([1-4])$/.exec(e.code);
        if (!match && e.code !== "KeyC" && e.code !== "F6") return;
        // C is also the native character-menu shortcut. Capture it before the
        // engine's bubbling keyboard listener so one press has one effect.
        if (e.code === "KeyC" || e.code === "F6") { e.preventDefault(); e.stopImmediatePropagation(); }
        if (e.repeat || this.held.has(e.code)) return;
        this.held.add(e.code);
        if (this.held.size > 1) { this.PostToRuntime("cancel", {}); return; }
        if (e.code === "KeyC") this.PostToRuntime("combat", {});
        else if (e.code === "F6") this.PostToRuntime("forest", {});
        else this.PostToRuntime("key", { phase: "down", slot: Number(match[1]) });
      }, true);
      window.addEventListener("keyup", e => {
        if (!this.ready || !this.held.delete(e.code)) return;
        if (e.code === "KeyC" || e.code === "F6") { e.preventDefault(); e.stopImmediatePropagation(); return; }
        if (editable(document.activeElement) || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) { cancel(); return; }
        this.PostToRuntime("key", { phase: "up", slot: Number(e.code.slice(-1)) });
      }, true);
      window.addEventListener("blur", cancel);
      document.addEventListener("visibilitychange", () => { if (document.hidden) cancel(); });
      document.addEventListener("focusin", e => { if (editable(e.target)) cancel(); });
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
