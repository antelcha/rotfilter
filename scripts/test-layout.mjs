import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// A separate, temporary browser profile. No user cookies, key, or live requests.
const browser = await chromium.launch(process.env.ROTFILTER_TEST_BROWSER
  ? { executablePath: process.env.ROTFILTER_TEST_BROWSER, headless: true }
  : { channel: 'chrome', headless: true });
const css = await readFile('dist/content.css', 'utf8');
const script = await readFile('dist/content.js', 'utf8');
try {
  for (const [theme, background, color] of [['light','#fff','#0f1419'],['dim','#15202b','#f7f9f9'],['dark','#000','#e7e9ea']]) {
    const page = await browser.newPage({viewport:{width:1000,height:900}});
    const errors=[]; page.on('pageerror', error=>errors.push(error.message));
    await page.route('**/*', route=>route.fulfill({contentType:'text/html',body:`<!doctype html>
      <style>body{margin:0;background:${background};color:${color};font:16px Arial}
      main{width:600px;margin:0 auto}article{position:relative;display:flex;padding:12px 16px;border-bottom:1px solid #777;box-sizing:content-box}
      .content{width:100%}p{line-height:24px}.media{height:190px;background:#485d68}
      article:hover{background:rgba(127,127,127,.05)}article:hover span{visibility:visible!important;opacity:1!important}
      #after{height:1200px}</style><main><section aria-label="Timeline">
      <article data-testid="tweet" id="one"><div class="content" aria-hidden="false"><a href="/tester/status/1"><time>now</time></a>
      <p data-testid="tweetText">A sufficiently long test post to exercise text-only classification and layout preservation.</p><div class="media"></div><a href="#action">Original action</a><span>Text</span></div></article>
      <article data-testid="tweet" id="two"><div class="content"><a href="/tester/status/2"><time>now</time></a><p data-testid="tweetText">Useful specific information stays visible in the next post.</p></div></article>
      <article data-testid="tweet" id="three"><div class="content" inert aria-hidden="true"><a href="/tester/status/3"><time>now</time></a><p data-testid="tweetText">Another test post with existing accessibility attributes to preserve.</p></div></article>
      </section><div id="after"></div></main>`}));
    await page.goto('https://x.com/home');
    await page.addStyleTag({content:css});
    await page.evaluate(()=>{
      window.saved = document.querySelector('#one').outerHTML;
      window.requestCount=0; window.articleClicks=0;
      window.__testSettings={enabled:true,configured:true,filterHash:'f1',label:'bullshit'};
      window.chrome={runtime:{id:'fixture-extension',
        sendMessage:async msg=>{
          if(msg.type==='GET_PUBLIC_SETTINGS')return window.__testSettings;
          if(msg.type==='EVALUATE_POST'){
            window.requestCount++;
            return {ok:true,classification:{decision:msg.payload.post.id==='2'?'keep':'filter',model:'fixture'}};
          }
          return {ok:true};
        },onMessage:{addListener:fn=>window.settingsChanged=fn}
      }};
      document.querySelector('#one').addEventListener('mouseenter',e=>{e.currentTarget.className='x-replaced-hover-class'});
      document.querySelector('#one').addEventListener('click',()=>window.articleClicks++);
    });
    const layout=()=>page.evaluate(()=>({scroll:scrollY,boxes:['one','two','three'].map(id=>{
      const r=document.getElementById(id).getBoundingClientRect();return [r.x,r.y,r.width,r.height];
    })}));
    const baseline=await layout();
    await page.addScriptTag({content:script});
    await page.waitForSelector('#one[data-rotfilter-masked]');
    assert.deepEqual(await layout(),baseline,`${theme}: masking must not move any tweet`);
    await page.locator('#one').hover();
    assert.equal(await page.locator('#one').getAttribute('class'),'x-replaced-hover-class');
    assert.equal(await page.locator('#one > .content').evaluate(e=>getComputedStyle(e).opacity),'0');
    assert.deepEqual(await layout(),baseline,`${theme}: hovering must not move any tweet`);
    // X replaces children or removes our overlay: original controls become inert again.
    await page.evaluate(()=>{
      document.querySelector('#one > .content').replaceWith(document.querySelector('#one > .content').cloneNode(true));
      document.querySelector('#one [data-rotfilter-ui="mask"]').remove();
    });
    await page.waitForSelector('#one [data-rotfilter-ui="mask"]');
    assert.equal(await page.locator('#one > .content').evaluate(e=>e.inert),true);
    assert.deepEqual(await layout(),baseline,`${theme}: mask repair must not change layout`);
    // The same tweet returns in an entirely new article; use the local score before paint.
    const requests=await page.evaluate(()=>window.requestCount);
    await page.evaluate(()=>document.querySelector('#one').outerHTML=window.saved);
    const restored=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>resolve({masked:document.querySelector('#one').hasAttribute('data-rotfilter-masked'),requests:window.requestCount}))));
    assert.deepEqual(restored,{masked:true,requests});
    assert.deepEqual(await layout(),baseline,`${theme}: remount must not change layout`);
    // Media may expand naturally. Removing the mask must still change no geometry.
    await page.evaluate(()=>document.querySelector('#one .media').style.height='260px');
    const expanded=await layout();
    assert.equal(expanded.boxes[0][3]-baseline.boxes[0][3],70);
    await page.locator('#one').getByRole('button',{name:'Show filtered post'}).focus();
    await page.keyboard.press('Enter');
    await page.waitForSelector('#one:not([data-rotfilter-masked])');
    assert.deepEqual(await layout(),expanded,`${theme}: show/feedback must not move following posts`);
    assert.equal(await page.locator('#one > .content').evaluate(e=>e.inert),false);
    assert.equal(await page.locator('#one > .content').getAttribute('aria-hidden'),'false');
    assert.equal(await page.evaluate(()=>window.articleClicks),0);
    await page.locator('#one').getByRole('button',{name:'wrong call'}).click();
    assert.deepEqual(await layout(),expanded,`${theme}: feedback must not change geometry`);
    await page.evaluate(()=>document.querySelector('#one').outerHTML=window.saved);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
    assert.equal(await page.locator('#one').getAttribute('data-rotfilter-state'),'revealed');
    assert.equal(await page.locator('#one [data-rotfilter-ui="mask"]').count(),0);
    // Pause restores pre-existing inert/aria-hidden exactly; resume reapplies scores.
    await page.evaluate(()=>window.settingsChanged({type:'SETTINGS_CHANGED',settings:{...window.__testSettings,enabled:false}}));
    assert.equal(await page.locator('#three > .content').getAttribute('aria-hidden'),'true');
    assert.equal(await page.locator('#three > .content').evaluate(e=>e.inert),true);
    assert.equal(await page.locator('[data-rotfilter-ui="mask"]').count(),0);
    await page.evaluate(()=>window.settingsChanged({type:'SETTINGS_CHANGED',settings:window.__testSettings}));
    await page.waitForSelector('#three[data-rotfilter-masked]');
    assert.equal(await page.locator('#one [data-rotfilter-ui="mask"]').count(),0);
    assert.deepEqual(errors,[]);
    console.log(`${theme}: hover, rerender, remount, reveal, feedback, accessibility and pause/resume passed; mask/reveal layout delta = 0px`);
    await page.close();
  }
} finally { await browser.close(); }
