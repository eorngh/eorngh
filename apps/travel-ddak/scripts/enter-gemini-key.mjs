import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const token = process.env.TRAVEL_DDAK_ENTRY_TOKEN || randomBytes(32).toString('hex');
const isPhoto = process.argv.includes('--tour-photo');
const isMaps = process.argv.includes('--maps');
const isTour = isPhoto || process.argv.includes('--tour');
const service = isMaps ? 'Google Maps' : isPhoto ? '관광사진 API' : isTour ? '관광 API' : 'Gemini';
const port = isMaps ? 4177 : isPhoto ? 4176 : isTour ? 4175 : 4174;
const destination = path.join(process.env.LOCALAPPDATA, 'TravelDdak', 'secrets', isMaps ? 'google-maps-key.dpapi' : isPhoto ? 'tour-photo-key.dpapi' : isTour ? 'tour-api-key.dpapi' : 'gemini-key.dpapi');
const origin = `http://127.0.0.1:${port}`;
let saved = false;
const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  if (req.headers.host !== `127.0.0.1:${port}`) { res.writeHead(403).end(); return; }
  if (req.method === 'GET' && req.url === `/${token}`) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>여행딱 ${service} 키 보안 입력</title><style>body{font:18px system-ui;max-width:620px;margin:60px auto;padding:24px;line-height:1.7}input{box-sizing:border-box;width:100%;padding:14px;font-size:18px}button{padding:14px;margin-top:20px}code{overflow-wrap:anywhere}</style><h1>${service} 키 입력</h1><p>이 화면은 이 PC(127.0.0.1)에서만 동작합니다. 키는 현재 Windows 계정으로 암호화해 저장합니다. 외부 API 호출이나 과금은 아직 실행하지 않습니다.</p><p>저장 위치: <code>${destination}</code></p>${saved ? '<p>저장 완료. 창을 닫아도 됩니다.</p>' : `<form method="post" action="/${token}"><label>${isTour ? "일반 인증키 · Decoding 권장 (Encoding도 가능)" : "생성한 " + service + " API 키"}<input type="password" name="key" required autocomplete="off" spellcheck="false" minlength="20" maxlength="8192"></label><button type="submit">이 PC에 암호화 저장</button></form>`}</html>`);
    return;
  }
  if (req.method !== 'POST' || req.url !== `/${token}` || req.headers.origin !== origin || saved) { res.writeHead(403).end(); return; }
  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > 32768) { res.writeHead(413).end(); return; } }
  let key = new URLSearchParams(body).get('key')?.trim();
  body = '';
  key = key?.replace(/^(?:export\s+)?(?:GEMINI_API_KEY|GOOGLE_API_KEY|GOOGLE_MAPS_API_KEY|MAPS_API_KEY|TOUR_PHOTO_KEY|TOUR_API_KEY|TOURAPI_SERVICE_KEY|SERVICE_KEY|serviceKey)\s*=\s*/i, '').replace(/^(["'])(.*)\1$/, '$2').trim();
  if (!key || !/^[\x21-\x7e]{20,8192}$/.test(key)) { res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' }).end('<!doctype html><html lang="ko"><meta charset="utf-8"><h1>키가 저장되지 않았습니다</h1><p>공백·줄바꿈 없이 키 문자열을 입력해 주세요. 20~8192자의 영문·숫자·기호를 지원합니다.</p><a href="'+`/${token}`+'">입력 화면으로 돌아가기</a></html>'); return; }
  try {
    const encrypted = await new Promise((resolve, reject) => {
      // PowerShell 7's inherited module path prevents Windows PowerShell 5 from loading its security module.
      const childEnv = { ...process.env };
      delete childEnv.PSModulePath;
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '$ErrorActionPreference="Stop"; $value=[Console]::In.ReadToEnd(); $secure=ConvertTo-SecureString $value -AsPlainText -Force; $encrypted=ConvertFrom-SecureString $secure; $check=[PSCredential]::new("gemini",(ConvertTo-SecureString $encrypted)); if($check.GetNetworkCredential().Password -ne $value){throw "Encryption roundtrip failed"}; Write-Output $encrypted'], { env: childEnv, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      let output = '';
      child.stdout.on('data', data => output += data);
      child.stderr.resume();
      child.on('error', reject);
      child.on('close', code => code === 0 && output.trim() ? resolve(output.trim()) : reject(new Error('Encryption failed')));
      child.stdin.end(key);
    });
    key = '';
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, encrypted, { flag: 'wx' });
    saved = true;
    console.log(isMaps ? 'GOOGLE_MAPS_KEY_SAVED_ENCRYPTED' : isPhoto ? 'TOUR_PHOTO_KEY_SAVED_ENCRYPTED' : isTour ? 'TOUR_API_KEY_SAVED_ENCRYPTED' : 'GEMINI_KEY_SAVED_ENCRYPTED');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(`<!doctype html><html lang="ko"><meta charset="utf-8"><title>저장 완료</title><h1>${service} 키 암호화 저장 완료</h1><p>이 창을 닫아도 됩니다. 실제 API 호출은 아직 하지 않았습니다.</p></html>`);
    server.close();
  } catch {
    key = '';
    res.writeHead(500).end('Secure storage failed. No API call made.');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`SECURE_ENTRY_URL=${origin}/${token}`));
setTimeout(() => server.close(), 20 * 60 * 1000).unref();
