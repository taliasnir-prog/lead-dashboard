import {test,expect} from '@playwright/test';import {createDemoLeads} from '../../js/demo-data.js';
test.beforeEach(async({page})=>{await page.clock.install({time:new Date('2026-11-10T10:00:00Z')});await page.route('**/api/leads',r=>r.fulfill({json:{source:'airtable',leads:createDemoLeads('2026-11-10').slice(0,3)}}));});
test('AC-12.1 AC-12.3 shows three sorted upcoming public holidays with a source link',async({page})=>{
await page.route('https://www.hebcal.com/**',r=>r.fulfill({json:{items:[{category:'holiday',date:'2026-11-13',hebrew:'ג'},{category:'holiday',date:'2026-11-11',hebrew:'א'},{category:'holiday',date:'2026-11-12',hebrew:'ב'},{category:'holiday',date:'2026-11-14',hebrew:'ד'},{category:'holiday',date:'2026-11-09',hebrew:'ישן'}]}}));
await page.goto('./?source=airtable');const panel=page.getByTestId('holidays');await expect(panel.getByRole('listitem')).toHaveText(['א | 11/11/2026','ב | 12/11/2026','ג | 13/11/2026']);await expect(panel.getByRole('link',{name:'Hebcal'})).toHaveAttribute('href','https://www.hebcal.com/');
});
test('AC-12.2 holiday source failure does not block the Airtable leads',async({page})=>{
await page.route('https://www.hebcal.com/**',r=>r.fulfill({status:503,body:'unavailable'}));await page.goto('./?source=airtable');await expect(page.getByTestId('holidays')).toContainText('לא ניתן לטעון כרגע את המועדים');await expect(page.getByTestId('metric-total')).toHaveText('3');await expect(page.getByTestId('holidays').getByRole('listitem')).toHaveCount(0);
});
