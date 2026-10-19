"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { fixture } = require("./helpers/crafting-fixture");
const key = "cjs-formations:craft-stations:v1:12345678";
const saved = (f, id) => f.stored.get(key).stations.find(s => s.id === id);
const options = { mode:"sets",loop:"forge",roles:["forge"],tier:1,minimum:3,multiplier:1,autoSell:true };
function addForge(f, id = 10) {
  const x=10040,y=10010;
  f.tiles.push({uid:300,instVars:{用途:"主地图",设施编号:21,X坐标:x,Y坐标:y,有效解锁:true,资源类型:""}});
  [id,21,6,0].forEach((v,field)=>f.save.setAt(v,id,field,21));f.save.setAt(id,x-10000+150,y-10000,6);
  return f.tiles.length-1;
}
const recipe = (f,id) => f.save.getAt(f.save.getAt(id,3,21),3,13);

test("two forges reload and refill their own recipes during a shared building upgrade",async()=>{
  const records=[
    {id:3,type:21,owner:6,enabled:true,options:{...options,forgeOutput:"weapons"}},
    {id:10,type:21,owner:6,enabled:true,options:{...options,loop:"research",forgeOutput:"hands"}},
  ];
  const f=fixture(new Map([[key,{version:1,stations:records}]]),true);addForge(f);
  f.save.setAt(1500000,6,4,1);await f.tick();await f.tick();
  assert.equal(recipe(f,3),2);assert.equal(recipe(f,10),15);
  const other=f.save.getAt(10,3,21);
  assert.equal(f.remaining(0),10);assert.equal(f.save.getAt(other,8,13),10);
  for(let i=0;i<10;i++)f.complete(0,[72]);await f.tick();
  assert.equal(recipe(f,3),2);assert.equal(f.remaining(0),10);
  assert.equal(f.save.getAt(10,3,21),other);assert.equal(f.save.getAt(other,8,13),10);
  assert.deepEqual(f.balance(),[9940,9910]);assert.equal(f.save.getAt(6,4,1),1500000);
  assert.equal(saved(f,3).enabled,true);assert.equal(saved(f,10).enabled,true);
});

test("two forges independently choose roles, rarity, multipliers and selling, with saved reload",async()=>{
  const f=fixture(new Map(),true),second=addForge(f);await f.tick();await f.configure({loop:"forge",minimum:3});
  await f.select(second);await f.configure({loop:"research",minimum:5,multiplier:10,autoSell:false});await f.tick();
  assert.equal(recipe(f,3),2);assert.equal(recipe(f,10),7);
  assert.equal(f.save.getAt(f.save.getAt(10,3,21),6,13),10);
  assert.equal(saved(f,3).options.loop,"forge");assert.equal(saved(f,3).options.autoSell,true);
  assert.equal(saved(f,10).options.loop,"research");assert.equal(saved(f,10).options.autoSell,false);
  const next=fixture(f.stored,true);addForge(next);await next.tick();await next.tick();
  assert.equal(recipe(next,3),2);assert.equal(recipe(next,10),7);
  await next.select(second);assert.equal(next.status().options.minimum,5);
});
test("pausing one station and manually overriding another do not pause a third",async()=>{
  const f=fixture(new Map(),true),second=addForge(f);await f.tick();await f.configureAll({loop:"forge"});await f.tick();
  const otherQueue=f.queue(1);await f.handlers["craft-pause"]({token:f.status().token});await f.tick();
  assert.equal(saved(f,3).enabled,false);assert.equal(saved(f,4).enabled,true);assert.equal(saved(f,10).enabled,true);
  f.cancel(1);await f.tick();assert.equal(saved(f,4).enabled,false);assert.equal(saved(f,10).enabled,true);
  assert.ok(otherQueue>0);await f.select(second);assert.equal(f.status().running,true);
});
test("station selection is required and stale actions cannot edit the newly selected station",async()=>{
  const f=fixture(new Map(),true);await f.tick();await f.tick();const old=f.status().token;
  await f.select(1);await f.handlers["craft-configure"]({token:old,options});
  assert.equal(saved(f,3).options.mode,"repeat");assert.equal(saved(f,4).options.mode,"repeat");
  f.objects.底部菜单背景.length=0;await f.tick();assert.equal(f.status().visible,false);
  await f.handlers["craft-configure"]({token:old,options});assert.equal(saved(f,3).options.mode,"repeat");
  await f.select(0);f.objects.二级页面背景.push({});await f.tick();assert.equal(f.status().visible,false);
  await f.handlers["craft-configure"]({token:old,options});assert.equal(saved(f,3).options.mode,"repeat");
});
test("repeat and brewery pause controls are local, and breweries reject equipment mode",async()=>{
  const f=fixture(new Map(),true);await f.tick();f.start(0);f.start(2);
  await f.select(2);await f.handlers["craft-pause"]({token:f.status().token});
  f.finish(0);f.finish(2);await f.tick();assert.equal(f.remaining(0),10);assert.equal(f.queue(2),0);
  await f.configure({mode:"repeat"});await f.tick();assert.equal(f.remaining(2),10);
  await f.configure({mode:"sets"});await f.tick();assert.equal(f.status().running,false);assert.match(f.status().message,/Breweries/);
  assert.equal(saved(f,3).enabled,true);
});
test("old global settings migrate once to existing gear stations, with new stations using defaults",async()=>{
  for(const enabled of [true,false]) {
    const legacy={version:1,enabled,options:{...options,loop:"combat-int",minimum:5,autoSell:false}};
    const f=fixture(new Map([["cjs-formations:craft-sets:v1:12345678",legacy]]),true);
    await f.tick();await f.tick();
    for(const id of [3,4]){assert.deepEqual(saved(f,id).options,{...legacy.options,keepLimit:null,forgeOutput:"all"});assert.equal(saved(f,id).enabled,enabled);}
    assert.equal(saved(f,5).options.mode,"repeat");assert.equal(saved(f,5).enabled,true);
    const index=addForge(f);await f.select(index);assert.equal(f.status().options.mode,"repeat");
    assert.equal(saved(f,10).options.mode,"repeat");assert.deepEqual(f.stored.get("cjs-formations:craft-sets:v1:12345678"),legacy);
  }
});
test("moving a station preserves its settings, demolition and reused ids reset them",async()=>{
  const f=fixture(new Map(),true);await f.tick();await f.configure({loop:"research"});await f.tick();
  const v=f.tiles[0].instVars,oldX=v.X坐标;
  f.runtime.callFunction("删除地图设施",v.X坐标,v.Y坐标,false,false,false,0,false,true);
  f.save.setAt(0,oldX-10000+150,v.Y坐标-10000,6);v.X坐标+=5;f.save.setAt(3,v.X坐标-10000+150,v.Y坐标-10000,6);
  await f.select(0);assert.equal(f.status().options.loop,"research");assert.equal(f.status().running,true);
  f.runtime.callFunction("删除地图设施",v.X坐标,v.Y坐标,false,false,false,0,false,false);
  await f.tick();assert.equal(f.status().visible,false);assert.equal(saved(f,3),undefined);
  [3,21,6,0].forEach((n,field)=>f.save.setAt(n,3,field,21));f.save.setAt(3,v.X坐标-10000+150,v.Y坐标-10000,6);
  await f.select(0);assert.equal(f.status().options.mode,"repeat");
});
test("different rarity targets at two forges neither block each other nor share auto-sell",async()=>{
  const f=fixture(new Map(),true),second=addForge(f);await f.tick();await f.configure({loop:"forge",minimum:3});
  await f.select(second);await f.configure({loop:"forge",minimum:5});await f.tick();
  assert.equal(recipe(f,3),2);assert.equal(recipe(f,10),2);
  f.save.setAt(6,9,1,0);f.complete(0,[59],3);f.complete(second,[59],3);
  assert.equal(f.save.getAt(1,22,7),1);assert.equal(f.save.getAt(2,1,7),0);assert.equal(f.save.getAt(1,2,0),123);
  await f.handlers["craft-sell"]({token:f.status().token,autoSell:false});f.complete(second,[72],3);
  assert.equal(f.save.getAt(2,1,7),2);assert.equal(f.save.getAt(2,22,7),0);assert.equal(saved(f,3).options.autoSell,true);
});
test("concurrent settings writes and manual changes keep both station records",async()=>{
  const f=fixture(new Map(),true);await f.tick();await f.tick();const original=f.runtime.storage.setItem;let release;
  f.runtime.storage.setItem=async(k,v)=>{if(k===key&&!release)await new Promise(r=>{release=r;});return original(k,v);};
  const a=f.configure({loop:"forge"});await new Promise(r=>setImmediate(r));
  await f.select(1);const b=f.configure({loop:"research",autoSell:false});
  f.start(0,3);release();await Promise.all([a,b]);await f.tick();
  assert.equal(saved(f,3).enabled,false);assert.equal(saved(f,3).options.loop,"forge");
  assert.equal(saved(f,4).enabled,true);assert.equal(saved(f,4).options.loop,"research");assert.equal(saved(f,4).options.autoSell,false);
});
test("corrupt saved station settings stop crafting instead of falling back to repeat",async()=>{
  const f=fixture(new Map([[key,{version:1,stations:[{id:3,type:21,owner:6,enabled:true,options:{...options,minimum:99}}]}]]),true);
  await f.tick();await f.tick();f.start(0);f.finish(0);await f.tick();
  assert.equal(f.queue(0),0);assert.equal(f.status().error,true);assert.equal(f.status().enabled,false);
});
test("manual changes and demolition during a pending settings read win over saved automation",async()=>{
  for(const removed of [false,true]) {
    const f=fixture(new Map([[key,{version:1,stations:[{id:3,type:21,owner:6,enabled:true,options}]}]]),true);
    const original=f.runtime.storage.getItem;let release;
    f.runtime.storage.getItem=async k=>{if(k===key)await new Promise(r=>{release=r;});return original(k);};
    await f.tick();
    if(removed)f.runtime.callFunction("删除地图设施",10020,10010,false,false,false,0,false,false);
    else f.start(0,3);
    release();await f.tick();await f.tick();
    if(removed)assert.equal(saved(f,3),undefined);
    else {assert.equal(saved(f,3).enabled,false);assert.equal(recipe(f,3),3);}
  }
});
test("both restricted forge outputs cycle roles and rounds, persist locally, and resume all gear",async()=>{
  for(const [output,recipes,label] of [["weapons",[2,7],"weapon"],["hands",[13,15],"hand piece"]]) {
    const f=fixture(new Map(),true),second=addForge(f);await f.tick();
    await f.configure({forgeOutput:output});await f.tick();
    for(const [expected,bonus] of [[recipes[0],59],[recipes[1],63],[recipes[0],59]]) {
      assert.equal(recipe(f,3),expected);assert.equal(f.remaining(0),10);
      for(let i=0;i<10;i++)f.complete(0,[i===0?bonus:72]);
      await f.tick();
    }
    assert.ok(f.status().message.includes(`Round 2 · Researcher · 0/1 ${label}`));
    assert.equal(saved(f,3).options.forgeOutput,output);assert.equal(saved(f,10).options.forgeOutput,"all");
    const next=fixture(f.stored,true);addForge(next);await next.tick();await next.tick();
    assert.equal(next.status().options.forgeOutput,output);assert.equal(recipe(next,3),recipes[0]);
    await next.select(second);assert.equal(next.status().options.forgeOutput,"all");
    const q=f.queue(0);await f.configure({forgeOutput:"all"});assert.equal(f.queue(0),q);
    for(let i=0;i<10;i++)f.complete(0,[63]);await f.tick();
    assert.equal(recipe(f,3),output==="weapons"?13:2);assert.match(f.status().message,/Round 1 · Forger · 1\/2 pieces/);
  }
});
test("enabling weapons-only finishes and protects a paid hand-gear batch before switching",async()=>{
  const f=fixture(new Map(),true);await f.tick();await f.configure({loop:"forge"});await f.tick();
  for(let i=0;i<10;i++)f.complete(0,[i===0?59:72]);await f.tick();
  assert.equal(recipe(f,3),13);const q=f.queue(0),balance=f.balance();
  await f.configure({loop:"forge",forgeOutput:"weapons"});await f.tick();
  assert.equal(f.queue(0),q);assert.equal(f.remaining(0),10);assert.deepEqual(f.balance(),balance);
  f.save.setAt(6,9,1,0);
  for(let i=0;i<10;i++)f.complete(0,[62]);await f.tick();
  const gloves=[];for(let row=1;row<f.save.width;row++)if(f.save.getAt(row,1,7)===13)gloves.push(f.save.getAt(row,22,7));
  assert.deepEqual(gloves,Array(10).fill(1));assert.equal(recipe(f,3),2);
  assert.match(f.status().message,/Round 2 · Forger · 0\/1 weapon/);
});
test("identical forges start and refill independently for every output mode",async()=>{
  for(const output of ["all","weapons","hands"]) {
    const f=fixture(new Map(),true),second=addForge(f);await f.tick();
    await f.configureAll({loop:"forge",forgeOutput:output});await f.tick();
    const other=f.save.getAt(10,3,21),first=output==="hands"?13:2;
    assert.ok(f.queue(0)>0&&other>0);assert.notEqual(f.queue(0),other);
    assert.equal(recipe(f,3),first);assert.equal(recipe(f,10),first);
    assert.equal(f.save.getAt(other,8,13),10);assert.deepEqual(f.balance(),[9940,9910]);
    for(let i=0;i<10;i++)f.complete(0,[i===0?59:72]);await f.tick();
    assert.equal(f.remaining(0),10);assert.equal(recipe(f,3),output==="all"?13:first);
    assert.equal(f.save.getAt(10,3,21),other);assert.equal(f.save.getAt(other,8,13),10);
    assert.deepEqual(f.balance(),[9920,9880]);
    await f.handlers["craft-pause"]({token:f.status().token});
    await f.select(second);assert.equal(f.status().running,true);assert.equal(f.save.getAt(10,3,21),other);
    const next=fixture(f.stored,true);addForge(next);await next.tick();await next.tick();
    assert.equal(next.queue(0),0);assert.equal(recipe(next,10),first);
  }
});
