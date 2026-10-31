import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {test,before,after} from 'node:test';
import {chromium,expect} from '@playwright/test';
import {cleanData} from '../fretboard/profile-data.mjs';
let server,browser,origin;
const root=new URL('../',import.meta.url);
before(async()=>{
  server=createServer(async(req,res)=>{
    const path=new URL(req.url,'http://local').pathname;
    if(!/^\/fretboard\/[a-z.-]+$/.test(path)){res.writeHead(404).end();return;}
    try{const body=await readFile(new URL('.'+path,root));res.setHeader('Content-Type',path.endsWith('.mjs')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');res.end(body);}catch{res.writeHead(404).end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch();await mkdir(new URL('test-results/',root),{recursive:true});
});
after(async()=>{await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});});
function mockAccounts(){
  const users={alice:{id:'11111111-1111-4111-8111-111111111111',email:'alice@example.invalid',user_metadata:{username:'Alice'}},bob:{id:'22222222-2222-4222-8222-222222222222',email:'bob@example.invalid',user_metadata:{username:'Bob'}}};
  const rows=new Map(),receipts=new Set(),calls=[];
  return {users,rows,calls,async route(route){
    const req=route.request(),url=new URL(req.url()),path=url.pathname,body=req.postDataJSON(),id=req.headers().authorization?.replace('Bearer test-',''),user=Object.values(users).find(u=>u.id===id);
    const reply=(json,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(json)});
    calls.push({path,body});
    if(path==='/auth/v1/token'){
      const account=Object.values(users).find(u=>u.email===body.email);
      if(!account||body.password!=='correct-password')return reply({msg:'Invalid login credentials'},400);
      return reply({access_token:'test-'+account.id,refresh_token:'refresh-'+account.id,expires_in:3600,token_type:'bearer',user:account});
    }
    if(path==='/auth/v1/signup')return reply({id:crypto.randomUUID(),email:body.email,identities:[]});
    if(path==='/auth/v1/recover')return reply({});
    if(path==='/auth/v1/logout')return reply({});
    if(path==='/auth/v1/user')return reply(user||{},user?200:401);
    if(!user)return reply({message:'Unauthorized'},401);
    if(path==='/rest/v1/practice_profiles')return reply(rows.get(id)||null);
    if(path==='/rest/v1/rpc/save_practice_profile'){
      if(body.expected_user_id!==id)return reply({code:'PT403'},403);
      const key=id+body.mutation_id,existing=rows.get(id);
      if(receipts.has(key))return reply([existing]);
      if(existing&&body.expected_revision!==existing.revision)return reply({code:'PT409'},409);
      const row={user_id:id,username:body.profile_name,data:body.profile_data,revision:(existing?.revision||0)+1};rows.set(id,row);receipts.add(key);return reply([row]);
    }
    return reply({message:'Unexpected request'},404);
  }};
}
async function pageFor(t,backend,width=390){
  const context=await browser.newContext({viewport:{width,height:844}});t.after(()=>context.close());
  await context.route('https://*.supabase.co/**',route=>backend.route(route));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));t.after(()=>assert.deepEqual(errors,[]));
  await page.goto(origin+'/fretboard/index.html');await expect(page.locator('#account-open')).toBeEnabled();return page;
}
async function login(page,name='alice'){
  await page.locator('#account-open').click();await page.locator('#account-email').fill(name+'@example.invalid');await page.locator('#account-password').fill('correct-password');await page.locator('#account-submit').click();await expect(page.locator('#account-dialog')).not.toBeVisible();await expect(page.locator('#profile-status')).toHaveText('Synced across devices');
}
async function sync(page){await page.locator('#account-open').click();await page.locator('#account-sync').click();await expect(page.locator('#account-message')).toHaveText('Synced across devices');await page.locator('[aria-label="Close account"]').click();}

test('phone sign-up, recovery and invalid-login forms stay readable and preserve guest practice',async t=>{
  const backend=mockAccounts(),page=await pageFor(t,backend,320);
  await page.locator('#bpm').fill('20');await page.locator('#bpm').press('Tab');
  await page.locator('#account-open').click();await page.locator('#account-switch').click();
  await page.locator('#account-username').fill('New Guitarist');await page.locator('#account-email').fill('new@example.invalid');await page.locator('#account-password').fill('new-password-long');
  assert.ok(await page.locator('#account-dialog').evaluate(d=>d.scrollWidth<=d.clientWidth));
  await page.locator('#account-dialog').screenshot({path:'test-results/fretwise-account-signup-phone.png'});
  await page.locator('#account-submit').click();await expect(page.locator('#account-message')).toContainText('Check your email');
  assert.equal(backend.calls.find(c=>c.path.endsWith('/signup')).body.data.username,'New Guitarist');
  await page.locator('#account-forgot').click();await page.locator('#account-submit').click();await expect(page.locator('#account-message')).toContainText('reset link');
  await page.locator('#account-switch').click();await page.locator('#account-password').fill('wrong-password');await page.locator('#account-submit').click();await expect(page.locator('#account-message')).toContainText('Invalid login');
  await page.locator('[aria-label="Close account"]').click();await expect(page.locator('#bpm')).toHaveValue('20');assert.equal(backend.rows.size,0);
});

test('two devices share a profile while playback tempo and goal remain separate',async t=>{
  const backend=mockAccounts(),phone=await pageFor(t,backend),computer=await pageFor(t,backend,1440);
  await login(phone);await login(computer);
  await phone.locator('#bpm').fill('15');await phone.locator('#bpm').press('Tab');await sync(phone);await sync(computer);
  await expect(computer.locator('#bpm')).toHaveValue('15');await expect(computer.locator('#target-bpm')).toHaveValue('100');
  await computer.locator('#target-bpm').fill('90');await computer.locator('#target-bpm').press('Tab');await sync(computer);await sync(phone);
  await expect(phone.locator('#bpm')).toHaveValue('15');await expect(phone.locator('#target-bpm')).toHaveValue('90');
  await phone.reload();await expect(phone.locator('#account-open')).toHaveText('Alice');await expect(phone.locator('#bpm')).toHaveValue('15');
});

test('guest import is optional, one-time and separate from the next person signing in',async t=>{
  const backend=mockAccounts(),page=await pageFor(t,backend);
  const guest=cleanData();guest.progress.sessions=[{id:'old-session',at:1,ms:120000,best:4}];guest.progress.notes[60]={correct:3,attempts:4,last:1,passes:[]};
  await page.addInitScript(data=>localStorage.setItem('fretwise.v1',JSON.stringify(data)),guest);await page.reload();
  await expect(page.locator('#total-minutes')).toHaveText('2');await login(page);await expect(page.locator('#total-minutes')).toHaveText('0');
  await page.locator('#account-open').click();await page.locator('#account-import').click();await expect(page.locator('#account-message')).toContainText('has been added');await expect(page.locator('#account-import')).toBeHidden();await page.locator('#account-signout').click();
  await expect(page.locator('#account-form')).toBeVisible();await page.locator('[aria-label="Close account"]').click();await login(page,'bob');await expect(page.locator('#total-minutes')).toHaveText('0');
  assert.equal(backend.rows.get(backend.users.alice.id).data.progress.notes[60].correct,3);assert.deepEqual(backend.rows.get(backend.users.bob.id).data.progress.notes,{});
  await page.locator('#account-open').click();await expect(page.locator('#account-import')).toBeHidden();
  await page.locator('#profile-name').fill('<img src=x onerror=alert(1)>');await page.locator('#profile-name-form button').click();await expect(page.locator('#account-message')).toHaveText('Username saved.');await page.locator('[aria-label="Close account"]').click();await expect(page.locator('#account-open img')).toHaveCount(0);
});
