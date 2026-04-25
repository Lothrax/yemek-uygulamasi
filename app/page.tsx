"use client";
import { useState, useEffect } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "../lib/supabase";

// --- AYAR: BURAYA KENDİ GOOGLE E-POSTANI YAZ ---
const GELISTIRICI_EMAIL = "civeleksirac@gmail.com"; 

export default function Home() {
  const [malzemeler, setMalzemeler] = useState("");
  const [tarifSecenekleri, setTarifSecenekleri] = useState<any[]>([]);
  const [secilenTarif, setSecilenTarif] = useState<any>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [kayitYukleniyor, setKayitYukleniyor] = useState(false);
  const [kayitliTarifler, setKayitliTarifler] = useState<any[]>([]);
  const [kullanici, setKullanici] = useState<any>(null);
  const [kalanHak, setKalanHak] = useState(3);
  const [yuklemeMesaji, setYuklemeMesaji] = useState("Şef hazırlanıyor...");

  // --- 1. VERİLERİ ÇEKME ---
  const verileriCek = async (userId: string) => {
    try {
      const { data } = await supabase.from('tarifler').select('*').eq('user_id', userId).order('id', { ascending: false });
      if (data) setKayitliTarifler(data.map((item: any) => ({ ...item.tarif_data, db_id: item.id })));

      // Kota kontrolü
      const bugun = new Date().toLocaleDateString('tr-TR');
      const { data: haklar } = await supabase.from('kullanim_haklari').select('*').eq('user_id', userId).eq('gun', bugun).single();
      
      if (kullanici?.email === GELISTIRICI_EMAIL) setKalanHak(999);
      else if (haklar) setKalanHak(3 - haklar.sayac);
      else setKalanHak(3);
    } catch (e) { console.log("Veri hatası."); }
  };

  // --- 2. OTURUM YÖNETİMİ ---
  useEffect(() => {
    // Sayfa açıldığında
    supabase.auth.getSession().then(({ data: { session } }) => {
      setKullanici(session?.user ?? null);
      if (session?.user) verileriCek(session.user.id);
    });

    // Oturum değiştiğinde (Giriş/Çıkış)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setKullanici(session?.user ?? null);
      if (session?.user) {
        verileriCek(session.user.id);
      } else {
        setKayitliTarifler([]);
        setKalanHak(3);
        setSecilenTarif(null);
        setTarifSecenekleri([]);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const googleGiris = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
  };

  const cikisYap = async () => {
    await supabase.auth.signOut();
    setKullanici(null); // Çıkış anında state'i elle temizliyoruz (Butonun geri gelmesi için)
  };

  // --- 3. TARİF ÜRETME ---
  const tarifOlustur = async () => {
    if (!kullanici) return alert("Önce giriş yapmalısın şefim! 😊");
    if (kullanici.email !== GELISTIRICI_EMAIL && kalanHak <= 0) return alert("Hakkın bitti!");

    setYukleniyor(true);
    setTarifSecenekleri([]);
    setSecilenTarif(null);

    try {
      const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);
      const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
      const prompt = `Yemek tarifi JSON 3 adet öneri: ${malzemeler}. Format: {"oneriler":[{"isim":"","sure":"","kalori":"","protein":"","karbonhidrat":"","malzemeler":[],"hazirlanis":[],"ipucu":"","img_prompt":""}]}`;
      
      const sonuc = await model.generateContent(prompt);
      const text = (await sonuc.response.text()).replace(/```json|```/g, "").trim();
      const veri = JSON.parse(text);
      setTarifSecenekleri(veri.oneriler || []);

      if (kullanici.email !== GELISTIRICI_EMAIL) {
        const bugun = new Date().toLocaleDateString('tr-TR');
        const { data: mHak } = await supabase.from('kullanim_haklari').select('*').eq('user_id', kullanici.id).eq('gun', bugun).single();
        if (mHak) await supabase.from('kullanim_haklari').update({ sayac: mHak.sayac + 1 }).eq('id', mHak.id);
        else await supabase.from('kullanim_haklari').insert([{ user_id: kullanici.id, gun: bugun, sayac: 1 }]);
        verileriCek(kullanici.id);
      }
    } catch (e) { alert("Hata oluştu."); }
    finally { setYukleniyor(false); }
  };

  // --- 4. KAYDETME ---
  const tarifiKaydet = async () => {
    if (!secilenTarif || !kullanici || kayitYukleniyor) return;
    setKayitYukleniyor(true);
    try {
      const { error } = await supabase.from('tarifler').insert([{ 
        tarif_data: secilenTarif, 
        user_id: kullanici.id 
      }]);
      if (error) throw error;
      alert("Mutfağına kaydedildi! ❤️");
      verileriCek(kullanici.id);
    } catch (e: any) { alert("Hata: " + e.message); }
    finally { setKayitYukleniyor(false); }
  };

  return (
    <main className="min-h-screen bg-[#EFE9E2] p-4 md:p-12 font-sans text-gray-800">
      <meta name="referrer" content="no-referrer" />
      
      {/* NAVBAR */}
      <nav className="max-w-6xl mx-auto flex justify-between items-center mb-10 bg-white/70 backdrop-blur-md p-3 px-6 rounded-full border border-white shadow-lg">
        <div className="flex items-center gap-2">
          <img src="/logo.png" className="h-22 w-auto" alt="logo" />
          <span className="text-3xl font-black text-orange-600 tracking-tighter uppercase italic">Şefin Mutfağı</span>
        </div>
        {kullanici ? (
          <div className="flex items-center gap-4">
            <img src={kullanici.user_metadata.avatar_url} className="w-10 h-10 rounded-full border-2 border-orange-500" />
            <button onClick={cikisYap} className="bg-gray-800 text-white px-5 py-2 rounded-full font-bold text-xs uppercase">ÇIKIŞ</button>
          </div>
        ) : (
          <button onClick={googleGiris} className="bg-orange-500 text-white font-black py-3 px-8 rounded-full text-xs uppercase tracking-widest shadow-md">Giriş Yap</button>
        )}
      </nav>

      {/* HERO */}
      <div className="max-w-4xl mx-auto text-center mb-12 md:-mt-10">
       <img src="/logo.png" className="h-60 w-auto mb-2 drop-shadow-2xl ml-60 mr-auto" />
        <h1 className="text-6xl md:text-8xl font-black text-orange-600 mb-6 italic tracking-tighter uppercase leading-none">Şefin Tarif Mutfağı</h1>
        <div className="bg-orange-200/50 text-orange-800 px-6 py-2 rounded-full text-[11px] font-black tracking-widest uppercase mb-10 border border-orange-200 inline-block shadow-sm">
          {kullanici?.email === GELISTIRICI_EMAIL ? "👑 SINIRSIZ ERİŞİM" : `GÜNLÜK KALAN HAKKIN: ${kalanHak} / 3`}
        </div>

        <div className="bg-white p-3 rounded-[3.5rem] shadow-2xl border-4 border-orange-100 flex flex-col md:flex-row items-center gap-2 max-w-2xl mx-auto">
          <input className="flex-1 px-8 py-4 outline-none text-xl bg-transparent w-full text-black placeholder-gray-300" placeholder="Elinizde ne var?" value={malzemeler} onChange={(e) => setMalzemeler(e.target.value)} />
          <button onClick={tarifOlustur} disabled={yukleniyor} className="bg-orange-500 text-white px-12 py-5 rounded-[2.8rem] font-black text-lg hover:bg-orange-600 shadow-xl disabled:bg-gray-300 uppercase">{yukleniyor ? "..." : "TARİF ÜRET"}</button>
        </div>
      </div>

      {/* 3 SEÇENEK */}
      {!secilenTarif && tarifSecenekleri.length > 0 && (
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mb-20 animate-in slide-in-from-bottom-10 duration-500">
          {tarifSecenekleri.map((t, i) => (
            <div key={i} onClick={() => {
              const seed = Math.floor(Math.random() * 9999);
              t.foto = `https://image.pollinations.ai/prompt/${encodeURIComponent(t.img_prompt || t.isim)}?width=1024&height=768&seed=${seed}&nologo=true`;
              setSecilenTarif(t);
            }} className="bg-white p-10 rounded-[3.5rem] shadow-2xl border-4 border-white hover:border-orange-400 cursor-pointer transition-all text-center">
              <h3 className="text-3xl font-black text-orange-600 uppercase mb-4">{t.isim}</h3>
              <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest">{t.sure} • {t.kalori} KCAL</p>
              <div className="mt-8 bg-orange-100 text-orange-700 font-black py-4 px-8 rounded-2xl uppercase text-xs tracking-widest">Gör ✨</div>
            </div>
          ))}
        </div>
      )}

      {/* TARİF DETAYI */}
      {secilenTarif && (
        <div className="max-w-4xl mx-auto bg-white rounded-[4.5rem] shadow-2xl overflow-hidden border-8 border-white mb-24 animate-in zoom-in duration-700">
          <img src={secilenTarif.foto} className="h-[450px] w-full object-cover bg-gray-100" />
          <div className="p-10 md:p-16">
            <h2 className="text-4xl md:text-6xl font-black text-orange-600 uppercase tracking-tighter mb-10 text-center leading-none">{secilenTarif.isim}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16 text-center text-black font-bold">
              <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-[2.5rem]"> <p className="text-[10px] font-black text-blue-500 uppercase">🔥 Kalori</p> <p className="text-2xl font-black">{secilenTarif.kalori}</p> </div>
              <div className="bg-red-50/50 border border-red-100 p-6 rounded-[2.5rem]"> <p className="text-[10px] font-black text-red-500 uppercase">🥩 Protein</p> <p className="text-2xl font-black">{secilenTarif.protein}</p> </div>
              <div className="bg-green-50/50 border border-green-100 p-6 rounded-[2.5rem]"> <p className="text-[10px] font-black text-green-500 uppercase">⏱ Süre</p> <p className="text-2xl font-black">{secilenTarif.sure}</p> </div>
              <div className="bg-amber-50/50 border border-amber-100 p-6 rounded-[2.5rem]"> <p className="text-[10px] font-black text-amber-500 uppercase">🌾 Karb.</p> <p className="text-2xl font-black">{secilenTarif.karbonhidrat}</p> </div>
            </div>
            <div className="grid md:grid-cols-2 gap-10 text-left mb-12">
               <div><h3 className="text-2xl font-black mb-4 uppercase italic border-l-8 border-orange-500 pl-4">Malzemeler</h3>{secilenTarif.malzemeler?.map((m:any,i:number)=><p key={i} className="border-b py-2 text-lg">✓ {m}</p>)}</div>
               <div><h3 className="text-2xl font-black mb-4 uppercase italic border-l-8 border-orange-500 pl-4">Hazırlanış</h3>{secilenTarif.hazirlanis?.map((h:any,i:number)=><p key={i} className="mb-4 text-lg"><span className="text-orange-500 font-black">{i+1}.</span> {h}</p>)}</div>
            </div>
            <button onClick={tarifiKaydet} disabled={kayitYukleniyor} className={`w-full font-black py-8 rounded-[2.5rem] shadow-2xl text-2xl uppercase transition-all ${kayitYukleniyor ? 'bg-gray-400' : 'bg-orange-500 hover:bg-orange-600'}`}>
              {kayitYukleniyor ? "KAYDEDİLİYOR..." : "❤️ MUTFAĞIMA KAYDET"}
            </button>
          </div>
        </div>
      )}

      {/* DEFTERİM */}
      {kullanici && kayitliTarifler.length > 0 && (
        <div className="max-w-6xl mx-auto mt-20">
          <h3 className="text-4xl font-black mb-10 px-6 uppercase tracking-tighter text-gray-900 border-l-8 border-orange-500 pl-6 italic text-left">Mutfak Defterim</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
            {kayitliTarifler.map((t, i) => (
              <div key={i} onClick={() => {setSecilenTarif(t); window.scrollTo({top: 0, behavior: 'smooth'});}} className="bg-white rounded-[3.5rem] overflow-hidden shadow-xl border border-white hover:border-orange-300 transition-all cursor-pointer group relative">
                <button onClick={async (e) => { e.stopPropagation(); if(confirm("Silinsin mi?")) { await supabase.from('tarifler').delete().eq('id', t.db_id); verileriCek(kullanici.id); } }} className="absolute top-6 right-6 z-20 bg-red-500 text-white w-10 h-10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity font-bold">✕</button>
                <div className="h-64 w-full overflow-hidden bg-gray-100"><img src={t.foto} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="food" /></div>
                <div className="p-8 text-center bg-white font-black">
                  <h4 className="text-xl text-gray-800 uppercase group-hover:text-orange-600 transition-colors mb-2 truncate">{t.isim}</h4>
                  <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">{t.sure} • {t.kalori} KCAL</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}