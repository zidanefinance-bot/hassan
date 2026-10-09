# sr | description | quoted brand | qty | quoted rate | correct brand | buy low | buy high | source | confidence | note
# confidence: V = seen on Pakistani online store, P = similar/sister item listed online, E = market estimate (verify by phone)
ROWS = """
1|STONE CUTTING DISC 4"|Industrial|30|325|Bosch / Industrial|120|280|toolshub/ingcomart Permanent 4in 120; nasirnsons Rhodius 280|V|
2|STEEL NAIL 1-1/2" Taiwan|Licota|2|455|Generic (Taiwan)|300|450|Hardware mkt|E|Licota nails nahi banata
3|MECHANICAL JACK 5 TON (Japan or Germany)|Licota|2|58500|Masada (Japan) / Yato|45000|75000|Importer quote needed|E|Licota jack nahi banata; Japan brand confirm karo
4|DRILL BIT 08 MM (Yato or any Good brand taiwan)|Licota|50|715|Yato|350|500|ktools/imartpk Yato|E|
5|MECHANICAL JACK 03 TONS (Japan or germany)|Licota|2|41600|Masada (Japan) / Yato|32000|55000|Importer quote needed|E|
6|SAFETY HELMET (WHITE)|Industrial|6|1105|Industrial|730|1000|powerhouseexpress Total 730; toolsmart Ingco 1,440; local 500-750|V|
7|SAFETY GOOGLES|Industrial|24|507|Industrial|250|400|Market|E|
8|7 DRAWER TOOL TROLLEY|Licota|3|161070|Licota (AWX series, empty)|150000|210000|ktools Yato 7-drawer 211pc 315,000 / 6-drawer 177pc 220,000 (with tools); empty Licota est|P|Empty ya tools ke saath? Confirm
9|DOUBLE OPEN RING OFFSET WRENCH SET (12PCS)|Licota|4|18200|Licota|20000|26000|toolsmart Licota 14pc set 25,660|P|
10|DOUBLE OPEN END WRENCH 6 TO 32 (12 PCS SET)|Licota|4|15600|Licota|16000|21000|toolsmart Licota; Ingco 12pc 9,899|P|
11|DOUBLE OPEN END WRENCH 36X41|Licota|3|3640|Licota|4500|5800|toolsmart Licota wrench sets (scaled); goldentools.ae Licota|E|
12|DOUBLE OPEN END WRENCH 41X46|Licota|3|4550|Licota|6000|7500|toolsmart Licota wrench sets (scaled); goldentools.ae Licota|E|
13|COMBINATION WRENCH 8 TO 32 (14 PCS SET)|Licota|4|22100|Licota|24000|30000|toolsmart Licota 14pc combo 25,660|V|
14|SOCKET SET (113PCS) 1/4" & 1/2"|Licota|4|75400|Licota|56900|67200|toolsmart Licota 120pc 56,890-67,130|V|
15|PIN PUNCH SET (06PCS SET)|Licota|4|5850|Licota|5460|6200|toolsmart Licota 6pc 5,460|V|
16|HOLLOW PUNCH (3MM-25MM) (15PCS SET)|Licota|4|8450|Yato|6500|9000|ingcotool Harden 12pc 4,699; Licota not in PK|P|Licota PK mein nahi mila
17|LONG TYPE HEX KEY WRENCH SET 09 PCS|Licota|4|2548|Licota|3740|4400|toolsmart 4,400 (long) / 3,740 (extra long)|V|
18|SHORT TYPE HEX KEY WRENCH SET (09PCS)|Licota|4|1846|Licota|2000|3000|toolsmart Licota hex sets (scaled)|P|
19|LONG TYPE HEX WRENCH SET 09 PCS|Licota|4|2548|Licota|3740|4400|toolsmart 4,400 (long) / 3,740 (extra long)|V|Item 17 ka duplicate lagta hai
20|ALLEN HEX KEY 12MM|Licota|3|910|Licota|950|1300|goldentools.ae Licota 12mm AED 250/20pc (~PKR 950 ea)|P|
21|ALLEN (HEX) KEY 14MM|Licota|3|1170|Licota|1200|1700|goldentools.ae Licota 12mm (scaled)|E|
22|ALLEN (HEX) KEY 16MM|Licota|3|1430|Licota|1500|2100|goldentools.ae Licota 12mm (scaled)|E|
23|CIRCLIP PLIER INTERNAL STRAIGHT 175MM|Licota|4|4940|Licota|4500|5500|toolsmart Licota pliers 3,830-5,210|P|
24|CIRCLIP PLIER INTERNAL BENT 175MM|Licota|4|4940|Licota|4500|5500|toolsmart Licota pliers|P|
25|CIRCLIP PLIER EXTERNAL STRAIGHT 175MM|Licota|4|4940|Licota|4500|5500|toolsmart Licota pliers|P|
26|CIRCLIP PLIER EXTERNAL BENT 175MM|Licota|4|4940|Licota|4500|5500|toolsmart Licota pliers|P|
27|CIRCLIP PLIER INTERNAL STRAIGHT 230MM|Licota|4|6760|Licota|6000|7500|toolsmart Licota pliers (scaled)|P|
28|CIRCLIP PLIER EXTERNAL STRAIGHT 230MM|Licota|3|6760|Licota|6000|7500|toolsmart Licota pliers (scaled)|P|
30|CHISEL SET (05 PCS SET)|Licota|4|6136|Licota|4000|4720|toolsmart Licota 5pc 4,000-4,720|V|
31|PIPE WRENCH SIZE 10"|Licota|3|2210|Licota|4200|5200|toolsmart Licota 18" 9,620 (scaled)|P|
32|PIPE WRENCH SIZE 12"|Licota|3|2886|Licota|5200|6500|toolsmart Licota 18" 9,620 (scaled)|P|
33|PIPE WRENCH SIZE 18"|Licota|3|5902|Licota|9620|10500|toolsmart Licota 18" 9,620|V|
34|PIPE WRENCH SIZE 24"|Licota|2|6120|Licota|13000|16000|toolsmart Licota 18" (scaled); Harden 24" 6,560|P|
35|PIPE WRENCH SIZE 36"|Licota|2|12870|Licota|22000|28000|toolsmart Licota (scaled); Wiseup 36" 6,300|P|
36|SLEDGE HAMMER 1 LBS WITH FIBREGLASS HANDLE|Licota|3|1950|Licota|2500|3500|toolsmart Harden fibreglass 6lb 6,480 (Licota ~2x)|E|
37|SLEDGE HAMMER 3 LBS WITH FIBREGLASS HANDLE|Licota|3|4550|Licota|4500|6000|toolsmart Harden fibreglass (Licota premium)|E|
38|SOFT FACE DEAD BLOW HAMMER 50MM|Licota|3|6240|Licota|5000|7000|pakistanpowertools Harden dead blow 1,987-2,450 (Licota premium)|E|
39|VICE GRIP PLIER 08"|Licota|3|1950|Licota|3500|4500|ingcotool locking plier 1,499; Licota premium|E|
40|CORDLESS IMPACT WRENCH 185NM (Bosch)|Bosch Professional|3|79300|Bosch Professional GDX 180-Li|45000|79000|ktools 45,000 solo / 79,000 kit; kamadi 75,200|V|Kit (battery+charger) ho to loss
41|CORDLESS IMPACT WRENCH 350N (Bosch)|Bosch Professional|3|128700|Bosch Professional GDS 18V-350|95000|140000|No PK listing; est from GDX/GDS range|E|
42|CORDLESS IMPACT WRENCH 1000N (Bosch)|Bosch Professional|2|106600|Bosch Professional GDS 18V-1000|70000|143800|ktools 70,000 solo (oos); kamadi 143,800 kit|V|Kit diya to har piece par 37k loss
43|HEX IMPACT ADAPTOR 1/2" FEMALE TO 1/4" FEMALE|Licota|4|1560|Licota|1800|2400|toolsmart Licota impact accessories|E|
44|FLAT FILE 12"|Licota|4|1950|Yato|1750|2000|zeeshanhardware Yato YT-6190 12in 1,750|V|
45|ROUNDE FILE 12"|Licota|4|2210|Yato|1750|2000|zeeshanhardware Yato 12in file 1,750 (flat; round similar)|P|
47|UNIVERSAL PULLER 2-ARMED WITH HOOK BRAKE 21|Licota|3|13000|Licota|12000|16000|goldentools.ae/amazon.ae Licota 6in 3-jaw AED 105-120 (~PKR 9k) scaled + import|E|
48|UNIVERSAL PULLER 2-ARMED WITH HOOK BRAK 250|Licota|2|15600|Licota|16000|24000|goldentools.ae Licota pullers (scaled) + import|E|
49|UNIVERSAL PULLER 2-ARMED 160 X 300 MM 5T|Licota|1|20800|Licota|20000|28000|goldentools.ae Licota pullers (scaled) + import|E|
50|UNIVERSAL PULLER 2-ARMED 250 X 300 MM 7.5T|Licota|1|28600|Licota|28000|38000|goldentools.ae Licota pullers (scaled) + import|E|
51|INTERNAL EXTRACTOR WITH REINFORCED COLLAR|Licota|1|32500|Licota|30000|45000|Licota catalogue; no PK listing|E|
52|MECHANICAL PULLER 3 ARMED 200X200|Licota|2|18200|Licota|18000|25000|goldentools.ae Licota 6in 3-jaw AED 120 (scaled to 8in) + import|E|
53|MECHANICAL PULLER 3 ARMED 250X250|Licota|1|23400|Licota|24000|32000|goldentools.ae Licota 3-jaw (scaled to 10in) + import|E|
54|DRILL MACHINE CORDLESS ROTARY HAMMER Bosch|Bosch Professional|2|400946|Bosch Professional GBH 180-LI / GBH 18V-26|49000|115000|ktools 49,000 solo / 115,000 kit|V|Rate cost se 3x - customer pakray ga
55|MANUAL GREASE GUN 5KG|Licota|2|15600|Yato / Industrial (bucket type)|12000|18000|Market|E|Licota 5kg bucket gun nahi milta
56|AIR GREASE GUN 500CC|Licota|1|10400|Licota|9000|13000|toolsmart Licota grease gun 7,760 (air premium)|P|
57|HAND GREASE GUN WITH HOSE 500CC|Licota|4|4550|Licota|7760|9000|toolsmart Licota 400cc 7,760|V|
58|GREASE PIPE 1/4"X12"|Licota|12|715|Licota|800|1200|Market|E|
59|DOUBLE HANDLE GREASE NOZZLE|Licota|12|1950|Licota|1200|1800|Market|E|
60|STEEL MEASURMENT TAPE 100M|Licota|2|9100|Yato|8000|12000|Market (Licota tapes PK mein nahi)|E|
61|STEEL MEASURMENT TAPE 50M|Licota|2|5850|Yato|5000|7500|Market|E|
62|ALIGNING PRY BAR DIA 5/8" X 18" LENGTH|Licota|3|2600|Licota|3000|4000|Market|E|
63|ADJUSTABLE WRENCH 15"|Licota|1|5551|Licota|9000|11000|toolsmart Licota 10" 5,310; Total 15" 3,700-3,890|P|
64|ROUGH FILE SMOOTH 10"|Licota|3|1560|Yato|1350|1600|zeeshanhardware Yato YT-6228 10in 1,350|V|
65|POLISH FILE SMOOTH 10"|Licota|3|1560|Yato|1350|1600|zeeshanhardware Yato YT-6228 10in 1,350|V|
66|REVOLVING CENTRE MT4|Licota|2|11700|Vertex (Taiwan)|14000|18000|Market|E|Licota lathe centre nahi banata
67|REVOLVING CENTRE MT3|Licota|2|9750|Vertex (Taiwan)|12000|15000|Market|E|
69|CIRCUMFERENCE TAPE (60-950) (D20-300)|Licota|2|23400|Insize|15000|25000|Market|E|
70|CIRCUMFERENCE TAPE (940-2200) (D300-700)|Licota|1|32500|Insize|25000|40000|Market|E|
71|MEASURING TAPE 5M|Licota|1|1105|Yato|800|1200|Market|E|
73|HSS COBALT DRILL SET 1-13MM 25 PCS|Licota|1|45500|Yato (HSS-Co)|25000|35000|ktools/imartpk Yato|E|
74|HSS DRILL BITS 1/16-1/2" 29 PCS SET|Licota|2|23400|Yato|12000|18000|ktools/imartpk Yato|E|
75|HSS DRILL BIT 14MM TAPER SHANK|Licota|2|1950|Dormer / YG-1|2500|3200|Market; India Dormer ref|E|Licota taper shank nahi banata
76|HSS DRILL BIT 15MM TAPER SHANK|Licota|2|2080|Dormer / YG-1|2700|3400|Market|E|
77|HSS DRILL BIT 15.5MM TAPER SHANK|Licota|2|2210|Dormer / YG-1|2800|3600|Market|E|
78|HSS DRILL BIT 16MM TAPER SHANK|Licota|2|2340|Dormer / YG-1|3000|3800|Market|E|
79|HSS DRILL BIT 16.5MM TAPER SHANK|Licota|2|2470|Dormer / YG-1|3100|4000|Market|E|
80|HSS DRILL BIT 17MM TAPER SHANK|Licota|2|2600|Dormer / YG-1|3300|4200|Market|E|
81|HSS DRILL BIT 17.5MM TAPER SHANK|Licota|2|2730|Dormer / YG-1|3500|4400|Market|E|
82|HSS DRILL BIT 19MM TAPER SHANK|Licota|2|3250|Dormer / YG-1|4000|5000|Market|E|
83|HSS DRILL BIT 21MM TAPER SHANK|Licota|1|4160|Dormer / YG-1|5000|6500|Market|E|
84|HSS DRILL BIT 25MM TAPER SHANK|Licota|1|5850|Dormer / YG-1|6500|8500|Market|E|
85|HSS DRILL BIT 30MM TAPER SHANK|Licota|1|8450|Dormer / YG-1|9500|12500|Market|E|
86|HSS DRILL BIT 32MM TAPER SHANK|Licota|1|9750|Dormer / YG-1|11000|14500|Market|E|
87|HSS DRILL BIT 35MM TAPER SHANK|Licota|1|11700|Dormer / YG-1|13500|17500|Market|E|
88|MORSE TAPER EXTENSION SOCKET SLEEVE ADAPT|Licota|2|4550|Vertex (Taiwan)|3500|5000|Market|E|
89|MORSE TAPER EXTENSION SOCKET SLEEVE ADAPT|Licota|2|5850|Vertex (Taiwan)|4500|6500|Market|E|
90|MORSE TAPER EXTENSION SOCKET SLEEVE ADAPT|Licota|2|7150|Vertex (Taiwan)|5500|8000|Market|E|
91|DEAD CENTRE DIAMOND TIP M2|Licota|2|2340|Vertex (Taiwan)|2500|3500|Market|E|
92|DEAD CENTRE DIAMOND TIP M3|Licota|2|2860|Vertex (Taiwan)|3000|4000|Market|E|
93|DIGITAL VERINER CALIPER 300MM (Insize brand)|Insize|2|25350|Insize 1108-300|15800|19500|amjadhardware 15,800; kamadi 18,100; ktools 19,500|V|
94|MANUAL VERNIER CALLIPER 12" (Insize brand)|Insize|3|8138|Insize 1205-300S|15800|18900|kamadi 15,800|V|Rate cost ka aadha hai
95|MANUAL VERNIER CALLIPER 8" (Insize (Bosch))|Insize|3|6370|Insize 1205-200S|7928|8800|purchaser.com.pk 7,928|V|
96|VERNIER DEPTH GUAGE 250MM GRADUATION 0.02M|Licota|2|14950|Insize|15000|20000|Market|E|Licota measuring nahi banata
97|CORDLESS DRILL DRIVER 150NM Bosch|Bosch Professional|2|286000|Bosch Professional GSR/GSB 18V-150 C|110000|199500|ktools GSB 18V-150C 199,500 (oos)|P|Rate bohat zyada - verify kit
98|TAP SET 1/2" BSPF LEFT HAND (Dormer)|Dormer|1|15600|Dormer|12000|16000|Market|E|
99|TAP SET 1/2" BSPF RIGHT HAND|Licota|1|11050|Dormer / Totem|8000|11000|Market|E|Licota taps PK mein nahi
100|TAP SET 3/8" BSPF|Licota|1|9100|Dormer / Totem|6500|9000|Market|E|
101|TAP SET 1/4" BSPF|Licota|3|7150|Dormer / Totem|5500|7500|Market|E|
102|TAP SET 1/8" BSPF|Licota|3|5850|Dormer / Totem|4500|6000|Market|E|
103|WIRE BRUSH HEAVY DUTY 4/5 NROW|Industrial|12|715|Industrial|350|550|Market|E|
104|WELDING HELMET (FLIP FRONT)|Industrial|4|1274|Industrial|700|1000|Market|E|
105|WELDING LEATHER GLOVES 16"|Industrial|12|1170|Industrial|600|900|Market|E|
106|C-CLAMP 6"|Licota|6|3640|Yato|2000|2800|Market|E|
107|C-CLAMP 12"|Licota|6|6760|Yato|4500|6000|Market|E|
108|SPIRIT LEVEL 1 METER|Licota|3|4550|Yato|3500|5000|Market|E|
109|MAGNET SPIRIT LEVEL 12"|Licota|6|2340|Yato|1800|2500|Market|E|
110|CARBON STEEL RIGHT ANGLE 150MM|Licota|3|1820|Insize|2000|2800|Market|E|
111|CARBON STEEL RIGHT ANGLE 300MM|Licota|3|2860|Insize|4000|5500|Market|E|
112|GAS CUTTING TORCH MEDIUM 6-50MM|Licota|2|12350|Harris type / Industrial|8000|12000|Market|E|Licota gas equipment nahi banata
113|CUTTING TIPS/NOZZLES NO. 02 (6MM-12MM)|Licota|3|1560|Industrial|800|1200|Market|E|
114|CUTTING TIPS/NOZZLES NO. 03 (12MM-25)|Licota|3|1950|Industrial|900|1400|Market|E|
115|OXYGEN REGULATOR 0-10 BAR|Industrial|2|11050|Industrial|6500|9000|Market|E|
116|FUEL GAS REGULATOR 0-2.5 BAR|Licota|2|11050|Industrial|6500|9000|Market|E|
117|OXYGEN HOSE 08MM ID|Industrial|15|585|Industrial|300|450|Market (per metre)|E|
118|ACETYLENE GAS HOSE 08 ID|Industrial|15|585|Industrial|300|450|Market (per metre)|E|
119|CYLINDER KEY/SPANNER|Licota|2|910|Industrial|400|700|Market|E|
120|TIP CLEANER FOR GAS WELDING TORCH|Industrial|6|910|Industrial|400|650|Market|E|
121|WELDING/CUTTING GOGGLES|Industrial|6|637|Industrial|300|450|Market|E|
122|AC/DC SINGLE PHASE WELDING PLANT 300 AMP|Industrial|1|357500|Industrial (AC/DC TIG 300A)|200000|330000|houseoftools.com.pk AC/DC TIG WACTA20 126,000 (amp n/a); hyundaipower TIG-200 AC/DC 86,500 - 300A est|P|Model/brand confirm karo
123|TIG WELDING TORCH AIR-COOLED 5METER|Industrial|2|23400|Industrial|14000|20000|Market|E|
124|TORCH HEAD ARGON WELDING|Industrial|2|4550|Industrial|2500|3500|Market|E|
125|COLLECT OF ARGON 2.4MM|Industrial|12|585|Industrial|250|400|Market|E|
126|COLLECT BODY FOR ARGON 2.4MM|Industrial|12|780|Industrial|300|500|Market|E|
127|CERAMIC CUP NO.5|Industrial|6|455|Industrial|200|350|Market|E|
128|CERAMIC CUP NO.6|Industrial|6|455|Industrial|200|350|Market|E|
129|CERAMIC CUP NO.7|Industrial|6|455|Industrial|200|350|Market|E|
130|TUNGSTEN ELECTRODE 2.4MM|Industrial|6|2340|Industrial|1500|2200|Market (per pack of 10)|E|
131|ARGON REGULATOR FLOW METER|Industrial|2|7800|Industrial|5000|6000|aliweldinghouse.pk WM argon regulator 5,000-6,000|V|
132|ARGON GAS HOSE 06MM|Industrial|10|455|Industrial|250|400|Market (per metre)|E|
133|GAS HOSE CONNECTOR|Licota|6|650|Industrial|300|500|Market|E|
134|SHORT SLEEVE TIG WELDING GLOVES 10-INCH|Industrial|6|1040|Industrial|600|900|Market|E|
135|CUTTING DISC 355MM (14")|Industrial|6|2860|Industrial|1800|2500|Market|E|
136|CUTTING DISC 125MM X 01MM|Industrial|500|130|Industrial|150|270|powerhouseexpress Total 5in metal cutting 270; ktools/toolshub 4in 75-120|P|Aapka 130 kam hai - 125mm thin disc 150-270
138|CUTTING DISC 230MM X 03MM|Industrial|24|1170|Industrial|600|900|Market|E|
139|BUFFING DISC 125MM|Licota|24|715|Industrial|350|600|Market|E|
140|BRASS PLATED CUP WIRE BRUSH 125MM|Industrial|24|1560|Industrial|900|1300|Market|E|
142|GRINDER WHEEL ALUMINIUM OXIDE GRIT 24|Industrial|3|7150|Norton / Industrial|5000|7000|Market|E|
143|GRINDER WHEEL ALUMINIUM OXIDE GRIT 60|Industrial|3|7150|Norton / Industrial|5000|7000|Market|E|
144|GRINDER WHEEL SILICON CARBIDE|Industrial|3|8450|Norton / Industrial|6000|8000|Market|E|
145|COTTON ROPE 2MM|Licota|500|104|Local / Generic|50|80|Market (per metre)|E|Licota rope nahi banata
146|HYDRAULIC HAND TROLLY 3T|Industrial|1|105788|Industrial (VMAX/BAOLI)|80000|85000|eqmachines 82,000; rafiqbrothers 80,000; OLX 85,000|V|
147|HYDRAULIC HAND TROLLY 5T|Industrial|1|245700|Industrial (VMAX)|200000|225000|rafiqbrothers 200,000-225,000|V|
148|FLATE METAL SCRAPPER 50MM|Licota|12|650|Generic|300|500|Market|E|
149|WD 40 330ML (MULTI PURPOSE)|Industrial|100|1754|WD-40|1299|1380|naheed.pk 1,380; autohub.pk 1,299; toolsmart (oos)|V|
150|PU COATED SAFETY GLOVES LEVEL 5 CUT RESISTA|Industrial|100|1235|Industrial|600|1000|mjstraders Safeyear 600; ktools Total HPPE 800-900; hacsons 1,000|V|
151|NITRILE SAFETY GLOOVES OIL RESISTANT|Industrial|100|650|Industrial|350|500|Market|E|
152|PVC SAFETY GLOVES LARGE CHEMICAL RESISTANT|Industrial|24|546|Industrial|300|450|Market|E|
153|SAFETY HELMET YELLOW|Industrial|24|1105|Industrial|730|1000|powerhouseexpress Total 730; toolsmart Ingco 1,440; local 500-750|V|
154|RED OXIDE POWDER|Industrial|12|1560|Industrial|900|1300|Market|E|
155|SPRAY WHITE|Industrial|50|748|Industrial|400|600|Market|E|
156|SPRAY BLUE|Industrial|30|748|Industrial|400|600|Market|E|
157|SPRAY GREEN|Industrial|30|748|Industrial|400|600|Market|E|
158|TOILET CLEANING BRUSH|Licota|12|311|Local / Generic|150|250|Market|E|Licota brush nahi banata
159|CUT PIECES OF CLOTHS FOR CLEANING|Licota|100|325|Local / Generic|180|280|Market (per kg)|E|
160|ANCHOR BOLT 10X110|Licota|150|117|Local / Fischer|60|100|Market|E|
161|ANCHOR BOLT 12X120|Licota|150|169|Local / Fischer|90|140|Market|E|
162|ANCHOR BOLT 12X160|Licota|150|234|Local / Fischer|120|190|Market|E|
164|WELDING RODS 2.5MM E6013, NO 10 Zodian|Industrial|40|1209|Industrial|800|1100|Market (pack)|E|Pack size confirm
165|WELDING RODS 3.25MM E6013 NO 12|Industrial|40|1209|Industrial|800|1100|Market (pack)|E|
166|WELDING RODS 2.5MM E7018 NO-10|Industrial|20|3022|Industrial|2200|2900|Market (pack)|E|
167|SS WELDING RODS 309L-16 2.6MM NO.12|Industrial|40|6240|Industrial|4500|6000|Market (pack)|E|
168|SS WELDING RODS 316L-16 2.6MM NO.12|Industrial|20|7150|Industrial|5200|6800|Market (pack)|E|
177|BLIND RIVETS 04MMX25MM (1000PCS)|Licota|3|5850|Generic|3500|5000|Market|E|
179|TAP SET 1" BSPF LEFT HAND|Licota|1|23400|Dormer / Totem|20000|26000|Market|E|
180|TAP SET 1" BSPF RIGHT HAND|Licota|1|15600|Dormer / Totem|14000|18000|Market|E|
181|TAP SET 1-1/4" BSPF LEFT HAND|Licota|1|33800|Dormer / Totem|28000|36000|Market|E|
182|TAP SET 1-1/4" BSPF RIGHT HAND|Licota|1|23400|Dormer / Totem|20000|26000|Market|E|
183|TAP SET M6|Licota|3|2860|Yato|1800|2500|Market|E|
184|TAP SET M8|Licota|3|3250|Yato|2100|2900|Market|E|
185|TAP SET M10|Licota|3|3900|Yato|2600|3500|Market|E|
186|TAP SET M12|Licota|3|4550|Yato|3300|4300|Market|E|
187|TAP SET M16|Licota|2|7150|Yato|5500|7000|Market|E|
188|TAP SET M18|Licota|1|8450|Yato|7000|8800|Market|E|
189|TAP SET M20|Licota|1|9750|Yato|8500|10500|Market|E|
190|TAP HANDLE|Licota|2|2340|Yato|1500|2200|Market|E|
191|TAP HANDLE|Licota|2|3640|Yato|2300|3200|Market|E|
192|INSIDE CALIPER 06"|Licota|3|1950|Generic (Taiwan)|1200|1800|Market|E|
193|INSIDE CALIPER 20"|Licota|2|5850|Generic (Taiwan)|4000|5500|Market|E|
194|OUTSIDE CALIPER 06"|Licota|3|1950|Generic (Taiwan)|1200|1800|Market|E|
195|OUTSIDE CALIPER 20"|Licota|2|5850|Generic (Taiwan)|4000|5500|Market|E|
196|RACHET TAP HANDLE|Licota|2|4550|Yato|3500|4800|Market|E|
197|MICROMETER 0 TO 25MM|Licota|1|17940|Insize 3203-25A|4815|5500|imsons Insize 3203-25A 4,815; kamadi 5,500|V|Analog Insize; digital chahiye to ~15k+
198|MICROMETER 25 TO 50MM|Licota|1|18850|Insize 3203-50A|5300|6500|imsons Insize 3203 series (4,815-9,625)|P|Analog Insize; digital chahiye to ~15k+
199|MICROMETER 50 TO 75MM|Licota|1|19500|Insize 3203-75A|6000|7200|imsons Insize 3203 series (4,815-9,625)|P|Analog Insize; digital chahiye to ~15k+
200|MICROMETER 75 TO 100MM|Licota|1|20800|Insize 3203-100A|6875|7800|imsons Insize 3203-100A 6,875|V|Analog Insize; digital chahiye to ~15k+
201|MICROMETER 100 TO 125MM|Licota|1|22750|Insize 3203-125A|8750|9800|imsons Insize 3203-125A 8,750|V|Analog Insize; digital chahiye to ~15k+
202|NEEDLE FILE (5PCS SET)|Licota|2|2340|Yato|1500|2000|Market|E|
204|END MILL CUTTER SIZE 5MM|Licota|6|845|YG-1 / Taiwan HSS-Co|800|1200|Market|E|Licota end mill nahi banata
205|END MILL CUTTER SIZE 6MM|Licota|6|910|YG-1 / Taiwan HSS-Co|900|1300|Market|E|
206|END MILL CUTTER SIZE 8MM|Licota|6|1170|YG-1 / Taiwan HSS-Co|1200|1700|Market|E|
207|END MILL CUTTER SIZE 10MM|Licota|4|1430|YG-1 / Taiwan HSS-Co|1600|2200|Market|E|
208|END MILL CUTTER SIZE 12MM|Licota|3|1690|YG-1 / Taiwan HSS-Co|2000|2800|Market|E|
209|END MILL CUTTER SIZE 16MM|Licota|3|2340|YG-1 / Taiwan HSS-Co|3000|4000|Market|E|
210|END MILL CUTTER SIZE 18MM|Licota|2|2860|YG-1 / Taiwan HSS-Co|3700|4800|Market|E|
211|END MILL CUTTER SIZE 22MM|Licota|1|4160|YG-1 / Taiwan HSS-Co|5200|7000|Market|E|
212|END MILL CUTTER SIZE 25MM|Licota|1|5460|YG-1 / Taiwan HSS-Co|6500|8500|Market|E|
213|DIE NUT SIZE 5MM|Licota|2|455|Yato|500|700|Market|E|
214|DIE NUT SIZE 6MM|Licota|2|494|Yato|550|750|Market|E|
215|DIE NUT SIZE 8MM|Licota|2|585|Yato|650|850|Market|E|
216|DIE NUT SIZE 10MM|Licota|2|715|Yato|800|1050|Market|E|
217|DIE NUT SIZE 12MM|Licota|2|910|Yato|1000|1300|Market|E|
218|DIE NUT SIZE 16MM|Licota|2|1170|Yato|1400|1800|Market|E|
219|DIE NUT HANDLE SMALL|Licota|1|1040|Yato|1100|1500|Market|E|
220|DIE NUT HANDLE MEDIUM|Licota|1|1430|Yato|1400|1900|Market|E|
221|DIE NUT HANDLE LARGE|Licota|1|1950|Yato|2000|2600|Market|E|
222|3 JAW CHUCK 4"|Licota|1|15600|Vertex (Taiwan) / Bison|18000|32000|Market|E|Licota chuck nahi banata
223|BENCH VISE 08"|Licota|2|30940|Yato YT-65049|45000|60000|Yato UK GBP250; Total 8" PK 17,999|P|Sasta option: Total 8" ~18k
224|BENCH VISE 12"|Licota|2|54600|Yato (heavy)|85000|110000|Yato range est|E|Sasta option: local heavy vise
225|HSS TOOL 08X08X200MM|Licota|24|1170|Taiwan HSS / Dormer|1000|1400|Market|E|
226|HSS TOOL 10MMX10MMX200MM|Licota|24|1430|Taiwan HSS / Dormer|1400|1900|Market|E|
227|HSS TOOL 12MMX12MMX200MM|Licota|24|1820|Taiwan HSS / Dormer|1900|2600|Market|E|
228|HSS TOOL 16MMX16MMX200MM|Licota|24|2860|Taiwan HSS / Dormer|3200|4200|Market|E|
229|HSS PARTING OFF TOOL 1/8" X 3/4" X 8"|Licota|24|2340|Taiwan HSS / Dormer|1800|2600|Market|E|
230|HYDRAULIC JACK 3 TON|Licota|1|9750|Yato YT-17001|6000|8500|pakwheels 5T bottle jack 4,000-5,999; purchaser 8,390|P|
231|HYDRAULIC JACK 5 TON|Licota|1|12350|Yato YT-17002|8000|11000|pakwheels 5,499-5,999 (generic); Yato premium|P|
233|CORDLESS SMALL ANGLE GRINDER 125MM EQUIVAL|Bosch Professional|2|52000|Bosch Professional GWS 180-LI / GWS 18V-10|38340|85000|powerhouseexpress 38,340 solo; ktools 40,000 solo|V|Kit diya to loss
234|WELDING ELCTRODE HOLDER 1000 AMP|Industrial|3|3094|Industrial|1800|2600|Market|E|
235|EARTH CLAMP 1000 AMP|Licota|3|2860|Industrial|1500|2300|Market|E|
236|WELDING CABLE 1000 AMPERE|Industrial|200|2860|Industrial (copper)|2400|3200|enontraders 95mm copper flexible ~3,600/m; thetoolsstore welding cable 580/m (size n/a)|P|Copper rate pe depend
237|CABLE LUGS 1000 AMPERE|Licota|24|845|Industrial|450|700|Market|E|
238|FULL BODY HARNESS BELT|Licota|6|8450|Toho (Taiwan)|6500|7800|mjstraders Toho MH106 3D 7,800; imsons Yamada 6,500; citex 5,800|V|Karam PK mein nahi; Toho Taiwan brand
239|ANGLE GRINDER 9" BOSCH PRO STONE BONDED CU|Bosch Professional|50|65000|Bosch Professional GWS 2200-230 H|36570|44000|imartpk 36,570; kamadi 43,200; ktools 44,000|V|PR check karo: grinder hai ya 9" cutting disc?
240|DRILL BIT 4MM|Licota|50|325|Yato|150|250|Market|E|
"""
ITEMS = []
for line in ROWS.strip().splitlines():
    p = line.split("|")
    ITEMS.append(dict(sr=int(p[0]), desc=p[1], qbrand=p[2], qty=int(p[3]), rate=float(p[4]),
                      brand=p[5], low=float(p[6]), high=float(p[7]), src=p[8], conf=p[9], note=p[10]))
