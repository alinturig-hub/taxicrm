import assert from 'node:assert/strict';
import { encode } from 'next-auth/jwt';
import { createRequire } from 'node:module';
import { prisma } from '../../src/lib/prisma.ts';
const {chromium}=createRequire(import.meta.url)('playwright');
assert.equal(process.env.SENDGRID_SYNTHETIC_QA,'1');
const target = new URL(process.env.DATABASE_URL || '');
assert.equal(target.hostname,'127.0.0.1'); assert.equal(target.pathname,'/sendgrid_qa'); assert.equal(target.username,'sendgrid_qa');
const origin='http://127.0.0.1:3015', users=[]; let browser;
try {
 for(const role of ['ADMIN','MANAGER']) users.push(await prisma.user.create({data:{email:`synthetic-${role.toLowerCase()}@example.test`,name:'Synthetic',role,passwordHash:'synthetic-only'}}));
 const token=async u=>encode({secret:process.env.NEXTAUTH_SECRET,token:{id:u.id,sub:u.id,email:u.email,name:u.name,role:u.role,mustChangePassword:false},maxAge:3600});
 const admin=await token(users[0]),manager=await token(users[1]);
 const req=(method,token,body,originHeader=origin)=>fetch(origin+'/api/dashboard/integrations/sendgrid',{method,headers:{cookie:'next-auth.session-token='+token,origin:originHeader,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await fetch(origin+'/api/dashboard/integrations/sendgrid')).status,403);
 assert.equal((await req('GET',manager)).status,403);
 assert.equal((await req('PUT',admin,{},'https://other.example')).status,403);
 const original=await (await req('GET',admin)).json();assert.equal(original.storageReady,true);assert.equal(original.configured,false);
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const ctx=await browser.newContext({viewport:{width:390,height:844}});await ctx.addCookies([{name:'next-auth.session-token',value:admin,url:origin}]);const page=await ctx.newPage();await page.goto(origin+'/dashboard/configuration/sms');await page.getByRole('heading',{name:'Email · SendGrid'}).waitFor();await page.getByLabel('Sender name').fill('Synthetic');await page.getByLabel('Sender email').fill('owner@example.test');await page.getByLabel('SendGrid API key').fill('SG.synthetic_key_example.synthetic_secret_value');await page.getByRole('button',{name:'Save settings'}).click();await page.getByText('Settings saved. Test the connection when ready.').waitFor();assert.equal(await page.getByLabel('SendGrid API key').inputValue(),'');const saved=await (await req('GET',admin)).json();assert.equal(saved.configured,true);assert.doesNotMatch(JSON.stringify(saved),/synthetic_secret_value/);assert.equal((await req('DELETE',admin,{confirm:false,expectedRevision:saved.revision})).status,400);await page.getByRole('button',{name:'Remove connection'}).click();await page.getByRole('button',{name:'Confirm removal'}).click();await page.getByText(/settings removed from TaxiCRM/).waitFor();const removed=await (await req('GET',admin)).json();assert.equal(removed.configured,false);assert.equal(removed.revision,saved.revision+1);console.log('Synthetic authenticated API/browser: permissions, CSRF, encrypted save/redaction and removal passed; no real SendGrid call');
}finally{await browser?.close();await prisma.user.deleteMany({where:{id:{in:users.map(u=>u.id)}}});await prisma.$disconnect()}
