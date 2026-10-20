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
    { tier:0 }, { tier:10 }, { tier:1.5 }, { minimum:0 }, { minimum:7 }, { multiplier:2 }, { autoSell:"true" },
    {keepLimit:-1}, {keepLimit:1.5}, {keepLimit:"2"}, {keepLimit:1000}, {forgeOutput:"invalid"}, {forgeOutput:null}]) {
    assert.throws(() => api.validateCraftOptions(options(bad)), /Invalid/);
  }
  const o = options(); const valid = api.validateCraftOptions(o); o.roles.length = 0;
  assert.equal(valid.roles.length, 12);
});
test("older crafting settings default to full sets", () => {
  const old=options();delete old.forgeOutput;
  assert.equal(api.validateCraftOptions(old).forgeOutput,"all");
  assert.equal(api.validateCraftOptions(options({forgeOutput:"weapons"})).forgeOutput,"weapons");
  delete old.keepLimit; assert.equal(api.validateCraftOptions(old).keepLimit,null);
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
test("work crit fills compatible work sets, with a job combination allocated to its matching job first", () => {
  const targets=[target("forge"),target("building")],o=options({forgeOutput:"hands"});
  const combo=item(2,[51,62]);
  let plan=api.planCraftSets([combo],targets,o);
  assert.deepEqual(clone(plan.counts),[[0,0,0,0],[0,1,0,0]]);
  plan=api.planCraftSets([item(2,[51]),combo],targets,o);
  assert.deepEqual(clone(plan.counts),[[0,1,0,0],[0,1,0,0]]);
  assert.equal(api.matchesCraftItem(item(2,[51]),target("combat-str"),o),false);
  assert.equal(api.matchesCraftItem(item(3,[],{mainStat:51}),target("forge"),o),false);
  for(const bonuses of [[12],[52],[72]])assert.equal(api.matchesCraftItem(item(2,bonuses),target("forge"),o),false);
});
test("innate stats never qualify a work item or fill its job stock", () => {
  const targets=[target("forge"),target("building")],o=options();
  const belt=item(3,[],{mainStat:51});
  const wp={getAt:(_,field)=>({3:1,4:"普通",5:"装备",6:3,9:51,10:1,23:"生产"})[field]??0};
  assert.equal(api.isCraftKeeper(belt,wp,o),false);
  assert.equal(api.matchesCraftItem(item(3,[],{mainStat:59}),targets[0],o),false);
  assert.deepEqual(clone(api.craftSaleGroups(belt,wp)),["other:"]);
  assert.deepEqual(clone(api.craftSaleGroups({...belt,bonuses:[59]},wp)),[59]);
  for(const keepLimit of [null,2]) {
    const plan=api.planCraftSets([belt,{...belt,bonuses:[59]}],targets,{...o,keepLimit});
    assert.deepEqual(clone(plan.counts),[[0,0,1,0],[0,0,0,0]]);
  }
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
test("restricted forge rounds advance using their chosen slot and leave crafting slots intact", () => {
  for(const [output,slot] of [["weapons",1],["hands",2]]) {
    const targets=[target("forge"),target("research",[5,6,7,8])],o=options({forgeOutput:output});
    const forge=item(slot,[59]),research=item(slot,[63],{recipe:slot+4});
    let plan=api.planCraftSets([forge],targets,o);
    assert.deepEqual(clone(plan.cycles[0].slots),[slot-1]);assert.equal(plan.cycles[0].target.id,"research");
    assert.deepEqual(clone(plan.cycles[1].slots),[2,3]);assert.equal(plan.cycles[1].target.id,"forge");
    plan=api.planCraftSets([forge,research],targets,o);
    assert.equal(plan.cycles[0].round,2);assert.equal(plan.cycles[0].target.id,"forge");
    assert.equal(plan.cycles[1].round,1);
    plan=api.planCraftSets([forge,research],targets,{...o,forgeOutput:"all"});
    assert.equal(plan.cycles[0].round,1);assert.equal(plan.cycles[0].target.id,"forge");
    assert.deepEqual(clone(plan.cycles[0].slots),[0,1]);assert.equal(plan.cycles[0].complete,1);
  }
});
test("lowest-stock selection compares item and bonus groups before checkbox order", () => {
  const targets = [target("forge"), target("research", [5,6,7,8])];
  const inventory = [item(1,[59]), item(1,[59]), item(2,[59]), item(2,[59]),
    item(1,[63],{recipe:5}), item(3,[63],{recipe:7}), item(4,[63],{recipe:8})];
  for (const keepLimit of [null, 5]) {
    const { cycles } = api.planCraftSets(inventory, targets, options({keepLimit}));
    assert.equal(cycles[0].target.id, "research"); assert.equal(cycles[0].slot, 1); assert.equal(cycles[0].stock, 0);
    assert.equal(cycles[1].target.id, "forge"); assert.equal(cycles[1].stock, 0);
  }
});
test("equal stock rotates by batch while lower stock always wins over the cursor", () => {
  const targets = [target("forge"), target("research", [5,6,7,8])];
  for (const keepLimit of [null, 5]) {
    const o = options({keepLimit});
    let cursor = 0;
    for (const [role, slot] of [["forge",0],["forge",1],["research",0],["research",1],["forge",0]]) {
      const cycle = api.planCraftSets([], targets, o, cursor).cycles[0];
      assert.equal(cycle.target.id, role); assert.equal(cycle.slot, slot); cursor = cycle.nextCursor;
    }
    const inventory = [item(1,[59]), item(1,[63],{recipe:5}), item(2,[63],{recipe:6})];
    const cycle = api.planCraftSets(inventory, targets, o, 2).cycles[0];
    assert.equal(cycle.target.id, "forge"); assert.equal(cycle.slot, 1); assert.equal(cycle.stock, 0);
  }
});
test("lowest-stock normal sets still allocate each multi-bonus item once; sell limits count each bonus", () => {
  const targets = [target("forge"), target("building")], inventory = [item(2,[59,62])];
  const o = options({forgeOutput:"hands"});
  let cycle = api.planCraftSets(inventory, targets, o).cycles[0];
  assert.equal(cycle.target.id, "building"); assert.equal(cycle.stock, 0);
  cycle = api.planCraftSets(inventory, targets, {...o,keepLimit:2}).cycles[0];
  assert.equal(cycle.target.id, "forge"); assert.equal(cycle.stock, 1);
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
  assert.deepEqual(clone(api.craftRecipes(wp,target("combat-str"),1)), [1,5,0,0]);
});
test("combat crafting and keepers both require spear, bow and fan", () => {
  const rows = {
    1:{3:1,4:"普通",5:"装备",6:1,8:4,9:40,10:1,23:"通用"},
    2:{3:1,4:"普通",5:"装备",6:1,8:4,9:43,10:1,23:"通用"},
    3:{3:1,4:"普通",5:"装备",6:1,8:5,9:48,10:2,23:"通用"},
    4:{3:1,4:"普通",5:"装备",6:1,8:5,9:44,10:2,23:"通用"},
    5:{3:1,4:"普通",5:"装备",6:1,8:6,9:45,10:3,23:"通用"},
    6:{3:1,4:"普通",5:"装备",6:1,8:6,9:47,10:3,23:"通用"},
  };
  const wp = { width:7, getAt:(i,f)=>rows[i]?.[f]??0 }, o = options({loop:"forge",roles:["forge"]});
  for(const [role,recipe,alternative,bonus] of [["combat-str",2,1,19],["combat-agi",4,3,20],["combat-int",6,5,21]]){
    const recipes=api.craftRecipes(wp,target(role),1);
    assert.equal(recipes[0],recipe);
    assert.equal(api.isCraftKeeper(item(1,[bonus],{recipe}),wp,o),true);
    assert.equal(api.isCraftKeeper(item(1,[bonus],{recipe:alternative}),wp,o),false);
    assert.equal(api.matchesCraftItem(item(1,[bonus],{recipe:alternative}),target(role,recipes),o),false);
    assert.ok(!api.craftSaleGroups(item(1,[bonus],{recipe:alternative}),wp).includes(bonus));
  }
  rows[1][8]=5;
  assert.equal(api.isCraftKeeper(item(1,[19]),wp,o),false,"a mismatched attack stat does not qualify for combat");
});
test("every combat role agrees with keeper and stock grouping across tiers, weapon families and rolled bonuses", () => {
  const rows = {}, powers = [40,43,46,48,44,41,47,45,42];
  for (let tier=1;tier<=9;tier++) for (let weapon=0;weapon<9;weapon++) {
    const stat=Math.floor(weapon/3)+1;
    rows[(tier-1)*9+weapon+1]={3:tier,4:"普通",5:"装备",6:1,8:stat+3,9:powers[weapon],10:stat,23:"通用"};
  }
  const wp={width:82,getAt:(id,field)=>rows[id]?.[field]??0};
  for(let tier=1;tier<=9;tier++) for(const role of api.craftRoles.filter(r=>r.combat)) {
    const o=options({tier}), recipes=api.craftRecipes(wp,role,tier);
    for(let weapon=1;weapon<=9;weapon++) {
      const recipe=(tier-1)*9+weapon, gear=item(1,[role.bonus],{recipe,tier});
      const expected=recipe===recipes[0];
      assert.equal(api.isCraftKeeper(gear,wp,o),expected,`${role.id}, tier ${tier}, weapon ${weapon}`);
      assert.equal(api.matchesCraftItem(gear,{...role,recipes},o),expected);
      assert.equal(api.craftSaleGroups(gear,wp).includes(role.bonus),expected);
      if(rows[recipe][10]===role.stat) {
        const work=api.craftRoles.find(r=>!r.combat&&r.power===rows[recipe][9]);
        const shared={...gear,bonuses:[role.bonus,work.bonus]};
        assert.equal(api.isCraftKeeper(shared,wp,o),true,"a valid work match is kept even on the wrong combat weapon");
        assert.ok(api.craftSaleGroups(shared,wp).includes(work.bonus));
        assert.equal(api.craftSaleGroups(shared,wp).includes(role.bonus),expected);
        assert.equal(api.isCraftKeeper({...gear,bonuses:[51]},wp,o),true,"rolled Work Crit still qualifies a work weapon");
      }
    }
  }
});
