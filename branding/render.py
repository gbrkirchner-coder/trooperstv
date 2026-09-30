import math, subprocess, sys, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import imageio_ffmpeg
S='/tmp/claude-0/-home-claude-trooperstv/b9834d81-8a91-5fe1-8783-4051cb7106b3/scratchpad/'
FONT=S+'LilitaOne.ttf'
LOGO=Image.open('/home/claude/trooperstv/public/logo.png').convert('RGBA')
# circular crop of logo (drop square corners)
m=Image.new('L',LOGO.size,0); ImageDraw.Draw(m).ellipse((6,6,LOGO.width-6,LOGO.height-6),fill=255)
LOGO.putalpha(m)
FPS=30
def ease_out_back(t,s=1.9):
    t-=1; return t*t*((s+1)*t+s)+1
def ease_out(t): return 1-(1-t)**3
def ease_in(t): return t**3
def clamp(x): return max(0.0,min(1.0,x))

def background(W,H,t):
    img=Image.new('RGB',(W,H),(20,70,190))
    d=ImageDraw.Draw(img)
    cx,cy=W/2,H*0.45; R=math.hypot(W,H)
    n=24; rot=t*8
    for i in range(n):
        if i%2: continue
        a0=math.radians(rot+i*360/n); a1=math.radians(rot+(i+1)*360/n)
        d.polygon([(cx,cy),(cx+R*math.cos(a0),cy+R*math.sin(a0)),(cx+R*math.cos(a1),cy+R*math.sin(a1))],fill=(32,95,215))
    # vignette
    v=Image.new('L',(W,H),0); vd=ImageDraw.Draw(v)
    for k in range(40):
        r=R*0.55*(1-k/40)
        vd.ellipse((cx-r*1.3,cy-r,cx+r*1.3,cy+r),fill=int(255*(k/40)))
    dark=Image.new('RGB',(W,H),(6,20,70))
    img=Image.composite(img,dark,v.filter(ImageFilter.GaussianBlur(40)))
    return img

def text(img,s,cx,cy,size,fill=(255,210,40),stroke=None,alpha=1.0,shadow=True):
    if alpha<=0: return
    f=ImageFont.truetype(FONT,size); sw=stroke if stroke is not None else max(4,size//11)
    layer=Image.new('RGBA',img.size,(0,0,0,0)); d=ImageDraw.Draw(layer)
    bb=d.textbbox((0,0),s,font=f,stroke_width=sw); w=bb[2]-bb[0]; h=bb[3]-bb[1]
    x=cx-w/2-bb[0]; y=cy-h/2-bb[1]
    if shadow: d.text((x,y+size*0.09),s,font=f,fill=(11,11,18),stroke_width=sw,stroke_fill=(11,11,18))
    d.text((x,y),s,font=f,fill=fill,stroke_width=sw,stroke_fill=(11,11,18))
    if alpha<1: layer.putalpha(layer.getchannel('A').point(lambda p:int(p*alpha)))
    img.alpha_composite(layer)

def pill(img,s,cx,cy,size,bg=(230,40,60),alpha=1.0,scale=1.0):
    if alpha<=0: return
    f=ImageFont.truetype(FONT,int(size*scale))
    layer=Image.new('RGBA',img.size,(0,0,0,0)); d=ImageDraw.Draw(layer)
    bb=d.textbbox((0,0),s,font=f); w=bb[2]-bb[0]; h=bb[3]-bb[1]
    px,py=h*0.9,h*0.55; sw=max(4,int(size*scale)//10)
    box=(cx-w/2-px,cy-h/2-py,cx+w/2+px,cy+h/2+py)
    d.rounded_rectangle((box[0],box[1]+sw*1.6,box[2],box[3]+sw*1.6),radius=(h+2*py)/2,fill=(11,11,18))
    d.rounded_rectangle(box,radius=(h+2*py)/2,fill=bg,outline=(11,11,18),width=sw)
    d.text((cx-w/2-bb[0],cy-h/2-bb[1]),s,font=f,fill=(255,255,255))
    if alpha<1: layer.putalpha(layer.getchannel('A').point(lambda p:int(p*alpha)))
    img.alpha_composite(layer)

def paste_logo(img,cx,cy,size,rot=0,alpha=1.0):
    if size<2 or alpha<=0: return
    L=LOGO.resize((int(size),int(size)),Image.LANCZOS)
    if rot: L=L.rotate(rot,resample=Image.BICUBIC,expand=True)
    sh=Image.new('RGBA',L.size,(0,0,0,0)); sh.putalpha(L.getchannel('A').point(lambda p:int(p*0.45)))
    sh=sh.filter(ImageFilter.GaussianBlur(size*0.03))
    if alpha<1: L.putalpha(L.getchannel('A').point(lambda p:int(p*alpha)))
    img.alpha_composite(sh,(int(cx-L.width/2),int(cy-L.height/2+size*0.05)))
    img.alpha_composite(L,(int(cx-L.width/2),int(cy-L.height/2)))

def ring(img,cx,cy,r,width,alpha):
    if alpha<=0: return
    layer=Image.new('RGBA',img.size,(0,0,0,0)); d=ImageDraw.Draw(layer)
    d.ellipse((cx-r,cy-r,cx+r,cy+r),outline=(255,255,255,int(255*alpha)),width=int(width))
    img.alpha_composite(layer)

random.seed(7)
SPARKS=[(random.uniform(0,2*math.pi),random.uniform(0.6,1.4),random.uniform(0.6,1.2)) for _ in range(28)]
def sparks(img,cx,cy,base,t):
    if t<0 or t>1: return
    d=ImageDraw.Draw(img)
    for a,sp,sz in SPARKS:
        r=base*(0.5+ease_out(t)*1.6*sp); s=base*0.05*sz*(1-t)
        x,y=cx+r*math.cos(a),cy+r*math.sin(a)
        pts=[(x+s*math.cos(math.radians(90+k*72))*(1 if k%1==0 else 1),y-s*math.sin(math.radians(90+k*72))) for k in range(5)]
        star=[]
        for k in range(10):
            rr=s if k%2==0 else s*0.45; ang=math.radians(90+k*36)
            star.append((x+rr*math.cos(ang),y-rr*math.sin(ang)))
        d.polygon(star,fill=(255,215,50,int(255*(1-t))),outline=(11,11,18))

def flash(img,a):
    if a<=0: return
    img.alpha_composite(Image.new('RGBA',img.size,(255,255,255,int(255*a))))

def intro_frame(W,H,t,dur,vertical):
    img=background(W,H,t).convert('RGBA')
    u=min(W,H)
    size=u*(0.62 if vertical else 0.52)
    cy=H*(0.42 if vertical else 0.42)
    k=clamp(t/0.55)
    sc=ease_out_back(k) if k>0 else 0
    rot=(1-ease_out(k))*-25
    # exit: zoom through at the end
    ex=clamp((t-(dur-0.35))/0.35)
    sc*=1+ease_in(ex)*2.5
    a=1-ex
    ring(img,W/2,cy,size*0.5*(0.8+ease_out(clamp((t-0.45)/0.5))*1.2),u*0.02*(1-clamp((t-0.45)/0.5)),1-clamp((t-0.45)/0.5) if t>0.45 else 0)
    sparks(img,W/2,cy,size*0.5,(t-0.45)/0.8)
    paste_logo(img,W/2,cy,size*sc,rot,a)
    tk=clamp((t-0.55)/0.35)
    ty=cy+size*0.5+u*(0.09 if vertical else 0.085)+(1-ease_out_back(tk,1.4))*u*0.15 if tk>0 else 0
    if tk>0: text(img,'TROOPERS',W/2,ty,int(u*(0.15 if vertical else 0.12)),alpha=a*tk)
    if tk>0: text(img,'BRAWL STARS CLUB',W/2,ty+u*(0.105 if vertical else 0.09),int(u*(0.045 if vertical else 0.04)),fill=(255,255,255),alpha=a*tk)
    flash(img,max(0,0.55-abs(t-0.55)*4)*0.6 if t>0.4 else 0)
    flash(img,ease_in(ex)*0.9)
    return img.convert('RGB')

def outro_frame(W,H,t,dur,vertical):
    img=background(W,H,t).convert('RGBA')
    u=min(W,H)
    k=clamp(t/0.5); sc=ease_out_back(k) if k>0 else 0
    fin=clamp((t-(dur-0.5))/0.5)  # fade to dark at end
    if vertical:
        lcx,lcy,size=W/2,H*0.30,u*0.55
    else:
        lcx,lcy,size=W/2,H*0.33,u*0.42
    bob=math.sin(t*2.2)*u*0.008
    paste_logo(img,lcx,lcy+bob,size*sc,(1-ease_out(k))*20)
    t1=clamp((t-0.35)/0.35)
    if t1>0: text(img,'DANKE FÜRS ZUSCHAUEN!',W/2,lcy+size*0.5+u*0.08+(1-ease_out_back(t1,1.4))*u*0.1,int(u*(0.075 if vertical else 0.07)),alpha=t1)
    t2=clamp((t-0.7)/0.35)
    pulse=1+0.06*math.sin(max(0,t-1.1)*6.5) if t>1.1 else 1
    if t2>0: pill(img,'ABONNIEREN',W/2,lcy+size*0.5+u*0.21,int(u*(0.06 if vertical else 0.055)),alpha=t2,scale=ease_out_back(t2)*pulse)
    t3=clamp((t-1.0)/0.35)
    if t3>0:
        text(img,'CLUB BEITRETEN: #2VRLRP9PU',W/2,lcy+size*0.5+u*(0.34 if vertical else 0.33),int(u*(0.042 if vertical else 0.04)),fill=(255,255,255),alpha=t3)
        text(img,'troopers.tv',W/2,lcy+size*0.5+u*(0.41 if vertical else 0.40),int(u*(0.035 if vertical else 0.032)),fill=(180,215,255),alpha=t3,shadow=False)
    if fin>0: img.alpha_composite(Image.new('RGBA',img.size,(0,0,0,int(255*fin))))
    return img.convert('RGB')

def render(name,fn,W,H,dur,vertical):
    out=S+'brand/'+name+'.mp4'
    cmd=[imageio_ffmpeg.get_ffmpeg_exe(),'-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-',
         '-f','lavfi','-t',str(dur),'-i','anullsrc=r=48000:cl=stereo','-shortest',
         '-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-preset','medium','-c:a','aac','-movflags','+faststart',out]
    p=subprocess.Popen(cmd,stdin=subprocess.PIPE)
    n=int(dur*FPS)
    for i in range(n):
        p.stdin.write(fn(W,H,i/FPS,dur,vertical).tobytes())
    p.stdin.close(); p.wait(); print(name,p.returncode)

if __name__=='__main__':
    which=sys.argv[1]
    jobs={'intro-long':(intro_frame,1920,1080,3.0,False),'intro-short':(intro_frame,1080,1920,2.0,True),
          'outro-long':(outro_frame,1920,1080,8.0,False),'outro-short':(outro_frame,1080,1920,3.5,True)}
    if which=='preview':
        for nm,(fn,W,H,dur,v) in jobs.items():
            ts=[0.3,0.7,1.2,dur-0.2] if 'intro' in nm else [0.4,1.0,2.5,dur-0.2]
            fr=[fn(W,H,t,dur,v).resize((W//4,H//4)) for t in ts]
            c=Image.new('RGB',(W//4*4,H//4),'black')
            for i,f in enumerate(fr): c.paste(f,(i*W//4,0))
            c.save(S+'brand/prev-'+nm+'.png')
    else:
        fn,W,H,dur,v=jobs[which]; render(which,fn,W,H,dur,v)
