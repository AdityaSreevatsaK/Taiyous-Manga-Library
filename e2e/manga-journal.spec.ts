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
