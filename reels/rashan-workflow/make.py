from PIL import Image, ImageDraw, ImageFont
import subprocess, imageio_ffmpeg
W,H=1080,1920; F="/usr/share/fonts/truetype/dejavu/DejaVuSans"
f=lambda s,b=True: ImageFont.truetype(F+("-Bold" if b else "")+".ttf",s)
BG,INK,GR,OR,CARD,MUT="#FFF8EC","#1d2a22","#1E6B3A","#E8891C","#FFFFFF","#6b7468"
logo=Image.open("../../zidane-logos/zidane-corporation-logo.png").convert("RGBA"); logo.thumbnail((520,200))
S=[
 (None,"Rashan Order","ka poora workflow",[],"Zidane Books mein 7 steps — kit se invoice tak"),
 ("1","Kit banao","Ek bag mein kya jayega",["Rice 5 kg ........ Rs 1,100","Oil 5 ltr ......... Rs 2,800","Daal 2 kg ......... Rs   640","Sugar 2 kg ........ Rs   320","Ek bag = Rs 4,860"],"Menu: Ration Kits → + New kit"),
 ("2","Quotation","Kit → Make quotation",["Customer + kitne bags (e.g. 500)","Customer ko kya dikhana hai:","• Har item ka rate + bag total","• Rates hidden, sirf bag total","• Item by item"],"Draft par discount / delivery add kar sakte ho"),
 ("3","Job banao","Quote accept → Job",["Saman stock se nikle","Jo kam hai woh purchase karo","Bags × qty khud calculate"],"Andar sab item-wise, customer ko bags"),
 ("4","Packing + kharche","Job → Pack bags",["Aaj 150 bags pack hue → entry","Labour, packing material","Loading, delivery → Job cost","Har order ka kharcha alag"],"Cost per bag aur margin khud dikhta hai"),
 ("5","Delivery points","Job → + Add delivery points",["Korangi office ...... 200 bags","SITE factory ........ 180 bags","Landhi warehouse .... 120 bags","Total = 500 ✓"],"Naam, address, receiver, phone"),
 ("6","DC har point ki","DC for bags → point chuno",["Har DC par usi point ka address","Bags limit: jitne packed + jitne chahiye","Teeno DC ek saath draft","Sign wali DC upload karo"],"Table mein: gaye / draft / baaki"),
 ("7","Invoice","Job → Invoice for bags",["500 bags × Rs 4,860","Ek invoice — ya delivery-wise alag","Payment → kis account mein aaya"],"Bas! Order complete ✓"),
]
for i,(n,t,sub,lines,tip) in enumerate(S):
  im=Image.new("RGB",(W,H),BG); d=ImageDraw.Draw(im)
  im.paste(logo,((W-logo.width)//2,110),logo)
  d.rectangle((0,H-24,W,H),fill=GR)
  y=420 if n else 720
  if n:
    d.rounded_rectangle((80,y,330,y+80),40,fill=OR); d.text((205,y+40),f"STEP {n}/7",font=f(40),fill="white",anchor="mm"); y+=130
  d.text((80,y),t,font=f(100 if n else 120),fill=GR); y+=140
  d.text((80,y),sub,font=f(50,False),fill=INK); y+=110
  if lines:
    h=60+len(lines)*88; d.rounded_rectangle((60,y,W-60,y+h),36,fill=CARD,outline="#e9dfc9",width=3)
    for k,l in enumerate(lines):
      last = k==len(lines)-1 and ("=" in l or "✓" in l)
      d.text((110,y+40+k*88),l,font=f(44,last) if not last else f(46),fill=GR if last else INK)
    y+=h+70
  d.rounded_rectangle((60,y,W-60,y+130),30,fill="#E8F1EA")
  d.text((W//2,y+65),tip,font=f(38),fill=GR,anchor="mm")
  im.save(f"s{i}.png")
ff=imageio_ffmpeg.get_ffmpeg_exe(); D,X=5.5,0.6; n=len(S)
cmd=[ff,"-y","-loglevel","error"]
for i in range(n): cmd+=["-loop","1","-t",str(D),"-i",f"s{i}.png"]
fc="";prev="[0]"
for i in range(1,n):
  o=f"[v{i}]"; fc+=f"{prev}[{i}]xfade=transition=slideleft:duration={X}:offset={i*(D-X):.2f}{o};"; prev=o
fc+=f"{prev}format=yuv420p,fps=30[out]"
subprocess.run(cmd+["-filter_complex",fc,"-map","[out]","-c:v","libx264","-crf","20","rashan-workflow.mp4"],check=True)
