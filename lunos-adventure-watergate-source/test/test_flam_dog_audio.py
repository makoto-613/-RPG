from playwright.sync_api import sync_playwright
from pathlib import Path
import json
html = (Path(__file__).resolve().parent.parent / 'dist' / 'standalone.html').read_text()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
    page = b.new_page()
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.set_content(html, wait_until='domcontentloaded', timeout=40000)
    res=page.evaluate('''async () => {
        const dog = ['犬の鳴き声1.mp3','犬の鳴き声2.mp3','犬の鳴き声3.mp3','犬の鳴き声4.mp3'];
        const urls = dog.map(n=>window.AUDIO_FILES[n]);
        if(urls.some(v=>!v || !v.startsWith('data:audio/'))) return {ok:false, why:'Missing embedded dog audio', present:urls.map(Boolean)};
        const durations=await Promise.all(urls.map(u=>new Promise((resolve)=>{
            const a=new Audio(u); a.onloadedmetadata=()=>resolve(a.duration); a.onerror=()=>resolve(-1); a.load();
            setTimeout(()=>resolve(-2),5000);
        })));
        window.Sound.unlock();
        await new Promise(r=>setTimeout(r,750));
        const loaded=window.Sound.seLoaded();
        window.Sound.sfx('bark','howl');
        return {ok:durations.every(x=>x>0), durations, loaded, active:window.Sound.seActive(), howl:window.AUDIO.SE.bark.alt.howl};
    }''')
    print(json.dumps({'result':res,'page_errors':errors},ensure_ascii=False))
    b.close()

