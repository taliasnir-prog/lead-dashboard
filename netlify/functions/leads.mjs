import {readAirtable} from '../../server/airtable.mjs';
export function makeHandler(reader=readAirtable,config=process.env){return async event=>{
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(event.httpMethod!=='GET')return {statusCode:405,headers:{...headers,Allow:'GET'},body:JSON.stringify({error:'Method not allowed'})};
 try{return {statusCode:200,headers,body:JSON.stringify({source:'airtable',loadedAt:new Date().toISOString(),leads:await reader(config)})}}
 catch{return {statusCode:502,headers,body:JSON.stringify({error:'לא ניתן לטעון נתונים מ-Airtable. בדקו את החיבור, ההרשאות ותקינות הרשומות.'})}}
}}
export const handler=makeHandler();
