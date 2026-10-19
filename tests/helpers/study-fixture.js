"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const settle = () => new Promise(resolve => setImmediate(resolve));
const clone = x => x == null ? x : JSON.parse(JSON.stringify(x));
const storageKey = "cjs-formations:study:v1:12345678";

function fixture(stored = new Map()) {
  let clock = 0;
  const cells = new Map(), calls = [], methods = new Map(), groups = new Map(), handlers = {}, messages = [], notifications = [];
  groups.set("获得铜钱function", { active: true, IsGroupActive() { return this.active; } });
  const save = { uid: 100, width: 80, getAt: (...args) => cells.get(args.join()) ?? 0,
    setAt: (value, ...args) => cells.set(args.join(), value) };
  const research = {}, classes = {};
  for (const [id, prerequisite] of [[1,0],[2,1],[11,2],[22,2],[23,2],[24,2],[25,2]]) {
    research[id] = { 0:id,1:`Regular ${id}`,2:"基础",5:1,7:prerequisite }; save.setAt(1,id,4,0);
  }
  for (const [id, category] of [[31,"团队"],[32,"团队"],[33,"团队"],[34,"采集"],[35,"采集"],[36,"采集"],
    [37,"制造"],[38,"制造"],[39,"制造"],[40,"发展"],[41,"发展"],[42,"修炼"],[43,"发展"],[44,"修炼"]]) {
    research[id] = {0:id,1:`Topic ${id}`,2:category,5:300};
  }
  research[40][15] = "研究";
  for (const [id, name] of [[31,"主堂技术"],[32,"营房技术"],[33,"招募技术"],[34,"伐木技术"],
    [36,"采矿技术"],[40,"研究技术"],[41,"操练技术"]]) research[id][1] = name;
  for (const [id, rank, prerequisite, family] of [[1,1,0,1],[2,2,1,1],[3,2,1,1],[4,3,2,1],[5,3,2,2],
    [8,4,4,1],[9,4,4,1],[16,5,8,1]]) classes[id] = {0:id,1:`Class ${id}`,3:rank,4:family,10:prerequisite};
  const kj = { width: 50, getAt: (id, field) => research[id]?.[field] ?? 0 };
  const zy = { width: 50, getAt: (id, field) => classes[id]?.[field] ?? 0 };
  const ss = { getAt: (type, field) => field === 30 ? ({1:8,11:9})[type] : 0 };
  const g = { 主地图编号起始:10000, 当前地图编号:28, 职业等级上限:30, 选中地块X:44, 选中地块Y:55, 游戏暂停:true };
  const tiles = [], menus = [];
  const objects = { save:[save],ss:[ss],kj:[kj],zy:[zy],地面:tiles,底部菜单背景:menus,二级页面背景:[],转场云:[],世界地图:[],黑幕:[],设施搬迁拖动点:[] };
  const runtime = { layout:{name:"主界面"},timeScale:1,globalVars:g,
    objects:Object.fromEntries(Object.entries(objects).map(([name, list]) => [name,{getAllInstances:()=>list,getFirstInstance:()=>list[0]}])),
    storage:{getItem:async k=>clone(stored.get(k)),setItem:async(k,v)=>{stored.set(k,clone(v));}},
    callFunction(name,...args) {
      calls.push([name,...args]); const fn=methods.get(name); assert.ok(fn,`Unexpected function ${name}`);
      const previous=fn.params;fn.params=args;
      try { return fn.block._RunAndBlock(); } finally { fn.params=previous; }
    },
  };
  function native(name, body) {
    const fn={params:[],CaptureFunctionParameters(){return this.params;},GetEventBlock(){return this.block;}};
    fn.block={_RunAndBlock:()=>body(...fn.params)};methods.set(name,fn);
    groups.set(name+"function",{active:true,IsGroupActive(){return this.active;}});
  }
  const stationAt=(x,y)=>save.getAt(x-10000+150,y-10000,6);
  const kind=id=>ss.getAt(save.getAt(id,1,21),30);
  const levelField=id=>kind(id)===8?4:5;
  const activeField=id=>kind(id)===8?13:15;
  const cap=(id,target)=>kind(id)===8 ? runtime.callFunction("科技等级上限",target,save.getAt(save.getAt(id,2,21),5,1)) :
    Math.min(g.职业等级上限,runtime.callFunction("操练等级上限",save.getAt(save.getAt(id,2,21),5,1)));
  const cost=(id,target)=>runtime.callFunction(kind(id)===8?"科技货币需求":"操练货币需求",target);
  native("科技等级上限",(target,level)=>research[target]?.[2]==="基础"?1:(level+1)*3);
  native("操练等级上限",level=>3+level);
  native("转职等级要求",id=>id===1?1:2);
  native("操练按钮解锁判断",()=>f.familyOpen?1:0);
  native("科技货币需求",target=>100+save.getAt(target,4,0)*10);
  native("操练货币需求",target=>100+save.getAt(target,5,0)*10);
  native("文本",text=>text);
  native("相同进程检测",()=>0);
  native("生成单体设施",()=>{});
  for(const name of ["关闭二级页面","刷新底部菜单","界面音效"])native(name,()=>{f.ui.push(name);});
  for(const [name,expected] of [["科技研究",8],["职业操练",9]])native(name,target=>{
    const id=stationAt(g.选中地块X,g.选中地块Y);
    if(f.refuse || kind(id)!==expected || save.getAt(id,3,21)>0 || save.getAt(target,levelField(id),0)>=cap(id,target) || save.getAt(1,2,0)<cost(id,target))return;
    for(let row=1;row<save.width;row++)if(kind(row)===expected&&save.getAt(row,3,21)===target)return;
    save.setAt(save.getAt(1,2,0)-cost(id,target),1,2,0);
    save.setAt(target,id,3,21);save.setAt(1,target,activeField(id),0);
    runtime.callFunction("界面音效","装上");runtime.callFunction("关闭二级页面",true);runtime.callFunction("刷新底部菜单");
    runtime.callFunction("生成单体设施");
  });
  native("采集核心碰撞",(_,uid)=>{
    const tile=tiles.find(t=>t.uid===uid),v=tile.instVars,id=stationAt(v.X坐标,v.Y坐标),target=save.getAt(id,3,21);
    if(!target)return;
    const field=levelField(id),progress=kind(id)===8?12:14;
    if(save.getAt(target,progress,0)<100)return;
    save.setAt(save.getAt(target,field,0)+1,target,field,0);save.setAt(0,target,progress,0);
    if(save.getAt(id,5,21)===1&&save.getAt(target,field,0)<cap(id,target)&&save.getAt(1,2,0)>=cost(id,target)) {
      save.setAt(save.getAt(1,2,0)-cost(id,target),1,2,0);
    } else {save.setAt(0,id,3,21);save.setAt(0,target,activeField(id),0);}
  });
  native("取消设施进程",(x,y)=>{
    const id=stationAt(x,y),target=save.getAt(id,3,21);
    if(target){save.setAt(save.getAt(1,2,0)+cost(id,target),1,2,0);save.setAt(0,target,activeField(id),0);}
    save.setAt(0,id,3,21);
  });
  native("删除地图设施",(x,y,a,b,c,d,e,moving)=>{
    const id=stationAt(x,y);runtime.callFunction("取消设施进程",x,y,false,0);
    if(!moving)for(let field=0;field<10;field++)save.setAt(0,id,field,21);
  });
  const engine = {GetMainRunningLayout:()=>runtime.layout,
    GetEventSheetManager:()=>({GetFunctionBlockByName:name=>methods.get(name),GetEventGroupByName:name=>groups.get(name)}),
    AddDOMComponentMessageHandler:(_,name,handler)=>{handlers[name]=handler;},
    PostComponentMessageToDOM:(_,name,data)=>{messages.push([name,clone(data)]);},FlushPendingInstances(){} };
  const sandbox={BanditFormations:{},performance:{now:()=>clock},console:{error(){}}};vm.createContext(sandbox);
  for(const name of ["study.js","study-runtime.js"])vm.runInContext(fs.readFileSync(`${__dirname}/../../src/${name}`,"utf8"),sandbox);
  const loop=sandbox.BanditFormations.attachStudy(runtime,engine,text=>notifications.push(text));
  save.setAt(12345678,0,1,0);save.setAt(100000,1,2,0);
  const f={save,kj,zy,ss,research,classes,g,tiles,menus,objects,runtime,engine,calls,methods,groups,stored,handlers,messages,notifications,loop,ui:[],familyOpen:true,
    status:()=>messages.filter(m=>m[0]==="study-status").at(-1)?.[1],
    queue:index=>save.getAt(index+1,3,21),
    async tick(){clock+=1000;loop.tick();await settle();},
    async ready(){await this.tick();g.游戏暂停=false;},
    select(index){menus.length=0;if(index!=null){const v=tiles[index].instVars;menus.push({instVars:{功能:"设施",X坐标:v.X坐标,Y坐标:v.Y坐标}});}},
    token(index){const v=tiles[index].instVars,id=index+1,epoch=this.status()?.token?.split(":")[2]||0;
      return `${save.getAt(0,1,0)}:${save.uid}:${epoch}:${id}:${v.设施编号}:${save.getAt(id,2,21)}:${v.X坐标}:${v.Y坐标}`;},
    enabled(kind,enabled,index=kind==="research"?0:1){const before=menus.slice();this.select(index);
      handlers["study-enabled"]({token:this.token(index),kind,enabled});menus.splice(0,menus.length,...before);},
    choose(index,target){const v=tiles[index].instVars;g.选中地块X=v.X坐标;g.选中地块Y=v.Y坐标;runtime.callFunction(kind(index+1)===8?"科技研究":"职业操练",target,0);},
    complete(index){const target=this.queue(index);save.setAt(100,target,kind(index+1)===8?12:14,0);runtime.callFunction("采集核心碰撞",1,tiles[index].uid);},
    cancel(index){const v=tiles[index].instVars;runtime.callFunction("取消设施进程",v.X坐标,v.Y坐标,false,0);},
    add(kind=8){const id=tiles.length+1,owner=id+10,type=kind===8?1:11,x=10020+id,y=10010;
      const tile={uid:200+id,instVars:{用途:"主地图",设施编号:type,X坐标:x,Y坐标:y,有效解锁:true,资源类型:""}};tiles.push(tile);
      for(const [field,value] of [[0,id],[1,type],[2,owner],[3,0],[5,1]])save.setAt(value,id,field,21);
      save.setAt(id,x-10000+150,y-10000,6);save.setAt(kind===8?5:6,owner,1,1);return tile;},
  };
  f.add(8);f.add(9);f.select(0);return f;
}
module.exports={fixture,settle,storageKey};
