
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const registry=fs.readFileSync('js/art/chars.js','utf8');
const dir='assets/character_hd';
const urls={}; for(const fn of fs.readdirSync(dir).filter(n=>n.endsWith('.webp'))){
 let m=/^(luno|flam|albo|amina)_([a-z_0-9]+)\.webp$/.exec(fn);
 if(m)(urls[m[1]] ||= {})[m[2]]='mock:'+fn;
}
class ImageMock{
 constructor(){this.complete=false;this.naturalWidth=0;this.naturalHeight=0;}
 set src(s){this._src=s;this.complete=true;this.naturalWidth=320;this.naturalHeight=480;}
 addEventListener(){}
}
const ctx={window:{CHARACTER_HD_URLS:urls},Image:ImageMock,console};
vm.createContext(ctx);vm.runInContext(registry,ctx);
const art=ctx.window.CharArt;
// 謎解き・戦闘で歩く絵と、台詞の枠の顔で使うポーズ（どれも、ご提供の絵がそろっていること。足りないと idle で代わりに描き、警告が出る）
const required={
 luno:['idle','determined',...['down','left','right','up'].flatMap(d=>[0,1,2,3].map(i=>'walk_'+d+i))],
 flam:['idle','bark','guard',...['down','left','right','up'].flatMap(d=>[0,1,2,3].map(i=>'walk_'+d+i))]
};
let count=0;
for(const [who,poses] of Object.entries(required)){
 for(const pose of poses){
  assert(art.get(who,pose), `${who}:${pose} has no approved sprite`);
  count++;
 }
}
for(const who of ['luno','flam']){
 for(const d of ['up','down','left','right']){
  for(let i=0;i<4;i++){
   assert(art.getSprite(`${who}_${d}${i}`),`${who}_${d}${i}`);
   count++;
  }
 }
}
let drawn=0;
const fake={canvas:{width:200,height:200},save(){},restore(){},drawImage(){drawn++},translate(){},scale(){},beginPath(){},rect(){},clip(){}};
assert(art.draw(fake,'luno','walk_left0',100,180,110));
assert(art.draw(fake,'flam','guard',100,180,65));
assert(drawn===2);
for(const [file,fragments] of Object.entries({
 'js/novel/stage.js':['window.CharArt.get(', 'window.CharArt.fromSprite(', 'const NOVEL_CHAR = window.CharArt.novel', "drawNovelPortrait(k, c, slots[k] ?? 0.5, now)", "NOVEL_CHAR[k][pose + (k === 'flam' ? '_cut' : '')]", "NOVEL_CHAR.albo[c.p === 'bed_sleep' ? 'bed_sleep' : 'bed_up']"],
 'js/puzzle/render.js':['window.CharArt.fromSprite(n)', 'window.CharArt.get(spec.who,spec.pose)', 'window.CharArt.fromSprite(name)'],
 'js/battle/battle.js':['window.CharArt.fromSprite(n)', 'window.CharArt.draw(ctx,ref.who,ref.pose']
})){
 const flat=(t)=>t.replace(/\s+/g,'');   // 改行・空白の入れ方が変わっても、中身で確かめる
 const source=flat(fs.readFileSync(file,'utf8'));
 for(const piece of fragments)assert(source.includes(flat(piece)),`${file} missing ${piece}`);
}
assert(art.status().diagnostics.length===0, 'missing poses: '+art.status().diagnostics.join(', '));
// 物語の会話の場面の立ち絵（assets/character_novel）：story.js で使うポーズが、どれも絵を持つこと（読みかえは stage_data.js の VN_POSE_ALT）
global.window={};require('../js/data/stage_data.js');require('../js/data/story.js');
const ALT=window.StageData.ST.VN_POSE_ALT, nv=new Set(fs.readdirSync('assets/character_novel').map(n=>n.replace(/\.webp$/,'')));
const storySrc=fs.readFileSync('js/data/story.js','utf8');let nvCount=0;
for(const who of ['luno','flam','albo','amina']){
 const used=new Set([...storySrc.matchAll(new RegExp(who+":\\s*\\['([a-z_]+)'",'g'))].map(m=>m[1]));
 for(const p of used){
  const q=who==='albo'&&/^bed/.test(p)?(p==='bed'?'bed_up':'bed_sleep'):p, f=(x)=>who+'_'+x+(who==='flam'?'_cut':''); // ベッドのアルボは、ベッドごと描いた絵（bed_up・bed_sleep）
  assert(nv.has(f(q))||(ALT[who]&&ALT[who][q]&&nv.has(f(ALT[who][q]))),`novel image missing: ${who}:${q}`);nvCount++;
 }
}
console.log(`OK: novel portraits for ${nvCount} story poses`);
console.log(`OK: ${count} character pose/direction paths; 2 draw calls; 3 renderer integrations; loaded ${art.status().loaded}/${art.status().total}; warnings ${art.status().diagnostics.length}`);
