"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const box = { BanditFormations: {} }; vm.createContext(box);
vm.runInContext(fs.readFileSync(`${__dirname}/../src/craft-sets.js`, "utf8"), box);
const api = box.BanditFormations, clone = value => JSON.parse(JSON.stringify(value));
const options = changes => ({ ...clone(api.craftDefaults), mode: "sets", ...changes });
const target = (id, recipes = [1, 2, 3, 4]) => ({ ...api.craftRoles.find(r => r.id === id), recipes });
const item = (slot, bonuses, changes = {}) => ({ slot, recipe: slot, tier: 1, quality: 3, bonuses, ...changes });

test("all nine work jobs and three combat roles select their native stat and bonus", () => {
  assert.deepEqual(clone(api.craftRoles.map(r => [r.id, r.stat, r.bonus])), [
    ["forge",1,59],["research",3,63],["logging",1,56],["mining",2,57],["planting",3,58],
    ["crafting",2,60],["alchemy",3,61],["building",1,62],["training",2,64],
    ["combat-str",1,19],["combat-agi",2,20],["combat-int",3,21],
  ]);
});
test("single-role dropdown overrides checkboxes without losing their choices", () => {
  const o = options({ roles: ["mining", "research", "forge"], loop: "combat-int" });
  assert.deepEqual(clone(api.selectedCraftRoles(o).map(r => r.id)), ["combat-int"]);
  o.loop = "all";
  assert.deepEqual(clone(api.selectedCraftRoles(o).map(r => r.id)), ["forge", "research", "mining"]);
});
test("invalid crafting preferences are rejected before any crafting or selling", () => {
  for (const bad of [{ mode:"anything" }, { loop:"missing" }, { roles:["forge","forge"] }, { roles:["missing"] },
    { tier:0 }, { tier:10 }, { tier:1.5 }, { minimum:0 }, { minimum:7 }, { multiplier:2 }, { autoSell:"true" }]) {
    assert.throws(() => api.validateCraftOptions(options(bad)), /Invalid/);
  }
  const o = options(); const valid = api.validateCraftOptions(o); o.roles.length = 0;
  assert.equal(valid.roles.length, 12);
});
test("a match requires the exact recipe/stat variant and tier, minimum quality and the specific rolled bonus", () => {
  const t = target("forge"), o = options();
  assert.equal(api.matchesCraftItem(item(2,[59]), t, o), true);
  assert.equal(api.matchesCraftItem(item(2,[59],{quality:6}), t, o), true);
  for (const changes of [{ recipe:99 }, { tier:2 }, { quality:2 }, { quality:7 }, { bonuses:[72] }, { slot:5 }]) {
    assert.equal(api.matchesCraftItem(item(2,[59],changes), t, o), false);
  }
});
test("each finished round requires additional complete sets, including gear already worn", () => {
  const targets = [target("forge"), target("research", [5,6,7,8])], o = options();
  const forge = [1,2,3,4].map(slot => item(slot,[59]));
  const research = [1,2,3,4].map(slot => item(slot,[63],{recipe:slot+4,location:9}));
  let plan = api.planCraftSets(forge, targets, o);
  assert.ok(plan.cycles.every(c=>c.round===1&&c.target.id==="research"));
  plan = api.planCraftSets([...forge,...research], targets, o);
  assert.ok(plan.cycles.every(c=>c.round===2&&c.target.id==="forge"&&c.complete===0));
  plan = api.planCraftSets([...forge,...research,...forge,...research], targets, o);
  assert.ok(plan.cycles.every(c=>c.round===3&&c.target.id==="forge"));
});
test("multi-job rolls count once and spare matches feed future rounds", () => {
  const targets = [target("forge"), target("building")], o = options();
  const both = [1,2,3,4].map(slot => item(slot,[59,62]));
  const plan = api.planCraftSets([...both,...both],targets,o);
  assert.deepEqual(clone(plan.counts), [[1,1,1,1],[1,1,1,1]]); assert.ok(plan.cycles.every(c=>c.round===2));
  const single = api.planCraftSets(both,targets,o);
  assert.deepEqual(clone(single.counts),[[1,1,1,1],[0,0,0,0]]);
  const mixed = api.planCraftSets([...both,...[1,2,3,4].map(s=>item(s,[59]))],targets,o);
  assert.ok(mixed.cycles.every(c=>c.round===2));
});
test("forge and crafting select roles and rounds using only their respective slots", () => {
  const targets = [target("forge"), target("research",[5,6,7,8])], o = options();
  for(const slots of [[1,2],[3,4]]){
    const forge = slots.map(slot=>item(slot,[59]));
    const research = slots.map(slot=>item(slot,[63],{recipe:slot+4}));
    const active = slots[0]===1?0:1, other = 1-active;
    let plan = api.planCraftSets(forge,targets,o);
    assert.equal(plan.cycles[active].target.id,"research");assert.equal(plan.cycles[other].target.id,"forge");
    plan = api.planCraftSets([...forge,...research],targets,o);
    assert.equal(plan.cycles[active].round,2);assert.equal(plan.cycles[active].target.id,"forge");
    assert.equal(plan.cycles[other].round,1);assert.equal(plan.cycles[other].complete,0);
  }
});
test("recipe selection uses the chosen tier, stat and work/combat family", () => {
  const rows = {
    1:{3:1,4:"普通",5:"装备",6:1,9:43,10:1,23:"通用"},
    2:{3:1,4:"普通",5:"装备",6:2,9:72,10:2,23:"生产"},
    3:{3:1,4:"普通",5:"装备",6:2,9:72,10:1,23:"生产"},
    4:{3:2,4:"普通",5:"装备",6:2,9:72,10:1,23:"生产"},
    5:{3:1,4:"普通",5:"装备",6:2,9:28,10:1,23:"战斗"},
    6:{3:1,4:"套装",5:"装备",6:3,9:51,10:1,23:"生产"},
  };
  const wp = { width:7, getAt:(i,f)=>rows[i]?.[f]??0 };
  assert.deepEqual(clone(api.craftRecipes(wp,target("forge"),1)), [1,3,0,0]);
  assert.deepEqual(clone(api.craftRecipes(wp,target("forge"),2)), [0,4,0,0]);
  assert.deepEqual(clone(api.craftRecipes(wp,target("combat-str"),1)), [0,5,0,0]);
});
