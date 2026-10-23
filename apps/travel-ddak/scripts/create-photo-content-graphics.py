from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import textwrap,json
root=Path('content-packages/photo-ddak-20261016');out=root/'images'
font='C:/Windows/Fonts/malgun.ttf';bold='C:/Windows/Fonts/malgunbd.ttf'
C={'bg':'#f7f5ed','ink':'#173f37','green':'#176954','light':'#e4efe8','gold':'#e7b35c','muted':'#5d746b'}
def start(w,h):
 im=Image.new('RGB',(w,h),C['bg']);return im,ImageDraw.Draw(im)
def f(n,b=False):return ImageFont.truetype(bold if b else font,n)
def txt(d,xy,t,n=36,fill=None,b=False):d.text(xy,t,font=f(n,b),fill=fill or C['ink'],spacing=15)
def box(d,r,fill,rad=25,outline=None,width=2):d.rounded_rectangle(r,rad,fill=fill,outline=outline,width=width)
def brand(d,y=35):box(d,(48,y,92,y+44),C['ink'],12);d.rectangle((60,y+11,80,y+33),outline='white',width=2);d.line((60,y+11,80,y+33),fill='white',width=2);txt(d,(109,y-2),'사진딱',32,b=True)
def save(im,name):im.save(out/name)
im,d=start(1200,630);brand(d,44);txt(d,(58,147),'1280 × 720을 입력했는데',49,b=True);txt(d,(58,220),'왜 크기가 달라질까요?',57,b=True);txt(d,(62,330),'비율 유지  vs  정확한 크기',35,fill=C['green']);box(d,(62,424,738,509),C['ink']);txt(d,(88,443),'사진 크기 조절 · 직접 확인한 사용법',29,fill='white',b=True)
box(d,(830,164,1133,470),'white',28);box(d,(858,199,1104,354),C['light'],15);d.rectangle((880,222,1081,332),outline=C['green'],width=3);d.ellipse((1017,238,1053,274),fill=C['gold']);d.polygon([(881,331),(945,273),(992,321),(1034,291),(1080,331)],fill='#79a592');txt(d,(872,385),'KB는 용량',28,b=True);txt(d,(872,425),'PX는 크기',28,b=True);txt(d,(62,563),'공개 웹앱 v0.3.0 · 2026.10.16 검증 · 직접 개발한 앱',23,fill=C['muted']);save(im,'01-thumbnail.png')
im,d=start(1200,1470);brand(d);txt(d,(55,126),'두 모드를 고르는 기준',55,b=True)
for y,title,sub,inside,footer in [(255,'비율 유지','최대 영역 안에, 원본 비율대로', (1152,720),'실제 저장: 1152 × 720 / 63,134바이트'),(790,'정확한 크기','자르지 않고 흰 여백으로 맞추기',(1280,720),'실제 저장: 1280 × 720 / 64,449바이트')]:
 box(d,(50,y,1150,y+470),'white');txt(d,(85,y+25),title,42,b=True);txt(d,(85,y+95),sub,30,fill=C['muted']);d.rectangle((340,y+180,900,y+380),outline=C['ink'],width=3)
 if title=='비율 유지':d.rectangle((340,y+180,844,y+380),fill='#82b5a1');d.rectangle((844,y+180,900,y+380),fill=C['bg'])
 else:d.rectangle((368,y+180,872,y+380),fill='#82b5a1')
 txt(d,(85,y+405),footer,28,b=True)
txt(d,(60,1300),'같은 내장 샘플 · 목표 200KB · 입력 1280×720',28,b=True);txt(d,(60,1356),'개별 확인 결과입니다. 모든 사진의 용량·화질을 보장하지 않습니다.',25,fill=C['muted']);save(im,'06-infographic.png')
def person(d,x,y,happy=False):
 d.ellipse((x+35,y,x+145,y+110),fill='#efd1ad',outline=C['ink'],width=3);d.pieslice((x+34,y-5,x+146,y+83),180,360,fill=C['ink']);d.ellipse((x+61,y+45,x+70,y+55),fill=C['ink']);d.ellipse((x+108,y+45,x+117,y+55),fill=C['ink']);d.arc((x+74,y+57,x+108,y+90),0 if happy else 180,180 if happy else 360,fill=C['ink'],width=3);box(d,(x+15,y+108,x+166,y+235),C['gold'],30);d.line((x+35,y+229,x+34,y+285),fill=C['ink'],width=14);d.line((x+140,y+229,x+145,y+285),fill=C['ink'],width=14)
im,d=start(1200,2220);brand(d);txt(d,(55,116),'제출 직전, 픽셀이 다르다고요?',48,b=True);stories=[('01 · 불편함','“1280×720인데 왜 1152×720이지?”','최대 크기와 정확한 크기를 헷갈렸어요.'),('02 · 도구 발견','사진딱에서 두 모드를 살펴봐요.','용량(KB)과 사진 크기(px)를 따로 설정!'),('03 · 실제 사용 흐름','정확한 크기가 필요하면 모드를 변경.','결과를 다시 만들고, 흰 여백을 확인해요.'),('04 · 확인 후 저장','원본과 결과를 비교하고 JPG 저장.','제출처가 여백을 허용하는지도 확인!')]
for i,(title,bubble,desc) in enumerate(stories):
 y=230+i*475;box(d,(45,y,1155,y+445),'white');txt(d,(78,y+25),title,33,b=True);box(d,(320,y+92,1115,y+232),C['light'],22);txt(d,(343,y+108),bubble.replace('사진딱에서 두 모드를 살펴봐요.','사진딱에서 두 모드를\n살펴봐요.').replace('정확한 크기가 필요하면 모드를 변경.','정확한 크기가 필요하면\n모드를 변경해요.').replace('원본과 결과를 비교하고 JPG 저장.','원본과 결과를 비교하고\nJPG 저장.'),36,b=True);person(d,90,y+125,i==3);box(d,(420,y+238,1035,y+375),C['ink'],15);txt(d,(451,y+263),'비율 유지  →  정확한 크기',30,fill='white',b=True);txt(d,(451,y+314),'결과 확인  →  JPG 저장',27,fill='#c9e9db');txt(d,(320,y+392),desc,26,fill=C['muted'])
txt(d,(60,2160),'창작 사용법 만화 · 화면은 설명용 연출이며 실제 실행 화면이 아닙니다.',24,fill=C['muted']);save(im,'07-comic-four-panels.png')
im,d=start(1200,1120);brand(d);txt(d,(60,138),'사진딱, 시작하는 방법',53,b=True)
for i,(t,s) in enumerate([('공개 링크 열기','PC·휴대폰 브라우저에서 실행'),('샘플 또는 사진 선택','개인 사진 없이도 샘플로 먼저 확인'),('KB·픽셀·모드 설정','결과를 확인하고 JPG로 저장'),('휴대폰 홈 화면 추가','Chrome 메뉴에 설치가 표시될 때만 진행')]):
 y=270+i*164;box(d,(60,y,1140,y+135),'white');d.ellipse((86,y+31,155,y+100),fill=C['green']);txt(d,(108,y+38),str(i+1),36,fill='white',b=True);txt(d,(184,y+20),t,35,b=True);txt(d,(184,y+77),s,27,fill=C['muted'])
txt(d,(60,975),'현재 안내는 공개 웹앱입니다. Google Play·APK 설치 링크가 아닙니다.',26,b=True);txt(d,(60,1030),'휴대폰별 설치 메뉴·저장·공유는 환경에 따라 다를 수 있습니다.',25,fill=C['muted']);save(im,'08-start-guide.png')
print('4 original graphic PNGs generated')
