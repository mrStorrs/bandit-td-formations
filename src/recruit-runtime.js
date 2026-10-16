(() => {
  "use strict";
  function attachRecruitment(runtime, engine, notify) {
    const all = name => runtime.objects[name]?.getAllInstances() || [];
    const first = name => runtime.objects[name]?.getFirstInstance();
    const clean = text => String(text).replace(/\[[^\]]*\]/g, "");
    const refreshPage = () => runtime.callFunction("刷新招募页面", 8, "招募", "二级页面", 0, 0, 0, 0, 0, 0, 0);
    function context() {
      if (!engine.GetMainRunningLayout() || runtime.layout.name !== "主界面") return null;
      // The background survives card refreshes; the inner page does not.
      const page = all("二级页面背景").find(p => p.isVisible && p.instVars["功能"] === "招募");
      const save = first("save"), mc = first("mc");
      if (!page || !save || !mc) return null;
      const saveId = save.getAt(0, 1, 0), g = runtime.globalVars;
      if (!Number.isSafeInteger(saveId) || saveId < 10000000) return null;
      const text = value => clean(runtime.callFunction("文本", value, 0));
      const methods = all("招募页面按钮").filter(b => b.isVisible && b.instVars["功能"] === "探访" && b.instVars["开关"])
        .map(b => ({ id: b.instVars["招募等阶"], name: text(mc.getAt(b.instVars["招募等阶"], 23)),
          cost: Number(runtime.callFunction("主动寻访费用", b.instVars["招募等阶"])) }));
      const candidates = [];
      for (let id = 1; id <= 3; id++) {
        const state = save.getAt(id, 0, 3);
        if (!(state > 0 || state === -1)) continue;
        const work = Array.from({ length: 9 }, (_, i) => {
          const value = save.getAt(id, 22 + i, 3);
          return { name: text(mc.getAt(i + 1, 3)), grade: Number.isFinite(value) && value >= 0
            ? runtime.callFunction("角色技艺资质分级", value) : NaN };
        });
        candidates.push({ id, name: clean(save.getAt(id, 1, 3)), locked: state === -1, work });
      }
      // Native recruitment readiness is a static event-sheet variable, not a
      // runtime.globalVars property. Its SID is shared by both supported builds.
      const canRecruit = engine.GetEventSheetManager().GetEventVariableBySID(172869272533233);
      const blocked = !canRecruit?.GetValue() || g["爬塔挑战开关"] ||
        ["转场云", "世界地图", "提示信息", "对话选择框"].some(name => all(name).length) ||
        all("黑幕").some(instance => instance.isVisible);
      return { token: `${saveId}:${g["当前地图编号"]}:${page.uid}`, save, methods, candidates, blocked,
        ready: Number(save.getAt(1, 17, 0)) > 1, money: Number(save.getAt(1, 2, 0)) };
    }
    const search = new globalThis.BanditFormations.RecruitSearch({ context, notify,
      status: state => engine.PostComponentMessageToDOM("cjs-formations", "recruit-status", state),
      suspend() {
        const manager = engine.GetEventSheetManager();
        const groups = ["倒计时刷新2", "自动招募function", "招募功能点击", "招募锁定点击"].map(name => manager.GetEventGroupByName(name));
        if (groups.some(g => !g)) throw new Error("Recruitment hooks are unavailable in this game build.");
        const states = groups.map(group => group.IsGroupActive());
        groups.forEach(group => group.SetGroupActive(false));
        return () => groups.forEach((group, i) => group.SetGroupActive(states[i]));
      },
      roll(current, method) {
        const latest = context();
        if (!latest || latest.token !== current.token || latest.blocked || !latest.ready ||
            !latest.methods.some(m => m.id === method && latest.money >= m.cost)) throw new Error("Recruitment is no longer ready. Search stopped.");
        const fingerprint = () => JSON.stringify(Array.from({ length: 3 }, (_, i) =>
          Array.from({ length: 58 }, (_, field) => latest.save.getAt(i + 1, field, 3))));
        const before = fingerprint();
        runtime.callFunction("主动寻访", method);
        if (fingerprint() === before) throw new Error("The game did not refresh any recruits. Search stopped.");
        return context();
      },
      lock(candidates, current) {
        const latest = context();
        if (!latest || latest.token !== current.token) throw new Error("Recruitment screen changed before the match could be locked.");
        // Same persistent slot marker as the native padlock. This also protects
        // matches from timed refreshes after normal game automation resumes.
        for (const candidate of candidates) latest.save.setAt(-1, candidate.id, 0, 3);
        refreshPage();
      },
    });
    engine.AddDOMComponentMessageHandler("cjs-formations", "recruit-start", options => search.start(options));
    engine.AddDOMComponentMessageHandler("cjs-formations", "recruit-stop", () => { search.stop(); search.publish(); });
    return search;
  }
  globalThis.BanditFormations.attachRecruitment = attachRecruitment;
})();
