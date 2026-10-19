"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { fixture } = require("./helpers/crafting-fixture");
const bag = f => Array.from({length:f.save.width-1},(_,i)=>i+1).filter(row=>f.save.getAt(row,1,7)>0);
const records = f => bag(f).map(row=>({row,quality:f.save.getAt(row,5,7),
  bonuses:Array.from({length:6},(_,i)=>f.save.getAt(row,9+i,7)),lock:f.save.getAt(row,22,7)}));
async function ready(changes={}, recipe=13) {
  const f=fixture(new Map(),true);await f.tick();await f.tick();
  f.workStation=f.wp.getAt(recipe,6)>2?1:0;await f.select(f.workStation);
  await f.configure({mode:"repeat",keepLimit:1,minimum:1,autoSell:true,...changes});
  f.start(f.workStation,recipe,1,50);return f;
}
function craft(f,quality,bonuses,rolls=bonuses.map(()=>50)) { f.rolls=rolls;f.complete(f.workStation??0,bonuses,quality); }

test("work crit alone is kept and locked in Normal Auto-all, and does not satisfy combat roles",async()=>{
  const f=fixture(new Map(),true);await f.tick();
  await f.configure({roles:["forge"],forgeOutput:"hands",minimum:3});await f.tick();
  f.save.setAt(6,9,1,0);craft(f,3,[51]);
  assert.equal(bag(f).length,1);assert.equal(records(f)[0].lock,1);assert.equal(f.save.getAt(1,2,0),0);
  f.cancel(0);await f.configure({loop:"combat-str",minimum:3});await f.tick();
  assert.equal(f.save.getAt(f.queue(0),3,13),10,"work-only gloves never fill combat stock");
});
test("work crit plus the job bonus outranks crit alone, which outranks job-only gear regardless of rarity",async()=>{
  const f=await ready({},2);
  craft(f,6,[59],[100]);craft(f,3,[51],[80]);
  assert.equal(bag(f).length,1);assert.equal(records(f)[0].quality,3);assert.equal(records(f)[0].bonuses[0],51);
  craft(f,2,[51,59],[10,10]);
  assert.equal(bag(f).length,1);assert.deepEqual(records(f)[0].bonuses.slice(0,2),[51,59]);assert.equal(records(f)[0].quality,2);
  craft(f,6,[51],[120]);assert.equal(bag(f).length,1);assert.equal(records(f)[0].quality,2);
  assert.equal(records(f)[0].lock,1);assert.equal(f.save.getAt(1,2,0),3*123);
});
test("within the preferred combination, work crit amount wins before job roll and rarity",async()=>{
  const f=await ready({},2);
  craft(f,6,[51,59],[50,100]);craft(f,3,[51,51,59],[30,30,1]);
  assert.equal(records(f)[0].quality,3);assert.deepEqual(records(f)[0].bonuses.slice(0,3),[51,51,59]);
  craft(f,2,[51,51,59],[30,30,80]);assert.equal(records(f)[0].quality,2);
  craft(f,6,[51,51,59],[30,30,80]);assert.equal(records(f)[0].quality,6);
});
test("the skill bonus must match the job; crit damage and combat crit are not work crit rate",async()=>{
  const f=await ready({},2);
  craft(f,4,[51],[50]);craft(f,6,[12,52,59],[120,120,120]);
  assert.equal(bag(f).length,1);assert.equal(records(f)[0].bonuses[0],51);
  craft(f,6,[51,60],[40,120]);assert.equal(bag(f).length,1);assert.equal(records(f)[0].quality,4);
  craft(f,3,[51,59],[40,10]);assert.equal(records(f)[0].quality,3);
});
test("minimum rarity remains required even when reject selling is disabled",async()=>{
  const f=await ready({minimum:3,autoSell:false},2);
  craft(f,3,[59],[50]);craft(f,2,[51,59],[120,120]);
  assert.equal(bag(f).length,1);assert.equal(records(f)[0].quality,3);
});
test("combat gear retains rarity-first ranking and never qualifies on work crit alone",async()=>{
  const f=await ready({},10);
  craft(f,5,[19],[1]);craft(f,3,[51,19],[120,120]);
  assert.equal(bag(f).length,1);assert.equal(records(f)[0].quality,5);
  craft(f,6,[51],[120]);assert.equal(bag(f).length,1);assert.equal(records(f)[0].quality,5);
});
test("built-in belt crit counts and its native value uses the main roll and equipment level",async()=>{
  const f=await ready({},19);f.catalog[19][9]=51;f.catalog[19][12]=100;
  craft(f,3,[72],[50]);assert.equal(bag(f).length,1);assert.equal(records(f)[0].lock,1);
  craft(f,2,[59],[50]);
  assert.ok(records(f).some(item=>item.bonuses[0]===59&&item.lock===1));
  const calls=f.calls.filter(c=>c[0]==="装备主属性"&&c[3]===51);
  assert.ok(calls.some(c=>c[1]===1&&c[6]==="主属性"&&c[4]===200));
});
test("an unreadable native work-crit value keeps both items and stops automatic selling",async()=>{
  const f=await ready({},2);craft(f,3,[59]);
  f.methods.get("装备主属性").block._RunAndBlock=()=>NaN;
  craft(f,6,[51,59]);await f.tick();
  assert.equal(bag(f).length,2);assert.equal(f.save.getAt(1,2,0),0);assert.equal(f.status().error,true);
});
test("crit gloves serve compatible work jobs while job combinations retain their own quotas",async()=>{
  const f=await ready();craft(f,3,[51],[50]);
  craft(f,2,[51,59],[10,10]);craft(f,2,[51,62],[10,10]);
  assert.equal(bag(f).length,3,"the stronger generic crit pair still serves Logger");
  craft(f,2,[51,56],[10,10]);
  assert.equal(bag(f).length,3);assert.ok(records(f).every(item=>item.bonuses[0]===51&&item.bonuses[1]>0));
});
test("manual locks protect job-only gear even when a stronger work-crit combination is crafted",async()=>{
  const f=await ready({},2);craft(f,3,[59]);const row=bag(f)[0];
  f.save.setAt(0,row,22,7);f.runtime.callFunction("刷新物品",8,"装备","二级页面",0,0,0);f.save.setAt(1,row,22,7);
  craft(f,6,[51,59],[120,120]);assert.deepEqual(bag(f),[row]);assert.equal(f.save.getAt(row,9,7),59);
});
