import {test,expect} from '@playwright/test';
import {parseJournalFields} from '../src/domain/journal';
const now='2026-01-01T00:00:00.000Z';
const entry={...parseJournalFields({title:'Synthetic Reading Record',status:'Reading',authors:['Synthetic Author'],rating:8}),schemaVersion:1,id:'jrn_'+'a'.repeat(32),revision:1,createdAt:now,updatedAt:now,deletedAt:null};
test('Journal remains accessible during catalogue failure, filters and fits responsive widths',async({page})=>{
 await page.route('**/api/library',route=>route.fulfill({status:503,json:{error:'Synthetic outage'}}));
 await page.route('**/api/journal?*',route=>route.fulfill({json:{schemaVersion:1,entries:[entry],nextCursor:null}}));
 for(const width of [320,390,768,1280]){
  await page.setViewportSize({width,height:900});
  await page.goto('/journal');
  await expect(page.getByRole('heading',{name:'Manga Reading Journal'})).toBeVisible();
  await expect(page.getByText('Synthetic Reading Record',{exact:true})).toBeVisible();
  await expect(page.getByText('Availability unknown',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
  await page.getByLabel('Search Journal').fill('no match');
  await expect(page.getByText('No matching entries.')).toBeVisible();
 }
});
test('unauthenticated Journal does not show private entries',async({page})=>{
 await page.route('**/api/library',route=>route.fulfill({status:401,json:{error:'Sign in'}}));
 await page.route('**/api/journal?*',route=>route.fulfill({status:401,json:{error:'Sign in'}}));
 await page.goto('/journal');
 await expect(page.getByRole('alert')).toContainText('Sign in');
 await expect(page.getByRole('button',{name:'Add manga'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Export JSON'})).toBeDisabled();
});

test('backup preview is non-destructive and restores only reviewed missing identities',async({page})=>{
 const missing={...entry,id:'jrn_'+'b'.repeat(32),title:'Synthetic removed backup',revision:3,deletedAt:now};
 const changed={...entry,title:'Synthetic conflicting backup'};
 await page.route('**/api/journal?*',route=>route.fulfill({json:{schemaVersion:1,entries:[entry],nextCursor:null}}));
 await page.route('**/api/journal/backup/preview',route=>route.fulfill({json:{version:1,rows:[
  {id:missing.id,status:'addition'},{id:changed.id,status:'conflict',reason:'Existing ID has different data; never overwritten'}]}}));
 await page.route('**/api/journal/backup/restore',route=>{
  expect(route.request().postDataJSON()).toEqual({version:1,entries:[missing]});
  return route.fulfill({json:{count:1,replayed:false}});
 });
 await page.goto('/journal');
 await page.getByRole('button',{name:'Backup and recovery'}).click();
 await page.getByLabel('Choose Journal backup JSON').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'taiyou-manga-journal',schemaVersion:1,exportedAt:now,entries:[missing,changed]}))});
 await page.getByRole('button',{name:'Review recovery batch'}).click();
 await expect(page.getByText('Synthetic removed backup · addition')).toBeVisible();
 await expect(page.getByText(/Synthetic conflicting backup · conflict/)).toBeVisible();
 await page.getByRole('button',{name:'Confirm recovery of 1 missing records'}).click();
 await expect(page.getByText('Recovered 1 missing records. Existing differences were not changed.')).toBeVisible();
});
