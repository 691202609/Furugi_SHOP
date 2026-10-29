'use strict';
const { createClient } = require('@supabase/supabase-js');
const [emailArg,passwordArg,...nameParts]=process.argv.slice(2);
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
if(!url||!key){console.error('Missing SUPABASE_URL / SUPABASE_SECRET_KEY in .env.local');process.exit(1)}
if(!emailArg||!passwordArg){console.error('Usage: npm run bootstrap-admin -- admin@example.com "StrongPassword!123" "Furugi Admin"');process.exit(1)}
if(passwordArg.length<12){console.error('Admin password must be at least 12 characters');process.exit(1)}
const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
(async()=>{const {count,error:cErr}=await supabase.from('profiles').select('id',{count:'exact',head:true}).eq('role','admin');if(cErr)throw cErr;if(Number(count||0)>0)throw new Error('Admin already exists. Use the existing admin account.');const name=nameParts.join(' ')||'Furugi Admin';const {data,error}=await supabase.auth.admin.createUser({email:emailArg,password:passwordArg,email_confirm:true,user_metadata:{full_name:name}});if(error)throw error;const {error:uErr}=await supabase.from('profiles').upsert({id:data.user.id,email:emailArg,full_name:name,role:'admin',status:'active'},{onConflict:'id'});if(uErr)throw uErr;console.log('Admin created:',emailArg);})().catch(e=>{console.error(e.message||e);process.exit(1)});
