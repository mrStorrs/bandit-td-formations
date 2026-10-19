"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { fixture } = require("./helpers/crafting-fixture");
const settle = () => new Promise(resolve => setImmediate(resolve));
const key = "cjs-formations:craft-stations:v1:12345678";
const saved = (f, id=3) => f.stored.get(key).stations.find(s=>s.id===id);
async function start(changes={}) {
  const f=fixture(new Map(),true);await f.tick();await f.configureAll(changes);await f.tick();return f;
}
function bag(f) {
  const out=[];for(let row=1;row<f.save.width;row++)if(f.save.getAt(row,1,7)>0)out.push({row,recipe:f.save.getAt(row,1,7),lock:f.save.getAt(row,22,7)});
  return out;
}
function give(f,recipe,bonus,quality=3) {
  f.bonuses=[bonus];f.runtime.callFunction("获得物品",true,recipe,quality,1,1,200,1,false,0,"特定装备",false,false);
}
function batch(f,index,bonus) {
  const count=f.remaining(index);
  for(let i=0;i<count;i++)f.complete(index,[i===0?bonus:72]);
}

test("Auto-all starts with the least-stocked checked item even when an earlier role is below its keep limit", async()=>{
  for(const keepLimit of [5,null]) {
    const f=fixture(new Map(),true);await f.tick();
    give(f,2,59);give(f,2,59);give(f,13,59);give(f,13,59);give(f,7,63);
    await f.configure({roles:["forge","research"],keepLimit});await f.tick();
    assert.equal(f.save.getAt(f.queue(0),3,13),15);assert.equal(f.remaining(0),10);
    assert.match(f.status().message,/Researcher/);assert.match(f.status().message,/Stock 0/);
    for(let n=0;n<10;n++)f.complete(0,[63]);await f.tick();
    assert.equal(f.save.getAt(f.queue(0),3,13),7,"recount after a full batch instead of finishing the first checkbox's quota");
    assert.equal(f.notifications.length,0);
  }
});
test("failed batches rotate tied stocks without replacing paid work or coordinating station queues", async()=>{
  const f=await start(),other=f.queue(1),paid=f.queue(0),balance=f.balance();
  f.complete(0,[72]);await f.tick();
  assert.equal(f.queue(0),paid);assert.equal(f.remaining(0),9);assert.deepEqual(f.balance(),balance);
  for(let n=0;n<9;n++)f.complete(0,[72]);await f.tick();
  assert.equal(f.save.getAt(f.queue(0),3,13),13,"next equally scarce item gets a turn");
  assert.equal(f.queue(1),other);assert.equal(f.remaining(1),10);
});
test("stock priority counts worn matches and ignores wrong quality, tier, bonus and unchecked roles", async()=>{
  const f=fixture(new Map(),true);await f.tick();
  for(const [recipe,bonus] of [[2,59],[13,59],[15,63]])give(f,recipe,bonus);
  give(f,7,63,2);give(f,7,59);give(f,7,63);f.save.setAt(2,6,3,7);
  give(f,3,62);give(f,7,63);
  for(let field=0;field<50;field++)f.save.setAt(f.save.getAt(8,field,7),1,field,9);
  f.save.setAt(1,1,7,9);f.save.setAt(0,8,1,7);
  await f.configure({roles:["forge","research"],forgeOutput:"weapons",keepLimit:5});await f.tick();
  assert.equal(f.save.getAt(f.queue(0),3,13),2,"one equipped Researcher fan ties one valid Forger spear");
  for(let n=0;n<10;n++)f.complete(0,[59]);await f.tick();
  assert.equal(f.save.getAt(f.queue(0),3,13),7,"invalid fans do not inflate Researcher stock");
});
test("forge and crafting choose their own lowest-stock items and honor separate role selections", async()=>{
  const f=fixture(new Map(),true);await f.tick();
  for(const recipe of [2,13])give(f,recipe,59);
  for(const recipe of [21,27])give(f,recipe,63);
  await f.configureAll({keepLimit:5});await f.tick();
  assert.equal(f.save.getAt(f.queue(0),3,13),7);
  assert.equal(f.save.getAt(f.queue(1),3,13),19);
  const craftingQueue=f.queue(1);f.cancel(0);
  await f.configure({keepLimit:5,roles:["forge"],forgeOutput:"hands"});await f.tick();
  assert.equal(f.save.getAt(f.queue(0),3,13),13,"unchecked Researcher stock cannot choose this station's recipe");
  assert.equal(f.queue(1),craftingQueue);assert.equal(f.remaining(1),10);
});
test("stock priority is recomputed from owned items after reloading station settings", async()=>{
  const f=fixture(new Map(),true);await f.tick();
  await f.configure({roles:["forge","research"],keepLimit:5,forgeOutput:"hands"});
  const next=fixture(f.stored,true);give(next,13,59);await next.tick();await next.tick();
  assert.equal(next.save.getAt(next.queue(0),3,13),15);
  assert.equal(next.status().options.keepLimit,5);assert.equal(next.status().options.forgeOutput,"hands");
});

test("Auto-all pays for ten crafts at each station and advances jobs and rounds", async()=>{
  const f=await start();
  assert.deepEqual([f.remaining(0),f.remaining(1)],[10,10]);
  assert.deepEqual([f.save.getAt(f.queue(0),3,13),f.save.getAt(f.queue(1),3,13)],[2,19]);
  assert.deepEqual(f.balance(),[9960,9940]);
  for(let round=1;round<=2;round++) {
    for(const bonus of [59,63]) {
      for(let step=0;step<2;step++){batch(f,0,bonus);batch(f,1,bonus);await f.tick();}
    }
    assert.match(f.status().message,new RegExp(`Round ${round+1} · Forger`));
  }
  assert.equal(bag(f).length,16);assert.ok(bag(f).every(i=>i.lock===1));
  assert.equal(f.notifications.length,0);
});
test("dropdown loops just one role and retains inactive checkbox choices", async()=>{
  const f=await start({loop:"combat-agi",roles:["forge"]});
  for(let round=0;round<2;round++)for(let step=0;step<2;step++){batch(f,0,20);batch(f,1,20);await f.tick();}
  assert.deepEqual(bag(f).map(i=>i.recipe).sort((a,b)=>a-b),[5,5,11,11,17,17,23,23]);
  assert.match(f.status().message,/Round 3 · Combat — AGI/);
  assert.deepEqual(saved(f).options.roles,["forge"]);
});
test("keepers are locked before native automatic selling, rejects use the native sale and can be disabled live", async()=>{
  const f=await start({loop:"forge"});f.save.setAt(6,9,1,0);
  const money=f.save.getAt(1,2,0);f.complete(0,[59]);
  assert.deepEqual(bag(f).map(i=>[i.recipe,i.lock]),[[2,1]]);assert.equal(f.save.getAt(1,2,0),money);
  f.complete(1,[63]);assert.equal(f.save.getAt(1,2,0),money+123);assert.equal(bag(f).length,1);
  await f.handlers["craft-sell"]({token:f.status().token,autoSell:false});await f.tick();
  f.complete(0,[63]);assert.equal(bag(f).length,2);assert.equal(bag(f).at(-1).lock,0);
  assert.equal(f.save.getAt(1,2,0),money+123);assert.equal(saved(f).options.autoSell,false);
});
test("all selected roles are checked and duplicate keepers go to future rounds", async()=>{
  const f=await start({roles:["forge","building"]});
  give(f,13,62);await f.tick();assert.equal(bag(f)[0].lock,1);
  f.complete(1,[62]);assert.equal(bag(f).at(-1).lock,1);
  assert.equal(f.save.getAt(1,2,0),0);
  give(f,13,59);give(f,13,59);await f.tick();
  assert.ok(bag(f).every(i=>i.lock===1));
});
test("unchecked jobs are kept and locked while only selected jobs advance the crafting loop", async()=>{
  for(const loop of ["all","forge"]){
    const f=await start({loop,roles:["forge"]});f.save.setAt(6,9,1,0);
    batch(f,0,59);await f.tick();assert.equal(f.save.getAt(f.queue(0),3,13),13);
    const money=f.save.getAt(1,2,0),other=f.queue(1);
    for(let i=0;i<10;i++)f.complete(0,[i===0?59:62]);
    await f.tick();
    const gloves=bag(f).filter(item=>item.recipe===13);
    assert.equal(gloves.length,10);assert.ok(gloves.every(item=>item.lock===1));
    assert.equal(f.save.getAt(1,2,0),money);
    assert.equal(f.save.getAt(f.queue(0),3,13),2);
    assert.match(f.status().message,/Forge: Round 2 · Forger/);
    assert.equal(f.queue(1),other);
    await f.configureAll({loop:"all",roles:["building"]});await f.tick();
    assert.match(f.status().message,/Forge: Round 1 · Builder · 1\/2 pieces/);
  }
});
test("existing unchecked matches and compatible combat weapons are locked without counting toward the selected set", async()=>{
  const f=fixture(new Map(),true);await f.tick();
  give(f,13,62);give(f,19,62);give(f,1,19);give(f,4,20);give(f,8,21);
  await f.configureAll({loop:"forge",roles:["forge"]});await f.tick();
  assert.equal(bag(f).length,5);assert.ok(bag(f).every(item=>item.lock===1));
  assert.match(f.status().message,/Forge: Round 1 · Forger · 0\/2 pieces/);
  await f.select(1);assert.match(f.status().message,/Crafting: Round 1 · Forger · 0\/2 pieces/);await f.select(0);
  const money=f.save.getAt(1,2,0);f.save.setAt(6,9,1,0);f.complete(0,[19]);
  assert.equal(bag(f).length,6);assert.equal(bag(f).at(-1).lock,1);assert.equal(f.save.getAt(1,2,0),money);
});
test("inherited queues protect unchecked job and combat matches before native automatic sales", async()=>{
  const f=await start({loop:"forge",roles:["forge"]});f.loop.leave();f.save.setAt(6,9,1,0);
  f.complete(0,[19]);f.complete(1,[62]);
  assert.deepEqual(bag(f).map(item=>[item.recipe,item.lock]),[[2,1],[19,1]]);
  assert.equal(f.save.getAt(1,2,0),0);
  f.complete(1,[63]);assert.equal(f.save.getAt(1,2,0),123);
});
test("all-role protection still rejects wrong stats, work weapons, rarity, tier and generic work bonuses", async()=>{
  const f=fixture(new Map(),true);await f.tick();
  give(f,13,63);give(f,2,62);give(f,19,62,2);give(f,13,62);f.save.setAt(2,4,3,7);
  give(f,13,72);give(f,2,20);
  await f.configureAll({loop:"forge",roles:["forge"]});await f.tick();
  assert.ok(bag(f).every(item=>item.lock===0));
  const money=f.save.getAt(1,2,0);
  f.complete(0,[62]);f.complete(0,[19],2);f.complete(1,[63]);
  assert.equal(bag(f).length,6);assert.equal(f.save.getAt(1,2,0),money+3*123);
});
test("wrong stat, quality, tier and bonus never count; preexisting rejects and unrelated loot are not swept", async()=>{
  const f=fixture(new Map(),true);await f.tick();
  give(f,14,59);give(f,13,59,2);give(f,13,63);give(f,13,59);f.save.setAt(2,4,3,7);
  await f.configureAll({loop:"forge"});await f.tick();
  assert.ok(bag(f).every(i=>i.lock===0));assert.equal(bag(f).length,4);
  f.save.setAt(6,9,1,0);give(f,1,56);assert.equal(bag(f).length,5);
  f.runtime.callFunction("获得物品",true,1,3,1,1,200,1,false,0,"特定装备",true,false);
  assert.equal(bag(f).length,5,"unrelated native drops still follow the game's own sell option");
  assert.equal(f.save.getAt(1,2,0),123);
  f.complete(0,[59],2);assert.equal(bag(f).length,5);assert.equal(f.save.getAt(1,2,0),246);
});
test("pausing or changing targets keeps an in-progress reject and never cancels paid work", async()=>{
  const f=await start({loop:"forge"});const q=f.queue(0);
  await f.handlers["craft-pause"]({token:f.status().token});assert.equal(f.queue(0),q);
  f.complete(0,[63]);assert.equal(bag(f).length,1);assert.equal(f.save.getAt(1,2,0),0);
  await f.tick();assert.equal(f.queue(0),q);assert.equal(f.remaining(0),9);
  batch(f,0,63);await f.tick();assert.equal(f.queue(0),0);assert.equal(bag(f).length,10);assert.equal(f.save.getAt(1,2,0),0);
  await f.configureAll({loop:"research"});await f.tick();
  f.complete(1,[59]);assert.equal(bag(f).at(-1).lock,1,"the old queue's matching result is still protected");
});
test("manual recipe changes and cancellations pause set scheduling; repeat mode keeps the manual recipe", async()=>{
  const f=await start({loop:"forge"});f.cancel(0);await f.tick();assert.equal(f.status().running,false);assert.equal(f.queue(0),0);
  f.start(0,3,10);await f.configureAll({mode:"repeat"});f.finish(0);await f.tick();
  assert.equal(f.remaining(0),10);assert.equal(f.save.getAt(f.queue(0),3,13),3);assert.equal(f.save.getAt(f.queue(0),6,13),10);
});
test("automatic recipes never replace the remembered manual repeat recipe", async()=>{
  const f=fixture(new Map(),true);await f.tick();f.start(0,3,10);f.finish(0);
  await f.configureAll({loop:"forge"});await f.tick();batch(f,0,59);
  await f.configureAll({mode:"repeat"});await f.tick();
  assert.equal(f.save.getAt(f.queue(0),3,13),3);assert.equal(f.save.getAt(f.queue(0),6,13),10);
});
test("material shortages, full bags, recipe locks, pause and disabled stations prevent spending", async()=>{
  for(const block of [f=>f.materials(0),f=>{f.capacity=0;},f=>{f.g.游戏暂停=true;},
    f=>{for(const t of f.tiles)t.instVars.有效解锁=false;},
    f=>{for(let i=1;i<64;i++)f.save.setAt(0,i,19,0);}]){
    const f=fixture(new Map(),true);await f.tick();await f.configureAll({loop:"forge"});block(f);f.calls.length=0;await f.tick();
    assert.equal(f.calls.filter(c=>c[0]==="失去材料").length,0);assert.equal(f.queue(0),0);
  }
  const f=fixture(new Map(),true);await f.tick();await f.configureAll({loop:"forge"});
  f.materials(10);await f.tick();assert.equal(f.queue(0),0);assert.equal(f.queue(1),0);assert.deepEqual(f.balance(),[10,10]);
  f.materials(20,30);await f.tick();assert.equal(f.remaining(0),10);assert.equal(f.queue(1),0);assert.deepEqual(f.balance(),[0,0]);
});
test("active recipes, sold filters and single-role choices persist per campaign", async()=>{
  const f=await start({loop:"combat-int",autoSell:false,minimum:5,multiplier:10});
  const next=fixture(f.stored,true);await next.tick();await next.tick();
  assert.equal(next.status().running,true);assert.equal(next.status().options.loop,"combat-int");assert.equal(next.remaining(0),10);
  assert.equal(next.save.getAt(next.queue(0),6,13),10);
  next.save.setAt(87654321,0,1,0);await next.tick();await next.tick();assert.equal(next.status().options.mode,"repeat");
});
test("stale UI, pending storage and invalid choices cannot start or sell", async()=>{
  const f=fixture(new Map(),true);await f.tick();const token=f.status().token;
  f.loop.leave();await f.handlers["craft-configure"]({token,options:{...f.status().options,mode:"sets"}});await f.tick();
  assert.equal(f.status().running,false);assert.equal(f.queue(0),0);
  await f.configureAll({roles:[],loop:"all"});await f.tick();assert.equal(f.status().running,false);assert.equal(f.queue(0),0);
  assert.match(f.status().message,/Check at least/);
});
test("sale failure or inactive sale functions stops without retrying or changing old inventory", async()=>{
  for(const block of [f=>{f.refuseSale=true;},f=>{f.groups.get("失去物品function").active=false;},f=>{f.groups.get("装备价格function").active=false;},
    f=>{f.methods.get("出售物品").IsEnabled=()=>false;}]){
    const f=await start({loop:"forge"});give(f,13,63);block(f);f.complete(0,[63]);
    await f.tick();await f.tick();assert.equal(bag(f).length,2);assert.equal(f.status().running,false);
    assert.equal(f.save.getAt(1,2,0),0);assert.equal(f.notifications.length,1);
  }
});
test("a paid queue is not claimed for automatic selling after re-entry", async()=>{
  const f=await start({loop:"forge"});f.loop.leave();f.complete(0,[63]);
  assert.equal(bag(f).length,1);assert.equal(f.save.getAt(1,2,0),0);
});
test("qualifying crafts from an inherited queue are protected on re-entry without claiming rejects for mod sales", async()=>{
  const f=await start({loop:"forge"});f.loop.leave();f.save.setAt(6,9,1,0);f.complete(0,[59]);
  assert.deepEqual(bag(f).map(i=>[i.recipe,i.lock]),[[2,1]]);assert.equal(f.save.getAt(1,2,0),0);
  f.complete(1,[63]);assert.equal(f.save.getAt(1,2,0),123,"inherited reject follows native selling preferences");
});
test("brewing retains repeat ×10 while equipment stations make sets", async()=>{
  const f=await start({loop:"forge"});f.start(2,30);f.finish(2);await f.tick();
  assert.equal(f.status().running,true);assert.equal(f.remaining(2),10);
});
test("failed settings writes stop automation without enabling sales", async()=>{
  const f=fixture(new Map(),true);await f.tick();f.runtime.storage.setItem=async()=>{throw Error("disk unavailable");};
  await f.configureAll({loop:"forge"});await f.tick();assert.equal(f.status().running,false);assert.equal(f.queue(0),0);
  assert.match(f.status().message,/disk unavailable/);await settle();
});
test("every station can queue the same missing recipe without reserving it from another station",async()=>{
  const f=fixture(new Map(),true);await f.tick();
  for(const [i,kind,type] of [[10,4,21],[11,5,31],[12,4,21]]){
    const x=10030+i,y=10010;
    f.tiles.push({uid:200+i,instVars:{用途:"主地图",设施编号:type,X坐标:x,Y坐标:y,有效解锁:true,资源类型:""}});
    [i,type,6,0].forEach((v,field)=>f.save.setAt(v,i,field,21));f.save.setAt(i,x-10000+150,y-10000,6);
  }
  await f.configureAll({loop:"forge"});await f.tick();
  const recipes=[3,4,10,11,12].map(id=>f.save.getAt(f.save.getAt(id,3,21),3,13)).filter(Boolean);
  assert.deepEqual(recipes,[2,19,2,19,2]);
  assert.ok([3,4,10,11,12].every(id=>f.save.getAt(f.save.getAt(id,3,21),8,13)===10));
  assert.deepEqual(f.balance(),[9900,9850]);
});
test("all ten results are inspected, including other selected roles on the last craft, without early refill",async()=>{
  const f=await start({roles:["forge","building"]});f.save.setAt(6,9,1,0);
  batch(f,0,59);await f.tick();
  assert.equal(f.save.getAt(f.queue(0),3,13),13);
  const queue=f.queue(0),balance=f.balance(),money=f.save.getAt(1,2,0);
  const bonuses=[59,72,62,63,59,72,62,72,59,62];
  for(const [i,bonus] of bonuses.entries()){
    f.complete(0,[bonus]);assert.equal(f.remaining(0),9-i);
    if(i<9)assert.equal(f.queue(0),queue);
    if(i<9){await f.tick();assert.deepEqual(f.balance(),balance);}
  }
  assert.equal(f.queue(0),0);assert.equal(f.remaining(1),10);
  const gloves=bag(f).filter(item=>item.recipe===13);
  assert.equal(gloves.length,6);assert.ok(gloves.every(item=>item.lock===1));
  assert.deepEqual(gloves.map(item=>f.save.getAt(item.row,9,7)),[59,62,59,62,59,62]);
  assert.equal(f.save.getAt(1,2,0),money+4*123);assert.equal(f.notifications.length,0);
});
test("each station advances through roles and starts its next round while the other is still on its first piece",async()=>{
  for(const index of [0,1]){
    const f=await start(),other=1-index,queue=f.queue(other),names=["Forge","Crafting"];
    for(let step=0;step<2;step++){batch(f,index,59);await f.tick();}
    assert.equal(f.save.getAt(f.queue(index),3,13),index===0?7:21);
    await f.select(index);assert.match(f.status().message,new RegExp(`${names[index]}: Round 1 · Researcher`));
    for(let step=0;step<2;step++){batch(f,index,63);await f.tick();}
    assert.equal(f.save.getAt(f.queue(index),3,13),index===0?2:19);assert.equal(f.remaining(index),10);
    assert.match(f.status().message,new RegExp(`${names[index]}: Round 2 · Forger`));
    await f.select(other);assert.match(f.status().message,new RegExp(`${names[other]}: Round 1 · Forger`));
    assert.equal(f.queue(other),queue);assert.equal(f.remaining(other),10);
  }
});
test("ten matching outputs per slot fill ten rounds while the other station is absent",async()=>{
  const f=fixture(new Map(),true);f.tiles.splice(1,1);await f.tick();await f.configureAll({loop:"forge"});await f.tick();
  for(let step=0;step<2;step++){
    for(let i=0;i<10;i++)f.complete(0,[59]);
    await f.tick();
  }
  assert.equal(bag(f).length,20);assert.ok(bag(f).every(item=>item.lock===1));
  assert.match(f.status().message,/Forge: Round 11 · Forger/);
  assert.equal(f.remaining(0),10);assert.equal(f.save.getAt(f.queue(0),3,13),2);
});
test("inherited Auto-all queues do not overwrite the remembered manual recipe on reload",async()=>{
  const f=fixture(new Map(),true);await f.tick();f.start(0,3,10);f.finish(0);await f.configureAll({loop:"forge"});await f.tick();
  const next=fixture(f.stored,true);next.start(0,2,1,1);await next.tick();await next.tick();next.complete(0,[59]);await settle();
  assert.equal(next.stored.get('cjs-formations:crafting:v1:12345678').stations.find(s=>s.id===3).recipe,3);
});
test("a manual station change during a pending Start wins over the older settings write",async()=>{
  const f=fixture(new Map(),true);await f.tick();const original=f.runtime.storage.setItem;let release;
  f.runtime.storage.setItem=async(k,v)=>{if(k===key&&!release)await new Promise(r=>{release=r;});return original(k,v);};
  const configuring=f.configure({loop:"forge"});await settle();f.start(0,3);release();await configuring;await settle();await f.tick();
  assert.equal(f.status().running,false);assert.equal(saved(f).enabled,false);assert.equal(f.status().options.mode,"sets");
});
test("a new Start is saved after an earlier manual cancellation even when storage is slow",async()=>{
  const f=await start({loop:"forge"});const original=f.runtime.storage.setItem;let release;
  f.runtime.storage.setItem=async(k,v)=>{if(k===key&&!release)await new Promise(r=>{release=r;});return original(k,v);};
  f.cancel(0);await settle();const configuring=f.configure({loop:"research"});release();await configuring;await settle();await f.tick();
  assert.equal(f.status().running,true);assert.equal(saved(f).enabled,true);assert.equal(saved(f).options.loop,"research");
});
