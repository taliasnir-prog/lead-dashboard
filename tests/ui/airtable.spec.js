import {test,expect} from '@playwright/test';
import {createDemoLeads} from '../../js/demo-data.js';
const initial=createDemoLeads('2026-11-10').slice(0,3);
test.beforeEach(async({page})=>{await page.route('https://www.hebcal.com/**',r=>r.fulfill({json:{items:[{category:'holiday',date:'2027-01-01',hebrew:'מועד בדיקה'}]}}));});
test('AC-11.1 AC-11.3 live source, refresh and read-only details',async({page})=>{
 let leads=initial;
 await page.route('**/api/leads',r=>r.fulfill({json:{source:'airtable',leads}}));
 await page.goto('./?source=airtable');
 await expect(page.getByTestId('metric-total')).toHaveText('3');
 await expect(page.getByTestId('airtable-status')).toContainText('נטענו 3');
 await expect(page.getByTestId('add-lead-button')).toBeHidden();
 await expect(page.getByTestId('reset-button')).toBeHidden();
 await page.getByTestId('details-button').first().click();
 await expect(page.getByTestId('field-status')).toBeDisabled();
 await expect(page.getByTestId('dialog-save')).toBeHidden();
 await page.getByTestId('dialog-cancel').click();
 leads=initial.slice(0,1);
 await page.getByTestId('airtable-refresh').click();
 await expect(page.getByTestId('metric-total')).toHaveText('1');
 expect(await page.evaluate(()=>localStorage.getItem('leadDashboard.v1'))).toBeNull();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('AC-11.2 upstream failure shows an error and no demo fallback',async({page})=>{
 await page.route('**/api/leads',r=>r.fulfill({status:502,json:{error:'failure'}}));
 await page.goto('./?source=airtable');
 await expect(page.getByTestId('airtable-status')).toContainText('לא ניתן לטעון');
 await expect(page.getByTestId('metric-total')).toHaveText('0');
 await expect(page.getByTestId('airtable-refresh')).toBeEnabled();
});
test('AC-11.1 empty base is valid',async({page})=>{
 await page.route('**/api/leads',r=>r.fulfill({json:{source:'airtable',leads:[]}}));
 await page.goto('./?source=airtable');
 await expect(page.getByTestId('airtable-status')).toContainText('נטענו 0');
 await expect(page.getByTestId('metric-total')).toHaveText('0');
});
