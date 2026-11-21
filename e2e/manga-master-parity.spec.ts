import {test,expect} from '@playwright/test';
const mangaId='mng_masterrecordtest12345678',chapterId='ch_masterrecordtest123456789';
const manga={kind:'manga',id:mangaId,title:'Sample Manga Journal',aliases:[],
 creators:['Sample Author'],tags:['Adventure'],publicationStatus:'ongoing',
 direction:'vertical',chapters:[{id:chapterId,label:'Chapter 1',sequence:0,pageCount:5}]};
function mockOwner(page:import('@playwright/test').Page){
 return Promise.all([
  page.route('**/api/library',route=>route.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({connected:true,owner:'AdityaSreevatsaK',
      repo:'AdityaSreevatsaK/Taiyous-Manga',revision:'a'.repeat(40),entries:[manga]})})),
  page.route('**/api/master?action=status',route=>route.fulfill({status:200,
    contentType:'application/json',body:JSON.stringify({configured:true,unlocked:false,writeScope:false})})),
 ]);
}
test('real per-series duration, reading actions and privacy controls appear in Analytics',async({page})=>{
 await mockOwner(page);
 await page.addInitScript((id)=>{
   const day=new Date(),key=[day.getFullYear(),String(day.getMonth()+1).padStart(2,'0'),
     String(day.getDate()).padStart(2,'0')].join('-');
   localStorage.setItem('taiyou-manga:usage:v1',JSON.stringify({
     version:1,enabled:true,
     days:{[key]:{appMs:600000,readingMs:480000,offlineMs:120000}},
     mangaReadingMs:{[id]:480000},
     events:[{at:new Date().toISOString(),mangaId:id,kind:'chapter-opened',
       chapterId:'ch_masterrecordtest123456789'}]
   }));
 },mangaId);
 await page.goto('/master?view=analytics');
 await expect(page.getByRole('heading',{name:'Reading analytics'})).toBeVisible();
 await expect(page.getByText('10m')).toBeVisible();
 await expect(page.getByText('8m').first()).toBeVisible();
 await expect(page.getByRole('heading',{name:'Most read manga'})).toBeVisible();
 await expect(page.getByRole('link',{name:'Sample Manga Journal'}).first()).toBeVisible();
 await page.getByText('More manga insights',{exact:true}).click();
 await expect(page.getByText('Opened chapter')).toBeVisible();
 await expect(page.getByRole('checkbox',{name:'Record analytics on this device'})).toBeChecked();
 await page.getByRole('button',{name:'Clear analytics'}).click();
 await expect(page.getByRole('group',{name:'Confirm clearing analytics'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Confirm clear analytics'})).toBeDisabled();
 await page.getByLabel('Type CLEAR ANALYTICS to continue').fill('CLEAR ANALYTICS');
 await page.getByRole('button',{name:'Confirm clear analytics'}).click();
 await expect(page.getByText('Your reading statistics will appear as you read manga chapters.')).toBeVisible();
});
test('Master edits personal records, protects progress reset and locks source metadata',async({page})=>{
 await mockOwner(page);
 await page.goto('/master');
 await expect(page.getByRole('heading',{name:'Master Controls'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Owner controls'})).toBeVisible();
 await expect(page.getByLabel('Independent owner passphrase')).toBeVisible();
 await page.getByRole('button',{name:'Edit record'}).click();
 const editor=page.getByLabel('Edit personal record for Sample Manga Journal');
 await expect(editor).toBeVisible();
 await expect(editor.getByRole('button',{name:'Review source correction'})).toBeDisabled();
 await editor.getByRole('textbox',{name:'Private notes'}).fill('My notes from chapter one.');
 await editor.getByRole('button',{name:'Save rating and notes'}).click();
 await expect(editor.getByRole('status')).toContainText('Rating and notes saved');
 expect(await page.evaluate(id=>localStorage.getItem('taiyou-manga:personal-annotation:v1:'+id),mangaId))
  .toContain('My notes from chapter one.');
 await expect(editor.getByRole('button',{name:'Reset reading progress'})).toBeDisabled();
 await editor.getByRole('button',{name:'Mark personally finished'}).click();
 await expect(editor.getByRole('group',{name:'Confirm mark finished'})).toBeVisible();
 await editor.getByRole('button',{name:'Confirm finished'}).click();
 await expect(editor.getByText('Moved to your Finished shelf')).toBeVisible();
});


test('analytics matches Novel dual-series chart and four-card layout at mobile and desktop widths',async({page})=>{
  await mockOwner(page);
  await page.addInitScript(()=>{
    const today=new Date();
    const day=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),
      String(today.getDate()).padStart(2,'0')].join('-');
    localStorage.setItem('taiyou-manga:usage:v1',JSON.stringify({
      version:1,enabled:true,days:{[day]:{appMs:600000,readingMs:480000,offlineMs:0}},
      mangaReadingMs:{},events:[]
    }));
  });
  for(const width of [320,390,768,1280]){
    await page.setViewportSize({width,height:800});
    await page.goto('/master?view=analytics');
    await expect(page.locator('.manga-usage-metric')).toHaveCount(4);
    await expect(page.getByRole('heading',{name:'Reading analytics'})).toBeVisible();
    await expect(page.getByRole('heading',{name:'Last 14 days'})).toBeVisible();
    await expect(page.locator('.manga-usage-track')).toHaveCount(14);
    await expect(page.getByRole('heading',{name:'Most read manga'})).toBeVisible();
    await expect(page.locator('.manga-usage-more')).not.toHaveAttribute('open','');
    const graph=page.locator('.manga-usage-track').last();
    const app=graph.locator('.manga-usage-app-bar'),reading=graph.locator('.manga-usage-read-bar');
    const a=await app.boundingBox(),r=await reading.boundingBox();
    expect(a&&r,'Both distinct daily series must be rendered').toBeTruthy();
    expect(a!.height,'App series shows collected time').toBeGreaterThan(0);
    expect(r!.height,'Reading series shows collected time').toBeGreaterThan(0);
    expect(r!.x,'Daily series must not overlap').toBeGreaterThanOrEqual(a!.x+a!.width-1);
    expect(await app.evaluate(node=>getComputedStyle(node).backgroundColor)).toBe('rgb(100, 119, 156)');
    expect(await reading.evaluate(node=>getComputedStyle(node).backgroundColor)).toBe('rgb(180, 109, 172)');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});
