import {isValidDateString} from './logic.js';
export function upcomingHolidays(items,today){
 if(!Array.isArray(items))throw Error('Invalid calendar');
 return items.filter(x=>x.category==='holiday'&&isValidDateString(x.date)&&x.date>=today&&typeof (x.hebrew??x.title)==='string').sort((a,b)=>a.date.localeCompare(b.date)).slice(0,3).map(x=>({date:x.date,title:x.hebrew??x.title}));
}
export async function showHolidays(){
 const panel=document.createElement('section');panel.className='section panel';panel.setAttribute('aria-labelledby','holidays-title');panel.dataset.testid='holidays';
 const heading=document.createElement('h2');heading.id='holidays-title';heading.textContent='מועדים קרובים לתכנון מעקב';
 const status=document.createElement('p');status.setAttribute('role','status');status.textContent='טוען מועדים...';
 const list=document.createElement('ul');
 const note=document.createElement('p');note.className='hint';note.append('מקור ציבורי: ');const link=document.createElement('a');link.href='https://www.hebcal.com/';link.textContent='Hebcal';note.append(link,'. המועדים מוצגים לתכנון בלבד ואינם משנים תאריכי מעקב.');
 panel.append(heading,status,list,note);document.querySelector('main').append(panel);
 try{
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const get=t=>parts.find(p=>p.type===t).value;const today=get('year')+'-'+get('month')+'-'+get('day');const end=(Number(get('year'))+1)+'-'+get('month')+'-'+get('day');
  const url=new URL('https://www.hebcal.com/hebcal');url.search=new URLSearchParams({v:'1',cfg:'json',start:today,end,maj:'on',min:'on',mod:'on',i:'on',lg:'he'});
  const response=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Calendar unavailable');
  const events=upcomingHolidays((await response.json()).items,today);
  for(const item of events){const li=document.createElement('li');li.textContent=item.title+' | '+item.date.split('-').reverse().join('/');list.append(li);}
  status.textContent=events.length?'מועדים לפי לוח ישראל. עודכן כעת.':'לא נמצאו מועדים בטווח שנבדק.';
 }catch{status.textContent='לא ניתן לטעון כרגע את המועדים. נתוני הלידים ממשיכים לעבוד כרגיל.';}
}
