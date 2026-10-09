// SPDX-License-Identifier: MIT
import {readFile, readdir, lstat} from 'node:fs/promises';
import {resolve, join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {inflateRawSync} from 'node:zlib';
const root=dirname(fileURLToPath(import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
const json=b=>JSON.parse(b.toString());
const safe=n=>typeof n==='string'&&n.length>0&&!n.startsWith('/')&&!/[\\\x00-\x1f?#]/.test(n)&&n.split('/').every(p=>p&&p!=='.'&&p!=='..');
const version=v=>{if(!/^\d+\.\d+\.\d+$/.test(v))throw Error('Invalid version');return v;};
const fail=m=>{throw Error(m);};
async function authoritative(v,kind){
  const folder=join(root,version(v)),record=json(await readFile(join(folder,'release.json'))),details=record[kind];
  if(record.version!==v||!details)fail('No authoritative release for '+v+' / '+kind);
  const list=await readFile(join(folder,kind,'SHA256SUMS'));
  if(hash(list)!==details.releaseHash||(await readFile(join(folder,kind,'release-hash.txt'),'utf8')).trim()!==details.releaseHash)fail('Published list hash mismatch');
  const entries=new Map();let previous='';
  for(const line of list.toString().trimEnd().split('\n')){
    const m=/^([a-f0-9]{64})  (.+)$/.exec(line);
    if(!m||!safe(m[2])||entries.has(m[2])||m[2]<=previous)fail('Invalid checksum list');
    entries.set(m[2],m[1]);previous=m[2];
  }
  if(details.metadata){
    const metadata=Buffer.from(JSON.stringify({files:'/release/SHA256SUMS',releaseHash:details.releaseHash,version:v},null,2)+'\n');
    entries.set('release.json',hash(metadata));entries.set('release/SHA256SUMS',hash(list));
  }
  return {entries,details};
}
// Bodies are read with byte budgets: 64 MB per file, 1 GB per run, 1 MB for metadata.
const FILE_LIMIT=64*1024*1024,META_LIMIT=1024*1024;let budget=1024*1024*1024;
async function body(response,limit){
  const chunks=[];let size=0;const reader=response.body.getReader();
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;budget-=value.length;
    if(size>limit||budget<0){await reader.cancel().catch(()=>{});fail('Response too large');}chunks.push(value);}
  return Buffer.concat(chunks);
}
async function get(url,limit=FILE_LIMIT){
  const response=await fetch(url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(60000)});
  if(!response.ok)fail(`HTTP ${response.status}: ${url}`);
  return body(response,limit);
}
async function web(origin,v){
  const base=new URL(origin);
  if(!['https:','http:'].includes(base.protocol)||base.username||base.password||base.pathname!=='/'||base.search||base.hash)fail('Use a wallet origin URL');
  if(base.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(base.hostname))fail('HTTPS required outside localhost');
  if(!v){
    const r=await fetch(new URL('/release.json',base),{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(60000)});
    if(r.ok)v=version(json(await body(r,META_LIMIT)).version);
    else if(r.status===404){
      const text=(await get(new URL('/version.js',base),META_LIMIT)).toString(),m=/QUANTUS_VERSION\s*=\s*['"](\d+\.\d+\.\d+)['"]/.exec(text);
      if(!m)fail('Cannot identify legacy release');v=m[1];
    }else fail('Cannot identify served release: HTTP '+r.status);
  }
  const {entries,details}=await authoritative(v,'web');
  let failures=0;const pending=[...entries];
  await Promise.all(Array.from({length:4},async()=>{
    while(pending.length){const [name,expected]=pending.shift();try{
      const bytes=await get(new URL('/'+name.split('/').map(encodeURIComponent).join('/'),base));
      if(hash(bytes)!==expected)fail('SHA-256 mismatch');
    }catch(error){failures++;console.error('FAIL '+name+': '+error.message);}}
  }));
  if(failures)fail(`${failures} file(s) failed at ${base.origin}`);
  console.log(`PASS ${base.origin} v${v}: ${entries.size} files, release ${details.releaseHash}`);
}
async function directory(path,prefix='',out=new Map()){
  for(const name of (await readdir(path)).sort()){
    if(!prefix&&name==='_metadata')continue;
    const full=join(path,name),rel=prefix+name,stat=await lstat(full);
    if(stat.isSymbolicLink())fail('Symlinks are not accepted: '+rel);
    if(stat.isDirectory())await directory(full,rel+'/',out);
    else if(stat.isFile()){if(!safe(rel))fail('Unsafe filename');out.set(rel,await readFile(full));}
    else fail('Unsupported file: '+rel);
  }return out;
}
function unzip(bytes){
  let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50&&i+22+bytes.readUInt16LE(i+20)===bytes.length){end=i;break;}
  if(end<0)fail('Invalid ZIP end record');
  const count=bytes.readUInt16LE(end+10),size=bytes.readUInt32LE(end+12);let cursor=bytes.readUInt32LE(end+16),total=0;
  if(bytes.readUInt16LE(end+4)||bytes.readUInt16LE(end+6)||count===65535||count!==bytes.readUInt16LE(end+8)||cursor+size!==end)fail('Multi-disk and ZIP64 archives are not supported');
  const result=new Map();
  for(let i=0;i<count;i++){
    if(bytes.readUInt32LE(cursor)!==0x02014b50)fail('Invalid ZIP central directory');
    const flags=bytes.readUInt16LE(cursor+8),method=bytes.readUInt16LE(cursor+10),compressed=bytes.readUInt32LE(cursor+20),length=bytes.readUInt32LE(cursor+24),n=bytes.readUInt16LE(cursor+28),extra=bytes.readUInt16LE(cursor+30),comment=bytes.readUInt16LE(cursor+32),offset=bytes.readUInt32LE(cursor+42),mode=bytes.readUInt32LE(cursor+38)>>>16;
    const name=bytes.subarray(cursor+46,cursor+46+n).toString('utf8');cursor+=46+n+extra+comment;
    if(flags&1||![0,8].includes(method)||(mode&0xf000)===0xa000)fail('Unsupported ZIP entry');
    if(name.endsWith('/')){if(!safe(name.slice(0,-1)))fail('Unsafe ZIP directory');continue;}
    if(!safe(name)||result.has(name))fail('Unsafe or duplicate ZIP path');
    total+=length;if(total>512*1024*1024)fail('ZIP exceeds 512 MiB uncompressed budget');
    if(bytes.readUInt32LE(offset)!==0x04034b50)fail('Invalid ZIP local header');
    const start=offset+30+bytes.readUInt16LE(offset+26)+bytes.readUInt16LE(offset+28);
    if(start+compressed>end)fail('Truncated ZIP entry');
    const raw=bytes.subarray(start,start+compressed),data=method===0?raw:inflateRawSync(raw,{maxOutputLength:Math.max(1,length)});
    if(data.length!==length)fail('Invalid ZIP size');result.set(name,data);
  }
  if(cursor!==end)fail('Invalid ZIP directory size');return result;
}
async function extension(path,v){
  path=resolve(path);const stat=await lstat(path);if(stat.isSymbolicLink())fail('Symlinks are not accepted');if(stat.size>512*1024*1024)fail('Archive exceeds 512 MiB budget');
  const zip=stat.isFile()?await readFile(path):null,entries=zip?unzip(zip):await directory(path);
  const manifest=json(entries.get('manifest.json')||fail('Missing manifest.json'));v=v||version(manifest.version);
  if(manifest.version!==v)fail('Installed extension version differs');
  const kind=Object.hasOwn(manifest,'key')?'unpacked':'extension';
  const {entries:expected,details}=await authoritative(v,kind);
  if(zip&&hash(zip)!==details.zipSha256)fail('ZIP SHA-256 differs from published archive');
  for(const [name,digest]of expected)if(!entries.has(name)||hash(entries.get(name))!==digest)fail('Missing or changed file: '+name);
  for(const name of entries.keys())if(!name.startsWith('_metadata/')&&!expected.has(name))fail('Unexpected file: '+name);
  console.log(`PASS extension v${v}: ${expected.size} files, release ${details.releaseHash}${zip?', ZIP hash matched':''}`);
}
try{
  const args=process.argv.slice(2);let v;const i=args.indexOf('--version');if(i>=0){v=version(args[i+1]);args.splice(i,2);}
  if(args[0]==='--extension'&&args.length===2)await extension(args[1],v);
  else if(args.length&&!args.some(a=>a.startsWith('--')))for(const origin of args)await web(origin,v);
  else fail('Usage: node verify.mjs [--version X.Y.Z] https://wallet.qkeep.app [other origins] | --extension <directory-or-zip>');
}catch(error){console.error('FAIL: '+error.message);process.exitCode=1;}
