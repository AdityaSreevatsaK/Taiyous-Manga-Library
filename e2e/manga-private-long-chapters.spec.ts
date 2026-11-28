import {expect,test} from '@playwright/test';
import {createHash} from 'node:crypto';

/**
 * Synthetic-only full-reader stress harness: no private HF credentials,
 * pages, catalogue exports or third-party artwork are accessed.
 * This checks browser image-source retention, not physical RAM usage.
 */
const png=Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/IX8AAAAASUVORK5CYII=',
  'base64',
);
const sha256=createHash('sha256').update(png).digest('hex');
const repo='AdityaSreevatsaK/Taiyous-Manga';
const revision='b'.repeat(40);
const mangaId='mng_'+'e'.repeat(24);
const chapterId='ch_'+'d'.repeat(24);
const pageId=(index:number)=>'pg_'+index.toString(16).padStart(24,'0');

// These large synthetic DOMs deliberately run sequentially to avoid runner OOM.
test.describe.configure({mode:'serial'});

for(const count of [300,500,1000]){
  test('bounded private browser image sources across '+count+' synthetic pages',async({page})=>{
    test.setTimeout(120_000);
    await page.setViewportSize({width:390,height:844});
    await page.addInitScript(()=>{
      const live=new Set<string>();
      let peak=0;
      const create=URL.createObjectURL.bind(URL);
      const revoke=URL.revokeObjectURL.bind(URL);
      URL.createObjectURL=(blob:Blob)=>{
        const url=create(blob);
        live.add(url);
        peak=Math.max(peak,live.size);
        return url;
      };
      URL.revokeObjectURL=(url:string)=>{live.delete(url);revoke(url);};
      Object.assign(window,{__mangaTestSourceMetrics:{
        retained:()=>live.size,peak:()=>peak,
      }});
    });
    const title='Synthetic '+count+' Page Trial';
    const pages=Array.from({length:count},(_,index)=>({
      id:pageId(index),
      assetPath:'manga/'+mangaId+'/'+chapterId+'/'+pageId(index)+'.png',
      mimeType:'image/png',width:800,height:1200,byteSize:png.length,sha256,
    }));
    const entry={
      kind:'manga',id:mangaId,title,aliases:[],creators:[],tags:[],
      publicationStatus:'ongoing',direction:'vertical',
      chapters:[{id:chapterId,label:'Chapter 1',sequence:0,pageCount:count}],
    };
    let delivered=0;
    await page.route('**/api/auth/session',route=>route.fulfill({
      status:200,contentType:'application/json',
      body:JSON.stringify({connected:true,owner:'AdityaSreevatsaK',repo}),
    }));
    await page.route('**/api/library',route=>route.fulfill({
      status:200,contentType:'application/json',
      body:JSON.stringify({connected:true,owner:'AdityaSreevatsaK',repo,
        revision,entries:[entry]}),
    }));
    await page.route('**/api/media/manifest?*',route=>route.fulfill({
      status:200,contentType:'application/json',
      body:JSON.stringify({revision,manifest:{
        schemaVersion:1,mediaKind:'manga',chapterId,pages,
      }}),
    }));
    await page.route('**/api/media/page?*',route=>{
      const id=new URL(route.request().url()).searchParams.get('pageId');
      if(!id||!pages.some(value=>value.id===id))
        return route.fulfill({status:404});
      delivered++;
      return route.fulfill({status:200,body:png,
        headers:{'Content-Type':'image/png','Content-Length':String(png.length),
          'Cache-Control':'no-store'}});
    });

    const assertBounded=async()=>{
      const measures=await page.evaluate(()=>{
        const metrics=(window as Window & {
          __mangaTestSourceMetrics:{retained:()=>number;peak:()=>number};
        }).__mangaTestSourceMetrics;
        return {retained:metrics.retained(),peak:metrics.peak(),
          mounted:document.querySelectorAll('.vertical-page-image').length,
          overflow:document.documentElement.scrollWidth>window.innerWidth};
      });
      expect(measures.retained,'Only near-viewport blob URLs may stay allocated')
        .toBeLessThanOrEqual(3);
      expect(measures.mounted,'Only near-viewport images may be mounted')
        .toBeLessThanOrEqual(3);
      expect(measures.overflow,'Narrow mobile reader must not overflow').toBe(false);
    };

    await page.goto('/library');
    await page.locator('.book-card').filter({hasText:title}).click();
    await page.getByRole('button',{name:/Chapter 1/}).click({timeout:15_000});
    await expect(page.locator('.vertical-page')).toHaveCount(count);
    await expect(page.locator('.chapter-preload-message'))
      .toContainText('Chapter verified',{timeout:100_000});
    expect(delivered,'The complete chapter must be checked').toBeGreaterThanOrEqual(count);
    await assertBounded();

    await page.getByRole('combobox',{name:'Jump within chapter'})
      .selectOption(String(count-1));
    await expect(page.locator('.page-navigation')).toContainText('Page '+count+' of '+count);
    await expect(page.locator('.vertical-page-image').last()).toBeVisible();
    await assertBounded();

    await page.getByRole('combobox',{name:'Jump within chapter'}).selectOption('0');
    await expect(page.locator('.page-navigation')).toContainText('Page 1 of '+count);
    await expect(page.locator('.vertical-page-image').first()).toBeVisible();
    await assertBounded();
  });
}
