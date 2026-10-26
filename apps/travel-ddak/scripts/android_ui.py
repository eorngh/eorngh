import subprocess,xml.etree.ElementTree as E,re
ADB='C:/Users/eorng/AppData/Local/Android/Sdk/platform-tools/adb.exe'
class AndroidUI:
 def __init__(self,device):self.device=device
 def command(self,*args):return subprocess.run([ADB,'-s',self.device,*args],capture_output=True,text=True,encoding='utf-8').stdout
 def tree(self):
  for attempt in range(2):
   outcome=self.command('shell','uiautomator','dump','/sdcard/travel-qa.xml')
   if 'dumped to:' in outcome:break
  else:raise RuntimeError('Fresh Android UI snapshot unavailable')
  return E.fromstring(self.command('shell','cat','/sdcard/travel-qa.xml'))
 def controls(self):return [n for n in self.tree().iter('node') if (n.get('text') or n.get('content-desc')) and n.get('bounds')!='[0,0][0,0]']
 def tap(self,text):
  nodes=[n for n in self.controls() if n.get('text')==text or n.get('content-desc')==text]
  assert nodes,'Control missing: '+text
  nodes=[n for n in nodes if (lambda b:b[2]>b[0] and b[3]-b[1]>=40)(list(map(int,re.findall(r'\d+',n.get('bounds')))))]
  assert nodes,'Control is outside the visible screen: '+text
  clickable=[n for n in nodes if n.get('clickable')=='true']
  n=(clickable or nodes)[-1];x1,y1,x2,y2=map(int,re.findall(r'\d+',n.get('bounds')))
  assert x2>x1 and y2>y1,'Control is outside the visible screen: '+text
  self.command('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2))
 def visible(self):return [(n.get('text') or n.get('content-desc'),n.get('bounds')) for n in self.controls()]
 def scroll(self):
  nodes=[n for n in self.tree().iter('node') if n.get('scrollable')=='true' and (lambda b:b[3]>b[1] and b[2]>b[0])(list(map(int,re.findall(r'\d+',n.get('bounds')))))]
  assert nodes,'No scrollable app surface'
  x1,y1,x2,y2=map(int,re.findall(r'\d+',max(nodes,key=lambda n:(lambda b:(b[2]-b[0])*(b[3]-b[1]))(list(map(int,re.findall(r'\d+',n.get('bounds')))))).get('bounds')))
  self.command('shell','input','swipe',str((x1+x2)//2),str(y1+(y2-y1)*4//5),str((x1+x2)//2),str(y1+(y2-y1)//3),'400')
