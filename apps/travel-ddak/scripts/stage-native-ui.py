from pathlib import Path
import zipfile,re,json
current=Path('dist/app.js').read_text(encoding='utf-8')
base=Path('artifacts/native-ui-v5');base.mkdir(exist_ok=True)
with zipfile.ZipFile('artifacts/travel-ddak-release-vc4.aab') as z:
 for n in z.namelist():
  prefix='base/assets/public/'
  if n.startswith(prefix) and not n.endswith('/'):
   out=base/n[len(prefix):];out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(z.read(n))
s=(base/'app.js').read_text(encoding='utf-8')
a=s.index('function home(){');b=s.index('\nfunction kindScreen()',a);s=s[:a]+current[current.index('function home(){'):current.index('\nfunction kindScreen()')]+s[b:]
a=s.index('function photo(parent)');b=s.index('\nfunction cityCard',a);s=s[:a]+current[current.index('function photo(parent)'):current.index('\nfunction cityCard')]+s[b:]
start=current.index("const routeTrail=");end=current.index('\nlet state=',start)
block=current[start:end]
s=s.replace('let notesTimer;','let notesTimer;\n'+block)
s=s.replace("if(a==='back'){const route=location.hash.slice(1);go(({dates:'cities',cities:'regions',regions:'new',new:'home'})[route]||'home');}","if(a==='back')navigateBack();")
a=s.index("window.addEventListener('hashchange'");b=s.index("window.addEventListener('offline'",a)
x=current.index("window.addEventListener('hashchange'");y=current.index("window.addEventListener('offline'",x);s=s[:a]+current[x:y]+s[b:]
s=s.replace("image('coast')","'./assets/journey-coast.svg'").replace("image('japan')","'./assets/journey-city.svg'")
s+='\n'+current[current.index("if(window.Capacitor?.isNativePlatform?.())import('./native-navigation.js')"):]
s=s.replace('TRAVEL DDAK · 0.2.0','TRAVEL DDAK · 0.2.1')
(base/'app.js').write_text(s,encoding='utf-8')
for f in ['styles.css','native-navigation.js','assets/journey-hero.svg','assets/journey-coast.svg','assets/journey-city.svg','assets/journey-nature.svg']:
 out=base/f;out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes((Path('dist')/f).read_bytes())
# Native staged snapshot intentionally preserves the reviewed v4 cloud feature set.
(Path('artifacts')/'native-v5-stage.json').write_text(json.dumps({'base':'travel-ddak-release-vc4.aab','changes':['home consolidation','illustrations','hardware back handler','styles'],'hybridAdded':False},indent=2))
