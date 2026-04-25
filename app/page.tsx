"use client";
import { useState, useEffect } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [malzemeler, setMalzemeler] = useState("");
  const [tarif, setTarif] = useState<any>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [kayitYukleniyor, setKayitYukleniyor] = useState(false);
  const [kayitliTarifler, setKayitliTarifler] = useState<any[]>([]);
  const [kullanici, setKullanici] = useState<any>(null);
  const [kalanHak, setKalanHak] = useState(3);
  const [yuklemeMesaji, setYuklemeMesaji] = useState("Şef hazırlanıyor...");

  // --- 1. OTURUM VE VERİ YÖNETİMİ ---
  useEffect(() => {
    // Kullanıcı oturumunu kontrol et
    supabase.auth.getSession().then(({ data: { session } }) => {
      setKullanici(session?.user ?? null);
      if (session?.user) verileriCek(session.user.id);
    });

    // Oturum değişikliklerini dinle
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setKullanici(session?.user ?? null);
      if (session?.user) verileriCek(session.user.id);
      else setKayitliTarifler([]);
    });

    // Günlük hak kontrolü (LocalStorage)
    const bugun = new Date().toLocaleDateString();
    if (localStorage.getItem("chef_tarih") !== bugun) {
      localStorage.setItem("chef_tarih", bugun);
      localStorage.setItem("chef_sayac", "0");
      setKalanHak(3);
    } else {
      setKalanHak(3 - parseInt(localStorage.getItem("chef_sayac") || "0"));
    }

    return () => subscription.unsubscribe();
  }, []);

  const verileriCek = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('tarifler')
        .select('*')
        .eq('user_id', userId) // SADECE BU KULLANICININ TARİFLERİ
        .order('id', { ascending: false });
      
      if (data) setKayitliTarifler(data.map((item: any) => ({ ...item.tarif_data, db_id: item.id })));
    } catch (e) { console.log("Veri çekme hatası."); }
  };

  useEffect(() => {
    if (yukleniyor) {
      const mesajlar = ["Bıçaklar bileniyor...", "Fırın ısıtılıyor...", "Lezzet dengeleniyor...", "Sunum hazırlanıyor..."];
      let i = 0;
      const interval = setInterval(() => { setYuklemeMesaji(mesajlar[i % mesajlar.length]); i++; }, 3000);
      return () => clearInterval(interval);
    }
  }, [yukleniyor]);

  // --- 2. TARİF ÜRETME ---
  const tarifOlustur = async () => {
    if (!kullanici) return alert("Tarif üretmek için önce giriş yapmalısın şefim! 😊");
    if (kalanHak <= 0) return alert("Günlük limitin doldu! 🚀");
    if (!malzemeler.trim()) return alert("Malzemeleri yazmalısın!");

    setYukleniyor(true);
    setTarif(null);

    try {
      const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);
      const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
      
      const prompt = `Sen 'Şefin Tarif Mutfağı'nın baş şefisin. Malzemeler: ${malzemeler}. Bana SADECE JSON ver: 
      { 
        "isim": "Yemek Adı", 
        "sure": "30 dk", 
        "kalori": "400", 
        "protein": "15g", 
        "karbonhidrat": "45g", 
        "malzemeler": ["madde 1", "madde 2"], 
        "hazirlanis": ["adım 1", "adım 2"], 
        "ipucu": "Şefin özel notu" 
      }`;

      const sonuc = await model.generateContent(prompt);
      const text = await sonuc.response.text();
      const veri = JSON.parse(text.replace(/```json|```/g, "").trim());
      
      const seed = Math.floor(Math.random() * 10000);
      veri.foto = `https://image.pollinations.ai/prompt/${encodeURIComponent(veri.isim)}?width=1024&height=768&seed=${seed}&nologo=true`;
      
      setTarif(veri);
      const yeniSayac = (3 - kalanHak) + 1;
      localStorage.setItem("chef_sayac", yeniSayac.toString());
      setKalanHak(3 - yeniSayac);
    } catch (e: any) { 
      alert(e.message.includes("429") ? "Şef meşgul, 1 dk bekle!" : "Teknik bir hata oldu.");
    } finally { setYukleniyor(false); }
  };

  // --- 3. KAYDETME VE SİLME ---
  const tarifiBulutaKaydet = async () => {
    if (!tarif || kayitYukleniyor || !kullanici) return;
    setKayitYukleniyor(true);
    try {
      const { error } = await supabase.from('tarifler').insert([{ 
        tarif_data: tarif, 
        user_id: kullanici.id // ARTIK GERÇEK KULLANICI ID'Sİ
      }]);
      if (error) throw error;
      alert("Mutfağına kaydedildi! ☁️");
      verileriCek(kullanici.id);
    } catch (e: any) { alert("Hata: " + e.message); }
    finally { setKayitYukleniyor(false); }
  };

  const tarifiSil = async (id: number, e: any) => {
    e.stopPropagation();
    if (confirm("Silinsin mi?")) {
      await supabase.from('tarifler').delete().eq('id', id);
      verileriCek(kullanici.id);
    }
  };

  return (
    <main className="min-h-screen bg-[#EFE9E2] p-4 md:p-12 font-sans text-gray-800 selection:bg-orange-200">
      
      {/* ÜST MENÜ */}
      <nav className="max-w-6xl mx-auto flex justify-between items-center mb-16 bg-white/50 backdrop-blur-md p-4 rounded-full border border-white/50 shadow-sm">
        <div className="text-xl font-black text-orange-600 tracking-tighter ml-4">ŞTM <span className="text-lg">👨‍🍳</span></div>
        
        {kullanici ? (
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <p className="text-[10px] font-black text-gray-400 uppercase leading-none">Hoş Geldin</p>
              <p className="font-bold text-sm">{kullanici.user_metadata.full_name}</p>
            </div>
            <img src={kullanici.user_metadata.avatar_url} className="w-10 h-10 rounded-full border-2 border-orange-500 shadow-sm" alt="profil" />
            <button onClick={() => supabase.auth.signOut()} className="bg-gray-800 text-white px-5 py-2 rounded-full font-bold text-xs hover:bg-red-600 transition-all uppercase">Çıkış</button>
          </div>
        ) : (
          <button onClick={() => supabase.auth.signInWithOAuth({provider:'google'})} className="bg-orange-500 text-white font-black py-2 px-6 rounded-full text-xs uppercase tracking-widest">Giriş Yap</button>
        )}
      </nav>

      {/* BAŞLIK VE GİRİŞ */}
      <div className="max-w-4xl mx-auto text-center mb-12">
        <h1 className="text-6xl md:text-8xl font-black text-orange-600 mb-4 italic tracking-tighter uppercase drop-shadow-sm leading-none">
          Şefin Tarif Mutfağı
        </h1>
        
        <div className="inline-flex items-center gap-2 bg-orange-200/50 text-orange-800 px-5 py-2 rounded-full text-[11px] font-black tracking-widest uppercase mb-12 border border-orange-200 shadow-sm">
          GÜNLÜK KALAN HAKKIN: {kalanHak} / 3
        </div>

        <div className="bg-white p-3 rounded-[3.5rem] shadow-2xl border-4 border-orange-100 flex flex-col md:flex-row items-center gap-2 max-w-2xl mx-auto transition-all focus-within:scale-[1.02]">
          <input className="flex-1 px-8 py-4 outline-none text-xl bg-transparent w-full text-black placeholder-gray-300" placeholder="Elinizde ne var? (Örn: yumurta, süt...)" value={malzemeler} onChange={(e) => setMalzemeler(e.target.value)} />
          <button onClick={tarifOlustur} disabled={yukleniyor} className="bg-orange-500 text-white px-12 py-5 rounded-[2.8rem] font-black text-lg hover:bg-orange-600 shadow-xl uppercase">
            {yukleniyor ? "..." : "TARİF ÜRET"}
          </button>
        </div>
        {yukleniyor && <p className="mt-8 text-orange-800 font-bold animate-pulse text-xs tracking-widest uppercase italic">{yuklemeMesaji}</p>}
      </div>

      {/* TARİF DETAYI */}
      {tarif && (
        <div className="max-w-4xl mx-auto bg-white rounded-[4.5rem] shadow-2xl overflow-hidden border-8 border-white mb-24 animate-in fade-in zoom-in duration-700">
          <div className="h-[450px] w-full relative bg-gray-100">
            <img src={tarif.foto} className="w-full h-full object-cover" alt="yemek" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent flex items-end p-12 text-left">
               <h2 className="text-4xl md:text-7xl font-black text-white uppercase tracking-tighter leading-none">{tarif.isim}</h2>
            </div>
          </div>

          <div className="p-10 md:p-16">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16 text-center text-black font-bold">
              <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-[2.5rem]"> <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1 italic">🔥 Kalori</p> <p className="text-2xl font-black">{tarif.kalori}</p> </div>
              <div className="bg-red-50/50 border border-red-100 p-6 rounded-[2.5rem]"> <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1 italic">🥩 Protein</p> <p className="text-2xl font-black">{tarif.protein}</p> </div>
              <div className="bg-green-50/50 border border-green-100 p-6 rounded-[2.5rem]"> <p className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-1 italic">⏱ Süre</p> <p className="text-2xl font-black">{tarif.sure}</p> </div>
              <div className="bg-amber-50/50 border border-amber-100 p-6 rounded-[2.5rem]"> <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1 italic">🌾 Karb.</p> <p className="text-2xl font-black">{tarif.karbonhidrat}</p> </div>
            </div>

            <div className="grid md:grid-cols-2 gap-20 mb-16 text-left">
              <div>
                <h3 className="text-3xl font-black mb-8 text-black tracking-tighter uppercase">🛒 Malzemeler</h3>
                <ul className="space-y-4">
                  {tarif.malzemeler.map((m: any, i: number) => (
                    <li key={i} className="flex items-center gap-4 text-xl font-medium text-gray-700 border-b border-gray-100 pb-2">
                      <input type="checkbox" className="w-6 h-6 accent-orange-500 rounded-lg cursor-pointer" /> {m}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-3xl font-black mb-8 text-black tracking-tighter uppercase">👨‍🍳 Hazırlanışı</h3>
                <div className="space-y-8">
                  {tarif.hazirlanis.map((h: any, i: number) => (
                    <div key={i} className="flex gap-6 text-left">
                      <span className="font-black text-orange-200 text-5xl leading-none">{i + 1}</span>
                      <p className="text-gray-700 text-lg leading-relaxed font-medium pt-2">{h}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={tarifiBulutaKaydet} disabled={kayitYukleniyor} className="w-full bg-orange-500 text-white font-black py-7 rounded-[2.5rem] hover:bg-orange-600 transition-all shadow-2xl text-xl uppercase tracking-widest">
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
              <div key={i} onClick={() => {setTarif(t); window.scrollTo({top: 0, behavior: 'smooth'});}} className="bg-white rounded-[3.5rem] overflow-hidden shadow-xl border border-white hover:border-orange-300 hover:scale-[1.03] transition-all cursor-pointer group relative">
                <button onClick={(e) => tarifiSil(t.db_id, e)} className="absolute top-6 right-6 z-20 bg-red-500 text-white w-10 h-10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center font-bold shadow-lg text-xs">✕</button>
                <div className="h-56 w-full overflow-hidden bg-gray-100">
                  <img src={t.foto} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={t.isim} />
                </div>
                <div className="p-8 text-center bg-white font-black">
                  <h4 className="text-xl text-gray-800 uppercase leading-tight group-hover:text-orange-600 transition-colors mb-2 truncate">{t.isim}</h4>
                  <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">{t.sure} • {t.kalori} KCAL</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <footer className="mt-40 text-center text-gray-400 font-bold text-[10px] uppercase tracking-[0.4em] pb-12 italic">
        Şefin Tarif Mutfağı © 2026 • Lezzet ve Teknoloji Buluşması
      </footer>
    </main>
  );
}