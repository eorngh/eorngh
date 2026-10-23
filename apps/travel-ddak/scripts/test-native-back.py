import subprocess,xml.etree.ElementTree as E,re,json,sys
from pathlib import Path
adb='C:/Users/eorng/AppData/Local/Android/Sdk/platform-tools/adb.exe'
device=sys.argv[1] if len(sys.argv)>1 else 'emulator-5554'
def cmd(*args):return subprocess.run([adb,'-s',device,*args],capture_output=True,text=True,encoding='utf-8').stdout
def ui():
 cmd('shell','uiautomator','dump','/sdcard/ux-check.xml');return E.fromstring(cmd('shell','cat','/sdcard/ux-check.xml'))
def tap_text(text):
 r=ui();nodes=[n for n in r.iter('node') if text in n.get('text','') and n.get('bounds')!='[0,0][0,0]'];assert nodes, 'control missing '+text
 n=nodes[-1];nums=list(map(int,re.findall(r'\d+',n.get('bounds'))));cmd('shell','input','tap',str((nums[0]+nums[2])//2),str((nums[1]+nums[3])//2))
result={}
tap_text('여행 만들기');result['newOpened']=any('국내여행' in n.get('text','') for n in ui().iter('node'))
tap_text('국내여행');result['regionsOpened']=any('서울' in n.get('text','') for n in ui().iter('node'))
cmd('shell','input','keyevent','4');result['hardwareBackToKind']=any('국내여행' in n.get('text','') for n in ui().iter('node'))
cmd('shell','input','keyevent','4');result['hardwareBackToHome']=any('여행 만들기' in n.get('text','') for n in ui().iter('node'))
cmd('shell','input','keyevent','4');result['hardwareBackAtHomeStays']=any('여행 만들기' in n.get('text','') for n in ui().iter('node'))
Path('handoff/UX_ANDROID_BACK_TEST_'+device+'.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result));
