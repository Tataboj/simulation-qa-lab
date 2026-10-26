"""Procedural terrain raster for a fictional offline training environment."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W,H=1600,1100
rng=np.random.default_rng(841)
acc=np.zeros((H,W),dtype=np.float32)
for n,weight in [(7,1.0),(13,.53),(28,.27),(65,.11),(146,.055)]:
    small=np.uint8(rng.uniform(0,255,(max(2,int(H*n/W)),n)))
    layer=np.asarray(Image.fromarray(small,'L').resize((W,H),Image.Resampling.BICUBIC),dtype=np.float32)/255.
    acc+=weight*(layer-.5)
y,x=np.ogrid[:H,:W]
ridge=np.sin(x/125+y/178)*.18+np.cos(x/242-y/122)*.13
height=np.clip((acc + ridge+.72)/1.45,0,1)
dy,dx=np.gradient(height)
shade=np.clip(.80-(dx*3.0+dy*4.0),.58,1.14)
base=np.array([22.,40.,44.])
low=np.array([43.,64.,62.])
high=np.array([65.,79.,70.])
t=np.clip(height,.05,.90)[:,:,None]
color=(base[None,None,:]*(1-t)+low[None,None,:]*t)*shade[:,:,None]
color += np.clip((height-.58)*1.9,0,1)[:,:,None]*(high-low)[None,None,:]
# Thin pseudo-contour accents in the raster; no geological accuracy implied.
cont=np.abs((height*32)%1 - .5)<.014
color[cont]=color[cont]*.78+np.array([45,79,77])*.22
noise=rng.normal(0,1.2,(H,W,1))
color=np.uint8(np.clip(color+noise,0,255))
img=Image.fromarray(color,'RGB').convert('RGBA')
d=ImageDraw.Draw(img,'RGBA')
# Water channel, tree clusters, engineered training roads and civilian-like buildings; all fictional.
river=[(-30,670),(160,610),(340,604),(500,640),(650,645),(840,715),(1070,733),(1330,683),(1650,790)]
d.line(river,fill=(13,37,52,170),width=42,joint='curve')
d.line(river,fill=(35,88,104,110),width=13,joint='curve')
# forest blocks
for cx,cy,r in [(270,260,165),(410,385,110),(1060,170,200),(1300,330,135),(1110,890,135),(260,850,175)]:
    for _ in range(470):
        a=rng.uniform(0,2*np.pi); rr=rng.uniform(0,r)
        px=int(cx+np.cos(a)*rr); py=int(cy+np.sin(a)*rr*.74)
        radius=int(rng.uniform(2.4,8))
        d.ellipse((px-radius,py-radius,px+radius,py+radius),fill=(12,56,46,int(rng.uniform(13,42))))
roads=[[(20,930),(210,760),(420,650),(610,500),(780,445),(970,290),(1260,175),(1620,110)],
       [(80,0),(260,170),(450,370),(710,530),(1030,665),(1350,960),(1550,1120)],
       [(0,240),(245,440),(540,530),(690,695),(950,835),(1340,840),(1600,780)],
       [(760,-20),(760,225),(880,355),(910,535),(810,760),(780,1120)]]
for road in roads:
    d.line(road,fill=(9,21,25,170),width=16,joint='curve')
    d.line(road,fill=(91,114,104,160),width=7,joint='curve')
    d.line(road,fill=(171,173,125,75),width=2,joint='curve')
# residential cluster
for cluster in [(780,500),(550,270),(1210,570)]:
    for _ in range(65):
        xx=int(cluster[0]+rng.normal(0,85)); yy=int(cluster[1]+rng.normal(0,55))
        ww=int(rng.uniform(7,19));hh=int(rng.uniform(6,15))
        d.rectangle((xx,yy,xx+ww,yy+hh),fill=(106,123,117,105),outline=(153,170,151,75),width=1)
# label training area on raster for atmospheric effect
d.text((30,30),'ECHO TRAINING SECTOR  /  SYNTHETIC TERRAIN',fill=(162,196,188,130))
img=img.convert('RGB')
out=Path(__file__).resolve().parents[1]/'public'/'terrain.png'
img.save(out,optimize=True)
print(out.name, out.stat().st_size)
