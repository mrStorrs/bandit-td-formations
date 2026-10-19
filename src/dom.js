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
          this.notify(`Formations ready · v${version} · Hold 1–4 to save, tap to restore · Shift + 1–4 buildings · C combat · F6 Beast realm loop (default ON).`);
        }],
        ["notify", ({ text }) => this.notify(text)],
        ["forest-status", ({ text }) => this.forestStatus(text)],
        ["recruit-status", state => this.recruitStatus(state)],
        ["outfit-status", state => this.outfitStatus(state)],
        ["craft-status", state => this.craftStatus(state)],
        ["study-status", state => this.studyStatus(state)],
      ]);
    }
    Attach() {
      const editable = element => element?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element?.tagName) || this.recruitPanel?.contains(element) || this.outfitPanel?.contains(element) || this.craftPanel?.contains(element) || this.studyPanel?.contains(element);
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
    craftStatus(state) {
      this.craftState = state;
      if (!state.visible) { if (this.craftPanel) this.craftPanel.hidden = true; this.craftSelection = null; this.craftSettings = null; return; }
      if (!this.craftPanel) {
        const make = (tag, text, parent) => {
          const element = document.createElement(tag); element.textContent = text;
          if (parent) parent.appendChild(element);
          return element;
        };
        const panel = this.craftPanel = make("section", "");
        panel.id = "cjs-crafting"; panel.setAttribute("aria-label", "Station crafting");
        panel.style.cssText = "position:fixed;top:64px;right:12px;z-index:2147483646;background:#152025f5;color:#fff;padding:10px 14px;border:1px solid #c0a35b;border-radius:6px;font:14px sans-serif;max-width:calc(100vw - 60px);box-shadow:0 3px 16px #0008";
        const toggle = this.craftToggle = make("button", "", panel);
        toggle.id = "cjs-craft-open"; toggle.type = "button"; toggle.setAttribute("aria-expanded", "true");
        toggle.style.cssText = "background:transparent;color:#fff;border:0;padding:3px;cursor:pointer;font:inherit";
        const body = this.craftBody = make("div", "", panel);
        body.hidden = false; body.style.cssText = "width:330px;max-width:100%;max-height:calc(100vh - 260px);overflow:auto;padding-top:10px";
        toggle.addEventListener("click", () => {
          body.hidden = !body.hidden; toggle.textContent = `${this.craftTitle} ${body.hidden ? "▸" : "▾"}`;
          toggle.setAttribute("aria-expanded", String(!body.hidden));
        });
        const select = (title, id, options, parent = body) => {
          const label = make("label", title + " ", parent); label.style.cssText = "display:block;margin:0 0 9px";
          const input = make("select", "", label); input.id = id; input.style.cssText = "font:inherit;max-width:100%";
          for (const [value, text] of options) make("option", text, input).value = String(value);
          return input;
        };
        make("div", "Settings apply only to this station.", body).style.cssText = "margin-bottom:10px;color:#c5ced1";
        this.craftMode = select("Mode", "cjs-craft-mode", [["repeat", "Repeat current ×10"], ["sets", "Auto-all sets"]]);
        this.craftGear = make("div", "", body);
        const gearSelect = (title, id, options) => select(title, id, options, this.craftGear);
        this.craftLoop = gearSelect("Loop", "cjs-craft-loop", [["all", "Cycle checked roles"], ...state.roles.map(r => [r.id, r.name])]);
        make("div", "Choose a single role to repeat only that set. Combat weapons: STR spear, AGI bow, INT fan.", this.craftGear).style.cssText = "margin:-3px 0 10px;color:#c5ced1;font-size:12px";
        this.craftForgeLabel = make("label", "Forge output ", this.craftGear); this.craftForgeLabel.style.cssText = "display:block;margin-bottom:10px";
        this.craftForgeOutput = make("select", "", this.craftForgeLabel); this.craftForgeOutput.id = "cjs-craft-forge-output";
        this.craftForgeOutput.style.cssText = "font:inherit;max-width:100%";
        for (const [value, text] of [["all", "All"], ["weapons", "Weapon only"], ["hands", "No weapon"]]) make("option", text, this.craftForgeOutput).value = value;
        this.craftTier = gearSelect("Tier", "cjs-craft-tier", Array.from({ length: 9 }, (_, i) => [i + 1, `T${i + 1}`]));
        this.craftMinimum = gearSelect("Minimum rarity", "cjs-craft-minimum", ["White", "Green", "Blue", "Purple", "Gold", "Red"].map((name, i) => [i + 1, `${i + 1} · ${name} or better`]));
        this.craftMultiplier = gearSelect("Materials per craft", "cjs-craft-multiplier", [1, 10, 100].map(n => [n, `×${n}`]));
        const roles = make("fieldset", "", this.craftGear);
        roles.style.cssText = "border:1px solid #5a676d;margin:0 0 10px;padding:8px";
        make("legend", "Roles to cycle", roles);
        const grid = make("div", "", roles); grid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:7px";
        this.craftRoles = {};
        for (const role of state.roles) {
          const label = make("label", "", grid), input = make("input", "", label);
          input.type = "checkbox"; input.id = `cjs-craft-role-${role.id}`; this.craftRoles[role.id] = input;
          make("span", ` ${role.name}${role.combat ? "" : " · " + ["", "STR", "AGI", "INT"][role.stat]}`, label);
        }
        const sellLabel = make("label", "", this.craftGear); sellLabel.style.cssText = "display:block;margin-bottom:10px";
        this.craftSell = make("input", "", sellLabel); this.craftSell.type = "checkbox"; this.craftSell.id = "cjs-craft-sell";
        make("span", " Auto-sell non-matching crafts", sellLabel);
        this.craftButton = make("button", "Apply / Start", body); this.craftButton.id = "cjs-craft-apply"; this.craftButton.type = "button";
        this.craftButton.style.cssText = "background:#c0a35b;color:#10191d;border:0;border-radius:4px;padding:7px 12px;cursor:pointer;font:inherit";
        this.craftPause = make("button", "Pause", body); this.craftPause.id = "cjs-craft-pause"; this.craftPause.type = "button";
        this.craftPause.style.cssText = "margin-left:8px;padding:7px 12px;cursor:pointer;font:inherit";
        this.craftInfo = make("div", "", body); this.craftInfo.setAttribute("role", "status");
        this.craftInfo.style.cssText = "margin-top:10px;line-height:1.4;white-space:pre-line";
        make("div", "This station makes its own pieces in batches of 10. Checked roles and Loop choose what to craft. Gear matching any job or combat role at this tier and minimum rarity is kept and locked, including unchecked roles. Auto-sell affects only this station’s new Auto-all crafts. Changes apply after the current queue finishes.", this.craftGear).style.cssText = "margin-top:8px;color:#c5ced1;font-size:12px;line-height:1.4";
        const controls = () => {
          const busy = this.craftState.busy || this.craftState.error, gear = this.craftState.station.kind !== 6;
          const sets = gear && this.craftMode.value === "sets";
          this.craftMode.disabled = this.craftState.busy || !gear;
          this.craftGear.hidden = !gear;
          this.craftForgeLabel.hidden = this.craftState.station.kind !== 4;
          this.craftForgeOutput.disabled = this.craftState.busy || !sets || this.craftState.station.kind !== 4;
          for (const input of [this.craftLoop, this.craftTier, this.craftMinimum, this.craftMultiplier]) input.disabled = this.craftState.busy || !sets;
          for (const input of Object.values(this.craftRoles)) input.disabled = this.craftState.busy || !sets || this.craftLoop.value !== "all";
          this.craftSell.disabled = busy || !sets;
          this.craftButton.disabled = this.craftState.busy;
          this.craftButton.textContent = sets ? "Apply / Start" : "Apply repeat ×10";
          this.craftPause.disabled = busy || !this.craftState.enabled;
        };
        this.updateCraftControls = controls;
        this.craftMode.addEventListener("change", controls); this.craftLoop.addEventListener("change", controls);
        this.craftSell.addEventListener("change", () => {
          if (this.craftState.visible && this.craftState.running && !this.craftState.busy) this.PostToRuntime("craft-sell", { token: this.craftState.token, autoSell: this.craftSell.checked });
        });
        this.craftButton.addEventListener("click", () => {
          if (!this.craftState.visible || this.craftState.busy) return;
          this.PostToRuntime("cancel", {});
          this.PostToRuntime("craft-configure", { token: this.craftState.token, options: {
            mode: this.craftMode.value, loop: this.craftLoop.value, roles: Object.keys(this.craftRoles).filter(id => this.craftRoles[id].checked),
            tier: Number(this.craftTier.value), minimum: Number(this.craftMinimum.value), multiplier: Number(this.craftMultiplier.value), autoSell: this.craftSell.checked,
            forgeOutput: this.craftState.station.kind === 4 ? this.craftForgeOutput.value : "all",
          } });
        });
        this.craftPause.addEventListener("click", () => {
          if (!this.craftState.visible || this.craftState.busy || !this.craftState.enabled) return;
          this.PostToRuntime("cancel", {});
          this.PostToRuntime("craft-pause", { token: this.craftState.token });
        });
        for (const event of ["pointerdown", "pointerup", "pointermove", "pointerrawupdate", "pointercancel", "mousedown", "mouseup", "mousemove", "click", "dblclick", "touchstart", "touchend", "touchmove", "touchcancel", "keydown", "keyup", "wheel"]) panel.addEventListener(event, e => e.stopPropagation());
        document.body.appendChild(panel);
      }
      if (this.craftSelection !== state.token) {
        this.craftSelection = state.token; this.craftBody.hidden = false; this.craftBody.scrollTop = 0;
        if (this.studyBody) { this.studyBody.hidden = true; this.studyToggle.textContent = "Research & drilling ▸"; this.studyToggle.setAttribute("aria-expanded", "false"); }
      }
      this.craftTitle = `${state.station.name} #${state.station.id} · Automation`;
      this.craftToggle.textContent = `${this.craftTitle} ${this.craftBody.hidden ? "▸" : "▾"}`;
      this.craftToggle.setAttribute("aria-expanded", String(!this.craftBody.hidden));
      this.craftPanel.hidden = false;
      const settings = JSON.stringify([state.token, state.options]);
      if (settings !== this.craftSettings) {
        this.craftSettings = settings;
        const o = state.options;
        this.craftMode.value = o.mode; this.craftLoop.value = o.loop; this.craftTier.value = String(o.tier);
        this.craftMinimum.value = String(o.minimum); this.craftMultiplier.value = String(o.multiplier); this.craftSell.checked = o.autoSell;
        this.craftForgeOutput.value = o.forgeOutput || "all";
        for (const [id, input] of Object.entries(this.craftRoles)) input.checked = o.roles.includes(id);
      }
      this.updateCraftControls();
      this.craftInfo.textContent = `${state.message} · ${state.kept} kept · ${state.sold} sold this session`;
    }
    studyStatus(state) {
      this.studyState = state;
      if (!state.visible) { if (this.studyPanel) this.studyPanel.hidden = true; return; }
      if (!this.studyPanel) {
        const panel = this.studyPanel = document.createElement("section");
        panel.id = "cjs-study"; panel.setAttribute("aria-label", "Research and drilling");
        panel.style.cssText = "position:fixed;bottom:12px;right:12px;z-index:2147483646;background:#152025f5;color:#fff;padding:10px 14px;border:1px solid #c0a35b;border-radius:6px;font:14px sans-serif;max-width:calc(100vw - 60px);box-shadow:0 3px 16px #0008";
        const toggle = this.studyToggle = document.createElement("button");
        toggle.id = "cjs-study-open"; toggle.type = "button"; toggle.textContent = "Research & drilling ▸"; toggle.setAttribute("aria-expanded", "false");
        toggle.style.cssText = "background:transparent;color:#fff;border:0;padding:3px;cursor:pointer;font:inherit";
        panel.appendChild(toggle);
        const body = this.studyBody = document.createElement("div");
        body.hidden = true; body.style.cssText = "width:330px;max-width:100%;max-height:calc(100vh - 110px);overflow:auto;padding-top:10px";
        panel.appendChild(body);
        toggle.addEventListener("click", () => {
          body.hidden = !body.hidden; toggle.textContent = body.hidden ? "Research & drilling ▸" : "Research & drilling ▾";
          toggle.setAttribute("aria-expanded", String(!body.hidden));
          if (!body.hidden && this.craftBody) { this.craftBody.hidden = true; this.craftToggle.textContent = `${this.craftTitle} ▸`; this.craftToggle.setAttribute("aria-expanded", "false"); }
        });
        this.studySection = document.createElement("fieldset"); this.studySection.style.cssText = "border:1px solid #5a676d;margin:0;padding:8px";
        body.appendChild(this.studySection);
        for (const event of ["pointerdown", "pointerup", "pointermove", "pointerrawupdate", "pointercancel", "mousedown", "mouseup", "mousemove", "click", "dblclick", "touchstart", "touchend", "touchmove", "touchcancel", "keydown", "keyup", "wheel"]) panel.addEventListener(event, e => e.stopPropagation());
        document.body.appendChild(panel);
      }
      this.studyPanel.hidden = false;
      if (!this.studyInputs) {
        const make = (tag, text, parent = this.studySection) => {
          const element = document.createElement(tag); element.textContent = text;
          parent.appendChild(element); return element;
        };
        make("legend", "Research & drilling");
        this.studyInputs = {};
        for (const [kind, title] of [["research", "Auto research"], ["drill", "Auto drill"]]) {
          const label = make("label", ""); label.style.cssText = "display:block;margin-bottom:7px";
          const input = make("input", "", label); input.type = "checkbox"; input.id = `cjs-study-${kind}`;
          this.studyInputs[kind] = input; make("span", " " + title, label);
          input.addEventListener("change", () => {
            if (!this.studyState.visible || this.studyState.busy || this.studyState.error) return;
            this.PostToRuntime("cancel", {});
            this.PostToRuntime("study-enabled", { token: this.studyState.token, kind, enabled: input.checked });
          });
        }
        this.studyJobsBox = make("div", "");
        this.studyInfo = make("div", ""); this.studyInfo.setAttribute("role", "status");
        this.studyInfo.style.cssText = "white-space:pre-line;line-height:1.4;margin:8px 0";
        make("div", "Research: finish the current tree, then prioritize the Research bonus, regular unlocks, and Team → Gather → Growth → Cultivate → Craft. Each tree runs to its current cap. Drill: follow the checked end jobs, lowest unlocked class tier first. Train prerequisites only to the next job's unlock level; end jobs stop at level 1. Manual choices train to their normal cap. Turning off Auto drill stops new selections; active auto drills still stop at their unlock level.").style.cssText = "color:#c5ced1;font-size:12px;line-height:1.4";
      }
      for (const [kind, input] of Object.entries(this.studyInputs)) {
        input.checked = state.enabled[kind]; input.disabled = state.busy || state.error;
      }
      this.updateStudyJobs(state);
      this.studyInfo.textContent = state.message;
    }
    updateStudyJobs(state) {
      const jobs = state.drillJobs || [], catalog = JSON.stringify(jobs.map(({ id, name, family }) => [id, name, family]));
      if (catalog !== this.studyJobCatalog) {
        this.studyJobCatalog = catalog; this.studyJobsBox.replaceChildren(); this.studyJobInputs = {};
        const make = (tag, text, parent = this.studyJobsBox) => {
          const element = document.createElement(tag); element.textContent = text; parent.appendChild(element); return element;
        };
        make("div", "Drill toward these end jobs").style.cssText = "font-weight:bold;margin:10px 0 6px";
        make("div", "Only checked jobs and their prerequisites are trained. Unchecking a path refunds its unused auto order; manual training continues. Select none to leave auto drilling idle.").style.cssText = "color:#c5ced1;font-size:12px;line-height:1.4;margin-bottom:8px";
        for (const family of [...new Set(jobs.map(job => job.family))].sort((a, b) => a - b)) {
          const group = make("fieldset", ""); group.style.cssText = "border:1px solid #5a676d;margin:6px 0;padding:6px 8px";
          make("legend", ({ 1: "STR", 2: "AGI", 3: "INT", 4: "Production" })[family] || "Other jobs", group);
          for (const job of jobs.filter(job => job.family === family)) {
            const label = make("label", "", group); label.style.cssText = "display:flex;align-items:center;gap:6px;margin:5px 0";
            const input = make("input", "", label); input.type = "checkbox"; input.id = `cjs-drill-job-${job.id}`;
            this.studyJobInputs[job.id] = input; make("span", job.name, label);
            input.addEventListener("change", () => {
              if (!this.studyState.visible || this.studyState.busy || this.studyState.error) return;
              this.PostToRuntime("cancel", {});
              this.PostToRuntime("study-drill-job", { token: this.studyState.token, id: job.id, enabled: input.checked });
            });
          }
        }
      }
      for (const job of jobs) {
        const input = this.studyJobInputs[job.id]; input.checked = job.selected; input.disabled = state.busy || state.error;
      }
    }
    outfitStatus(state) {
      this.outfitState = state;
      if (!state.visible) { if (this.outfitPanel) this.outfitPanel.hidden = true; return; }
      if (!this.outfitPanel) {
        const make = (tag, text, parent) => {
          const element = document.createElement(tag);
          element.textContent = text;
          if (parent) parent.appendChild(element);
          return element;
        };
        const panel = this.outfitPanel = make("section", "");
        panel.id = "cjs-outfits";
        panel.setAttribute("aria-label", "Job outfits");
        panel.style.cssText = "position:fixed;bottom:55px;left:12px;z-index:2147483646;background:#152025f5;color:#fff;padding:12px 16px;border:1px solid #c0a35b;border-radius:6px;font:14px sans-serif;width:220px;max-width:calc(100vw - 60px);box-shadow:0 3px 16px #0008";
        this.outfitTitle = make("strong", "Job outfits", panel);
        this.outfitInfo = make("div", "", panel);
        this.outfitInfo.style.cssText = "margin:8px 0;line-height:1.4";
        this.outfitInfo.setAttribute("role", "status");
        const row = make("div", "", panel);
        row.style.cssText = "display:flex;gap:8px;flex-wrap:wrap";
        this.outfitSave = make("button", "Save outfit", row);
        this.outfitSave.id = "cjs-outfit-save";
        this.outfitForget = make("button", "Forget", row);
        this.outfitForget.id = "cjs-outfit-forget";
        for (const [action, button] of [["save", this.outfitSave], ["forget", this.outfitForget]]) {
          button.type = "button";
          button.style.cssText = "background:#c0a35b;color:#10191d;border:0;border-radius:4px;padding:7px 10px;cursor:pointer;font:inherit";
          button.addEventListener("click", () => {
            if (!this.outfitState?.visible || this.outfitState.busy || this.outfitState.error) return;
            this.PostToRuntime("cancel", {});
            this.PostToRuntime(`outfit-${action}`, { token: this.outfitState.token });
          });
        }
        const label = make("label", "", panel);
        label.style.cssText = "display:block;margin-top:10px";
        this.outfitEnabled = make("input", "", label);
        this.outfitEnabled.type = "checkbox"; this.outfitEnabled.id = "cjs-outfit-enabled";
        make("span", " Auto-equip saved job outfits", label);
        this.outfitEnabled.addEventListener("change", () => {
          this.PostToRuntime("outfit-enabled", { token: this.outfitState.token, enabled: this.outfitEnabled.checked });
        });
        make("div", "Choose a job, equip your gear, then Save. Jobs without a saved outfit keep current gear.", panel).style.cssText = "margin-top:7px;color:#c5ced1;font-size:12px;line-height:1.4";
        for (const event of ["pointerdown", "pointerup", "pointermove", "pointerrawupdate", "pointercancel", "mousedown", "mouseup", "mousemove", "click", "dblclick", "touchstart", "touchend", "touchmove", "touchcancel", "keydown", "keyup", "wheel"]) {
          panel.addEventListener(event, e => e.stopPropagation());
        }
        document.body.appendChild(panel);
      }
      this.outfitPanel.hidden = false;
      this.outfitTitle.textContent = `${state.name} · ${state.jobName}`;
      this.outfitSave.textContent = `Save outfit for ${state.jobName}`;
      this.outfitInfo.textContent = state.error || (state.busy ? "Updating outfit…" : state.saved ? "Outfit saved for this character and job." : "No saved outfit for this job.");
      this.outfitSave.disabled = this.outfitEnabled.disabled = state.busy || !!state.error;
      this.outfitForget.disabled = state.busy || !!state.error || !state.saved;
      this.outfitEnabled.checked = state.enabled;
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
        make("option", "Off", this.recruitGrade).value = "0";
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
        const statRow = make("div", "", panel);
        statRow.style.cssText = "display:flex;gap:12px;flex-wrap:wrap;margin-top:10px";
        this.recruitStats = {};
        for (const stat of ["str", "agi", "int"]) {
          const label = make("label", `${stat.toUpperCase()} over `, statRow);
          const input = this.recruitStats[stat] = make("input", "", label);
          input.id = `cjs-recruit-${stat}`;
          input.type = "number"; input.min = "0"; input.step = "any";
          input.placeholder = "Off";
          input.style.cssText = "width:72px;font:inherit";
        }
        const moneyRow = make("div", "", panel);
        moneyRow.style.cssText = "margin-top:10px";
        const moneyLabel = make("label", "Minimum copper ", moneyRow);
        this.recruitMoney = make("input", "", moneyLabel);
        this.recruitMoney.id = "cjs-recruit-money";
        this.recruitMoney.type = "number"; this.recruitMoney.min = "0"; this.recruitMoney.step = "any";
        this.recruitMoney.placeholder = "0";
        this.recruitMoney.style.cssText = "width:120px;font:inherit";
        make("span", " Keep this much; blank or 0 = no reserve.", moneyRow).style.cssText = "color:#c5ced1;font-size:12px";
        this.recruitInfo = make("div", "", panel);
        this.recruitInfo.style.cssText = "margin-top:8px;line-height:1.4";
        this.recruitInfo.setAttribute("role", "status");
        make("div", "Stop on ANY target: work grade or better, OR a displayed stat above its number. Blank stat fields are off. Hire a match or Start rolling again to skip it. Manual locks are kept.", panel).style.cssText = "margin-top:5px;color:#c5ced1;font-size:12px";
        this.recruitOptions = { minimum: 5, method: 1, minimumMoney: 0, stats: { str: null, agi: null, int: null } };
        try {
          const saved = JSON.parse(localStorage.getItem("cjs-formations:recruit-options:v1"));
          if (Number.isInteger(saved?.minimum) && saved.minimum >= 0 && saved.minimum <= state.grades.length) this.recruitOptions.minimum = saved.minimum;
          if (Number.isInteger(saved?.method) && saved.method >= 1 && saved.method <= 5) this.recruitOptions.method = saved.method;
          if (Number.isFinite(saved?.minimumMoney) && saved.minimumMoney >= 0) this.recruitOptions.minimumMoney = saved.minimumMoney;
          for (const stat of Object.keys(this.recruitStats)) {
            if (Number.isFinite(saved?.stats?.[stat]) && saved.stats[stat] >= 0) this.recruitOptions.stats[stat] = saved.stats[stat];
          }
        } catch { /* A search still works when browser storage is unavailable. */ }
        this.recruitGrade.value = String(this.recruitOptions.minimum);
        this.recruitMoney.value = String(this.recruitOptions.minimumMoney);
        for (const [stat, input] of Object.entries(this.recruitStats)) input.value = this.recruitOptions.stats[stat] === null ? "" : String(this.recruitOptions.stats[stat]);
        const saveOptions = () => {
          const invalid = [...Object.values(this.recruitStats), this.recruitMoney].find(input => !input.checkValidity());
          if (invalid) { invalid.reportValidity(); return false; }
          this.recruitOptions = { minimum: Number(this.recruitGrade.value), method: Number(this.recruitMethod.value),
            minimumMoney: Number(this.recruitMoney.value),
            stats: Object.fromEntries(Object.entries(this.recruitStats).map(([stat, input]) => [stat, input.value === "" ? null : Number(input.value)])) };
          try { localStorage.setItem("cjs-formations:recruit-options:v1", JSON.stringify(this.recruitOptions)); } catch { /* Session settings remain usable. */ }
          return true;
        };
        this.recruitGrade.addEventListener("change", saveOptions);
        this.recruitMethod.addEventListener("change", saveOptions);
        this.recruitMoney.addEventListener("change", saveOptions);
        for (const input of Object.values(this.recruitStats)) input.addEventListener("change", saveOptions);
        this.recruitButton.addEventListener("click", () => {
          if (this.recruitState.running) this.PostToRuntime("recruit-stop", {});
          else {
            if (!saveOptions()) return;
            const criteria = this.recruitOptions.minimum ? [{ type: "work-grade", minimum: this.recruitOptions.minimum }] : [];
            for (const [stat, above] of Object.entries(this.recruitOptions.stats)) {
              if (above !== null) criteria.push({ type: "stat", stat, above });
            }
            this.PostToRuntime("cancel", {});
            this.PostToRuntime("recruit-start", { method: this.recruitOptions.method, criteria, minimumMoney: this.recruitOptions.minimumMoney });
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
      this.recruitGrade.disabled = this.recruitMethod.disabled = this.recruitMoney.disabled = state.running;
      for (const input of Object.values(this.recruitStats)) input.disabled = state.running;
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
