const fs=require('fs'),vm=require('vm'),assert=require('assert');
let draws=0; const errors=[];
const ctx=new Proxy({}, {get(t,k){if(k in t)return t[k];
  if(k==='createRadialGradient') return ()=>({addColorStop(){}});
  if(k==='drawImage') return ()=>{draws++};
  return ()=>{}; },set(t,k,v){t[k]=v;return true}});
class Img {
 constructor(){this.complete=true;this.naturalWidth=470;this.naturalHeight=340}
 set src(uri){this._src=uri}
}
const URLs={centipede:{idle:'data:c',big:'data:c',atk:'data:c',dmg:'data:c'},boss:{idle:'data:b',big:'data:b',atk:'data:b',dmg:'data:b'}};
const win={ENEMY_HD_URLS:URLs,ATLAS:{frames:{}},Render:{img:()=>null}};
const sandbox={window:win,Image:Img,console:{error:(...x)=>errors.push(x),warn:(...x)=>errors.push(x)}};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('js/art/enemy.js','utf8'),sandbox);
for(const kind of ['centipede','boss']) for(const pose of ['idle','big','atk','dmg']){
 win.Enemy.draw(ctx,kind,200,300,100,1000,{pose,dir:-1,big:pose==='big'});
}
assert.equal(draws,8);
assert.equal(errors.length,0);
console.log('PASS: all 8 approved HD sprites render without legacy atlas');
