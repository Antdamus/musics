import {build} from 'esbuild';
import {copyFile} from 'node:fs/promises';
await build({stdin:{contents:"export {createClient} from '@supabase/supabase-js';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',target:['es2022'],minify:true,outfile:'fretboard/supabase-client.mjs',banner:{js:'// Supabase JS client (MIT). See supabase-client.LICENSE.txt. Rebuild: node tools/build-auth-client.mjs'}});
await copyFile('node_modules/@supabase/supabase-js/LICENSE','fretboard/supabase-client.LICENSE.txt');
