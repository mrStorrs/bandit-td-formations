"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {researchTargets,drillTargets,nextResearch}=require("../src/study.js");
const {fixture,settle,storageKey}=require("./helpers/study-fixture.js");

test("research sorts all lowest-level topics by Team, Gather, Growth, Cultivate, Craft",()=>{
  const f=fixture(),read=()=>researchTargets(f.kj,f.save,()=>3);
  assert.deepEqual(read().map(t=>t.id),[31,32,33,34,35,36,40,41,43,42,44,37,38,39]);
  f.save.setAt(1,31,4,0);assert.equal(nextResearch(read(),()=>false).id,32);
  f.save.setAt(2,32,4,0);f.save.setAt(3,33,4,0);
  assert.equal(read().at(-1).id,32);assert.ok(!read().some(t=>t.id===33));
});
test("open regular research takes precedence and new prerequisite unlocks are respected",()=>{
  const f=fixture();f.save.setAt(0,2,4,0);f.save.setAt(0,11,4,0);
  let list=researchTargets(f.kj,f.save,()=>3);
  assert.equal(nextResearch(list,()=>false).id,2);assert.ok(!list.some(t=>t.id===11||t.category==="Team"));
  f.save.setAt(1,2,4,0);list=researchTargets(f.kj,f.save,()=>3);
  assert.equal(nextResearch(list,()=>false).id,11);
  assert.equal(nextResearch(list,id=>id===11).id,34);
});
test("higher research levels wait when every topic at the lowest open level is already assigned",()=>{
  const f=fixture();for(let id=31;id<=44;id++)f.save.setAt(1,id,4,0);f.save.setAt(0,34,4,0);
  const list=researchTargets(f.kj,f.save,()=>3);
  assert.equal(nextResearch(list,()=>false).id,34);assert.equal(nextResearch(list,id=>id===34),undefined);
  assert.equal(nextResearch([],()=>false),undefined);
});
test("drilling uses class tier order, prerequisites, family unlocks and the current cap",()=>{
  const f=fixture(),read=()=>drillTargets(f.zy,f.save,3,id=>id===1?1:2,()=>f.familyOpen);
  assert.deepEqual(read().map(t=>t.id),[1]);f.save.setAt(3,1,5,0);
  assert.deepEqual(read().map(t=>t.id),[2,3]);f.save.setAt(2,2,5,0);
  assert.deepEqual(read().map(t=>t.id),[2,3,4,5]);
  for(const id of [4,8,9])f.save.setAt(3,id,5,0);
  assert.equal(read().at(-1).id,16);f.familyOpen=false;assert.ok(!read().some(t=>t.id===16));
  assert.deepEqual(drillTargets(f.zy,f.save,NaN,()=>0,()=>true),[]);
});

test("defaults start both stations using native payment and preserve UI selection",async()=>{
  const f=fixture();await f.ready();await f.tick();
  assert.deepEqual([f.queue(0),f.queue(1)],[31,1]);assert.equal(f.save.getAt(1,2,0),99800);
  assert.deepEqual([f.g.选中地块X,f.g.选中地块Y],[44,55]);assert.deepEqual(f.ui,[]);
  assert.deepEqual(f.stored.get(storageKey).enabled,{research:true,drill:true});
});
test("automatic research pays for one level only and traverses each category before raising the next level",async()=>{
  const f=fixture();await f.ready();f.enabled("drill",false);
  for(const id of [31,32,33,34,35,36,40,41,43,42,44,37,38,39,31]){
    await f.tick();assert.equal(f.queue(0),id);
    const money=f.save.getAt(1,2,0);f.complete(0);
    assert.equal(f.queue(0),0);assert.equal(f.save.getAt(1,2,0),money);
    assert.equal(f.save.getAt(1,5,21),1,"native Repeat preference is restored");
  }
});
test("new regular unlocks preempt automatic advanced research at the next completed level",async()=>{
  const f=fixture();await f.ready();await f.tick();f.save.setAt(0,22,4,0);
  f.complete(0);await f.tick();assert.equal(f.queue(0),22);f.complete(0);await f.tick();assert.equal(f.queue(0),32);
});
test("manual research runs to the cap, even if native Repeat is off, before automation resumes",async()=>{
  const f=fixture();await f.ready();f.save.setAt(0,1,5,21);f.choose(0,37);
  assert.equal(f.ui.length,3,"manual UI functions still run");
  f.menus.push({instVars:{功能:"设施",X坐标:f.tiles[0].instVars.X坐标,Y坐标:10010}});
  for(let level=1;level<=3;level++){
    await f.tick();assert.equal(f.queue(0),37);f.complete(0);assert.equal(f.save.getAt(37,4,0),level);
  }
  await f.tick();assert.equal(f.queue(0),31);
});
test("manual research retains control through insufficient copper and a restart",async()=>{
  const stored=new Map(),f=fixture(stored);await f.ready();f.enabled("drill",false);f.choose(0,37);
  f.save.setAt(0,1,2,0);f.complete(0);await f.tick();assert.equal(f.queue(0),0);
  assert.equal(stored.get(storageKey).stations.find(e=>e.id===1).mode,"manual");
  const next=fixture(stored);next.save.setAt(1,37,4,0);await next.ready();await next.tick();assert.equal(next.queue(0),37);
});
test("auto drill finishes each class to the cap and never duplicates another station's target",async()=>{
  const f=fixture();f.add(9);await f.ready();await f.tick();assert.equal(f.queue(1),1);assert.equal(f.queue(2),0);
  for(let level=1;level<=3;level++){f.complete(1);await f.tick();assert.equal(f.save.getAt(1,5,0),level);}
  assert.deepEqual([f.queue(1),f.queue(2)].sort(),[2,3]);
});
test("manual drill overrides class order and continues to cap before the lowest class resumes",async()=>{
  const f=fixture();f.save.setAt(1,1,5,0);await f.ready();f.cancel(1);f.choose(1,3);
  f.menus.push({instVars:{功能:"设施",X坐标:f.tiles[1].instVars.X坐标,Y坐标:10010}});
  for(let level=1;level<=3;level++){await f.tick();assert.equal(f.queue(1),3);f.complete(1);}
  await f.tick();assert.equal(f.queue(1),1);
});
test("inherited native queues are manual; saved automatic research still yields after one level",async()=>{
  const f=fixture();f.save.setAt(37,1,3,21);f.save.setAt(1,37,13,0);await f.ready();await f.tick();
  f.complete(0);assert.equal(f.queue(0),37);assert.equal(f.save.getAt(37,4,0),1);
  const stored=new Map(),a=fixture(stored);await a.ready();await a.tick();
  const b=fixture(stored);b.save.setAt(31,1,3,21);b.save.setAt(1,31,13,0);await b.ready();await b.tick();
  const money=b.save.getAt(1,2,0);b.complete(0);assert.equal(b.queue(0),0);assert.equal(b.save.getAt(1,2,0),money);
});
test("manual cancellation releases a pin and selected idle stations wait for user input",async()=>{
  const f=fixture();await f.ready();f.choose(0,37);f.cancel(0);
  f.menus.push({instVars:{功能:"设施",X坐标:f.tiles[0].instVars.X坐标,Y坐标:10010}});
  await f.tick();await f.tick();await f.tick();assert.equal(f.queue(0),0);
  f.menus.length=0;await f.tick();assert.equal(f.queue(0),31);
});
test("manual choice during async settings load wins over stored automatic ownership",async()=>{
  const old=fixture();await old.ready();await old.tick();
  const f=fixture(old.stored);let release;f.runtime.storage.getItem=()=>new Promise(resolve=>{release=resolve;});
  await f.tick();f.choose(0,37);release(old.stored.get(storageKey));await settle();f.g.游戏暂停=false;
  await f.tick();assert.equal(f.queue(0),37);f.complete(0);assert.equal(f.queue(0),37);
});
test("pause, menus, transitions, unusable stations and disabled native groups cannot schedule orders",async()=>{
  for(const block of [f=>{f.g.游戏暂停=true;},f=>{f.runtime.timeScale=0;},f=>{f.objects.二级页面背景.push({});},
    f=>{f.objects.转场云.push({});},f=>{f.objects.黑幕.push({isVisible:true});},f=>{f.tiles.forEach(t=>{t.instVars.有效解锁=false;});},
    f=>{f.groups.get("相同进程检测function").active=false;}]){
    const f=fixture();await f.ready();block(f);await f.tick();assert.deepEqual([f.queue(0),f.queue(1)],[0,0]);
    assert.equal(f.save.getAt(1,2,0),100000);
  }
});
test("toggles persist independently, stale messages cannot change them, and off finishes a paid research level",async()=>{
  const f=fixture();await f.ready();await f.tick();const token=f.status().token;
  f.enabled("research",false);f.complete(0);await f.tick();assert.equal(f.queue(0),0);assert.equal(f.queue(1),1);
  f.loop.leave();f.handlers["study-enabled"]({token,kind:"research",enabled:true});await f.tick();
  assert.equal(f.status().enabled.research,false);assert.equal(f.stored.get(storageKey).enabled.research,false);
  f.enabled("research",true);await f.tick();assert.equal(f.queue(0),32);
});
test("money shortages wait without spending and failed native start stops instead of retrying",async()=>{
  const f=fixture();await f.ready();f.save.setAt(99,1,2,0);await f.tick();assert.deepEqual([f.queue(0),f.queue(1)],[0,0]);
  f.save.setAt(100,1,2,0);await f.tick();assert.equal(f.queue(0),31);assert.equal(f.queue(1),0);assert.equal(f.save.getAt(1,2,0),0);
  const bad=fixture();await bad.ready();bad.refuse=true;await bad.tick();assert.equal(bad.status().error,true);
  const count=bad.calls.filter(c=>c[0]==="科技研究").length;await bad.tick();assert.equal(bad.calls.filter(c=>c[0]==="科技研究").length,count);
  assert.deepEqual([bad.g.选中地块X,bad.g.选中地块Y],[44,55]);
});
test("demolished or replaced stations cannot retain manual ownership",async()=>{
  const f=fixture();await f.ready();f.choose(0,37);
  const tile=f.tiles[0];f.runtime.callFunction("删除地图设施",tile.instVars.X坐标,10010,0,0,0,"主地图",0,false);
  await f.tick();assert.equal(f.stored.get(storageKey).stations.some(e=>e.id===1),false);
});
test("multiple research stations reserve different topics at the same level",async()=>{
  const f=fixture();f.add(8);await f.ready();await f.tick();assert.deepEqual([f.queue(0),f.queue(2)],[31,32]);
});

test("selecting the current automatic research topic manually takes ownership until its cap",async()=>{
  const f=fixture();await f.ready();await f.tick();f.choose(0,31);f.complete(0);
  assert.equal(f.queue(0),31);await f.tick();assert.match(f.status().message,/Research: Manual/);
});
test("research changed outside the mod is treated as manual after reload",async()=>{
  const stored=new Map(),a=fixture(stored);await a.ready();await a.tick();
  const b=fixture(stored);b.save.setAt(31,1,3,21);b.save.setAt(1,31,13,0);b.save.setAt(1,31,4,0);
  await b.ready();await b.tick();b.complete(0);assert.equal(b.queue(0),31);
});
test("relocating a station preserves its manual target instead of releasing the override",async()=>{
  const f=fixture();await f.ready();f.choose(0,37);const v=f.tiles[0].instVars;
  f.runtime.callFunction("删除地图设施",v.X坐标,v.Y坐标,0,0,0,"主地图",0,true);
  await f.tick();assert.equal(f.queue(0),37);assert.match(f.status().message,/Research: Manual/);
});
test("bad saved data stops automatic spending but leaves native manual selection usable",async()=>{
  const f=fixture(new Map([[storageKey,{version:99}]]));await f.ready();await f.tick();
  assert.equal(f.status().error,true);assert.deepEqual([f.queue(0),f.queue(1)],[0,0]);
  f.choose(0,37);f.complete(0);assert.equal(f.queue(0),37);assert.equal(f.save.getAt(37,4,0),1);
});
test("campaign changes load separate settings and reject messages from the previous campaign",async()=>{
  const f=fixture(new Map([[storageKey,{version:1,enabled:{research:false,drill:false},stations:[]}]]));
  await f.ready();await f.tick();const old=f.status().token;assert.deepEqual([f.queue(0),f.queue(1)],[0,0]);
  f.save.setAt(87654321,0,1,0);await f.tick();
  f.handlers["study-enabled"]({token:old,kind:"research",enabled:false});await f.tick();
  assert.deepEqual([f.queue(0),f.queue(1)],[31,1]);assert.equal(f.stored.get(storageKey).enabled.research,false);
});
test("native work exceptions restore the player's Repeat setting",async()=>{
  const f=fixture();f.methods.get("采集核心碰撞").block._RunAndBlock=()=>{throw Error("Native failure");};
  await f.ready();await f.tick();assert.throws(()=>f.complete(0),/Native failure/);
  assert.equal(f.save.getAt(1,5,21),1);
});

test("a valid manual research choice immediately replaces an auto order with a native refund and retained progress",async()=>{
  const f=fixture();await f.ready();await f.tick();f.save.setAt(75,31,12,0);
  const money=f.save.getAt(1,2,0);f.choose(0,37);
  assert.equal(f.queue(0),37);assert.equal(f.save.getAt(1,2,0),money);
  assert.equal(f.save.getAt(31,13,0),0);assert.equal(f.save.getAt(31,12,0),75);
  f.complete(0);assert.equal(f.queue(0),37,"manual target keeps repeating to its cap");
});
test("manual drill replacement refunds the old current level and clears its active flag",async()=>{
  const f=fixture();await f.ready();await f.tick();f.complete(1);
  const money=f.save.getAt(1,2,0);f.choose(1,3);
  assert.equal(f.queue(1),3);assert.equal(f.save.getAt(1,2,0),money+110-100);assert.equal(f.save.getAt(1,15,0),0);
  f.complete(1);assert.equal(f.queue(1),3);
});

test("locked or unaffordable manual choices cannot cancel an automatic research order",async()=>{
  const f=fixture();await f.ready();await f.tick();f.save.setAt(0,22,4,0);f.choose(0,37);
  assert.equal(f.queue(0),31);f.save.setAt(1,22,4,0);f.save.setAt(2,37,4,0);f.save.setAt(0,1,2,0);
  f.choose(0,37);assert.equal(f.queue(0),31);
  assert.equal(f.calls.filter(c=>c[0]==="取消设施进程").length,0);
});
