"use client";
import { useState, useEffect } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default function Home() {
  const [malzemeler, setMalzemeler] = useState("");
  const [tarif, setTarif] = useState<any>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [fotoYukleniyor, setFotoYukleniyor] = useState(false);
  const [kayitliTarifler, setKayitliTarifler] = useState<any[]>([]);
  const [yuklemeMesaji, setYuklemeMesaji] = useState("Şef malzemeleri inceliyor...");
  const [kalanHak, setKalanHak] = useState(3);

  useEffect(() => {
    const data = localStorage.getItem("chefAI_vFinal_v3");
    if (data) setKayitliTarifler(JSON.parse(data));

    const bugun = new Date().toLocaleDateString();
    const sonKullanim = localStorage.getItem("chefAI_son_tarih");
    const kullanilan = localStorage.getItem("chefAI_gunluk_sayac") || "0";

    if (sonKullanim !== bugun) {
      localStorage.setItem("chefAI_son_tarih", bugun);
      localStorage.setItem("chefAI_gunluk_sayac", "0");
      setKalanHak(3);
    } else {
      setKalanHak(3 - parseInt(kullanilan));
    }
  }, []);

  useEffect(() => {
    if (yukleniyor) {
      const mesajlar = ["Bıçaklar bileniyor...", "Fırın ısıtılıyor...", "Baharatlar ayarlanıyor...", "Sunum hazırlanıyor..."];
      let i = 0;
      const interval = setInterval(() => { setYuklemeMesaji(mesajlar[i % mesajlar.length]); i++; }, 3000);
      return () => clearInterval(interval);
    }
  }, [yukleniyor]);

  const tarifOlustur = async () => {
    if (kalanHak <= 0) return alert("Günlük limitin doldu! 🚀");
    if (!malzemeler.trim()) return alert("Malzemeleri yaz şefim!");
    
    setYukleniyor(true);
    setFotoYukleniyor(true);
    setTarif(null);

    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY?.trim();
      const genAI = new GoogleGenerativeAI(apiKey!);
      const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

      const prompt = `Elimdeki malzemeler: ${malzemeler}. Bana SADECE şu JSON formatında cevap ver: 
      { 
        "isim": "Yemek Adı", 
        "sure": "30 dk", 
        "kalori": "400", 
        "protein": "15g", 
        "karbonhidrat": "45g", 
        "malzemeler": [], 
        "hazirlanis": [], 
        "ipucu": "", 
        "gorsel_kelimesi": "Sadece 2-3 kelimelik İngilizce yemek ismi, örneğin: chocolate sponge cake" 
      }`;

      const sonuc = await model.generateContent(prompt);
      const cevapMetni = await sonuc.response.text();
      const veri = JSON.parse(cevapMetni.replace(/```json|```/g, "").trim());
      
      // GÖRSEL ÇÖZÜMÜ: 
      // 1. Pollinations (Yapay Zeka Çizimi)
      const seed = Math.floor(Math.random() * 10000);
      veri.foto = `https://image.pollinations.ai/prompt/${encodeURIComponent(veri.gorsel_kelimesi)}?width=800&height=600&seed=${seed}&nologo=true`;
      
      // 2. Unsplash (Eğer çizim yüklenmezse diye yedek arama linki)
      veri.yedek_foto = `https://source.unsplash.com/800x600/?food,${encodeURIComponent(veri.gorsel_kelimesi)}`;
      
      setTarif(veri);

      const yeniSayac = (3 - kalanHak) + 1;
      localStorage.setItem("chefAI_gunluk_sayac", yeniSayac.toString());
      setKalanHak(3 - yeniSayac);

    } catch (hata) {
      console.error(hata);
      alert("Bir sorun oldu.");
    } finally {
      setYukleniyor(false);
    }
  };

  const tarifiSil = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Bu tarifi defterden silmek istediğine emin misin?")) {
      const yeniListe = kayitliTarifler.filter((_, i) => i !== index);
      setKayitliTarifler(yeniListe);
      localStorage.setItem("chefAI_vFinal_v3", JSON.stringify(yeniListe));
    }
  };

  return (
    <main className="min-h-screen bg-[#EFE9E2] p-4 md:p-12 font-sans text-gray-800">
      {/* GÖRSEL GÜVENLİK AYARI (Bunu ekledik) */}
      <meta name="referrer" content="no-referrer" />
      
      <div className="max-w-2xl mx-auto text-center mb-12">
        <h1 className="text-7xl font-black text-orange-600 mb-2 italic tracking-tighter uppercase">ChefAI</h1>
        <div className="inline-flex items-center gap-2 bg-orange-200/50 text-orange-800 px-5 py-2 rounded-full text-xs font-black tracking-widest uppercase mb-8 shadow-sm border border-orange-200">
          Kalan Hakkın: {kalanHak} / 3
        </div>

        <div className="bg-white p-3 rounded-[3rem] shadow-xl border-4 border-orange-100 flex flex-col md:flex-row items-center gap-2">
          <input className="flex-1 px-8 py-4 outline-none text-xl bg-transparent w-full text-black" placeholder="Yumurta, un, şeker..." value={malzemeler} onChange={(e) => setMalzemeler(e.target.value)} />
          <button onClick={tarifOlustur} disabled={yukleniyor || kalanHak <= 0} className="bg-orange-500 text-white px-10 py-5 rounded-[2.5rem] font-black text-lg hover:bg-orange-600 transition-all shadow-xl disabled:bg-gray-300 w-full md:w-auto">
            {yukleniyor ? "..." : "TARİF ÜRET"}
          </button>
        </div>
        
        {yukleniyor && (
          <div className="mt-6">
            <p className="text-orange-800 font-bold text-xs uppercase tracking-[0.2em] animate-pulse">👨‍🍳 {yuklemeMesaji}</p>
          </div>
        )}
      </div>

      {tarif && (
        <div className="max-w-4xl mx-auto bg-white rounded-[4rem] shadow-2xl overflow-hidden border border-white/50 mb-24 animate-in fade-in zoom-in duration-700">
          <div className="h-[450px] w-full relative bg-gray-200">
            {fotoYukleniyor && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 z-10">
                <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-orange-800 font-black text-[10px] tracking-widest uppercase">Görsel Çiziliyor...</p>
              </div>
            )}
            
            <img 
              src={tarif.foto} 
              className={`w-full h-full object-cover transition-opacity duration-1000 ${fotoYukleniyor ? 'opacity-0' : 'opacity-100'}`} 
              onLoad={() => setFotoYukleniyor(false)}
              onError={(e:any) => {
                // EĞER AI GÖRSELİ ÇİZEMEZSE, UNSPALSH'TEN GERÇEK FOTOĞRAF GETİR
                e.target.src = `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=800&auto=format&fit=crop`;
                setFotoYukleniyor(false);
              }}
            />
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 flex items-end p-12">
               <h2 className="text-5xl md:text-7xl font-black text-white uppercase tracking-tighter leading-none">{tarif.isim}</h2>
            </div>
          </div>

          <div className="p-10 md:p-16">
            {/* BESİN DEĞERLERİ */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16 text-center text-black">
              <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-[2.5rem]"> <p className="text-[10px] font-black text-blue-500 uppercase mb-1">🔥 Kalori</p> <p className="text-2xl font-black">{tarif.kalori}</p> </div>
              <div className="bg-red-50/50 border border-red-100 p-6 rounded-[2.5rem]"> <p className="text-[10px] font-black text-red-500 uppercase mb-1">🥩 Protein</p> <p className="text-2xl font-black">{tarif.protein}</p> </div>
              <div className="bg-green-50/50 border border-green-100 p-6 rounded-[2.5rem]"> <p className="text-[10px] font-black text-green-500 uppercase mb-1">⏱ Süre</p> <p className="text-2xl font-black">{tarif.sure}</p> </div>
              <div className="bg-amber-50/50 border border-amber-100 p-6 rounded-[2.5rem]"> <p className="text-[10px] font-black text-amber-500 uppercase mb-1">🌾 Karb.</p> <p className="text-2xl font-black">{tarif.karbonhidrat}</p> </div>
            </div>

            <div className="grid md:grid-cols-2 gap-20 mb-16">
              <div>
                <h3 className="text-3xl font-black mb-8 text-black tracking-tighter uppercase">🛒 Malzemeler</h3>
                <ul className="space-y-4 font-medium text-gray-700">
                  {tarif.malzemeler.map((m: any, i: number) => (
                    <li key={i} className="flex items-center gap-4 text-xl border-b border-gray-100 pb-2">
                      <input type="checkbox" className="w-6 h-6 accent-orange-500 cursor-pointer" /> {m}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-3xl font-black mb-8 text-black tracking-tighter uppercase">👨‍🍳 Hazırlanışı</h3>
                <div className="space-y-8">
                  {tarif.hazirlanis.map((h: any, i: number) => (
                    <div key={i} className="flex gap-6">
                      <span className="font-black text-orange-200 text-5xl leading-none">{i + 1}</span>
                      <p className="text-gray-700 text-lg leading-relaxed font-medium pt-2">{h}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={() => {
               if (kayitliTarifler.find(t => t.isim === tarif.isim)) return alert("Zaten kayıtlı!");
               const yeniListe = [tarif, ...kayitliTarifler];
               setKayitliTarifler(yeniListe);
               localStorage.setItem("chefAI_vFinal_v3", JSON.stringify(yeniListe));
               alert("Deftere eklendi! ❤️");
            }} className="w-full bg-orange-500 text-white font-black py-7 rounded-[2.5rem] hover:bg-orange-600 transition-all shadow-2xl text-xl uppercase tracking-widest">
              ❤️ TARİFİ KAYDET
            </button>
          </div>
        </div>
      )}

      {/* DEFTERİM */}
      {kayitliTarifler.length > 0 && (
        <div className="max-w-6xl mx-auto mt-20">
          <h3 className="text-4xl font-black mb-10 px-6 uppercase tracking-tighter text-gray-900 border-l-8 border-orange-500 pl-6">Defterim</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {kayitliTarifler.map((t, i) => (
              <div key={i} onClick={() => {setTarif(t); window.scrollTo({top: 0, behavior: 'smooth'});}} className="bg-white rounded-[3rem] overflow-hidden shadow-xl border border-white hover:border-orange-300 hover:scale-[1.03] transition-all cursor-pointer group relative">
                <button 
                  onClick={(e) => tarifiSil(i, e)}
                  className="absolute top-6 right-6 z-20 bg-red-500 text-white w-10 h-10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg flex items-center justify-center font-bold"
                > ✕ </button>
                <div className="h-48 w-full bg-gray-100">
                  <img src={t.foto} className="w-full h-full object-cover" />
                </div>
                <div className="p-8 text-center bg-white font-black">
                  <h4 className="text-xl text-gray-800 uppercase group-hover:text-orange-600 transition-colors truncate">{t.isim}</h4>
                  <p className="text-gray-400 text-[10px] mt-2 uppercase tracking-widest">{t.sure} • {t.kalori} KCAL</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <footer className="mt-32 text-center text-gray-400 font-bold text-[10px] uppercase tracking-[0.4em] pb-12 italic">
        ChefAI Kitchen © 2026 • AI Powered Gourmet Experience
      </footer>
    </main>
  );
}