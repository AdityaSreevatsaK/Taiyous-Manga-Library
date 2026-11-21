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
 await expect(page.getByRole('heading',{name:'Analytics'})).toBeVisible();
 await expect(page.getByText('10 min')).toBeVisible();
 await expect(page.getByText('8 min').first()).toBeVisible();
 await expect(page.getByRole('heading',{name:'Most read manga'})).toBeVisible();
 await expect(page.getByRole('link',{name:'Sample Manga Journal'}).first()).toBeVisible();
 await expect(page.getByText('Opened chapter')).toBeVisible();
 await expect(page.getByRole('checkbox',{name:'Record reading activity on this device'})).toBeChecked();
 await page.getByRole('button',{name:'Clear analytics'}).click();
 await expect(page.getByRole('group',{name:'Confirm clearing analytics'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Confirm clear analytics'})).toBeDisabled();
 await page.getByLabel('Type CLEAR ANALYTICS to continue').fill('CLEAR ANALYTICS');
 await page.getByRole('button',{name:'Confirm clear analytics'}).click();
 await expect(page.getByText('No tracked reading time yet')).toBeVisible();
});
test('Master edits personal records, protects progress reset and locks source metadata',async({page})=>{
 await mockOwner(page);
 await page.goto('/master');
 await expect(page.getByRole('heading',{name:'Master Controls'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Owner controls'})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Independent owner passphrase'})).toBeVisible();
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
