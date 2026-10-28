/*
 * yz.js — Yapay zekâ koç çekirdeği.
 * Model yalnızca ÖNERİ üretir. Uygulama her öneriyi doğrular (çakışma, geçmiş saat, geçersiz değer),
 * kullanıcı önizleyip onaylamadan veriye hiçbir şey yazılmaz.
 * Bağlantı: "OpenAI uyumlu" sohbet uç noktası (Ollama, LM Studio ve benzerleri).
 * Ayarlar ve sohbet geçmişi YEDEK DOSYASINA GİRMEZ; tarayıcıda ayrı anahtarlarda tutulur.
 */
(function (kok) {
  'use strict';

  var D = kok.YKSDepo || require('./depo.js');
  var A = kok.YKSAnaliz || require('./analiz.js');
  var P = kok.YKSPlanlayici || require('./planlayici.js');
  var R = kok.YKSRapor || require('./rapor.js');

  var AYAR_ANAHTARI = 'yks-kocu-yz-ayar';
  var SOHBET_ANAHTARI = 'yks-kocu-yz-sohbet';
  var VARSAYILAN_ADRES = 'http://localhost:11434/v1';
  var EN_FAZLA_MESAJ = 30;
  var EN_FAZLA_ONERI = 40;

  var depolama = null;
  try { if (typeof localStorage !== 'undefined') { depolama = localStorage; } } catch (hata) { depolama = null; }
  function depolamaAyarla(d) { depolama = d; }

  // ---------- Ayarlar (yedeğe girmez) ----------

  function varsayilanAyar() {
    return { adres: VARSAYILAN_ADRES, model: '', anahtar: '', jsonModu: true, gunSayisi: 5, notlariGonder: false };
  }

  function ayarOku() {
    var a = varsayilanAyar();
    if (!depolama) { return a; }
    try {
      var h = JSON.parse(depolama.getItem(AYAR_ANAHTARI) || '{}');
      if (h && typeof h === 'object') {
        if (typeof h.adres === 'string' && h.adres) { a.adres = h.adres; }
        if (typeof h.model === 'string') { a.model = h.model; }
        if (typeof h.anahtar === 'string') { a.anahtar = h.anahtar; }
        if (typeof h.jsonModu === 'boolean') { a.jsonModu = h.jsonModu; }
        if (typeof h.gunSayisi === 'number' && h.gunSayisi >= 1 && h.gunSayisi <= 10) { a.gunSayisi = Math.round(h.gunSayisi); }
        if (typeof h.notlariGonder === 'boolean') { a.notlariGonder = h.notlariGonder; }
        if (typeof h.zamanAsimiSn === 'number' && h.zamanAsimiSn >= 30 && h.zamanAsimiSn <= 600) { a.zamanAsimiSn = Math.round(h.zamanAsimiSn); }
      }
    } catch (hata) { /* bozuk ayar: varsayılana dön */ }
    return a;
  }

  function ayarKaydet(girdi) {
    var adres = String(girdi.adres || '').trim().replace(/\/+$/, '');
    if (!/^https?:\/\/[^\s]+$/i.test(adres)) { throw new Error('Adres http:// veya https:// ile başlamalı (örnek: ' + VARSAYILAN_ADRES + ').'); }
    var model = String(girdi.model || '').trim();
    if (!model) { throw new Error('Model adını gir.'); }
    var gun = Number(girdi.gunSayisi);
    if (!isFinite(gun) || gun < 1 || gun > 10 || Math.round(gun) !== gun) { throw new Error('Plan gün sayısı 1 ile 10 arasında bir tam sayı olmalı.'); }
    var ayar = { adres: adres, model: model, anahtar: String(girdi.anahtar || '').trim(), jsonModu: !!girdi.jsonModu, gunSayisi: gun, notlariGonder: !!girdi.notlariGonder };
    if (girdi.zamanAsimiSn !== undefined) {
      var zs = Number(girdi.zamanAsimiSn);
      if (isFinite(zs) && zs >= 30 && zs <= 600) { ayar.zamanAsimiSn = Math.round(zs); }
    }
    if (!depolama) { throw new Error('Tarayıcı veri saklamaya izin vermiyor, ayarlar kaydedilemedi.'); }
    depolama.setItem(AYAR_ANAHTARI, JSON.stringify(ayar));
    return ayar;
  }

  function ayarSil() { if (depolama) { depolama.removeItem(AYAR_ANAHTARI); } }

  function yerelAdresMi(adres) {
    var m = /^https?:\/\/([^\/:]+)/i.exec(adres || '');
    if (!m) { return false; }
    var h = m[1].toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '0.0.0.0';
  }

  // ---------- Sohbet geçmişi (yedeğe girmez) ----------

  function sohbetOku() {
    if (!depolama) { return []; }
    try {
      var l = JSON.parse(depolama.getItem(SOHBET_ANAHTARI) || '[]');
      return Array.isArray(l) ? l.filter(function (m) { return m && typeof m.metin === 'string' && typeof m.rol === 'string'; }).map(function (m) {
        if (!m.id) { m.id = D.yeniId(); }
        return m;
      }) : [];
    } catch (hata) { return []; }
  }
  function sohbetKaydet(liste) {
    if (!depolama) { return; }
    depolama.setItem(SOHBET_ANAHTARI, JSON.stringify(liste.slice(-EN_FAZLA_MESAJ)));
  }
  function sohbetTemizle() { if (depolama) { depolama.removeItem(SOHBET_ANAHTARI); } }
  function sohbetMesajiSil(id) {
    if (!depolama) { return []; }
    var l = sohbetOku();
    var yeni = l.filter(function (m) { return m.id !== id; });
    sohbetKaydet(yeni);
    return yeni;
  }

  // ---------- Bağlam (modele gönderilen özet) ----------

  var ONCELIK_ADI = { 1: 'düşük', 2: 'normal', 3: 'yüksek' };

  function baglamOlustur(veri, bugun, simdiDk, secenek) {
    secenek = secenek || {};
    var gunSayisi = secenek.gunSayisi || 5;
    var satir = [];
    var konuHarita = {}, gorevHarita = {};
    var t = D.uzunTarih(bugun);
    satir.push('BUGÜN: ' + bugun + ' ' + t.gunYil.split(',')[0] + ', saat ' + A.saateCevir(simdiDk));

    var h = veri.hedefler;
    if (h.bolum || h.universite) {
      var kalan = A.sinavaKalanGun(veri, bugun);
      satir.push('HEDEF: ' + [h.bolum, h.universite].filter(Boolean).join(', ') + (kalan !== null && kalan >= 0 ? '; YKS\'ye ' + kalan + ' gün' : ''));
    }
    satir.push('AYARLAR: konu bloğu ' + veri.rutin.blokDk + ' dk, mola ' + veri.rutin.molaDk + ' dk, günlük hedef ' + P.etkinHedefDk(veri, bugun) + ' dk');

    satir.push('BOŞ ARALIKLAR (yeni işleri yalnızca bunların içine koy):');
    for (var i = 0; i < gunSayisi; i++) {
      var tarih = D.tarihEkle(bugun, i);
      var bos = P.bosAraliklar(veri, tarih, { simdiDk: i === 0 ? simdiDk : null });
      var adi = D.uzunTarih(tarih).gunYil.split(',')[0].slice(0, 3);
      satir.push(tarih + ' (' + adi + '): ' + (bos.length ? bos.map(function (a) { return A.saateCevir(a[0]) + '-' + A.saateCevir(a[1]); }).join(', ') : 'yok'));
    }

    var konular = P.konuOnceligi(veri, bugun, { limit: secenek.konuSayisi || 10 });
    if (konular.length) {
      satir.push('ÖNCELİKLİ KONULAR (kod: konu, ders, neden):');
      konular.forEach(function (k, n) {
        var kod = 'K' + (n + 1);
        konuHarita[kod] = { dersId: k.dersId, konuId: k.konuId, konuAdi: k.konuAdi, dersAdi: k.dersAdi };
        satir.push(kod + ': ' + k.konuAdi + ', ' + k.dersAdi + ', ' + k.neden);
      });
    }

    var farklar = [];
    ['TYT', 'AYT'].forEach(function (s) {
      A.dersAnalizi(veri, s, 3).forEach(function (r) { if (r.fark !== null && r.fark < 0) { farklar.push({ ad: s + ' ' + r.ad, fark: r.fark }); } });
    });
    farklar.sort(function (a, b) { return a.fark - b.fark; });
    if (farklar.length) {
      satir.push('HEDEFE UZAK DERSLER: ' + farklar.slice(0, 5).map(function (f) { return f.ad + ' ' + A.netMetni(f.fark) + ' net'; }).join('; '));
    }

    var no = 0;
    function gorevSatiri(g) {
      no++;
      var kod = 'G' + no;
      gorevHarita[kod] = g.id;
      var parca = g.baslik + ' (' + (g.sureDk ? g.sureDk + ' dk' : 'süre yok') + ', öncelik ' + ONCELIK_ADI[g.oncelik];
      if (g.tarih) { parca += ', ' + g.tarih + (g.saat ? ' ' + g.saat : ''); }
      return kod + ': ' + parca + ')';
    }
    var geciken = veri.gorevler.filter(function (g) { return D.gorevGecikmisMi(g, bugun); }).slice(0, 8);
    if (geciken.length) {
      satir.push('GECİKEN GÖREVLER:');
      geciken.forEach(function (g) { satir.push(gorevSatiri(g)); });
    }
    var bitis = D.tarihEkle(bugun, gunSayisi - 1);
    var yaklasan = veri.gorevler.filter(function (g) { return !g.tamamlandi && g.tarih >= bugun && g.tarih <= bitis; })
      .sort(function (a, b) { return (a.tarih + a.saat) < (b.tarih + b.saat) ? -1 : 1; }).slice(0, 12);
    if (yaklasan.length) {
      satir.push('MEVCUT GÖREVLER (yeni iş bunlarla çakışmasın):');
      yaklasan.forEach(function (g) { satir.push(gorevSatiri(g)); });
    }

    var hf = R.haftalikRapor(veri, bugun);
    var ozet = 'SON 7 GÜN: çalışma ' + (A.sureMetni(hf.toplamDk) || '0 dk');
    if (hf.tamamlanmaOrani !== null) { ozet += ', tarihli görevlerin %' + hf.tamamlanmaOrani + '\'i tamamlandı'; }
    if (hf.hataSayisi) { ozet += ', ' + hf.hataSayisi + ' yanlış/boş kaydı' + (hf.sebepler.length ? ' (en sık: ' + hf.sebepler[0].ad + ')' : ''); }
    satir.push(ozet);

    if (secenek.notlariGonder) {
      var notlar = Object.keys(veri.gunluk).sort().reverse().slice(0, 3).map(function (t2) {
        var g = veri.gunluk[t2];
        return t2 + ': ' + [g.puan ? 'puan ' + g.puan + '/5' : '', g.odak ? 'odak: ' + g.odak : '', g.notlar ? 'not: ' + g.notlar.slice(0, 200) : ''].filter(Boolean).join(', ');
      });
      if (notlar.length) { satir.push('SON GÜN NOTLARI:'); notlar.forEach(function (n) { satir.push(n); }); }
    }

    return { metin: satir.join('\n'), konuHarita: konuHarita, gorevHarita: gorevHarita };
  }

  var SISTEM_MESAJI =
    'Sen sayısal alan YKS öğrencisi için çalışma programı hazırlayan bir yardımcısın. Türkçe yaz. ' +
    'Yalnızca verilen VERİLER bölümüne dayan; olmayan bilgiyi uydurma. ' +
    'Yanıtını SADECE tek bir JSON nesnesi olarak ver, başka metin ekleme. Biçim: ' +
    '{"mesaj":"kullanıcıya kısa açıklama","gorevler":[{"baslik":"...","tarih":"YYYY-AA-GG","saat":"SS:DD","sureDk":45,"konu":"K1","oncelik":2,"neden":"..."}],"tasi":[{"id":"G1","tarih":"YYYY-AA-GG","saat":"SS:DD"}]}. ' +
    '"gorevler" yeni işlerdir; "tasi" mevcut bir görevin gün/saatini değiştirir (id VERİLER\'deki G kodudur). ' +
    'Kurallar: Yeni işleri yalnızca BOŞ ARALIKLAR içine yerleştir ve birbirleriyle çakıştırma; iş sürelerini aralığa sığdır, işler arasında mola bırak. ' +
    '"konu" alanında yalnızca ÖNCELİKLİ KONULAR listesindeki K kodlarını kullan (konu bağlamak istemiyorsan boş bırak). ' +
    'Önceliği zayıf konulara, geciken görevlere ve hedefe uzak derslere ver. Kullanıcının isteğine (ör. "salı akşamı müsait değilim") uy. ' +
    'Emin olmadığın veya bilgi eksik olan durumda önce "mesaj" içinde soru sor ve "gorevler" ile "tasi" listelerini boş bırak.';

  function istemHazirla(veri, kullaniciMetni, gecmis, ayar, bugun, simdiDk) {
    var baglam = baglamOlustur(veri, bugun, simdiDk, { gunSayisi: ayar.gunSayisi, notlariGonder: ayar.notlariGonder });
    var icerik = 'VERİLER:\n' + baglam.metin + '\n\nİSTEK: ' + kullaniciMetni;
    var mesajlar = [{ role: 'system', content: SISTEM_MESAJI }];
    (gecmis || []).filter(function (m) { return !m.hata && (m.rol === 'kullanici' || m.rol === 'asistan'); }).slice(-6).forEach(function (m) {
      mesajlar.push({ role: m.rol === 'kullanici' ? 'user' : 'assistant', content: m.metin });
    });
    mesajlar.push({ role: 'user', content: icerik });
    var onceki = (gecmis || []).filter(function (m) { return !m.hata && (m.rol === 'kullanici' || m.rol === 'asistan'); }).slice(-4)
      .map(function (m) { return (m.rol === 'kullanici' ? 'Kullanıcı: ' : 'Yardımcı: ') + m.metin; });
    var kopyala = SISTEM_MESAJI + '\n\n' + (onceki.length ? 'ÖNCEKİ KONUŞMA:\n' + onceki.join('\n') + '\n\n' : '') + icerik;
    return { mesajlar: mesajlar, kopyalaMetni: kopyala, baglam: baglam };
  }

  // ---------- Yanıtı ayrıştırma ----------

  function yanitiAyristir(metin) {
    var ham = String(metin || '').trim();
    var temiz = ham.replace(/```(?:json)?/gi, '').trim();
    var bas = temiz.indexOf('{'), son = temiz.lastIndexOf('}');
    if (bas < 0 || son <= bas) { return { hata: 'Yanıtta JSON bulunamadı.', ham: ham }; }
    var nesne;
    try { nesne = JSON.parse(temiz.slice(bas, son + 1)); } catch (e) { return { hata: 'Yanıt geçerli JSON değil (' + e.message + ').', ham: ham }; }
    if (!nesne || typeof nesne !== 'object' || Array.isArray(nesne)) { return { hata: 'Yanıt beklenen biçimde değil.', ham: ham }; }
    return {
      mesaj: typeof nesne.mesaj === 'string' ? nesne.mesaj.trim() : '',
      gorevler: Array.isArray(nesne.gorevler) ? nesne.gorevler : [],
      tasi: Array.isArray(nesne.tasi) ? nesne.tasi : [],
      ham: ham
    };
  }

  // ---------- Doğrulama ----------

  function oneriyiDogrula(veri, oneri, harita, bugun, simdiDk) {
    var sonuc = { gorevler: [], tasi: [], reddedilen: [], uyarilar: [] };
    var doluluk = {};
    function dolu(tarih) {
      if (!doluluk[tarih]) {
        var l = [];
        P.blokListesi(veri, tarih, 'mesgul').forEach(function (m) { l.push([m.bas, m.bit, 'meşgul blok (' + m.ad + ')', null]); });
        veri.gorevler.forEach(function (g) {
          if (!g.tamamlandi && g.tarih === tarih && g.saat) {
            var b = A.dakikayaCevir(g.saat);
            l.push([b, b + (g.sureDk || veri.rutin.varsayilanSureDk), '"' + g.baslik + '" görevi', g.id]);
          }
        });
        doluluk[tarih] = l;
      }
      return doluluk[tarih];
    }
    function cakisma(tarih, bas, bit, haricId) {
      var l = dolu(tarih);
      for (var i = 0; i < l.length; i++) {
        if (l[i][3] !== null && l[i][3] === haricId) { continue; }
        if (bas < l[i][1] && l[i][0] < bit) { return l[i][2]; }
      }
      return null;
    }
    function penceredeMi(tarih, bas, bit) {
      return P.blokListesi(veri, tarih, 'calisma').some(function (p) { return bas >= p.bas && bit <= p.bit; });
    }
    function tarihGecerli(t) {
      if (typeof t !== 'string' || !D.tarihAyristir(t)) { return 'tarih geçersiz'; }
      if (t < bugun) { return 'geçmiş bir tarih'; }
      if (D.gunFarki(bugun, t) > 60) { return 'çok ileri bir tarih'; }
      return null;
    }
    var saatDeseni = /^([01]\d|2[0-3]):[0-5]\d$/;
    harita = harita || { konu: {}, gorev: {} };

    (oneri.gorevler || []).slice(0, EN_FAZLA_ONERI).forEach(function (o) {
      o = (o && typeof o === 'object') ? o : {};
      var baslik = typeof o.baslik === 'string' ? o.baslik.trim().slice(0, 200) : '';
      var ret = function (neden) { sonuc.reddedilen.push({ tur: 'gorev', baslik: baslik || '(başlıksız)', neden: neden }); };
      if (!baslik) { return ret('başlık yok'); }
      var tarihHata = tarihGecerli(o.tarih);
      if (tarihHata) { return ret(tarihHata); }
      if (typeof o.saat !== 'string' || !saatDeseni.test(o.saat)) { return ret('saat geçersiz veya yok'); }
      var sure = Number(o.sureDk);
      if (!isFinite(sure) || sure < 5 || sure > 240) { return ret('süre 5 ile 240 dakika arasında olmalı'); }
      sure = Math.round(sure);
      var bas = A.dakikayaCevir(o.saat), bit = bas + sure;
      if (o.tarih === bugun && bas < simdiDk) { return ret('saati geçmiş (' + o.saat + ')'); }
      var c = cakisma(o.tarih, bas, bit, null);
      if (c) { return ret(c + ' ile çakışıyor'); }
      var konu = null;
      if (o.konu !== undefined && o.konu !== null && o.konu !== '') {
        konu = harita.konu[String(o.konu)] || null;
        if (!konu) { sonuc.uyarilar.push('"' + baslik + '": bilinmeyen konu kodu (' + o.konu + ') yok sayıldı.'); }
      }
      if (!penceredeMi(o.tarih, bas, bit)) { sonuc.uyarilar.push('"' + baslik + '" çalışma penceresinin dışında kalıyor (' + o.tarih + ' ' + o.saat + ').'); }
      var oncelik = Number(o.oncelik);
      oncelik = (oncelik === 1 || oncelik === 2 || oncelik === 3) ? oncelik : 2;
      dolu(o.tarih).push([bas, bit, '"' + baslik + '" önerisi', null]);
      sonuc.gorevler.push({ baslik: baslik, tarih: o.tarih, saat: o.saat, sureDk: sure, dersId: konu ? konu.dersId : '', konuId: konu ? konu.konuId : '', konuAdi: konu ? konu.konuAdi : '', oncelik: oncelik, neden: typeof o.neden === 'string' ? o.neden.trim().slice(0, 300) : '' });
    });

    (oneri.tasi || []).slice(0, EN_FAZLA_ONERI).forEach(function (o) {
      o = (o && typeof o === 'object') ? o : {};
      var gercekId = harita.gorev[String(o.id)];
      var gorev = null;
      veri.gorevler.forEach(function (g) { if (g.id === gercekId) { gorev = g; } });
      var etiket = gorev ? gorev.baslik : String(o.id);
      var ret = function (neden) { sonuc.reddedilen.push({ tur: 'tasi', baslik: etiket, neden: neden }); };
      if (!gorev) { return ret('böyle bir görev yok'); }
      if (gorev.tamamlandi) { return ret('görev zaten tamamlanmış'); }
      var tarihHata = tarihGecerli(o.tarih);
      if (tarihHata) { return ret(tarihHata); }
      var saat = (typeof o.saat === 'string' && o.saat !== '') ? o.saat : gorev.saat;
      if (saat && !saatDeseni.test(saat)) { return ret('saat geçersiz'); }
      if (saat) {
        var sure = gorev.sureDk || veri.rutin.varsayilanSureDk;
        var bas = A.dakikayaCevir(saat), bit = bas + sure;
        if (o.tarih === bugun && bas < simdiDk) { return ret('saati geçmiş (' + saat + ')'); }
        var c = cakisma(o.tarih, bas, bit, gorev.id);
        if (c) { return ret(c + ' ile çakışıyor'); }
        dolu(o.tarih).push([bas, bit, '"' + gorev.baslik + '" önerisi', gorev.id]);
      }
      sonuc.tasi.push({ gorevId: gorev.id, baslik: gorev.baslik, eskiTarih: gorev.tarih, eskiSaat: gorev.saat, tarih: o.tarih, saat: saat || '' });
    });
    return sonuc;
  }

  // Doğrulanmış öneriyi veriye yazar. Önce kopyada dener; hata olursa gerçek veriye dokunmaz.
  function oneriyiUygula(veri, dogru) {
    var deneme = JSON.parse(JSON.stringify(veri));
    islemleriYap(deneme, dogru);
    return islemleriYap(veri, dogru);
  }

  function islemleriYap(veri, dogru) {
    var eklenen = 0, tasinan = 0;
    dogru.gorevler.forEach(function (g) {
      D.gorevEkle(veri, { baslik: g.baslik, tarih: g.tarih, saat: g.saat, sureDk: g.sureDk, dersId: g.dersId, konuId: g.konuId, oncelik: g.oncelik, notlar: g.neden });
      eklenen++;
    });
    dogru.tasi.forEach(function (t) {
      D.gorevZamanlaAyarla(veri, t.gorevId, { tarih: t.tarih, saat: t.saat });
      tasinan++;
    });
    return { eklenen: eklenen, tasinan: tasinan };
  }

  var aktifDenetim = null;

  function istekIptalEt() {
    if (aktifDenetim) {
      try { aktifDenetim.abort(); } catch (e) {}
      aktifDenetim = null;
      return true;
    }
    return false;
  }

  // ---------- Kapsamlı YKS Durum Analizi (AI) ----------

  var DURUM_ANALIZI_SISTEM_MESAJI =
    'Sen deneyimli, objektif ve gerçekçi bir YKS sınav koçusun. Türkçe yaz.\n' +
    'Aşağıdaki VERİLER bölümündeki gerçek öğrenci verilerini analiz et. Asla olmayan bilgi uydurma.\n' +
    'ÖNEMLİ KURALLAR:\n' +
    '1. Asla kesin bir başarı yüzdesi veya sahte başarı olasılığı uydurma.\n' +
    '2. Eğer deneme sayısı azsa (2\'den az) veya çalışma verisi yetersizse, genel seviye ve eğilim için veri yetersiz olduğunu açıkça belirt.\n' +
    '3. Tek bir denemeden hareketle kesin hüküm verme; net eğilimini, ders bazlı farkları ve konu seviyelerini birlikte değerlendir.\n' +
    '4. Değerlendirmeni aşağıdaki 7 başlık altında yapılandırılmış, net ve motive edici bir dille sun:\n' +
    '1. Mevcut Durumun Özeti\n' +
    '2. Hedeflerle Mevcut Sonuçlar Arasındaki Fark\n' +
    '3. Güçlü ve Zayıf Dersler / Konular\n' +
    '4. Öncelikli Olarak Çalışılması Gereken Konular\n' +
    '5. Temkinli İlerleme ve Hedefe Ulaşma Değerlendirmesi\n' +
    '6. Hedefe Ulaşmak İçin Somut Çalışma Planı\n' +
    '7. Bir Sonraki Değerlendirmede Karşılaştırılacak Ölçülebilir Göstergeler';

  function durumAnaliziBaglami(veri, bugun) {
    var ozet = A.kapsamliDurumOzeti(veri, bugun);
    var satir = [];
    satir.push('BUGÜN: ' + bugun);
    if (ozet.kalanGun !== null) {
      satir.push('SINAVA KALAN GÜN: ' + ozet.kalanGun);
    }
    var h = ozet.hedef;
    satir.push('HEDEF: ' + [h.universite, h.bolum].filter(Boolean).join(', ') + (h.hedefSiralama ? ' (Hedef Sıralama: ' + h.hedefSiralama + ')' : ''));
    if (ozet.toplamHedef.TYT !== null || ozet.toplamHedef.AYT !== null) {
      satir.push('HEDEF TOPLAM NETLER: TYT ' + (ozet.toplamHedef.TYT || '-') + ', AYT ' + (ozet.toplamHedef.AYT || '-'));
    }
    if (h.seviyeNotu) {
      satir.push('ÖĞRENCİNİN KENDİ SEVİYE NOTU: ' + h.seviyeNotu);
    }

    satir.push('\nDENEME GEÇMİŞİ (' + ozet.denemeSayisi + ' deneme kayıtlı):');
    if (!ozet.yeterliVeri) {
      satir.push('UYARI: ' + ozet.veriYetersizNotu);
    }
    if (ozet.tytSerisi.length) {
      satir.push('TYT Net Gelişimi: ' + ozet.tytSerisi.map(function (d) { return d.tarih + ' (' + (d.ad || 'Deneme') + '): ' + A.netMetni(d.net); }).join(', '));
    }
    if (ozet.aytSerisi.length) {
      satir.push('AYT Net Gelişimi: ' + ozet.aytSerisi.map(function (d) { return d.tarih + ' (' + (d.ad || 'Deneme') + '): ' + A.netMetni(d.net); }).join(', '));
    }

    satir.push('\nDERS BAZINDA SON DURUM (Son 5 deneme ortalaması ve hedef farkı):');
    ['TYT', 'AYT'].forEach(function (tur) {
      satir.push(tur + ' Dersleri:');
      ozet.dersAnalizleri[tur].forEach(function (d) {
        var bilgi = ' - ' + d.ad + ': Ortalama ' + (d.ortalama !== null ? A.netMetni(d.ortalama) : '-') + ' net';
        if (d.hedef !== null) { bilgi += ' (Hedef: ' + d.hedef + ', Fark: ' + (d.fark > 0 ? '+' : '') + A.netMetni(d.fark) + ')'; }
        if (d.sonDenemeSayisi) { bilgi += ' [Son ' + d.sonDenemeSayisi + ' deneme: ' + d.dogru + 'D / ' + d.yanlis + 'Y]'; }
        satir.push(bilgi);
      });
    });

    satir.push('\nMÜFREDAT VE TÜM KONULARIN DURUMU:');
    ozet.mufredat.forEach(function (d) {
      var baslik = d.grup + ' ' + d.ad + ' (%' + d.yuzde + ' bitti - ' + d.bitti + '/' + d.toplam + ' konu)';
      if (d.zayifKonular.length) {
        baslik += ' -> Eksik/Zayıf konular: ' + d.zayifKonular.map(function (k) {
          return k.ad + ' (' + (k.durum === 'bitti' ? 'Seviye ' + k.seviye : k.durum) + ')';
        }).join(', ');
      } else {
        baslik += ' -> Tüm konular tamamlanmış ve iyi seviyede.';
      }
      satir.push(baslik);
    });

    if (ozet.hataIstatistikleri.toplam) {
      satir.push('\nYANLIŞ DEFTERİ (' + ozet.hataIstatistikleri.toplam + ' soru kayıtlı):');
      satir.push('En sık hata sebepleri: ' + ozet.hataIstatistikleri.sebepler.slice(0, 4).map(function (s) { return s.ad + ' (' + s.sayi + ')'; }).join(', '));
      satir.push('En çok hata yapılan konular: ' + ozet.hataIstatistikleri.konular.slice(0, 6).map(function (k) { return k.ad + ' (' + k.sayi + ' hata)'; }).join(', '));
    }

    if (ozet.tekrarGecikenler.length) {
      satir.push('\nARALIKLI TEKRARI GECİKEN KONULAR: ' + ozet.tekrarGecikenler.slice(0, 6).map(function (t) { return t.konuAdi + ' (' + t.dersAdi + ')'; }).join(', '));
    }

    satir.push('\nSON 14 GÜN ÇALIŞMA PERFORMANSI: ' + ozet.performans14Gun.gorevSayisi + ' görev tamamlandı, toplam ' + A.sureMetni(ozet.performans14Gun.toplamDk) + ' (günlük ortalama ' + ozet.performans14Gun.gunlukOrtDk + ' dk).');

    return satir.join('\n');
  }

  function durumAnaliziIstemiHazirla(veri, bugun, ayar) {
    var baglamMetni = durumAnaliziBaglami(veri, bugun);
    var mesajlar = [
      { role: 'system', content: DURUM_ANALIZI_SISTEM_MESAJI },
      { role: 'user', content: 'VERİLER:\n' + baglamMetni + '\n\nLütfen yukarıdaki verilerime dayanarak kapsamlı, gerçekçi ve ölçülebilir YKS durum analizimi yap.' }
    ];
    var kopyala = DURUM_ANALIZI_SISTEM_MESAJI + '\n\nVERİLER:\n' + baglamMetni + '\n\nİSTEK: Kapsamlı ve gerçekçi YKS durum analizi yap.';
    return { mesajlar: mesajlar, kopyalaMetni: kopyala, baglamMetni: baglamMetni };
  }

  // ---------- Haftalık Planlama (AI) ----------

  var HAFTALIK_PLAN_SISTEM_MESAJI =
    'Sen YKS öğrencisi için sonraki haftanın çalışma programını hazırlayan bir koçsun. Türkçe yaz.\n' +
    'Yalnızca verilen VERİLER bölümüne dayan. Müsait olunmayan kısıtlı saatlere ASLA görev koyma.\n' +
    'Yanıtını SADECE tek bir JSON nesnesi olarak ver, başka metin ekleme. Biçim:\n' +
    '{"mesaj":"öğrenciye genel motivasyon ve strateji notu","program":[{"tarih":"YYYY-AA-GG","bas":"SS:DD","bit":"SS:DD","baslik":"...","tur":"rutin|odev|yanlis|oneri","detay":"..."}]}\n' +
    'Kurallar:\n' +
    '1. "program" listesindeki işlerin saatlerini (bas, bit) çakıştırma ve serbest çalışma saatlerine yerleştir.\n' +
    '2. Günlük rutinleri (Paragraf, Problem, Geometri) ve haftalık ödevleri günlere dengeli dağıt.\n' +
    '3. Yanlış defteri tekrar görevlerine ve hedefe uzak derslere öncelik ver.\n' +
    '4. Kullanıcının haftalık özel notuna ve kısıtlamalarına harfiyen uy.';

  function haftalikPlanBaglami(veri, haftaBasi, bugun, talimatlar) {
    var haftalik = D.haftalikPlanAl(veri, haftaBasi);
    var satir = [];
    satir.push('HAFTA: ' + haftaBasi + ' ile ' + D.tarihEkle(haftaBasi, 6) + ' arası');
    var h = veri.hedefler;
    if (h.bolum || h.universite) {
      satir.push('HEDEF: ' + [h.universite, h.bolum].filter(Boolean).join(', ') + '; YKS\'ye ' + (A.sinavaKalanGun(veri, bugun) || '-') + ' gün');
    }

    satir.push('\nGÜNLÜK SERBEST ÇALIŞMA VE BOŞ SAATLER:');
    for (var i = 0; i < 7; i++) {
      var t = D.tarihEkle(haftaBasi, i);
      var gunAdi = D.uzunTarih(t).gunYil.split(',')[0];
      var bos = P.bosAraliklar(veri, t, { simdiDk: t === bugun ? 0 : null });
      var kisitlar = (haftalik.kisitlamalar || []).filter(function (k) { return k.tarih === t; });
      var kisitEngeller = [];
      kisitlar.forEach(function (k) {
        if (k.tumGun) { kisitEngeller.push([0, 1440]); }
        else if (k.bas && k.bit) { kisitEngeller.push([A.dakikayaCevir(k.bas), A.dakikayaCevir(k.bit)]); }
      });
      if (kisitEngeller.length) { bos = P.cikar(bos, kisitEngeller); }
      var bosStr = bos.length ? bos.map(function (a) { return A.saateCevir(a[0]) + '-' + A.saateCevir(a[1]); }).join(', ') : 'müsait saat yok';
      satir.push(t + ' (' + gunAdi + '): ' + bosStr + (kisitlar.length ? ' [Kısıtlama: ' + kisitlar.map(function (k) { return k.aciklama; }).join(', ') + ']' : ''));
    }

    var rutinler = veri.tekrarlananRutinler || [];
    if (rutinler.length) {
      satir.push('\nGÜNLÜK TEKRARLANAN RUTİNLER (Her gün yerleştirilmeli):');
      rutinler.forEach(function (r) {
        if (r.aktif) {
          satir.push(' - ' + r.ad + ': ' + (r.hedefTur === 'soru' ? r.hedefDeger + ' soru' : r.hedefDeger + ' dk') + ' (' + r.gunler.map(function (g) { return ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'][g]; }).join(', ') + ')');
        }
      });
    }

    var odevler = (haftalik.odevler || []).filter(function (o) { return !o.tamamlandi; });
    if (odevler.length) {
      satir.push('\nHAFTALIK ÖDEVLER:');
      odevler.forEach(function (o) {
        satir.push(' - ' + o.ad + ' (' + (o.hedefTur === 'soru' ? o.hedefDeger + ' soru' : o.hedefDeger + ' dk') + (o.sonTeslimTarihi ? ', Son teslim: ' + o.sonTeslimTarihi : '') + (o.tercihEdilenGun !== null ? ', Tercih edilen gün: ' + ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'][o.tercihEdilenGun] : '') + ')');
      });
    }

    var tekrarKonulari = (haftalik.tekrarKonulari || []).filter(function (t) { return !t.tamamlandi; });
    if (tekrarKonulari.length) {
      satir.push('\nKULLANICININ BU HAFTA TEKRAR ETMEK İSTEDİĞİ ÖZEL KONULAR (Programda yer verilmeli):');
      tekrarKonulari.forEach(function (tk) {
        satir.push(' - ' + tk.konuAdi + (tk.dersAdi ? ' (' + tk.dersAdi + ')' : '') + ': ' + (tk.hedefSoru ? tk.hedefSoru + ' soru' : (tk.sureDk || 40) + ' dk'));
      });
    }

    var yanlislar = (veri.yanlisGorevleri || []).filter(function (yg) { return yg.durum === 'onaylandi' || yg.durum === 'onerildi'; });
    if (yanlislar.length) {
      satir.push('\nÖNCELİKLİ YANLIŞ DEFTERİ TEKRARLARI:');
      yanlislar.slice(0, 5).forEach(function (yg) {
        satir.push(' - ' + yg.baslik + ' (' + yg.sureDk + ' dk, sebep: ' + yg.sebep + ')');
      });
    }

    var konular = P.konuOnceligi(veri, bugun, { limit: 8 });
    if (konular.length) {
      satir.push('\nÖNCELİKLİ KONULAR: ' + konular.map(function (k) { return k.konuAdi + ' (' + k.dersAdi + ')'; }).join('; '));
    }

    if (talimatlar || haftalik.talimatlar) {
      satir.push('\nKULLANICININ BU HAFTAYA ÖZEL NOTU / TALİMATI: ' + (talimatlar || haftalik.talimatlar));
    }

    return satir.join('\n');
  }

  function haftalikPlanIstemiHazirla(veri, haftaBasi, bugun, talimatlar, ayar) {
    var baglamMetni = haftalikPlanBaglami(veri, haftaBasi, bugun, talimatlar);
    var mesajlar = [
      { role: 'system', content: HAFTALIK_PLAN_SISTEM_MESAJI },
      { role: 'user', content: 'VERİLER:\n' + baglamMetni + '\n\nYukarıdaki haftalık bilgilerime göre dengeli ve çakışmasız haftalık çalışma programı oluştur.' }
    ];
    var kopyala = HAFTALIK_PLAN_SISTEM_MESAJI + '\n\nVERİLER:\n' + baglamMetni + '\n\nİSTEK: Haftalık çalışma programı hazırla.';
    return { mesajlar: mesajlar, kopyalaMetni: kopyala, baglamMetni: baglamMetni };
  }

  // ---------- API bağlantısı (OpenAI uyumlu) ----------

  function bagImla(hata) { return new Error(hata); }

  function apiyeGonder(ayar, mesajlar, secenek) {
    secenek = secenek || {};
    var adres = String(ayar.adres || '').replace(/\/+$/, '');
    var govde = { model: ayar.model, messages: mesajlar, temperature: 0.4, stream: false };
    if (ayar.jsonModu) { govde.response_format = { type: 'json_object' }; }
    var basliklar = { 'Content-Type': 'application/json' };
    if (ayar.anahtar) { basliklar.Authorization = 'Bearer ' + ayar.anahtar; }
    var zamanAsimi = secenek.zamanAsimiMs || ((ayar.zamanAsimiSn || 180) * 1000);

    function dene(g) {
      var denetim = new AbortController();
      aktifDenetim = denetim;
      var zamanAsimiOldu = false;
      var sayac = setTimeout(function () {
        zamanAsimiOldu = true;
        denetim.abort();
      }, zamanAsimi);
      return fetch(adres + '/chat/completions', { method: 'POST', headers: basliklar, body: JSON.stringify(g), signal: denetim.signal })
        .then(function (yanit) {
          clearTimeout(sayac);
          aktifDenetim = null;
          if (yanit.ok) { return yanit.json().then(function (j) { return { j: j }; }); }
          return yanit.text().then(function (t) { return { durum: yanit.status, metin: t }; });
        }, function (hata) {
          clearTimeout(sayac);
          aktifDenetim = null;
          if (hata && (hata.name === 'AbortError' || denetim.signal.aborted)) {
            if (zamanAsimiOldu) {
              throw bagImla('Yanıt ' + Math.round(zamanAsimi / 1000) + ' saniyede gelmedi. Model yavaş olabilir; daha küçük bir model dene veya "Plan gün sayısı"nı azalt.');
            }
            throw bagImla('İstek kullanıcı tarafından iptal edildi.');
          }
          throw bagImla('Bağlanılamadı (' + adres + '). Ollama çalışıyor mu? Adres doğru mu? Bulut servisi kullanıyorsan internet bağlantını ve servisin tarayıcıdan erişime izin verip vermediğini kontrol et.');
        });
    }

    return dene(govde).then(function (s) {
      if (!s.durum) { return s; }
      if (s.durum === 400 && govde.response_format && /response_format|json/i.test(s.metin)) {
        delete govde.response_format;
        return dene(govde);
      }
      return s;
    }).then(function (s) {
      if (s.durum) {
        var kisa = String(s.metin || '').replace(/\s+/g, ' ').slice(0, 200);
        if (s.durum === 401 || s.durum === 403) { throw bagImla('Servis anahtarı kabul etmedi (' + s.durum + '). Anahtarı kontrol et.'); }
        if (s.durum === 404) { throw bagImla('Adres veya model bulunamadı (404). Model adını kontrol et; Ollama kullanıyorsan "ollama list" komutu yüklü modelleri gösterir. Ayrıntı: ' + kisa); }
        if (s.durum === 429) { throw bagImla('İstek sınırı doldu (429). Biraz bekleyip yeniden dene.'); }
        throw bagImla('Servis hata verdi (' + s.durum + '): ' + kisa);
      }
      var j = s.j, icerik = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (typeof icerik !== 'string') { throw bagImla('Servisin yanıtı beklenen biçimde değil (OpenAI uyumlu bir adres mi?).'); }
      return icerik;
    });
  }

  var api = {
    VARSAYILAN_ADRES: VARSAYILAN_ADRES,
    SISTEM_MESAJI: SISTEM_MESAJI,
    DURUM_ANALIZI_SISTEM_MESAJI: DURUM_ANALIZI_SISTEM_MESAJI,
    HAFTALIK_PLAN_SISTEM_MESAJI: HAFTALIK_PLAN_SISTEM_MESAJI,
    depolamaAyarla: depolamaAyarla,
    varsayilanAyar: varsayilanAyar,
    ayarOku: ayarOku,
    ayarKaydet: ayarKaydet,
    ayarSil: ayarSil,
    yerelAdresMi: yerelAdresMi,
    sohbetOku: sohbetOku,
    sohbetKaydet: sohbetKaydet,
    sohbetTemizle: sohbetTemizle,
    sohbetMesajiSil: sohbetMesajiSil,
    istekIptalEt: istekIptalEt,
    baglamOlustur: baglamOlustur,
    istemHazirla: istemHazirla,
    durumAnaliziBaglami: durumAnaliziBaglami,
    durumAnaliziIstemiHazirla: durumAnaliziIstemiHazirla,
    haftalikPlanBaglami: haftalikPlanBaglami,
    haftalikPlanIstemiHazirla: haftalikPlanIstemiHazirla,
    yanitiAyristir: yanitiAyristir,
    oneriyiDogrula: oneriyiDogrula,
    oneriyiUygula: oneriyiUygula,
    apiyeGonder: apiyeGonder
  };

  kok.YKSYZ = api;
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})(typeof window !== 'undefined' ? window : globalThis);
