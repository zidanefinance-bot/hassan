// A verse of the Qur'an on rizq and honest trade on the home screen: a different one each day (tap › for the next).
import React, { useState } from "react";

export const AYAT = [
  { ref: "Surah At-Talaq 65:2–3", ar: "وَمَن يَتَّقِ ٱللَّهَ يَجْعَل لَّهُۥ مَخْرَجًا ۝ وَيَرْزُقْهُ مِنْ حَيْثُ لَا يَحْتَسِبُ ۚ وَمَن يَتَوَكَّلْ عَلَى ٱللَّهِ فَهُوَ حَسْبُهُۥٓ",
    roman: "Wa man yattaqil-laaha yaj'al lahu makhrajaa. Wa yarzuqhu min haysu laa yahtasib. Wa man yatawakkal 'alal-laahi fahuwa hasbuh.",
    ur: "Jo Allah se darta hai, Allah us ke liye (har mushkil se) nikalne ka raasta bana deta hai, aur use wahan se rizq deta hai jahan se use gumaan bhi nahi hota. Aur jo Allah par bharosa kare, Allah us ke liye kaafi hai." },
  { ref: "Surah Ibrahim 14:7", ar: "لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ",
    roman: "La'in shakartum la-azeedannakum.",
    ur: "Agar tum shukr karoge to Main tumhein aur zyada dunga." },
  { ref: "Surah Adh-Dhariyat 51:58", ar: "إِنَّ ٱللَّهَ هُوَ ٱلرَّزَّاقُ ذُو ٱلْقُوَّةِ ٱلْمَتِينُ",
    roman: "Innal-laaha huwar-Razzaaqu zul-quwwatil-mateen.",
    ur: "Beshak Allah hi sab ko rizq dene wala hai, zabardast quwwat wala, mazboot." },
  { ref: "Surah Hud 11:6", ar: "وَمَا مِن دَآبَّةٍ فِى ٱلْأَرْضِ إِلَّا عَلَى ٱللَّهِ رِزْقُهَا",
    roman: "Wa maa min daabbatin fil-ardi illaa 'alal-laahi rizquhaa.",
    ur: "Zameen par chalne wala koi jaandaar aisa nahi jis ka rizq Allah ke zimme na ho." },
  { ref: "Surah Al-Jumu'ah 62:10", ar: "فَإِذَا قُضِيَتِ ٱلصَّلَوٰةُ فَٱنتَشِرُوا۟ فِى ٱلْأَرْضِ وَٱبْتَغُوا۟ مِن فَضْلِ ٱللَّهِ وَٱذْكُرُوا۟ ٱللَّهَ كَثِيرًا لَّعَلَّكُمْ تُفْلِحُونَ",
    roman: "Fa-izaa qudiyatis-salaatu fantashiroo fil-ardi wabtaghoo min fadlil-laahi wazkurul-laaha kaseeral-la'allakum tuflihoon.",
    ur: "Phir jab namaz ho chuke to zameen mein phail jao aur Allah ka fazl (rozi) talaash karo, aur Allah ko kasrat se yaad karo taake tum kaamyab ho." },
  { ref: "Surah Nuh 71:10–12", ar: "فَقُلْتُ ٱسْتَغْفِرُوا۟ رَبَّكُمْ إِنَّهُۥ كَانَ غَفَّارًا ۝ يُرْسِلِ ٱلسَّمَآءَ عَلَيْكُم مِّدْرَارًا ۝ وَيُمْدِدْكُم بِأَمْوَٰلٍ وَبَنِينَ",
    roman: "Faqultus-taghfiroo Rabbakum innahoo kaana Ghaffaaraa. Yursilis-samaa'a 'alaikum midraaraa. Wa yumdidkum bi-amwaalin wa baneen.",
    ur: "Apne Rab se maafi maango, beshak woh bahut maaf karne wala hai. Woh tum par khoob barish barsayega, aur maal aur aulaad se tumhari madad karega." },
  { ref: "Surah Al-Qasas 28:24 (dua)", ar: "رَبِّ إِنِّى لِمَآ أَنزَلْتَ إِلَىَّ مِنْ خَيْرٍ فَقِيرٌ",
    roman: "Rabbi innee limaa anzalta ilayya min khairin faqeer.",
    ur: "Aye mere Rab! Jo bhi bhalai Tu meri taraf utaare, main us ka mohtaaj hun." },
  { ref: "Surah At-Talaq 65:3", ar: "إِنَّ ٱللَّهَ بَٰلِغُ أَمْرِهِۦ ۚ قَدْ جَعَلَ ٱللَّهُ لِكُلِّ شَىْءٍ قَدْرًا",
    roman: "Innal-laaha baalighu amrih. Qad ja'alal-laahu likulli shai'in qadraa.",
    ur: "Beshak Allah apna kaam poora kar ke rehta hai. Allah ne har cheez ka ek andaaza (waqt) muqarrar kar rakha hai." },
  { ref: "Surah Al-Mutaffifin 83:1–3", ar: "وَيْلٌ لِّلْمُطَفِّفِينَ ۝ ٱلَّذِينَ إِذَا ٱكْتَالُوا۟ عَلَى ٱلنَّاسِ يَسْتَوْفُونَ ۝ وَإِذَا كَالُوهُمْ أَو وَّزَنُوهُمْ يُخْسِرُونَ",
    roman: "Wailul-lil-mutaffifeen. Allazeena izak-taaloo 'alan-naasi yastawfoon. Wa izaa kaaloohum aw wazanoohum yukhsiroon.",
    ur: "Tabahi hai naap tol mein kami karne walon ke liye: jo logon se lete waqt poora lete hain, aur jab unhein naap ya tol kar dete hain to kam dete hain. (Imaandari se karobar hi barkat hai.)" },
];

const dayIndex = () => Math.floor((Date.now() + 5 * 3600e3) / 864e5); // changes at midnight Karachi time

export default function Ayah() {
  const [n, setN] = useState(() => dayIndex() % AYAT.length);
  const a = AYAT[n];
  return (
    <section className="card ayah">
      <div className="ayah-ar" dir="rtl" lang="ar">{a.ar}</div>
      <div className="ayah-roman">{a.roman}</div>
      <div className="ayah-ur">“{a.ur}”</div>
      <div className="ayah-foot"><span>{a.ref}</span><button type="button" className="link-btn" onClick={() => setN((n + 1) % AYAT.length)} title="Next verse">Next ›</button></div>
    </section>
  );
}
