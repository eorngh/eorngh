from android_ui import AndroidUI,ADB
import subprocess,json,re,os
serial='emulator-5556';u=AndroidUI(serial)
assert 'TravelDdak_Autopilot_QA' in u.command('emu','avd','name'),'Only the isolated test emulator may receive these credentials'
command='$ErrorActionPreference="Stop"; $s=ConvertTo-SecureString ([IO.File]::ReadAllText($env:LOCALAPPDATA+"/TravelDdak/secrets/play-review.dpapi")); [Console]::Out.Write(([PSCredential]::new("review",$s)).GetNetworkCredential().Password)'
env={k:v for k,v in os.environ.items() if k.upper()!='PSMODULEPATH'}
p=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-Command',command],capture_output=True,text=True,env=env,creationflags=subprocess.CREATE_NO_WINDOW)
if p.returncode:raise RuntimeError('Encrypted test credential unavailable')
credential=json.loads(p.stdout);p=None
assert credential['email']=='travelddak-play-review@example.invalid'
def fill(password,value):
 assert re.fullmatch(r'[A-Za-z0-9_!@.+-]+',value),'Unsupported input characters'
 for attempt in range(3):
  nodes=[n for n in u.tree().iter('node') if n.get('class')=='android.widget.EditText' and (n.get('password')=='true')==password]
  assert len(nodes)==1,'Field must be unambiguous'
  x1,y1,x2,y2=map(int,re.findall(r'\d+',nodes[0].get('bounds')))
  if x2>x1 and y2>y1:break
  u.scroll()
 else:raise RuntimeError('Field not visible')
 u.command('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2))
 subprocess.run([ADB,'-s',serial,'shell'],input="input text '"+value+"'\nexit\n",text=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True)
fill(False,credential['email']);fill(True,credential['password']);credential=None
u.command('shell','input','keyevent','4');u.tap('이메일·비밀번호 로그인')
print('Synthetic test-account credentials entered through native UI; values not logged.')

