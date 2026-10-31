const $=id=>document.getElementById(id);
export function createAccountUI(store,{pause,notice}){
  let mode='signin',busy=false;
  const message=(text,error=false)=>{$('account-message').textContent=text;$('account-message').classList.toggle('error',error);};
  function setMode(value){
    mode=value;message('');
    $('account-title').textContent={signin:'Welcome back.',signup:'Your own musical journey.',reset:'Reset your password.',password:'Choose a new password.'}[mode];
    $('account-intro').textContent=mode==='signup'?'Create an account to keep your progress on your phone and computer.':mode==='reset'?'We’ll email you a link to choose a new password.':mode==='password'?'Use at least 10 characters. A password manager can help.':'Sign in to pick up where you left off, on any device.';
    $('account-name-field').hidden=mode!=='signup';$('account-username').required=mode==='signup';
    $('account-email-field').hidden=mode==='password';$('account-email').required=mode!=='password';
    $('account-password-field').hidden=mode==='reset';$('account-password').required=mode!=='reset';
    $('account-password').autocomplete=mode==='signin'?'current-password':'new-password';
    $('account-password').minLength=mode==='signin'?1:10;
    $('account-submit').textContent={signin:'Sign in',signup:'Create account',reset:'Send reset link',password:'Save password'}[mode];
    $('account-switch').textContent=mode==='signin'?'New here? Create an account':'Back to sign in';
    $('account-forgot').hidden=mode!=='signin';$('account-switch').hidden=mode==='password';
    $('account-form').hidden=false;$('account-profile').hidden=true;
  }
  function render(state){
    $('account-open').textContent=state.user?state.username:'Sign in';
    $('profile-status').textContent=state.user?state.status:`Guest · ${state.status}`;
    $('account-profile-status').textContent=state.status;
    $('account-import').hidden=!state.canImport;
    $('account-open').disabled=!state.loaded;
    if(state.user){
      $('profile-email').textContent=state.user.email;
      if(document.activeElement!==$('profile-name'))$('profile-name').value=state.username;
      $('history-owner').textContent=`${state.username}’s practice`;
      if(mode!=='password'){$('account-form').hidden=true;$('account-profile').hidden=false;$('account-title').textContent='Your practice, anywhere.';$('account-intro').textContent='Sign in with this same email on your other device. Your progress and settings sync automatically.';}
    }else{
      $('history-owner').textContent='Your practice';
      if(mode!=='password'){$('account-profile').hidden=true;$('account-form').hidden=false;}
    }
  }
  store.onStatus=render;
  store.onRecovery=()=>{pause();setMode('password');$('account-dialog').showModal();$('account-password').focus();};
  async function action(work){
    if(busy)return;busy=true;
    const controls=[...$('account-dialog').querySelectorAll('button,input')];controls.forEach(el=>el.disabled=true);message('');
    try{await work();}catch(error){message(error.message||'Could not connect. Please try again.',true);}
    finally{busy=false;controls.forEach(el=>el.disabled=false);$('account-password').value='';}
  }
  $('account-open').onclick=()=>{pause();setMode('signin');render({user:store.user,username:store.username,status:store.status,loaded:store.loaded,canImport:store.canImport()});$('account-dialog').showModal();(store.user?$('profile-name'):$('account-email')).focus();};
  $('account-switch').onclick=()=>setMode(mode==='signin'?'signup':'signin');
  $('account-forgot').onclick=()=>setMode('reset');
  $('account-form').onsubmit=event=>{
    event.preventDefault();void action(async()=>{
      const email=$('account-email').value.trim(),password=$('account-password').value;
      const redirectTo=new URL('./',location.href).href;
      if(mode==='signin'){
        const {data,error}=await store.client.auth.signInWithPassword({email,password});if(error)throw error;
        await store.switchUser(data.user);$('account-dialog').close();notice(`Welcome, ${store.username}.`);
      }else if(mode==='signup'){
        const {error}=await store.client.auth.signUp({email,password,options:{data:{username:$('account-username').value.trim()},emailRedirectTo:redirectTo}});if(error)throw error;
        setMode('signin');message('Check your email to confirm your account, then sign in here.');
      }else if(mode==='reset'){
        const {error}=await store.client.auth.resetPasswordForEmail(email,{redirectTo});if(error)throw error;
        message('If an account uses that email, a reset link is on its way. Check your inbox and spam folder.');
      }else{
        const {error}=await store.client.auth.updateUser({password});if(error)throw error;
        setMode('signin');render({user:store.user,username:store.username,status:store.status,loaded:store.loaded,canImport:store.canImport()});message('Password saved.');
      }
    });
  };
  $('profile-name-form').onsubmit=event=>{event.preventDefault();void action(async()=>{store.rename($('profile-name').value);await store.sync();message('Username saved.');});};
  $('account-sync').onclick=()=>void action(async()=>{pause();store.deliver();await store.sync();message(store.status);});
  $('account-import').onclick=()=>void action(async()=>{await store.importGuest();message('This browser’s guest progress has been added to your account.');});
  $('account-signout').onclick=()=>void action(async()=>{await store.signOut();setMode('signin');message('Signed out on this device. Guest practice is separate.');});
  $('account-change-password').onclick=()=>{setMode('password');$('account-password').focus();};
  window.addEventListener('online',()=>void store.sync());
  window.addEventListener('focus',()=>{store.deliver();void store.sync();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){store.deliver();void store.sync();}});
  setInterval(()=>{if(!document.hidden)void store.sync();},15000);
  void store.init().catch(()=>{store.loaded=true;store.status='Could not connect · practice is saved here';store.emit();});
  return {render};
}
