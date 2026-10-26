from android_ui import AndroidUI,ADB
from pathlib import Path
import re,json,subprocess
u=AndroidUI('emulator-5556');assert 'TravelDdak_Autopilot_QA' in u.command('emu','avd','name')
base=Path('artifacts/ui-native-v7');base.mkdir(exist_ok=True)
def bounds(n):return tuple(map(int,re.findall(r'\d+',n.get('bounds'))))
def visible(n):
 x1,y1,x2,y2=bounds(n);return x2-x1>=100 and y2-y1>=40 and y1>=48 and y2<=1232
def click_node(n):
 x1,y1,x2,y2=bounds(n);assert visible(n);u.command('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2))
def capture(name):
 (base/(name+'.png')).write_bytes(subprocess.check_output([ADB,'-s','emulator-5556','exec-out','screencap','-p']))
def open_trip(days):
 for attempt in range(12):
  root=u.tree();parents={c:p for p in root.iter() for c in p};labels=[n for n in root.iter('node') if n.get('text')=='국내 · '+str(days)+'일'];assert len(labels)==1
  p=labels[0]
  while p is not None:
   candidates=[n for n in p.iter('node') if (n.get('text')=='여행 열기 →' or n.get('content-desc')=='여행 열기 →') and n.get('clickable')=='true']
   if candidates:break
   p=parents.get(p)
  assert p is not None
  choices=[n for n in candidates if visible(n)]
  if choices:
   click_node(choices[0])
   for wait in range(4):
    if any(n.get('text')=='← 내 여행' and visible(n) for n in u.tree().iter('node')):return
   raise RuntimeError('Trip detail did not become visible')
  u.scroll()
 raise RuntimeError('Trip card not visible')
def select_last(days):
 for attempt in range(10):
  root=u.tree();tabs=[n for n in root.iter('node') if re.fullmatch(r'\d+일차',n.get('text',''))]
  shown=[n for n in tabs if visible(n)]
  if shown:break
  u.scroll()
 else:raise RuntimeError('Date tabs not visible')
 for attempt in range(8):
  root=u.tree();tabs=[n for n in root.iter('node') if re.fullmatch(r'\d+일차',n.get('text',''))]
  target=[n for n in tabs if n.get('text')==str(days)+'일차' and visible(n)]
  if target:click_node(target[0]);return
  shown=[n for n in tabs if visible(n)];assert shown
  y=sum((bounds(n)[1]+bounds(n)[3])//2 for n in shown)//len(shown)
  u.command('shell','input','swipe','625',str(y),'95',str(y),'350')
 raise RuntimeError('Last day not reachable')
results=[]
for days in [3,5,7,9,14]:
 u.command('shell','am','start','-n','kr.travelddak.app/.MainActivity')
 # Return through the app header; no existing trip is deleted or overwritten.
 root=u.tree();nav=[n for n in root.iter('node') if (n.get('text')=='내 여행' or n.get('content-desc')=='내 여행') and n.get('clickable')=='true' and visible(n)]
 if nav:click_node(nav[0])
 else:
  u.command('shell','input','keyevent','4');u.tap('내 여행')
 # The list may retain its prior scroll position. Return to its beginning.
 for _ in range(5):u.command('shell','input','swipe','360','250','360','1150','200')
 open_trip(days);capture(str(days)+'d-title');select_last(days)
 # Keep both the selected tab and its date on screen for evidence.
 u.command('shell','input','swipe','360','1050','360','800','300')
 root=u.tree();end='2026-11-'+str(days).zfill(2)
 # Dates are text (36px tall), not 40px minimum tap targets.
 result={'days':days,'lastDateShown':any(n.get('text')==end and bounds(n)[3]>bounds(n)[1]>=48 and bounds(n)[3]<=1232 for n in root.iter('node')),'lastTabVisible':any(n.get('text')==str(days)+'일차' and visible(n) for n in root.iter('node'))}
 capture(str(days)+'d-tabs');results.append(result);(base/'matrix-final.json').write_text(json.dumps(results,indent=2));print(json.dumps(result),flush=True)
