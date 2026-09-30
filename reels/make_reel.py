import subprocess, imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont
FF=imageio_ffmpeg.get_ffmpeg_exe()
W,H=1080,1920
RED=(214,31,38); WHITE=(255,255,255); DARK=(20,20,20)
B='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
R='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
def f(p,s): return ImageFont.truetype(p,s)

def overlay(name, lines, top=260, tag=None):
    """lines: list of (text, size, fg, bg or None)"""
    im=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(im)
    # subtle top gradient for readability
    for y in range(900):
        a=int(150*(1-y/900)); d.line([(0,y),(W,y)],fill=(0,0,0,a))
    y=top
    if tag:
        ft=f(B,34); tw=d.textlength(tag,font=ft)
        d.rounded_rectangle([90,y,90+tw+44,y+62],18,fill=WHITE)
        d.text((112,y+12),tag,font=ft,fill=RED); y+=100
    for text,size,fg,bg in lines:
        ft=f(B,size); tw=d.textlength(text,font=ft); h=int(size*1.25)
        if bg:
            d.rounded_rectangle([90,y,90+tw+50,y+h+26],22,fill=bg)
            d.text((115,y+13),text,font=ft,fill=fg)
            y+=h+40
        else:
            d.rounded_rectangle([90,y,90+tw+40,y+h+18],16,fill=(0,0,0,165))
            d.text((110,y+9),text,font=ft,fill=fg); y+=h+30
    im.save(name)

overlay('o1.png',[("Company ke liye",72,WHITE,None),("500 ration bags",84,WHITE,RED),("chahiye?",84,WHITE,RED)],tag="RAMADAN 2027")
overlay('o2.png',[("Bas list bhejo.",80,WHITE,RED),("Excel · PDF · WhatsApp",56,WHITE,None),("ya handwritten photo bhi",56,WHITE,None)],tag="STEP 1")
overlay('o3.png',[("Hum source",80,WHITE,RED),("aur pack karte hain",72,WHITE,RED),("Aapke budget aur brands",54,WHITE,None),("ke hisaab se",54,WHITE,None)],tag="STEP 2")
overlay('o4.png',[("Corporate · Factory",66,WHITE,None),("NGO · Employees",66,WHITE,None),("Custom ration programs",62,WHITE,RED)],tag="KIS KE LIYE?")
overlay('o5.png',[("Delivery aapke",80,WHITE,RED),("schedule pe",80,WHITE,RED),("Karachi bhar mein",56,WHITE,None)],tag="STEP 3")

# end card
im=Image.new('RGB',(W,H),RED); d=ImageDraw.Draw(im)
def c(text,y,size,font=B,fill=WHITE):
    ft=f(font,size); tw=d.textlength(text,font=ft); d.text(((W-tw)/2,y),text,font=ft,fill=fill)
c("ZIDANE",300,150); c("B2B Grocery & Ration Bags · Karachi",490,42,R)
d.rounded_rectangle([140,640,W-140,1010],36,fill=WHITE)
c("Ramadan packages",690,58,B,DARK); c("starting from",775,44,R,DARK); c("PKR 2,149",840,120,B,RED)
c("Early booking open",1090,62)
c("Custom contents · branding · quantity",1180,40,R)
d.rounded_rectangle([140,1300,W-140,1420],60,fill=(37,211,102)); c("WhatsApp: 0339 2639315",1330,54)
c("021 111 ZIDANE (943263)",1470,50); c("zidane.com.pk",1550,56)
im.save('end.png')

clips=[('hero',2.2,4.5,'o1.png'),('stock',0,5,'o2.png'),('packing',0,5,'o3.png'),('ration-program',0,5,'o4.png'),('dispatch',0,5,'o5.png')]
parts=[]
for i,(n,ss,dur,ov) in enumerate(clips):
    out=f'seg{i}.mp4'; parts.append(out)
    vf=(f"[0:v]scale=-2:{H},crop={W}:{H},setsar=1,fps=30,eq=contrast=1.06:saturation=1.12,"
        f"zoompan=z='min(zoom+0.0006,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps=30[bg];"
        f"[1:v]format=rgba,fade=in:st=0.25:d=0.35:alpha=1[ov];[bg][ov]overlay=0:0,format=yuv420p")
    subprocess.run([FF,'-loglevel','error','-y','-ss',str(ss),'-t',str(dur),'-i',f'v/{n}.mp4','-loop','1','-t',str(dur),'-i',ov,
        '-filter_complex',vf,'-an','-c:v','libx264','-preset','medium','-crf','20','-r','30',out],check=True)
subprocess.run([FF,'-loglevel','error','-y','-loop','1','-t','4.5','-i','end.png','-vf',
    f"scale={W}:{H},zoompan=z='min(zoom+0.0005,1.04)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps=30,fade=in:st=0:d=0.3,format=yuv420p",
    '-c:v','libx264','-crf','20','-r','30','seg_end.mp4'],check=True)
parts.append('seg_end.mp4')
open('list.txt','w').write(''.join(f"file '{p}'\n" for p in parts))
subprocess.run([FF,'-loglevel','error','-y','-f','concat','-safe','0','-i','list.txt','-f','lavfi','-i','anullsrc=r=44100:cl=stereo',
    '-map','0:v','-map','1:a','-shortest','-c:v','libx264','-crf','20','-preset','medium','-c:a','aac','-movflags','+faststart','reel.mp4'],check=True)
