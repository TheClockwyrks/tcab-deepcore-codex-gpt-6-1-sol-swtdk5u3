"""One-time original pixel-art authoring. Build never invokes this script."""
import json,random,subprocess,pathlib
random.seed(73)
root=pathlib.Path('assets'); root.mkdir(exist_ok=True)
ops=[]
def rect(x,y,w,h,c): ops.append(dict(op='fill_rect',x=int(x),y=int(y),width=int(w),height=int(h),color=c))
def line(x,y,x2,y2,c): ops.append(dict(op='line',x0=int(x),y0=int(y),x1=int(x2),y1=int(y2),color=c))
def circ(x,y,r,c): ops.append(dict(op='fill_circle',cx=int(x),cy=int(y),r=int(r),color=c))
def save(p,w=80,h=80,bg='transparent',sheet=False):
 p=root/(p+'.png');p.parent.mkdir(parents=True,exist_ok=True)
 pathlib.Path('/tmp/art.json').write_text(json.dumps(ops))
 subprocess.run(['draw-sheet' if sheet else 'draw','render','--actions','/tmp/art.json','--out',str(p),'--width',str(w),'--height',str(h),'--background',bg,'--no-layers'],check=True,stdout=subprocess.DEVNULL);ops.clear()
pal=[('#594637','#6c5640','#3b3430'),('#3e5055','#53666a','#2a373d'),('#283540','#3a4655','#1c2632'),('#49313b','#66404a','#30232e')]
for bi,b in enumerate(['topsoil','rockbed','deepstone','coreshell']):
 for n in range(3):
  for i in range(720):
   x=random.randrange(80);y=random.randrange(80);rect(x,y,random.randrange(1,5),1,random.choice(pal[bi][1:]))
  for i in range(8):
   x=random.randrange(80);y=random.randrange(80);line(x,y,x+random.randrange(4,16),y-3,pal[bi][2])
  save(f'tiles/{b}-{n}',bg=pal[bi][0])
for n in range(2):
 for y in range(8,73):
  margin=8+abs(y-40)//4;rect(margin,y,80-2*margin,1,'#71878a' if y<32 else '#40525c')
 for i in range(55):
  x=random.randrange(18,62);y=random.randrange(15,65);rect(x,y,5,1,'#849b9b')
 save(f'tiles/stone-{n}')
for name,bg in [('bedrock','#1d2630'),('tunnel','#111d26')]:
 for i in range(450):rect(random.randrange(80),random.randrange(80),2,1,random.choice(['#22303b','#192632','#14202b']))
 save('tiles/'+name,bg=bg)
colors=['#c29d71','#d0c2a1','#e58a51','#d9e6e3','#589ddd','#e2cc58','#8fcac1','#f76d51','#c879ac','#b5e9e8','#62edaa','#ef8bbc','#ffd678']
for i,name in enumerate(['ferron','marlite','cuprite','argenite','cobaltine','voltite','halcite','pyronium','cindrite','adamite','verdite','roselite','aurite']):
 c=colors[i]
 if i<10:
  for x in range(80):
   y=int(39+8*__import__('math').sin(x/16));
   for j in range(7):rect(x,y+random.randrange(-12,13),random.randrange(1,6),random.randrange(1,4),c+random.choice(['60','90','cc','ff']))
 else:
  for y in range(14,66):
   width=int(25*(1-abs(y-34)/36));rect(40-width,y,width*2,1,c)
  rect(29,25,20,16,'#e9fff0');line(16,35,39,65,'#347d86');line(39,65,60,35,'#ffffff');line(52,15,52,28,'#ffffff');line(46,21,59,21,'#ffffff')
 save('ore/'+name)
def poly(points,c):
 for yy in range(min(p[1] for p in points),max(p[1] for p in points)+1):
  xs=[]
  for j,(x,y) in enumerate(points):
   xx,yyy=points[(j+1)%len(points)]
   if y!=yyy and min(y,yyy)<=yy<max(y,yyy):xs.append(x+(yy-y)*(xx-x)/(yyy-y))
  xs.sort()
  for j in range(0,len(xs)-1,2):rect(xs[j],yy,max(1,xs[j+1]-xs[j]),1,c)
for i,name in enumerate(['resonite','cryenite','core','core-sample']):
 if i<2:
  dark,mid,light=('#216b68','#6be3bd','#c5ffe0') if i==0 else ('#51448c','#9a8edc','#e1d9ff')
  circ(40,42,37,mid+'16')
  for x,y,w,h in [(9,32,14,33),(24,18,16,48),(43,9,19,58),(61,29,13,37)]:
   poly([(x,y+9),(x+w//2,y),(x+w,y+8),(x+w-2,y+h),(x+3,y+h)],dark)
   poly([(x+w//2,y),(x+w,y+8),(x+w-2,y+h),(x+w//2,y+h)],mid)
   poly([(x+w//2,y),(x+w//2+3,y+8),(x+w//2+1,y+h-3),(x+3,y+h)],light)
  line(46,17,46,34,'#ffffff');line(39,25,53,25,'#ffffff')
 else:
  circ(40,40,39,'#ffb85b18');circ(40,40,32,'#ffb85b38');circ(40,40,25,'#f37e4155')
  if i==2:
   circ(40,40,21,'#a24b38');circ(40,40,17,'#ffd97f');circ(37,37,12,'#fff6bf');circ(35,34,6,'#ffffff')
   for j in range(9):
    a=j*0.7;line(40+int(20*__import__('math').cos(a)),40+int(20*__import__('math').sin(a)),40+int(33*__import__('math').cos(a+0.15)),40+int(33*__import__('math').sin(a+0.15)),'#fcae62')
  else:
   rect(23,19,34,44,'#344f5b');rect(27,22,26,38,'#80a8a5');rect(31,27,18,28,'#f2ad66');circ(40,40,8,'#fff0a5');rect(22,16,36,7,'#9bb4b0');rect(22,59,36,7,'#9bb4b0')
 save('materials/'+name)
for n in range(4):
 for j in range(n+1):
  x=20+j*14;line(40,40,x,8,'#101820');line(x,8,x+9,0,'#101820');line(40,40,x,70,'#101820');line(x,70,x+8,80,'#101820')
 save(f'tiles/crack/frame{n:02}',sheet=True)
for n in range(3):
 math=__import__('math')
 for y in range(80):
  for x in range(80):
   v=math.sin(x/8+math.sin(y/11+n*1.8)*1.3)+0.8*math.sin(y/9+math.sin(x/15-n)*1.4)+0.35*math.sin((x-y)/5+n)
   c=['#5e2930','#a8352b','#dc5028','#fa8933','#ffd470'][max(0,min(4,int((v+2.15)*1.15)))]
   rect(x,y,1,1,c)
 for cx,cy,r in [(20+n*2,24-n,9),(59-n,58+n,12),(9,69,6)]:
  circ(cx,cy,r+2,'#ffb94b');circ(cx,cy,r,'#7c2e2d');circ(cx+2,cy-2,r-3,'#ad3c29')
 save(f'hazards/lava/frame{n:02}',sheet=True)
for state,count in [('idle',2),('walk',4),('drill-down',3),('drill-side',3),('jetpack',3),('fall',2),('hurt',2),('fuel-out',2)]:
 for f in range(count):
  bob=f%2*2; body=25+bob
  if state=='jetpack':body-=4
  if state=='drill-side':body+=f%2
  if state=='fall':body-=3
  if state=='hurt':body+=f*4
  if state=='fuel-out':body+=6
  # outlined backpack, boots, pressure suit, visor, lamp, drill
  rect(13,body+6,15,30,'#101d28');rect(16,body+8,9,24,'#627b7b');rect(17,body+10,4,17,'#a4b4a6')
  for x,off in [(27,[-3,0,3,0][f] if state=='walk' else 4 if state=='fall' else 0),(43,[3,0,-3,0][f] if state=='walk' else -4 if state=='fall' else 0)]:
   rect(x,body+25+off,12,20,'#152b36');rect(x+2,body+26+off,8,12,'#b8c7b4');rect(x-2,body+42+off,16,5,'#14212c')
  rect(25,body,31,35,'#102733');rect(28,body+2,25,28,'#d9b15e');rect(30,body+7,22,4,'#ffe09a');rect(31,body+22,19,6,'#8e6944')
  circ(40,body-5,17,'#102733');circ(40,body-7,14,'#d9c38a');rect(35,body-14,20,15,'#183a48');rect(38,body-12,15,5,'#82d9dc');rect(35,body-17,20,4,'#f9dc8f');rect(52,body-13,7,6,'#fff4c1' if f%2 else '#e1c983');rect(32,body+12,5,7,'#f0dfae');rect(33,body+14,3,2,'#7ba6a5');rect(15,body+27,8,3,'#dd985e')
  if state=='fall':line(25,body+12,13,body-2,'#d9b15e');rect(10,body-6,8,8,'#a9c6bb')
  if state=='hurt':line(26,body+10,17,body-3-f*3,'#d9b15e')
  if state=='drill-down':
   rect(45,body+20,13,22,'#758c90');rect(47,body+42,9,12+f,'#d4e0cf');line(46,body+44,57,body+48,'#344753')
  else:
   rect(46,body+13,16,10,'#b3c2aa');rect(56,body+12,13,14,'#526d78');rect(67,body+15,10,8,'#c7d8c8');line(69,body+15,72,body+22,'#334b59')
  if state=='jetpack':
   for k in range(13+f*2):rect(18+k//5,body+33+k,8-k//2,1,'#ffb94c' if k<7 else '#eb6941')
  save(f'miner/{state}/frame{f:02}',sheet=True)
# Industrial camp buildings with unique silhouettes and equipment.
for i,name in enumerate(['fuel-depot','ore-market','save-pad','upgrade-shop','supply-depot','launch-pad']):
 w=240;h=176
 rect(8,158,224,15,'#182a34');rect(12,154,216,5,'#92a4a0');rect(28,58,180,96,'#243e49');rect(32,62,172,8,'#627a7d')
 for x in range(36,201,12):rect(x,72,3,74,'#304e59')
 rect(50,88,66,65,'#142631');rect(55,94,56,43,'#55949b');rect(59,98,48,4,'#a8d5c5');rect(132,105,55,48,'#101e28');rect(137,110,45,33,'#445e67')
 rect(21,45,198,16,'#182b35');rect(28,48,184,5,['#edba65','#7bc8ae','#a5c7ea','#e3a771','#aa9fcf','#e3b877'][i])
 if i==0:
  circ(172,57,34,'#182b35');circ(172,57,28,'#a3b7ac');rect(149,55,46,5,'#496c73');rect(155,16,34,12,'#718b89')
 if i==1:
  rect(15,100,37,50,'#8a6744');rect(12,98,42,6,'#cba268');rect(112,15,9,32,'#83aeb0');rect(80,12,74,8,'#bdd7c3')
 if i==2:
  rect(76,18,89,130,'#385b69');rect(83,26,75,72,'#162c39');rect(92,37,57,6,'#7ae9c5');rect(92,51,42,5,'#7ae9c5');rect(94,110,50,12,'#e8c477')
 if i==3:
  rect(44,17,24,42,'#556c72');rect(40,12,32,8,'#9caaa0');circ(169,112,22,'#87a6a0');circ(169,112,12,'#304d59')
 if i==4:
  for x in range(16,200,39):rect(x,135,33,18,'#b09265');rect(x+3,138,27,3,'#d5bb8b')
 if i==5:
  ops.clear();rect(8,154,224,18,'#3e5963');rect(12,150,216,5,'#a7b4a7');rect(22,25,12,128,'#45646e');rect(22,25,90,9,'#80968e');line(28,30,90,150,'#8c9c8f')
 for xx in [32,196]:
  for yy in [73,146]:rect(xx,yy,3,3,'#a4b7a7')
 for xx in range(132,187,7):rect(xx,146,3,4,'#dcb579')
 for yy in range(115,137,5):rect(140,yy,36,2,'#182e38')
 save('surface/'+name,w,h)
for n in range(6):
 rect(4,148,152,12,'#4c6971');rect(8,145,144,4,'#c1c6a7')
 if n:
  rect(60,35,40,106,'#9cb8b4');rect(64,40,10,94,'#d4ded0');rect(92,40,8,94,'#5a7b83');
  for y in range(50,135,22):rect(60,y,40,3,'#385966')
 if n>1:rect(49,64,10,72,'#d9ae68');rect(101,64,10,72,'#d9ae68')
 if n>2:circ(80,61,11,'#193b50');circ(80,61,7,'#7cdae0')
 if n>3:rect(64,136,32,10,'#1c3743');rect(49,117,10,27,'#62868a');rect(101,117,10,27,'#62868a')
 if n>4:
  for y in range(8,35):rect(80-(y-7)//2,y,max(1,y-7),1,'#e5d0a0')
 save(f'rocket/stage{n}',160,160)
for i,name in enumerate(['fuel','hull','cargo','credits','depth','resonite','cryenite','core-sample']):
 c='#d9c38b'
 if i==0:
  rect(7,5,11,16,c);rect(9,2,7,4,c);rect(10,8,5,7,'#263e48');line(18,8,21,11,c);line(21,11,21,19,c)
 elif i==1:
  for y in range(3,21):
   width=8 if y<13 else max(1,8-(y-13));rect(12-width,y,width*2,1,'#91d5c5')
  line(8,10,11,13,'#294f5a');line(11,13,17,7,'#294f5a')
 elif i==2:
  rect(3,7,18,14,c);rect(8,2,8,6,c);rect(10,4,4,4,'#223c46');rect(5,10,14,2,'#7e987f');rect(10,7,3,14,'#7e987f')
 elif i==3:
  circ(12,12,10,'#b99459');circ(12,12,8,'#efcf85');line(15,7,9,7,'#7c6949');line(9,7,9,17,'#7c6949');line(9,17,15,17,'#7c6949');rect(6,11,8,2,'#7c6949')
 elif i==4:
  line(12,2,12,19,'#adc7c3');line(6,14,12,20,'#adc7c3');line(12,20,18,14,'#adc7c3');line(3,22,21,22,'#adc7c3')
 else:
  col=['#80e9c9','#b1a0ff','#ffcc84'][i-5]
  for y in range(3,22):
   width=max(1,7-abs(y-12)//2);rect(12-width,y,width*2,1,col)
  line(12,4,12,20,'#efffe5');line(6,11,17,11,'#efffe5')
 save('icons/'+name,24,24)
# Sky: layered distant mesas and stars baked into the art.
for i in range(140):rect(random.randrange(1280),random.randrange(410),1,1,random.choice(['#4b646e','#8caaab']))
for layer,c in [(0,'#142c39'),(1,'#1a3540'),(2,'#24414a')]:
 for x in range(0,1280,8):
  y=int(340+layer*38+35*__import__('math').sin(x/(90+layer*35))+15*__import__('math').sin(x/37));rect(x,y,8,520-y,c)
save('surface/sky',1280,520,bg='#0d222f')
for x in range(0,80,3):rect(x,random.randrange(3,10),3,3,'#8c8263')
rect(0,10,80,8,'#403e36');save('surface/ground',80,24,bg='#334341')
circ(40,48,36,'#334b50');circ(40,50,27,'#0a1721');rect(13,50,54,30,'#0a1721');save('surface/cave-mouth')
print('art complete')
