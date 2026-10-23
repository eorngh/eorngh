from PIL import Image,ImageDraw
from PIL.TiffImagePlugin import IFDRational
from pathlib import Path
import hashlib,json,datetime
root=Path('artifacts/synthetic-photos-qa');root.mkdir(exist_ok=True)
manifest=[]
for i in range(1200):
 category=['near','no-gps','away','outside'][i%4]
 shot=datetime.datetime(2026,10,20,10,0)+datetime.timedelta(seconds=i) if category!='outside' else datetime.datetime(2026,9,1,10,0)
 exif=Image.Exif();exif[306]=shot.strftime('%Y:%m:%d %H:%M:%S');exif[34665]={36867:exif[306],36868:exif[306],36881:'+09:00'}
 if category in ['near','away']:
  lat,lon=(35.16,129.16) if category=='near' else (37.56,126.97)
  def dms(v):
   d=int(v);m=int((v-d)*60);return (IFDRational(d),IFDRational(m),IFDRational(round(((v-d)*60-m)*60*10000),10000))
  exif[34853]={1:'N',2:dms(lat),3:'E',4:dms(lon)}
 im=Image.new('RGB',(96,96),('#1976d2' if category=='near' else '#ff7f66'));ImageDraw.Draw(im).text((4,30),'QA '+str(i),fill='white')
 p=root/('qa_'+str(i).zfill(4)+'_'+category+'.jpg');im.save(p,exif=exif)
 manifest.append({'file':p.name,'category':category,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
Path('artifacts/SYNTHETIC_PHOTO_MANIFEST.json').write_text(json.dumps({'synthetic':True,'total':1200,'expectedDateCandidates':900,'withinWithGps':600,'withinWithoutGps':300,'outside':300,'photos':manifest},indent=2))
print('Created 1200 synthetic photos; expected 900 date candidates, 600 GPS, 300 GPS-less; 300 out-of-range.')
