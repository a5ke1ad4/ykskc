/*
 * depo.js — Veri katmanı (veri sürümü 2)
 * Verileri tarayıcıda saklar, yedekler, doğrular ve değiştirir.
 * Ekranla ilgili hiçbir şey burada yok; bu yüzden ayrıca test edilebilir.
 */
(function (kok) {
  'use strict';

  var ANAHTAR = 'yks-kocu-veri';
  var OTO_YEDEK_ANAHTARI = 'yks-kocu-oto-yedekler';
  var ONCEKI_ANAHTARI = 'yks-kocu-degisiklik-oncesi';
  var BOZUK_ONEK = 'yks-kocu-bozuk-';
  var VERI_SURUMU = 3;
  var OTO_YEDEK_SAYISI = 7;

  var DURUMLAR = ['baslanmadi', 'calisiyor', 'bitti'];
  var GRUPLAR = ['TYT', 'AYT'];
  var AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  var GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

  // Konu bittikten sonra tekrar aralıkları (gün): 1, 3, 7, 14, 30, 60, sonra hep 60.
  var TEKRAR_ARALIKLARI = [1, 3, 7, 14, 30, 60];

  var BIRIMLER = ['sayfa', 'soru', 'test', 'video', 'bölüm', 'deneme'];
  var RUTIN_TURLERI = ['paragraf', 'problem', 'geometri', 'ozel'];
  var RUTIN_HEDEF_TURLERI = ['soru', 'sure'];
  var KAYNAK_TURLERI = ['soru-bankasi', 'konu-anlatimi', 'deneme', 'fasikul', 'diger'];
  var YANLIS_GOREV_DURUMLARI = ['onerildi', 'onaylandi', 'calisildi', 'reddedildi'];

  // Doğrulanmış ve popüler YKS kaynak kataloğu (isteğe bağlı hafif başlangıç listesi)
  var KAYNAK_KATALOGU = [
    { id: 'kat-tyt-paragraf-3d', ad: '3D TYT Paragraf Soru Bankası', yayin: '3D Yayınları', tur: 'soru-bankasi', birim: 'test', toplam: 80, grup: 'TYT', dersAdi: 'Türkçe' },
    { id: 'kat-tyt-paragraf-limit', ad: 'Limit TYT Kronometre Paragraf', yayin: 'Limit Yayınları', tur: 'soru-bankasi', birim: 'test', toplam: 75, grup: 'TYT', dersAdi: 'Türkçe' },
    { id: 'kat-tyt-problem-apotemi', ad: 'Apotemi Problemler Fasikülü', yayin: 'Apotemi Yayınları', tur: 'fasikul', birim: 'sayfa', toplam: 190, grup: 'TYT', dersAdi: 'Matematik' },
    { id: 'kat-tyt-problem-bilgisar', ad: 'Bilgi Sarmal Problemler', yayin: 'Bilgi Sarmal', tur: 'soru-bankasi', birim: 'test', toplam: 60, grup: 'TYT', dersAdi: 'Matematik' },
    { id: 'kat-tyt-geo-orijinal', ad: 'Orijinal Geometri Soru Bankası', yayin: 'Orijinal Matematik', tur: 'soru-bankasi', birim: 'test', toplam: 110, grup: 'TYT', dersAdi: 'Geometri' },
    { id: 'kat-tyt-geo-karekok', ad: 'Karekök Geometri Sıfır', yayin: 'Karekök', tur: 'soru-bankasi', birim: 'sayfa', toplam: 320, grup: 'TYT', dersAdi: 'Geometri' },
    { id: 'kat-tyt-mat-3d', ad: '3D TYT Matematik Soru Bankası', yayin: '3D Yayınları', tur: 'soru-bankasi', birim: 'test', toplam: 140, grup: 'TYT', dersAdi: 'Matematik' },
    { id: 'kat-ayt-mat-3d', ad: '3D AYT Matematik Soru Bankası', yayin: '3D Yayınları', tur: 'soru-bankasi', birim: 'test', toplam: 150, grup: 'AYT', dersAdi: 'Matematik' },
    { id: 'kat-ayt-fizik-bilgisar', ad: 'Bilgi Sarmal AYT Fizik', yayin: 'Bilgi Sarmal', tur: 'soru-bankasi', birim: 'test', toplam: 95, grup: 'AYT', dersAdi: 'Fizik' },
    { id: 'kat-ayt-kimya-palme', ad: 'Palme AYT Kimya Soru Bankası', yayin: 'Palme', tur: 'soru-bankasi', birim: 'test', toplam: 85, grup: 'AYT', dersAdi: 'Kimya' },
    { id: 'kat-ayt-biyoloji-biyotik', ad: 'Biyotik AYT Biyoloji Soru Bankası', yayin: 'Biyotik', tur: 'soru-bankasi', birim: 'test', toplam: 90, grup: 'AYT', dersAdi: 'Biyoloji' },
    { id: 'kat-tyt-deneme-meb', ad: 'MEB 3 Adım TYT Denemeleri', yayin: 'MEB', tur: 'deneme', birim: 'deneme', toplam: 15, grup: 'TYT', dersAdi: 'Türkçe' }
  ];

  var SEBEPLER = [
    ['konu-eksigi', 'Konu eksiği'],
    ['unuttum', 'Bilgiyi unuttum'],
    ['dikkatsizlik', 'Dikkatsizlik'],
    ['islem', 'İşlem hatası'],
    ['okuma', 'Soruyu yanlış okudum'],
    ['sure', 'Süre yetmedi'],
    ['kararsiz', 'Şıklar arasında kararsız kaldım'],
    ['riske-girmedim', 'Riske girmedim'],
    ['diger', 'Diğer']
  ];

  // Deneme sınavı bölümleri (sayısal alan): anahtar, sınav, ders adı, soru sayısı.
  var DENEME_DERSLERI = [
    { anahtar: 'tyt-turkce', sinav: 'TYT', ad: 'Türkçe', soru: 40 },
    { anahtar: 'tyt-tarih', sinav: 'TYT', ad: 'Tarih', soru: 5 },
    { anahtar: 'tyt-cografya', sinav: 'TYT', ad: 'Coğrafya', soru: 5 },
    { anahtar: 'tyt-felsefe', sinav: 'TYT', ad: 'Felsefe', soru: 5 },
    { anahtar: 'tyt-din', sinav: 'TYT', ad: 'Din Kültürü', soru: 5 },
    { anahtar: 'tyt-matematik', sinav: 'TYT', ad: 'Matematik (geometri dahil)', soru: 40 },
    { anahtar: 'tyt-fizik', sinav: 'TYT', ad: 'Fizik', soru: 7 },
    { anahtar: 'tyt-kimya', sinav: 'TYT', ad: 'Kimya', soru: 7 },
    { anahtar: 'tyt-biyoloji', sinav: 'TYT', ad: 'Biyoloji', soru: 6 },
    { anahtar: 'ayt-matematik', sinav: 'AYT', ad: 'Matematik (geometri dahil)', soru: 40 },
    { anahtar: 'ayt-fizik', sinav: 'AYT', ad: 'Fizik', soru: 14 },
    { anahtar: 'ayt-kimya', sinav: 'AYT', ad: 'Kimya', soru: 13 },
    { anahtar: 'ayt-biyoloji', sinav: 'AYT', ad: 'Biyoloji', soru: 13 }
  ];

  // Sürüm 1'den gelen verilerde, dokunulmamışsa silinecek AYT sosyal dersleri.
  var KALDIRILAN_AYT = ['Edebiyat', 'Tarih-1', 'Coğrafya-1', 'Tarih-2', 'Coğrafya-2', 'Felsefe Grubu'];

  // Başlangıç ders ve konu listesi (sayısal alan). Genel bir başlangıç listesidir;
  // uygulamadan konu/ders ekleyip silerek kendi listene göre düzenleyebilirsin.
  var MUFREDAT = [
    ['TYT', 'Türkçe', ['Sözcükte Anlam', 'Cümlede Anlam', 'Paragraf', 'Ses Bilgisi', 'Sözcükte Yapı', 'Sözcük Türleri', 'Cümlenin Ögeleri', 'Cümle Türleri', 'Yazım Kuralları', 'Noktalama İşaretleri', 'Anlatım Bozuklukları']],
    ['TYT', 'Matematik', ['Temel Kavramlar', 'Sayı Basamakları', 'Bölme ve Bölünebilme', 'EBOB - EKOK', 'Rasyonel Sayılar', 'Basit Eşitsizlikler', 'Mutlak Değer', 'Üslü Sayılar', 'Köklü Sayılar', 'Çarpanlara Ayırma', 'Oran - Orantı', 'Denklem Çözme', 'Problemler', 'Kümeler', 'Mantık', 'Fonksiyonlar', 'Polinomlar', 'Permütasyon - Kombinasyon - Olasılık', 'Veri - İstatistik - Grafikler']],
    ['TYT', 'Geometri', ['Temel Kavramlar ve Doğruda Açılar', 'Üçgende Açılar', 'Dik ve Özel Üçgenler', 'Üçgende Alan ve Benzerlik', 'Çokgenler ve Dörtgenler', 'Çember ve Daire', 'Analitik Geometri', 'Katı Cisimler']],
    ['TYT', 'Fizik', ['Fizik Bilimine Giriş', 'Madde ve Özellikleri', 'Hareket ve Kuvvet', 'İş - Güç - Enerji', 'Isı ve Sıcaklık', 'Basınç ve Kaldırma Kuvveti', 'Elektrostatik', 'Elektrik Akımı ve Manyetizma', 'Dalgalar', 'Optik']],
    ['TYT', 'Kimya', ['Kimya Bilimi', 'Atom ve Periyodik Sistem', 'Kimyasal Türler Arası Etkileşimler', 'Maddenin Halleri', 'Kimyanın Temel Kanunları', 'Mol Kavramı', 'Karışımlar', 'Asitler, Bazlar ve Tuzlar', 'Kimya Her Yerde']],
    ['TYT', 'Biyoloji', ['Canlıların Ortak Özellikleri', 'Canlıların Temel Bileşenleri', 'Hücre ve Organeller', 'Hücre Zarından Madde Geçişi', 'Canlıların Sınıflandırılması', 'Hücre Bölünmeleri', 'Kalıtım', 'Ekosistem Ekolojisi']],
    ['TYT', 'Tarih', ['Tarih ve Zaman', 'İlk ve Orta Çağlarda Türk Dünyası', 'İslam Medeniyetinin Doğuşu', 'Türk - İslam Devletleri', 'Osmanlı Devleti Kuruluş ve Yükselme', 'Osmanlı Devleti Duraklama ve Gerileme', 'Değişen Dünya Dengeleri', 'Yenileşme Hareketleri', 'Milli Mücadele', 'Atatürk İlkeleri ve İnkılapları']],
    ['TYT', 'Coğrafya', ['Doğa ve İnsan', 'Dünya\'nın Şekli ve Hareketleri', 'Harita Bilgisi', 'İklim Bilgisi', 'Yerin Şekillenmesi', 'Nüfus ve Yerleşme', 'Ekonomik Faaliyetler', 'Bölgeler ve Ülkeler', 'Doğal Afetler']],
    ['TYT', 'Felsefe', ['Felsefeyle Tanışma', 'Bilgi Felsefesi', 'Varlık Felsefesi', 'Ahlak Felsefesi', 'Sanat Felsefesi', 'Din Felsefesi', 'Siyaset Felsefesi', 'Bilim Felsefesi']],
    ['TYT', 'Din Kültürü', ['Bilgi ve İnanç', 'İslam ve İbadet', 'Ahlak ve Değerler', 'Hz. Muhammed\'in Hayatı', 'Vahiy ve Akıl', 'Din ve Hayat']],

    ['AYT', 'Matematik', ['Fonksiyonlar', 'Polinomlar', 'İkinci Dereceden Denklemler', 'Parabol', 'Eşitsizlikler', 'Trigonometri', 'Logaritma', 'Diziler', 'Limit', 'Türev', 'İntegral', 'Permütasyon - Kombinasyon - Binom - Olasılık']],
    ['AYT', 'Geometri', ['Üçgenler ve Dörtgenler', 'Çember ve Daire', 'Doğrunun Analitik İncelenmesi', 'Çemberin Analitik İncelenmesi', 'Katı Cisimler']],
    ['AYT', 'Fizik', ['Vektörler', 'Bağıl Hareket', 'Newton\'un Hareket Yasaları', 'Atışlar', 'İş - Güç - Enerji', 'İtme ve Momentum', 'Tork ve Denge', 'Elektrik Alan ve Potansiyel', 'Manyetizma', 'Alternatif Akım ve Transformatörler', 'Dairesel Hareket', 'Kütle Çekimi', 'Basit Harmonik Hareket', 'Dalga Mekaniği', 'Modern Fizik']],
    ['AYT', 'Kimya', ['Modern Atom Teorisi', 'Gazlar', 'Sıvı Çözeltiler', 'Kimyasal Tepkimelerde Enerji', 'Kimyasal Tepkimelerde Hız', 'Kimyasal Denge', 'Asit - Baz Dengesi', 'Çözünürlük Dengesi', 'Kimya ve Elektrik', 'Organik Kimya']],
    ['AYT', 'Biyoloji', ['Sinir Sistemi', 'Endokrin Sistem', 'Duyu Organları', 'Destek ve Hareket Sistemi', 'Sindirim Sistemi', 'Dolaşım ve Bağışıklık', 'Solunum Sistemi', 'Üriner Sistem', 'Üreme ve Embriyonik Gelişim', 'Genden Proteine', 'Canlılarda Enerji Dönüşümleri', 'Bitki Biyolojisi', 'Komünite ve Popülasyon Ekolojisi']]
  ];

  // ---------- Depolama (tarayıcının localStorage alanı) ----------

  var depolama = null;
  try {
    if (typeof localStorage !== 'undefined') { depolama = localStorage; }
  } catch (hata) {
    depolama = null;
  }
  if (depolama && !depolamaDene(depolama)) { depolama = null; }

  function depolamaDene(d) {
    try {
      d.setItem('yks-kocu-deneme', '1');
      d.removeItem('yks-kocu-deneme');
      return true;
    } catch (hata) {
      return false;
    }
  }

  // Testlerde sahte depolama vermek için.
  function depolamaAyarla(d) { depolama = d; }

  var simdiFonksiyonu = function () { return new Date(); };
  function simdiAyarla(f) { simdiFonksiyonu = f; }

  // ---------- Küçük yardımcılar ----------

  var idSayaci = 0;
  function yeniId() {
    idSayaci += 1;
    return Date.now().toString(36) + idSayaci.toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function iki(n) { return n < 10 ? '0' + n : String(n); }

  function yerelTarih(d) {
    return d.getFullYear() + '-' + iki(d.getMonth() + 1) + '-' + iki(d.getDate());
  }

  function bugunStr() { return yerelTarih(simdiFonksiyonu()); }

  function tarihAyristir(metin) {
    if (typeof metin !== 'string') { return null; }
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(metin);
    if (!m) { return null; }
    var y = Number(m[1]), ay = Number(m[2]), g = Number(m[3]);
    var t = new Date(Date.UTC(y, ay - 1, g));
    if (t.getUTCFullYear() !== y || t.getUTCMonth() !== ay - 1 || t.getUTCDate() !== g) { return null; }
    return { y: y, ay: ay, g: g, haftaGunu: t.getUTCDay() };
  }

  // b - a (gün olarak). İkisi de "YYYY-AA-GG" biçiminde.
  function gunFarki(a, b) {
    var x = tarihAyristir(a), y = tarihAyristir(b);
    return Math.round((Date.UTC(y.y, y.ay - 1, y.g) - Date.UTC(x.y, x.ay - 1, x.g)) / 86400000);
  }

  function tarihEkle(tarih, gun) {
    var t = tarihAyristir(tarih);
    return new Date(Date.UTC(t.y, t.ay - 1, t.g + gun)).toISOString().slice(0, 10);
  }

  function kisaTarih(tarih, bugun) {
    var t = tarihAyristir(tarih);
    var b = tarihAyristir(bugun);
    var s = t.g + ' ' + AYLAR[t.ay - 1];
    if (t.y !== b.y) { s += ' ' + t.y; }
    return s;
  }

  function tarihEtiketi(tarih, bugun, tamamlandi) {
    if (!tarih) { return 'Tarihsiz'; }
    var f = gunFarki(bugun, tarih);
    if (f === 0) { return 'Bugün'; }
    if (f === 1) { return 'Yarın'; }
    if (f === -1) { return 'Dün'; }
    if (f < 0) { return tamamlandi ? kisaTarih(tarih, bugun) : (-f) + ' gün gecikti'; }
    if (f <= 6) { return GUNLER[tarihAyristir(tarih).haftaGunu]; }
    return kisaTarih(tarih, bugun);
  }

  function uzunTarih(tarih) {
    var t = tarihAyristir(tarih);
    return { gunAy: t.g + ' ' + AYLAR[t.ay - 1], gunYil: GUNLER[t.haftaGunu] + ', ' + t.y };
  }

  // ---------- Başlangıç verisi ----------

  function yeniKonu(ad) {
    return { id: yeniId(), ad: ad, durum: 'baslanmadi', seviye: 0, tekrarSayisi: 0, sonCalisma: '', tekrarTarihi: '' };
  }

  function varsayilanDersler() {
    return MUFREDAT.map(function (m) {
      return { id: yeniId(), grup: m[0], ad: m[1], konular: m[2].map(yeniKonu) };
    });
  }

  function bosHedefler() {
    return { bolum: '', universite: '', hedefSiralama: '', sinavTarihi: '', hedefNetler: {}, mevcutNetler: {}, seviyeNotu: '' };
  }

  function bosRutin() {
    return { bloklar: [], molaDk: 10, blokDk: 45, varsayilanSureDk: 30, gunlukHedefDk: 0 };
  }

  function varsayilanRutinler() {
    return [
      { id: 'rutin-paragraf', ad: 'Paragraf Çözümü', tur: 'paragraf', hedefTur: 'soru', hedefDeger: 20, gunler: [0, 1, 2, 3, 4, 5, 6], baslangicTarihi: '', bitisTarihi: '', aktif: true, olusturma: '' },
      { id: 'rutin-problem', ad: 'Problem Çözümü', tur: 'problem', hedefTur: 'soru', hedefDeger: 15, gunler: [0, 1, 2, 3, 4, 5, 6], baslangicTarihi: '', bitisTarihi: '', aktif: true, olusturma: '' },
      { id: 'rutin-geometri', ad: 'Geometri Çalışması', tur: 'geometri', hedefTur: 'sure', hedefDeger: 30, gunler: [1, 2, 3, 4, 5], baslangicTarihi: '', bitisTarihi: '', aktif: true, olusturma: '' }
    ];
  }

  function varsayilanVeri() {
    return {
      surum: VERI_SURUMU,
      gorevler: [],
      dersler: varsayilanDersler(),
      kaynaklar: [],
      denemeler: [],
      hatalar: [],
      hedefler: bosHedefler(),
      rutin: bosRutin(),
      gunluk: {},
      ayarlar: { sonYedek: null },
      tekrarlananRutinler: varsayilanRutinler(),
      rutinKayitlari: {},
      haftalikPlanlar: {},
      yanlisGorevleri: [],
      yanlisPlaniAyarlari: { denemeEsigi: 3, sonDenemeSayisi: 0 }
    };
  }

  // ---------- Doğrulama (dosyadan veya depodan gelen veriye güvenmiyoruz) ----------

  function metinAl(x, yedek) {
    return (typeof x === 'string' && x.trim() !== '') ? x.trim() : yedek;
  }
  function serbestMetin(x, enFazla) {
    return typeof x === 'string' ? x.trim().slice(0, enFazla) : '';
  }
  function tarihAl(x) { return (typeof x === 'string' && tarihAyristir(x)) ? x : ''; }
  function saatDakika(s) { var p = s.split(':'); return Number(p[0]) * 60 + Number(p[1]); }
  function saatAl(x) { return (typeof x === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(x)) ? x : ''; }

  function sayiAl(x, min, max, yedek) {
    if (x === '' || x === null || x === undefined) { return yedek; }
    var n = Number(x);
    if (!isFinite(n)) { return yedek; }
    return Math.min(max, Math.max(min, n));
  }
  function tamSayiAl(x, min, max, yedek) {
    return Math.round(sayiAl(x, min, max, yedek));
  }

  function benzersizId(x, kullanilan) {
    var id = (typeof x === 'string' && x !== '' && !kullanilan[x]) ? x : yeniId();
    kullanilan[id] = true;
    return id;
  }

  function denemeDersiBul(anahtar) {
    for (var i = 0; i < DENEME_DERSLERI.length; i++) {
      if (DENEME_DERSLERI[i].anahtar === anahtar) { return DENEME_DERSLERI[i]; }
    }
    return null;
  }

  function sebepVarMi(id) {
    return SEBEPLER.some(function (s) { return s[0] === id; });
  }

  function netHaritasiAl(ham) {
    var cikti = {};
    if (!ham || typeof ham !== 'object') { return cikti; }
    DENEME_DERSLERI.forEach(function (d) {
      var n = sayiAl(ham[d.anahtar], 0, d.soru, null);
      if (n !== null) { cikti[d.anahtar] = Math.round(n * 100) / 100; }
    });
    return cikti;
  }

  function sonuclariAl(tur, ham) {
    var cikti = {};
    if (!ham || typeof ham !== 'object') { return cikti; }
    DENEME_DERSLERI.forEach(function (d) {
      if (d.sinav !== tur || !ham[d.anahtar] || typeof ham[d.anahtar] !== 'object') { return; }
      var dogru = tamSayiAl(ham[d.anahtar].d, 0, d.soru, 0);
      var yanlis = tamSayiAl(ham[d.anahtar].y, 0, d.soru - dogru, 0);
      cikti[d.anahtar] = { d: dogru, y: yanlis };
    });
    return cikti;
  }

  function normalizeEt(ham) {
    if (!ham || typeof ham !== 'object' || Array.isArray(ham)) {
      throw new Error('Dosya geçerli bir YKS Koçu verisi içermiyor.');
    }
    if (!Array.isArray(ham.gorevler) || !Array.isArray(ham.dersler)) {
      throw new Error('Dosyada görev veya ders listesi bulunamadı.');
    }
    if (typeof ham.surum === 'number' && ham.surum > VERI_SURUMU) {
      throw new Error('Bu yedek uygulamanın daha yeni bir sürümüne ait. Önce uygulamayı güncellemen gerekiyor.');
    }
    var eskiSurum = !(typeof ham.surum === 'number' && ham.surum >= 2);

    var dersKullanilan = {};
    var dersler = ham.dersler.filter(function (d) { return d && typeof d === 'object'; }).map(function (d) {
      var konuKullanilan = {};
      var konular = Array.isArray(d.konular) ? d.konular : [];
      return {
        id: benzersizId(d.id, dersKullanilan),
        grup: GRUPLAR.indexOf(d.grup) >= 0 ? d.grup : 'TYT',
        ad: metinAl(d.ad, '(adsız ders)'),
        konular: konular.filter(function (k) { return k && typeof k === 'object'; }).map(function (k) {
          var durum = DURUMLAR.indexOf(k.durum) >= 0 ? k.durum : 'baslanmadi';
          return {
            id: benzersizId(k.id, konuKullanilan),
            ad: metinAl(k.ad, '(adsız konu)'),
            durum: durum,
            seviye: tamSayiAl(k.seviye, 0, 5, 0),
            tekrarSayisi: tamSayiAl(k.tekrarSayisi, 0, 99, 0),
            sonCalisma: tarihAl(k.sonCalisma),
            tekrarTarihi: durum === 'bitti' ? tarihAl(k.tekrarTarihi) : ''
          };
        })
      };
    });

    // Sürüm 1 → 2 geçişi: dokunulmamış AYT sosyal dersleri sayısalcı için kaldırılır.
    if (eskiSurum) {
      dersler = dersler.filter(function (d) {
        var kaldirilacak = d.grup === 'AYT' && KALDIRILAN_AYT.indexOf(d.ad) >= 0;
        var dokunulmamis = d.konular.every(function (k) { return k.durum === 'baslanmadi'; });
        return !(kaldirilacak && dokunulmamis);
      });
    }

    function dersVarMi(id) { return dersler.some(function (d) { return d.id === id; }); }
    function konuVarMi(id) {
      return dersler.some(function (d) { return d.konular.some(function (k) { return k.id === id; }); });
    }

    var gorevKullanilan = {};
    var gorevler = ham.gorevler.filter(function (g) { return g && typeof g === 'object'; }).map(function (g) {
      var altKullanilan = {};
      var altlar = Array.isArray(g.altGorevler) ? g.altGorevler : [];
      var dersId = typeof g.dersId === 'string' ? g.dersId : '';
      return {
        id: benzersizId(g.id, gorevKullanilan),
        baslik: metinAl(g.baslik, '(adsız görev)'),
        tarih: tarihAl(g.tarih),
        saat: saatAl(g.saat),
        sureDk: tamSayiAl(g.sureDk, 0, 1440, 0),
        oncelik: tamSayiAl(g.oncelik, 1, 3, 2),
        konuId: (typeof g.konuId === 'string' && konuVarMi(g.konuId)) ? g.konuId : '',
        dersId: dersVarMi(dersId) ? dersId : '',
        kaynakId: typeof g.kaynakId === 'string' ? g.kaynakId : '',
        notlar: typeof g.notlar === 'string' ? g.notlar : '',
        tamamlandi: g.tamamlandi === true,
        tamamlanmaTarihi: typeof g.tamamlanmaTarihi === 'string' ? g.tamamlanmaTarihi : '',
        olusturma: typeof g.olusturma === 'string' ? g.olusturma : '',
        altGorevler: altlar.filter(function (a) { return a && typeof a === 'object'; }).map(function (a) {
          return {
            id: benzersizId(a.id, altKullanilan),
            baslik: metinAl(a.baslik, '(adsız alt görev)'),
            tamamlandi: a.tamamlandi === true
          };
        })
      };
    });

    var kaynakKullanilan = {};
    var kaynaklar = (Array.isArray(ham.kaynaklar) ? ham.kaynaklar : []).filter(function (k) { return k && typeof k === 'object'; }).map(function (k) {
      var toplam = tamSayiAl(k.toplam, 1, 1000000, 1);
      var dersId = typeof k.dersId === 'string' ? k.dersId : '';
      return {
        id: benzersizId(k.id, kaynakKullanilan),
        ad: metinAl(k.ad, '(adsız kaynak)'),
        yayin: serbestMetin(k.yayin, 80),
        tur: KAYNAK_TURLERI.indexOf(k.tur) >= 0 ? k.tur : 'soru-bankasi',
        dersId: dersVarMi(dersId) ? dersId : '',
        konuId: (typeof k.konuId === 'string' && konuVarMi(k.konuId)) ? k.konuId : '',
        birim: BIRIMLER.indexOf(k.birim) >= 0 ? k.birim : 'sayfa',
        toplam: toplam,
        yapilan: tamSayiAl(k.yapilan, 0, toplam, 0),
        bitisTarihi: tarihAl(k.bitisTarihi),
        notlar: serbestMetin(k.notlar, 500),
        olusturma: typeof k.olusturma === 'string' ? k.olusturma : ''
      };
    });

    function kayitTarihi(t, olusturma) {
      var d = tarihAl(t);
      if (d) { return d; }
      var o = typeof olusturma === 'string' ? olusturma.slice(0, 10) : '';
      return tarihAl(o) || bugunStr();
    }

    var denemeKullanilan = {};
    var denemeler = (Array.isArray(ham.denemeler) ? ham.denemeler : []).filter(function (d) { return d && typeof d === 'object'; }).map(function (d) {
      var tur = d.tur === 'AYT' ? 'AYT' : 'TYT';
      return {
        id: benzersizId(d.id, denemeKullanilan),
        tur: tur,
        tarih: kayitTarihi(d.tarih, d.olusturma),
        ad: serbestMetin(d.ad, 120),
        notlar: serbestMetin(d.notlar, 500),
        sonuclar: sonuclariAl(tur, d.sonuclar),
        olusturma: typeof d.olusturma === 'string' ? d.olusturma : ''
      };
    });
    function denemeVarMi(id) { return denemeler.some(function (d) { return d.id === id; }); }

    var hataKullanilan = {};
    var hatalar = (Array.isArray(ham.hatalar) ? ham.hatalar : []).filter(function (h) { return h && typeof h === 'object'; }).map(function (h) {
      var dersId = typeof h.dersId === 'string' && dersVarMi(h.dersId) ? h.dersId : '';
      var ders = null;
      for (var i = 0; i < dersler.length; i++) { if (dersler[i].id === dersId) { ders = dersler[i]; } }
      var konuId = '';
      if (ders && typeof h.konuId === 'string') {
        konuId = ders.konular.some(function (k) { return k.id === h.konuId; }) ? h.konuId : '';
      }
      return {
        id: benzersizId(h.id, hataKullanilan),
        tarih: kayitTarihi(h.tarih, h.olusturma),
        tur: h.tur === 'bos' ? 'bos' : 'yanlis',
        dersId: dersId,
        dersAdi: serbestMetin(h.dersAdi, 80),
        konuId: konuId,
        konuAdi: serbestMetin(h.konuAdi, 120),
        sebep: sebepVarMi(h.sebep) ? h.sebep : 'diger',
        notlar: serbestMetin(h.notlar, 500),
        denemeId: (typeof h.denemeId === 'string' && denemeVarMi(h.denemeId)) ? h.denemeId : '',
        olusturma: typeof h.olusturma === 'string' ? h.olusturma : ''
      };
    });

    var hh = (ham.hedefler && typeof ham.hedefler === 'object') ? ham.hedefler : {};
    var hedefler = {
      bolum: serbestMetin(hh.bolum, 120),
      universite: serbestMetin(hh.universite, 120),
      hedefSiralama: serbestMetin(hh.hedefSiralama, 20),
      sinavTarihi: tarihAl(hh.sinavTarihi),
      hedefNetler: netHaritasiAl(hh.hedefNetler),
      mevcutNetler: netHaritasiAl(hh.mevcutNetler),
      seviyeNotu: serbestMetin(hh.seviyeNotu, 1000)
    };

    var rr = (ham.rutin && typeof ham.rutin === 'object') ? ham.rutin : {};
    var blokKullanilan = {};
    var bloklar = (Array.isArray(rr.bloklar) ? rr.bloklar : []).filter(function (b) { return b && typeof b === 'object'; }).map(function (b) {
      var gunler = [];
      (Array.isArray(b.gunler) ? b.gunler : []).forEach(function (x) {
        var n = Number(x);
        if (n >= 0 && n <= 6 && Math.round(n) === n && gunler.indexOf(n) < 0) { gunler.push(n); }
      });
      gunler.sort();
      return { id: benzersizId(b.id, blokKullanilan), ad: serbestMetin(b.ad, 60), tur: b.tur === 'mesgul' ? 'mesgul' : 'calisma', gunler: gunler, bas: saatAl(b.bas), bit: saatAl(b.bit) };
    }).filter(function (b) { return b.gunler.length && b.bas && b.bit && saatDakika(b.bit) > saatDakika(b.bas); });
    var rutin = {
      bloklar: bloklar,
      molaDk: tamSayiAl(rr.molaDk, 0, 60, 10),
      blokDk: tamSayiAl(rr.blokDk, 15, 180, 45),
      varsayilanSureDk: tamSayiAl(rr.varsayilanSureDk, 5, 240, 30),
      gunlukHedefDk: tamSayiAl(rr.gunlukHedefDk, 0, 1440, 0)
    };

    var gunluk = {};
    if (ham.gunluk && typeof ham.gunluk === 'object' && !Array.isArray(ham.gunluk)) {
      Object.keys(ham.gunluk).forEach(function (t) {
        var g = ham.gunluk[t];
        if (!tarihAyristir(t) || !g || typeof g !== 'object') { return; }
        var kayit = { puan: tamSayiAl(g.puan, 0, 5, 0), notlar: serbestMetin(g.notlar, 1000), odak: serbestMetin(g.odak, 300) };
        if (kayit.puan || kayit.notlar || kayit.odak) { gunluk[t] = kayit; }
      });
    }

    var sonYedek = (ham.ayarlar && typeof ham.ayarlar.sonYedek === 'string') ? ham.ayarlar.sonYedek : null;

    var rutinKullanilan = {};
    var tekrarlananRutinler = (Array.isArray(ham.tekrarlananRutinler) ? ham.tekrarlananRutinler : (eskiSurum ? [] : varsayilanRutinler())).filter(function (r) {
      return r && typeof r === 'object';
    }).map(function (r) {
      var gunler = [];
      (Array.isArray(r.gunler) ? r.gunler : [0, 1, 2, 3, 4, 5, 6]).forEach(function (x) {
        var n = Number(x);
        if (n >= 0 && n <= 6 && Math.round(n) === n && gunler.indexOf(n) < 0) { gunler.push(n); }
      });
      gunler.sort();
      var tur = RUTIN_TURLERI.indexOf(r.tur) >= 0 ? r.tur : 'ozel';
      var hedefTur = r.hedefTur === 'sure' ? 'sure' : 'soru';
      return {
        id: benzersizId(r.id, rutinKullanilan),
        ad: metinAl(r.ad, tur === 'paragraf' ? 'Paragraf Çözümü' : (tur === 'problem' ? 'Problem Çözümü' : (tur === 'geometri' ? 'Geometri Çalışması' : 'Özel Rutin'))),
        tur: tur,
        hedefTur: hedefTur,
        hedefDeger: tamSayiAl(r.hedefDeger, 1, 1440, hedefTur === 'sure' ? 30 : 20),
        gunler: gunler.length ? gunler : [0, 1, 2, 3, 4, 5, 6],
        baslangicTarihi: tarihAl(r.baslangicTarihi) || bugunStr(),
        bitisTarihi: tarihAl(r.bitisTarihi),
        aktif: r.aktif !== false,
        olusturma: typeof r.olusturma === 'string' ? r.olusturma : ''
      };
    });

    var rutinKayitlari = {};
    if (ham.rutinKayitlari && typeof ham.rutinKayitlari === 'object' && !Array.isArray(ham.rutinKayitlari)) {
      Object.keys(ham.rutinKayitlari).forEach(function (t) {
        if (!tarihAyristir(t)) { return; }
        var gunlukRutin = ham.rutinKayitlari[t];
        if (!gunlukRutin || typeof gunlukRutin !== 'object' || Array.isArray(gunlukRutin)) { return; }
        var temizGun = {};
        Object.keys(gunlukRutin).forEach(function (rId) {
          var k = gunlukRutin[rId];
          if (k && typeof k === 'object') {
            temizGun[rId] = {
              tamamlandi: k.tamamlandi === true,
              deger: tamSayiAl(k.deger, 0, 10000, 0),
              notlar: serbestMetin(k.notlar, 300)
            };
          }
        });
        if (Object.keys(temizGun).length) {
          rutinKayitlari[t] = temizGun;
        }
      });
    }

    var haftalikPlanlar = {};
    if (ham.haftalikPlanlar && typeof ham.haftalikPlanlar === 'object' && !Array.isArray(ham.haftalikPlanlar)) {
      Object.keys(ham.haftalikPlanlar).forEach(function (hb) {
        if (!tarihAyristir(hb)) { return; }
        var hp = ham.haftalikPlanlar[hb];
        if (!hp || typeof hp !== 'object' || Array.isArray(hp)) { return; }
        var odevKullanilan = {};
        var odevler = (Array.isArray(hp.odevler) ? hp.odevler : []).filter(function (o) { return o && typeof o === 'object'; }).map(function (o) {
          var oDersId = typeof o.dersId === 'string' && dersVarMi(o.dersId) ? o.dersId : '';
          var oKonuId = (oDersId && typeof o.konuId === 'string' && konuVarMi(o.konuId)) ? o.konuId : '';
          var oHedefTur = o.hedefTur === 'sure' ? 'sure' : 'soru';
          return {
            id: benzersizId(o.id, odevKullanilan),
            ad: metinAl(o.ad, '(adsız ödev)'),
            dersId: oDersId,
            konuId: oKonuId,
            sonTeslimTarihi: tarihAl(o.sonTeslimTarihi),
            tercihEdilenGun: (typeof o.tercihEdilenGun === 'number' && o.tercihEdilenGun >= 0 && o.tercihEdilenGun <= 6) ? o.tercihEdilenGun : null,
            hedefTur: oHedefTur,
            hedefDeger: tamSayiAl(o.hedefDeger, 1, 1440, oHedefTur === 'sure' ? 45 : 30),
            tamamlandi: o.tamamlandi === true,
            olusturma: typeof o.olusturma === 'string' ? o.olusturma : ''
          };
        });
        var kisitKullanilan = {};
        var kisitlamalar = (Array.isArray(hp.kisitlamalar) ? hp.kisitlamalar : []).filter(function (k) { return k && typeof k === 'object'; }).map(function (k) {
          return {
            id: benzersizId(k.id, kisitKullanilan),
            tarih: tarihAl(k.tarih),
            bas: saatAl(k.bas),
            bit: saatAl(k.bit),
            tumGun: k.tumGun === true,
            aciklama: serbestMetin(k.aciklama, 120)
          };
        }).filter(function (k) { return k.tarih && (k.tumGun || (k.bas && k.bit && saatDakika(k.bit) > saatDakika(k.bas))); });
        var program = (Array.isArray(hp.program) ? hp.program : []).filter(function (p) { return p && typeof p === 'object'; }).map(function (p) {
          return {
            id: typeof p.id === 'string' ? p.id : yeniId(),
            tarih: tarihAl(p.tarih),
            bas: saatAl(p.bas),
            bit: saatAl(p.bit),
            baslik: metinAl(p.baslik, '(adsız görev)'),
            tur: metinAl(p.tur, 'gorev'),
            detay: serbestMetin(p.detay, 200),
            tamamlandi: p.tamamlandi === true
          };
        });
        haftalikPlanlar[hb] = {
          odevler: odevler,
          kisitlamalar: kisitlamalar,
          talimatlar: serbestMetin(hp.talimatlar, 2000),
          program: program
        };
      });
    }

    var yanlisGorevKullanilan = {};
    var yanlisGorevleri = (Array.isArray(ham.yanlisGorevleri) ? ham.yanlisGorevleri : []).filter(function (yg) { return yg && typeof yg === 'object'; }).map(function (yg) {
      var ygDersId = typeof yg.dersId === 'string' && dersVarMi(yg.dersId) ? yg.dersId : '';
      var ygKonuId = (ygDersId && typeof yg.konuId === 'string' && konuVarMi(yg.konuId)) ? yg.konuId : '';
      var durum = YANLIS_GOREV_DURUMLARI.indexOf(yg.durum) >= 0 ? yg.durum : 'onerildi';
      return {
        id: benzersizId(yg.id, yanlisGorevKullanilan),
        dersId: ygDersId,
        konuId: ygKonuId,
        dersAdi: serbestMetin(yg.dersAdi, 80),
        konuAdi: serbestMetin(yg.konuAdi, 120),
        baslik: metinAl(yg.baslik, '(adsız tekrar görevi)'),
        sebep: serbestMetin(yg.sebep, 80),
        soruHedefi: tamSayiAl(yg.soruHedefi, 0, 500, 20),
        sureDk: tamSayiAl(yg.sureDk, 5, 240, 30),
        tarih: tarihAl(yg.tarih),
        durum: durum,
        olusturma: typeof yg.olusturma === 'string' ? yg.olusturma : '',
        tamamlanmaTarihi: typeof yg.tamamlanmaTarihi === 'string' ? yg.tamamlanmaTarihi : ''
      };
    });

    var ypa = (ham.yanlisPlaniAyarlari && typeof ham.yanlisPlaniAyarlari === 'object') ? ham.yanlisPlaniAyarlari : {};
    var yanlisPlaniAyarlari = {
      denemeEsigi: tamSayiAl(ypa.denemeEsigi, 1, 20, 3),
      sonDenemeSayisi: tamSayiAl(ypa.sonDenemeSayisi, 0, 10000, 0)
    };

    return {
      surum: VERI_SURUMU,
      gorevler: gorevler,
      dersler: dersler,
      kaynaklar: kaynaklar,
      denemeler: denemeler,
      hatalar: hatalar,
      hedefler: hedefler,
      rutin: rutin,
      gunluk: gunluk,
      ayarlar: { sonYedek: sonYedek },
      tekrarlananRutinler: tekrarlananRutinler,
      rutinKayitlari: rutinKayitlari,
      haftalikPlanlar: haftalikPlanlar,
      yanlisGorevleri: yanlisGorevleri,
      yanlisPlaniAyarlari: yanlisPlaniAyarlari
    };
  }

  function gecerliVeriMi(metin) {
    try { normalizeEt(JSON.parse(metin)); return true; } catch (hata) { return false; }
  }

  // ---------- Yükleme ve kaydetme ----------

  function yukle() {
    if (!depolama) {
      return {
        veri: varsayilanVeri(),
        kaydedilemez: true,
        uyari: 'Tarayıcı veri saklamaya izin vermiyor. Bu şekilde girdiğin bilgiler kapatınca kaybolur. Uygulamayı Başlat dosyasıyla Edge tarayıcısında açmayı dene.'
      };
    }
    var metin;
    try {
      metin = depolama.getItem(ANAHTAR);
    } catch (hata) {
      return { veri: varsayilanVeri(), uyari: 'Kayıtlı veriler okunamadı: ' + hata.message };
    }
    if (metin === null) {
      var ilk = varsayilanVeri();
      kaydet(ilk);
      return { veri: ilk, uyari: null, ilkAcilis: true };
    }
    try {
      return { veri: normalizeEt(JSON.parse(metin)), uyari: null };
    } catch (hata) {
      // Bozuk veriyi ASLA silmeyiz: ayrı bir anahtara kopyalarız.
      var kopyaAnahtari = BOZUK_ONEK + Date.now();
      var kopyaNotu = '';
      try {
        depolama.setItem(kopyaAnahtari, metin);
        kopyaNotu = ' Bozuk veri silinmedi, "' + kopyaAnahtari + '" adıyla ayrı saklandı.';
      } catch (hata2) {
        kopyaNotu = ' Bozuk verinin kopyası da alınamadı: ' + hata2.message;
      }
      return {
        veri: varsayilanVeri(),
        bozuk: true,
        uyari: 'Kayıtlı veriler okunamadı (' + hata.message + ').' + kopyaNotu + ' Yedek sayfasındaki otomatik kopyalardan geri yükleyebilirsin.'
      };
    }
  }

  function otoYedekHaritasi() {
    try {
      var h = JSON.parse(depolama.getItem(OTO_YEDEK_ANAHTARI) || '{}');
      return (h && typeof h === 'object' && !Array.isArray(h)) ? h : {};
    } catch (hata) {
      return {};
    }
  }

  // Günün ilk değişikliğinden ÖNCEKİ durumu saklar (son 7 gün).
  function gunlukKopyaAl(eskiMetin) {
    try {
      var harita = otoYedekHaritasi();
      var bugun = bugunStr();
      if (harita[bugun]) { return null; }
      if (!gecerliVeriMi(eskiMetin)) { return null; }
      harita[bugun] = eskiMetin;
      var tarihler = Object.keys(harita).sort();
      while (tarihler.length > OTO_YEDEK_SAYISI) { delete harita[tarihler.shift()]; }
      depolama.setItem(OTO_YEDEK_ANAHTARI, JSON.stringify(harita));
      return null;
    } catch (hata) {
      return 'Otomatik günlük kopya alınamadı: ' + hata.message;
    }
  }

  function kaydet(veri) {
    if (!depolama) {
      throw new Error('Tarayıcı veri saklamaya izin vermiyor, bu yüzden veriler kaydedilemedi.');
    }
    var metin = JSON.stringify(veri);
    var uyari = null;
    var eski = depolama.getItem(ANAHTAR);
    if (eski) { uyari = gunlukKopyaAl(eski); }
    depolama.setItem(ANAHTAR, metin);
    if (depolama.getItem(ANAHTAR) !== metin) {
      throw new Error('Kayıt doğrulanamadı: yazılan veri geri okunamadı.');
    }
    return { uyari: uyari };
  }

  function otoYedekler() {
    if (!depolama) { return []; }
    var harita = otoYedekHaritasi();
    var liste = [];
    Object.keys(harita).sort().reverse().forEach(function (tarih) {
      try {
        var v = normalizeEt(JSON.parse(harita[tarih]));
        liste.push({ tarih: tarih, gorevSayisi: v.gorevler.length, dersSayisi: v.dersler.length });
      } catch (hata) { /* geçersiz kopyayı listeye alma */ }
    });
    return liste;
  }

  function otoYedekVerisi(tarih) {
    var metin = otoYedekHaritasi()[tarih];
    if (!metin) { throw new Error('Bu tarihli otomatik kopya bulunamadı.'); }
    return normalizeEt(JSON.parse(metin));
  }

  // Yedekten geri yüklemeden / içe aktarmadan hemen önce, mevcut durumu "geri al" için saklar.
  function oncekiniSakla(veri) {
    if (!depolama) { throw new Error('Tarayıcı veri saklamaya izin vermiyor.'); }
    depolama.setItem(ONCEKI_ANAHTARI, JSON.stringify(veri));
  }

  function oncekiVeri() {
    if (!depolama) { return null; }
    var metin = depolama.getItem(ONCEKI_ANAHTARI);
    if (!metin) { return null; }
    try { return normalizeEt(JSON.parse(metin)); } catch (hata) { return null; }
  }

  // ---------- Dışa / içe aktarma ----------

  function disaAktar(veri) {
    var paket = {
      uygulama: 'yks-kocu',
      surum: VERI_SURUMU,
      disaAktarmaTarihi: simdiFonksiyonu().toISOString(),
      veri: veri
    };
    return { dosyaAdi: 'yks-yedek-' + bugunStr() + '.json', metin: JSON.stringify(paket, null, 2) };
  }

  function iceAktar(metin) {
    var ham;
    try {
      ham = JSON.parse(metin);
    } catch (hata) {
      throw new Error('Dosya okunamadı: geçerli bir yedek dosyası değil.');
    }
    if (ham && typeof ham === 'object' && !Array.isArray(ham) && 'uygulama' in ham) {
      if (ham.uygulama !== 'yks-kocu' || !ham.veri) {
        throw new Error('Bu dosya YKS Koçu yedeği değil.');
      }
      ham = ham.veri;
    }
    return normalizeEt(ham);
  }

  // ---------- Sorgular ----------

  function dersBul(veri, id) {
    for (var i = 0; i < veri.dersler.length; i++) {
      if (veri.dersler[i].id === id) { return veri.dersler[i]; }
    }
    return null;
  }

  function gorevBul(veri, id) {
    for (var i = 0; i < veri.gorevler.length; i++) {
      if (veri.gorevler[i].id === id) { return veri.gorevler[i]; }
    }
    throw new Error('Görev bulunamadı.');
  }

  function gorevGecikmisMi(g, bugun) {
    return !g.tamamlandi && g.tarih !== '' && g.tarih < bugun;
  }

  function altGorevOzeti(g) {
    var tamam = g.altGorevler.filter(function (a) { return a.tamamlandi; }).length;
    return { toplam: g.altGorevler.length, tamam: tamam };
  }

  function sirala(liste) {
    return liste.slice().sort(function (a, b) {
      if (a.tamamlandi !== b.tamamlandi) { return a.tamamlandi ? 1 : -1; }
      if (a.tarih !== b.tarih) {
        if (a.tarih === '') { return 1; }
        if (b.tarih === '') { return -1; }
        return a.tarih < b.tarih ? -1 : 1;
      }
      if (a.saat !== b.saat) {
        if (a.saat === '') { return 1; }
        if (b.saat === '') { return -1; }
        return a.saat < b.saat ? -1 : 1;
      }
      return a.olusturma < b.olusturma ? -1 : (a.olusturma > b.olusturma ? 1 : 0);
    });
  }

  function filtrele(veri, filtre, bugun) {
    var liste = veri.gorevler.filter(function (g) {
      switch (filtre) {
        case 'bugun': return g.tarih === bugun;
        case 'geciken': return gorevGecikmisMi(g, bugun);
        case 'yaklasan': return !g.tamamlandi && g.tarih !== '' && g.tarih > bugun;
        case 'tarihsiz': return !g.tamamlandi && g.tarih === '';
        case 'tamamlanan': return g.tamamlandi;
        default: return true;
      }
    });
    return sirala(liste);
  }

  function ozet(veri, bugun) {
    var o = { toplam: veri.gorevler.length, bugunToplam: 0, bugunTamam: 0, bugunPlanDk: 0, bugunTamamDk: 0, geciken: 0, yaklasan: 0, tarihsiz: 0, tamamlanan: 0 };
    veri.gorevler.forEach(function (g) {
      if (g.tarih === bugun) {
        o.bugunToplam++;
        o.bugunPlanDk += g.sureDk;
        if (g.tamamlandi) { o.bugunTamam++; o.bugunTamamDk += g.sureDk; }
      }
      if (gorevGecikmisMi(g, bugun)) { o.geciken++; }
      if (!g.tamamlandi && g.tarih !== '' && g.tarih > bugun) { o.yaklasan++; }
      if (!g.tamamlandi && g.tarih === '') { o.tarihsiz++; }
      if (g.tamamlandi) { o.tamamlanan++; }
    });
    return o;
  }

  function konuSay(dersler) {
    var s = { toplam: 0, bitti: 0, calisiyor: 0 };
    dersler.forEach(function (d) {
      d.konular.forEach(function (k) {
        s.toplam++;
        if (k.durum === 'bitti') { s.bitti++; }
        if (k.durum === 'calisiyor') { s.calisiyor++; }
      });
    });
    s.yuzde = s.toplam ? Math.round((s.bitti / s.toplam) * 100) : 0;
    return s;
  }

  function dersIlerleme(ders) { return konuSay([ders]); }

  function grupIlerleme(veri, grup) {
    return konuSay(veri.dersler.filter(function (d) { return d.grup === grup; }));
  }

  // Son yedekten kaç gün geçti? (Hiç yedek yoksa null)
  function yedekGunu(veri, bugun) {
    if (!veri.ayarlar.sonYedek) { return null; }
    var d = new Date(veri.ayarlar.sonYedek);
    if (isNaN(d.getTime())) { return null; }
    return gunFarki(yerelTarih(d), bugun);
  }

  function veriVarMi(veri) {
    return veri.gorevler.length > 0 || veri.kaynaklar.length > 0 || veri.denemeler.length > 0 || veri.hatalar.length > 0 ||
      veri.rutin.bloklar.length > 0 || Object.keys(veri.gunluk).length > 0 ||
      veri.hedefler.bolum !== '' || veri.hedefler.universite !== '' || Object.keys(veri.hedefler.hedefNetler).length > 0 ||
      veri.dersler.some(function (d) {
        return d.konular.some(function (k) { return k.durum !== 'baslanmadi' || k.seviye > 0; });
      });
  }

  function yedekHatirlatmaGerekli(veri, bugun) {
    if (!veriVarMi(veri)) { return false; }
    var gun = yedekGunu(veri, bugun);
    return gun === null || gun >= 7;
  }

  // ---------- Değiştiren işlemler (veriyi yerinde günceller; kaydetmeyi çağıran yapar) ----------

  function sureDogrula(x) {
    if (x === '' || x === null || x === undefined) { return 0; }
    var n = Number(x);
    if (!isFinite(n) || n < 0 || n > 1440) { throw new Error('Süre 0 ile 1440 dakika arasında olmalı.'); }
    return Math.round(n);
  }

  function saatDogrula(x) {
    if (x === '' || x === null || x === undefined) { return ''; }
    var s = saatAl(x);
    if (!s) { throw new Error('Saat geçerli değil (örnek: 14:30).'); }
    return s;
  }

  function oncelikDogrula(x, yedek) {
    if (x === '' || x === null || x === undefined) { return yedek; }
    var n = Number(x);
    if (!isFinite(n) || n < 1 || n > 3 || Math.round(n) !== n) { throw new Error('Öncelik geçersiz (1 düşük, 2 normal, 3 yüksek).'); }
    return n;
  }

  function gorevEkle(veri, secenek) {
    var baslik = (secenek.baslik || '').trim();
    if (!baslik) { throw new Error('Görev başlığı boş olamaz.'); }
    var g = {
      id: yeniId(),
      baslik: baslik,
      tarih: tarihAl(secenek.tarih),
      saat: saatDogrula(secenek.saat),
      sureDk: sureDogrula(secenek.sureDk),
      oncelik: oncelikDogrula(secenek.oncelik, 2),
      konuId: konuVarMi(veri, secenek.konuId) ? secenek.konuId : '',
      dersId: dersBul(veri, secenek.dersId) ? secenek.dersId : '',
      kaynakId: typeof secenek.kaynakId === 'string' ? secenek.kaynakId : '',
      notlar: (secenek.notlar || '').trim(),
      tamamlandi: false,
      tamamlanmaTarihi: '',
      olusturma: simdiFonksiyonu().toISOString(),
      altGorevler: []
    };
    veri.gorevler.push(g);
    return g;
  }

  function gorevGuncelle(veri, id, degisiklik) {
    var g = gorevBul(veri, id);
    var baslik = (degisiklik.baslik || '').trim();
    if (!baslik) { throw new Error('Görev başlığı boş olamaz.'); }
    var saat = saatDogrula(degisiklik.saat);
    var sure = sureDogrula(degisiklik.sureDk);
    var oncelik = oncelikDogrula(degisiklik.oncelik, g.oncelik);
    g.oncelik = oncelik;
    g.baslik = baslik;
    g.tarih = tarihAl(degisiklik.tarih);
    g.saat = saat;
    g.sureDk = sure;
    g.dersId = dersBul(veri, degisiklik.dersId) ? degisiklik.dersId : '';
    if (degisiklik.kaynakId !== undefined) {
      g.kaynakId = typeof degisiklik.kaynakId === 'string' ? degisiklik.kaynakId : '';
    }
    g.notlar = (degisiklik.notlar || '').trim();
    return g;
  }

  function konuVarMi(veri, konuId) {
    if (!konuId) { return false; }
    return veri.dersler.some(function (d) { return d.konular.some(function (k) { return k.id === konuId; }); });
  }

  function gorevTamamlaDegistir(veri, id, tamam) {
    var g = gorevBul(veri, id);
    g.tamamlandi = !!tamam;
    g.tamamlanmaTarihi = tamam ? simdiFonksiyonu().toISOString() : '';
    // Bir konuya bağlı görev tamamlanınca konunun son çalışma günü güncellenir;
    // henüz başlanmamışsa "Çalışıyorum" olur.
    if (tamam && g.konuId) {
      veri.dersler.forEach(function (d) {
        d.konular.forEach(function (k) {
          if (k.id === g.konuId) {
            k.sonCalisma = bugunStr();
            if (k.durum === 'baslanmadi') { k.durum = 'calisiyor'; }
          }
        });
      });
    }
    return g;
  }

  // Planlayıcının kullandığı: yalnızca tarih, saat ve süreyi değiştirir.
  function gorevZamanlaAyarla(veri, id, z) {
    var g = gorevBul(veri, id);
    var tarih = z.tarih === undefined ? g.tarih : z.tarih;
    if (tarih !== '' && !tarihAyristir(tarih)) { throw new Error('Tarih geçerli değil.'); }
    var saat = z.saat === undefined ? g.saat : saatDogrula(z.saat);
    var sure = z.sureDk === undefined ? g.sureDk : sureDogrula(z.sureDk);
    g.tarih = tarih; g.saat = saat; g.sureDk = sure;
    return g;
  }

  function gorevSil(veri, id) {
    var g = gorevBul(veri, id);
    veri.gorevler.splice(veri.gorevler.indexOf(g), 1);
  }

  function altGorevEkle(veri, gorevId, baslik) {
    var g = gorevBul(veri, gorevId);
    var b = (baslik || '').trim();
    if (!b) { throw new Error('Alt görev başlığı boş olamaz.'); }
    var a = { id: yeniId(), baslik: b, tamamlandi: false };
    g.altGorevler.push(a);
    return a;
  }

  function altGorevBul(g, altId) {
    for (var i = 0; i < g.altGorevler.length; i++) {
      if (g.altGorevler[i].id === altId) { return g.altGorevler[i]; }
    }
    throw new Error('Alt görev bulunamadı.');
  }

  function altGorevTamamlaDegistir(veri, gorevId, altId, tamam) {
    altGorevBul(gorevBul(veri, gorevId), altId).tamamlandi = !!tamam;
  }

  function altGorevSil(veri, gorevId, altId) {
    var g = gorevBul(veri, gorevId);
    g.altGorevler.splice(g.altGorevler.indexOf(altGorevBul(g, altId)), 1);
  }

  function dersEkle(veri, secenek) {
    var ad = (secenek.ad || '').trim();
    if (!ad) { throw new Error('Ders adı boş olamaz.'); }
    var d = { id: yeniId(), grup: GRUPLAR.indexOf(secenek.grup) >= 0 ? secenek.grup : 'TYT', ad: ad, konular: [] };
    veri.dersler.push(d);
    return d;
  }

  function dersSil(veri, dersId) {
    var d = dersBul(veri, dersId);
    if (!d) { throw new Error('Ders bulunamadı.'); }
    veri.dersler.splice(veri.dersler.indexOf(d), 1);
    veri.gorevler.forEach(function (g) { if (g.dersId === dersId) { g.dersId = ''; } });
    veri.kaynaklar.forEach(function (k) { if (k.dersId === dersId) { k.dersId = ''; } });
    veri.hatalar.forEach(function (h) { if (h.dersId === dersId) { h.dersId = ''; h.konuId = ''; } });
  }

  function konuEkle(veri, dersId, ad) {
    var d = dersBul(veri, dersId);
    if (!d) { throw new Error('Ders bulunamadı.'); }
    var a = (ad || '').trim();
    if (!a) { throw new Error('Konu adı boş olamaz.'); }
    var k = yeniKonu(a);
    d.konular.push(k);
    return k;
  }

  function konuBul(d, konuId) {
    for (var i = 0; i < d.konular.length; i++) {
      if (d.konular[i].id === konuId) { return d.konular[i]; }
    }
    throw new Error('Konu bulunamadı.');
  }

  function konuSil(veri, dersId, konuId) {
    var d = dersBul(veri, dersId);
    if (!d) { throw new Error('Ders bulunamadı.'); }
    d.konular.splice(d.konular.indexOf(konuBul(d, konuId)), 1);
    veri.hatalar.forEach(function (h) { if (h.konuId === konuId) { h.konuId = ''; } });
  }

  function sonrakiDurum(durum) {
    return DURUMLAR[(DURUMLAR.indexOf(durum) + 1) % DURUMLAR.length];
  }

  function dersVeKonu(veri, dersId, konuId) {
    var d = dersBul(veri, dersId);
    if (!d) { throw new Error('Ders bulunamadı.'); }
    return { ders: d, konu: konuBul(d, konuId) };
  }

  function konuDurumuIlerlet(veri, dersId, konuId) {
    var k = dersVeKonu(veri, dersId, konuId).konu;
    var bugun = bugunStr();
    k.durum = sonrakiDurum(k.durum);
    if (k.durum === 'calisiyor') {
      k.sonCalisma = bugun; k.tekrarSayisi = 0; k.tekrarTarihi = '';
    } else if (k.durum === 'bitti') {
      k.sonCalisma = bugun; k.tekrarSayisi = 0; k.tekrarTarihi = tarihEkle(bugun, TEKRAR_ARALIKLARI[0]);
    } else {
      k.sonCalisma = ''; k.tekrarSayisi = 0; k.tekrarTarihi = '';
    }
    return k;
  }

  function konuSeviyeAyarla(veri, dersId, konuId, seviye) {
    var n = Number(seviye);
    if (!isFinite(n) || n < 0 || n > 5 || Math.round(n) !== n) { throw new Error('Seviye 0 ile 5 arasında olmalı.'); }
    var k = dersVeKonu(veri, dersId, konuId).konu;
    k.seviye = n;
    return k;
  }

  function konuTekrarEttim(veri, dersId, konuId) {
    var k = dersVeKonu(veri, dersId, konuId).konu;
    if (k.durum !== 'bitti') { throw new Error('Tekrar yalnızca "Bitti" durumundaki konular için işaretlenir.'); }
    var bugun = bugunStr();
    k.tekrarSayisi += 1;
    k.sonCalisma = bugun;
    k.tekrarTarihi = tarihEkle(bugun, TEKRAR_ARALIKLARI[Math.min(k.tekrarSayisi, TEKRAR_ARALIKLARI.length - 1)]);
    return k;
  }

  function konuTekrarTarihiAyarla(veri, dersId, konuId, tarih) {
    var k = dersVeKonu(veri, dersId, konuId).konu;
    if (k.durum !== 'bitti') { throw new Error('Tekrar tarihi yalnızca "Bitti" durumundaki konular için ayarlanır.'); }
    if (tarih !== '' && !tarihAyristir(tarih)) { throw new Error('Geçerli bir tarih seç.'); }
    k.tekrarTarihi = tarih;
    return k;
  }

  // ----- Kaynaklar -----

  function kaynakAlanlari(veri, s) {
    var ad = (s.ad || '').trim();
    if (!ad) { throw new Error('Kaynak adı boş olamaz.'); }
    var toplam = Number(s.toplam);
    if (!isFinite(toplam) || toplam < 1 || Math.round(toplam) !== toplam) { throw new Error('Toplam sayı en az 1 olan bir tam sayı olmalı.'); }
    var yapilanHam = (s.yapilan === '' || s.yapilan === null || s.yapilan === undefined) ? 0 : Number(s.yapilan);
    if (!isFinite(yapilanHam) || yapilanHam < 0 || Math.round(yapilanHam) !== yapilanHam) { throw new Error('Yapılan sayı 0 veya daha büyük bir tam sayı olmalı.'); }
    if (yapilanHam > toplam) { throw new Error('Yapılan sayı toplamdan büyük olamaz.'); }
    if (BIRIMLER.indexOf(s.birim) < 0) { throw new Error('Birim geçerli değil.'); }
    if (s.bitisTarihi && !tarihAyristir(s.bitisTarihi)) { throw new Error('Bitiş tarihi geçerli değil.'); }
    var dersId = '';
    try {
      if (s.dersId && dersBul(veri, s.dersId)) { dersId = s.dersId; }
    } catch (e) { dersId = ''; }
    var konuId = '';
    if (dersId && s.konuId) {
      try {
        var d = dersBul(veri, dersId);
        if (d && d.konular.some(function (k) { return k.id === s.konuId; })) { konuId = s.konuId; }
      } catch (e) { konuId = ''; }
    }
    return {
      ad: ad,
      yayin: serbestMetin(s.yayin, 80),
      tur: KAYNAK_TURLERI.indexOf(s.tur) >= 0 ? s.tur : 'soru-bankasi',
      dersId: dersId,
      konuId: konuId,
      birim: s.birim,
      toplam: toplam,
      yapilan: yapilanHam,
      bitisTarihi: s.bitisTarihi || '',
      notlar: serbestMetin(s.notlar, 500)
    };
  }

  function kaynakBul(veri, id) {
    for (var i = 0; i < veri.kaynaklar.length; i++) {
      if (veri.kaynaklar[i].id === id) { return veri.kaynaklar[i]; }
    }
    throw new Error('Kaynak bulunamadı.');
  }

  function kaynakEkle(veri, s) {
    var a = kaynakAlanlari(veri, s);
    var mukerrer = veri.kaynaklar.some(function (k) {
      var aAd = a.ad.toLowerCase().trim();
      var kAd = k.ad.toLowerCase().trim();
      var aYayin = (a.yayin || '').toLowerCase().trim();
      var kYayin = (k.yayin || '').toLowerCase().trim();
      return aAd === kAd && (aYayin === kYayin || (!aYayin && !kYayin));
    });
    if (mukerrer) {
      throw new Error('Bu kaynak listenizde zaten mevcut: "' + a.ad + '".');
    }
    a.id = yeniId();
    a.olusturma = simdiFonksiyonu().toISOString();
    veri.kaynaklar.push(a);
    return a;
  }

  function katalogdanKaynakEkle(veri, katId) {
    var item = null;
    for (var ki = 0; ki < KAYNAK_KATALOGU.length; ki++) {
      if (KAYNAK_KATALOGU[ki].id === katId) { item = KAYNAK_KATALOGU[ki]; break; }
    }
    if (!item) { throw new Error('Katalog öğesi bulunamadı.'); }

    var dersId = '';
    for (var i = 0; i < veri.dersler.length; i++) {
      if (veri.dersler[i].grup === item.grup && veri.dersler[i].ad.toLowerCase() === item.dersAdi.toLowerCase()) {
        dersId = veri.dersler[i].id;
        break;
      }
    }
    return kaynakEkle(veri, {
      ad: item.ad,
      yayin: item.yayin,
      tur: item.tur,
      dersId: dersId,
      birim: item.birim,
      toplam: item.toplam,
      yapilan: 0
    });
  }

  function kaynakGuncelle(veri, id, s) {
    var k = kaynakBul(veri, id);
    var a = kaynakAlanlari(veri, s);
    Object.keys(a).forEach(function (anahtar) { k[anahtar] = a[anahtar]; });
    return k;
  }

  function kaynakIlerlemeAyarla(veri, id, yapilan) {
    var k = kaynakBul(veri, id);
    var n = Number(yapilan);
    if (yapilan === '' || !isFinite(n) || n < 0 || Math.round(n) !== n) { throw new Error('Yapılan sayı 0 veya daha büyük bir tam sayı olmalı.'); }
    if (n > k.toplam) { throw new Error('Yapılan sayı toplamdan (' + k.toplam + ') büyük olamaz.'); }
    k.yapilan = n;
    return k;
  }

  function kaynakSil(veri, id) {
    var k = kaynakBul(veri, id);
    veri.kaynaklar.splice(veri.kaynaklar.indexOf(k), 1);
  }

  // ----- Denemeler -----

  function sonuclariDogrula(tur, girdi) {
    var cikti = {};
    var sayi = 0;
    DENEME_DERSLERI.forEach(function (d) {
      if (d.sinav !== tur) { return; }
      var g = girdi && girdi[d.anahtar];
      if (!g) { return; }
      var bosMu = function (x) { return x === '' || x === null || x === undefined; };
      if (bosMu(g.d) && bosMu(g.y)) { return; }
      var dogru = bosMu(g.d) ? 0 : Number(g.d);
      var yanlis = bosMu(g.y) ? 0 : Number(g.y);
      if (!isFinite(dogru) || !isFinite(yanlis) || dogru < 0 || yanlis < 0 || Math.round(dogru) !== dogru || Math.round(yanlis) !== yanlis) {
        throw new Error(d.ad + ': doğru ve yanlış sayıları 0 veya daha büyük tam sayı olmalı.');
      }
      if (dogru + yanlis > d.soru) {
        throw new Error(d.ad + ' (' + tur + '): doğru + yanlış en fazla ' + d.soru + ' olabilir.');
      }
      cikti[d.anahtar] = { d: dogru, y: yanlis };
      sayi++;
    });
    if (!sayi) { throw new Error('En az bir dersin doğru/yanlış sayısını gir.'); }
    return cikti;
  }

  function denemeAlanlari(s) {
    if (GRUPLAR.indexOf(s.tur) < 0) { throw new Error('Sınav türü TYT veya AYT olmalı.'); }
    if (!tarihAyristir(s.tarih)) { throw new Error('Deneme için geçerli bir tarih seç.'); }
    return {
      tur: s.tur,
      tarih: s.tarih,
      ad: serbestMetin(s.ad, 120),
      notlar: serbestMetin(s.notlar, 500),
      sonuclar: sonuclariDogrula(s.tur, s.sonuclar)
    };
  }

  function denemeBul(veri, id) {
    for (var i = 0; i < veri.denemeler.length; i++) {
      if (veri.denemeler[i].id === id) { return veri.denemeler[i]; }
    }
    throw new Error('Deneme bulunamadı.');
  }

  function denemeEkle(veri, s) {
    var a = denemeAlanlari(s);
    a.id = yeniId();
    a.olusturma = simdiFonksiyonu().toISOString();
    veri.denemeler.push(a);
    return a;
  }

  function denemeGuncelle(veri, id, s) {
    var d = denemeBul(veri, id);
    var a = denemeAlanlari(s);
    Object.keys(a).forEach(function (anahtar) { d[anahtar] = a[anahtar]; });
    return d;
  }

  function denemeSil(veri, id) {
    var d = denemeBul(veri, id);
    veri.denemeler.splice(veri.denemeler.indexOf(d), 1);
    veri.hatalar.forEach(function (h) { if (h.denemeId === id) { h.denemeId = ''; } });
  }

  // ----- Yanlış / boş soru kayıtları -----

  function hataAlanlari(veri, s) {
    if (s.tur !== 'yanlis' && s.tur !== 'bos') { throw new Error('Tür "Yanlış" veya "Boş" olmalı.'); }
    if (!tarihAyristir(s.tarih)) { throw new Error('Geçerli bir tarih seç.'); }
    var ders = dersBul(veri, s.dersId);
    if (!ders) { throw new Error('Önce bir ders seç.'); }
    var konu = null;
    if (s.konuId) { konu = konuBul(ders, s.konuId); }
    if (!sebepVarMi(s.sebep)) { throw new Error('Bir sebep seç.'); }
    var denemeId = '';
    if (s.denemeId) { denemeBul(veri, s.denemeId); denemeId = s.denemeId; }
    return {
      tarih: s.tarih,
      tur: s.tur,
      dersId: ders.id,
      dersAdi: ders.grup + ' ' + ders.ad,
      konuId: konu ? konu.id : '',
      konuAdi: konu ? konu.ad : '',
      sebep: s.sebep,
      notlar: serbestMetin(s.notlar, 500),
      denemeId: denemeId
    };
  }

  function hataBul(veri, id) {
    for (var i = 0; i < veri.hatalar.length; i++) {
      if (veri.hatalar[i].id === id) { return veri.hatalar[i]; }
    }
    throw new Error('Kayıt bulunamadı.');
  }

  function hataEkle(veri, s) {
    var a = hataAlanlari(veri, s);
    a.id = yeniId();
    a.olusturma = simdiFonksiyonu().toISOString();
    veri.hatalar.push(a);
    return a;
  }

  function hataGuncelle(veri, id, s) {
    var h = hataBul(veri, id);
    var a = hataAlanlari(veri, s);
    Object.keys(a).forEach(function (anahtar) { h[anahtar] = a[anahtar]; });
    return h;
  }

  function hataSil(veri, id) {
    var h = hataBul(veri, id);
    veri.hatalar.splice(veri.hatalar.indexOf(h), 1);
  }

  // ----- Hedefler ve mevcut seviye -----

  function netleriDogrula(girdi, etiket) {
    var cikti = {};
    DENEME_DERSLERI.forEach(function (d) {
      var x = girdi && girdi[d.anahtar];
      if (x === '' || x === null || x === undefined) { return; }
      var n = Number(x);
      if (!isFinite(n) || n < 0 || n > d.soru) {
        throw new Error(etiket + ' - ' + d.sinav + ' ' + d.ad + ': net 0 ile ' + d.soru + ' arasında olmalı.');
      }
      cikti[d.anahtar] = Math.round(n * 100) / 100;
    });
    return cikti;
  }

  function hedefleriKaydet(veri, h) {
    if (h.sinavTarihi && !tarihAyristir(h.sinavTarihi)) { throw new Error('YKS tarihi geçerli değil.'); }
    var sira = serbestMetin(h.hedefSiralama, 20);
    if (sira && !/^[0-9.,]+$/.test(sira)) { throw new Error('Hedef sıralama yalnızca rakamlardan oluşmalı.'); }
    veri.hedefler = {
      bolum: serbestMetin(h.bolum, 120),
      universite: serbestMetin(h.universite, 120),
      hedefSiralama: sira,
      sinavTarihi: h.sinavTarihi || '',
      hedefNetler: netleriDogrula(h.hedefNetler, 'Hedef'),
      mevcutNetler: netleriDogrula(h.mevcutNetler, 'Mevcut seviye'),
      seviyeNotu: serbestMetin(h.seviyeNotu, 1000)
    };
    return veri.hedefler;
  }

  // ----- Rutin (çalışma pencereleri ve meşgul bloklar) -----

  function rutinBlokAlanlari(s) {
    var tur = s.tur === 'mesgul' ? 'mesgul' : (s.tur === 'calisma' ? 'calisma' : null);
    if (!tur) { throw new Error('Blok türü "Çalışma" veya "Meşgul" olmalı.'); }
    var gunler = [];
    (Array.isArray(s.gunler) ? s.gunler : []).forEach(function (x) {
      var n = Number(x);
      if (n >= 0 && n <= 6 && Math.round(n) === n && gunler.indexOf(n) < 0) { gunler.push(n); }
    });
    if (!gunler.length) { throw new Error('En az bir gün seç.'); }
    var bas = saatAl(s.bas), bit = saatAl(s.bit);
    if (!bas || !bit) { throw new Error('Başlangıç ve bitiş saatini gir.'); }
    if (saatDakika(bit) <= saatDakika(bas)) { throw new Error('Bitiş saati başlangıçtan sonra olmalı.'); }
    var ad = serbestMetin(s.ad, 60) || (tur === 'calisma' ? 'Çalışma' : 'Meşgul');
    return { ad: ad, tur: tur, gunler: gunler.sort(), bas: bas, bit: bit };
  }

  function rutinBlokEkle(veri, s) {
    var b = rutinBlokAlanlari(s);
    b.id = yeniId();
    veri.rutin.bloklar.push(b);
    return b;
  }

  function rutinBlokBul(veri, id) {
    for (var i = 0; i < veri.rutin.bloklar.length; i++) {
      if (veri.rutin.bloklar[i].id === id) { return veri.rutin.bloklar[i]; }
    }
    throw new Error('Blok bulunamadı.');
  }

  function rutinBlokGuncelle(veri, id, s) {
    var blok = rutinBlokBul(veri, id);
    var b = rutinBlokAlanlari(s);
    Object.keys(b).forEach(function (k) { blok[k] = b[k]; });
    return blok;
  }

  function rutinBlokSil(veri, id) {
    veri.rutin.bloklar.splice(veri.rutin.bloklar.indexOf(rutinBlokBul(veri, id)), 1);
  }

  function rutinAyarlariKaydet(veri, a) {
    function tam(x, min, max, ad) {
      var n = Number(x);
      if (x === '' || x === null || x === undefined || !isFinite(n) || Math.round(n) !== n || n < min || n > max) {
        throw new Error(ad + ' ' + min + ' ile ' + max + ' arasında bir tam sayı olmalı.');
      }
      return n;
    }
    var yeni = {
      molaDk: tam(a.molaDk, 0, 60, 'Mola süresi'),
      blokDk: tam(a.blokDk, 15, 180, 'Çalışma bloğu süresi'),
      varsayilanSureDk: tam(a.varsayilanSureDk, 5, 240, 'Varsayılan görev süresi'),
      gunlukHedefDk: tam(a.gunlukHedefDk === '' ? 0 : a.gunlukHedefDk, 0, 1440, 'Günlük hedef')
    };
    Object.keys(yeni).forEach(function (k) { veri.rutin[k] = yeni[k]; });
  }

  // ----- Gün sonu değerlendirmesi -----

  function gunlukKaydet(veri, tarih, d) {
    if (!tarihAyristir(tarih)) { throw new Error('Tarih geçerli değil.'); }
    var puan = (d.puan === '' || d.puan === null || d.puan === undefined) ? 0 : Number(d.puan);
    if (!isFinite(puan) || puan < 0 || puan > 5 || Math.round(puan) !== puan) { throw new Error('Puan 0 ile 5 arasında olmalı.'); }
    var kayit = { puan: puan, notlar: serbestMetin(d.notlar, 1000), odak: serbestMetin(d.odak, 300) };
    if (!kayit.puan && !kayit.notlar && !kayit.odak) { delete veri.gunluk[tarih]; return null; }
    veri.gunluk[tarih] = kayit;
    return kayit;
  }

  // ----- Sıfırlama yardımcıları -----

  function otoYedekleriSil() {
    if (!depolama) { throw new Error('Tarayıcı veri saklamaya izin vermiyor.'); }
    depolama.removeItem(OTO_YEDEK_ANAHTARI);
  }

  function oncekiniSil() {
    if (!depolama) { throw new Error('Tarayıcı veri saklamaya izin vermiyor.'); }
    depolama.removeItem(ONCEKI_ANAHTARI);
  }

  // Her şeyi başlangıç durumuna döndürür ve yeni veriyi hemen kaydeder.
  // kalici=false: eski veri "geri al" için ayrıca saklanır.
  // kalici=true : otomatik günlük kopyalar ve geri al kaydı da silinir (geri dönüş yok).
  function tumVerileriSifirla(mevcut, kalici) {
    var yeni = varsayilanVeri();
    if (!kalici) { oncekiniSakla(mevcut); }
    kaydet(yeni);
    if (kalici) { otoYedekleriSil(); oncekiniSil(); }
    return yeni;
  }

  // ----- Tekrarlanan Rutinler (Paragraf, Problem, Geometri, Özel) -----

  function rutinAlanlari(s) {
    var ad = serbestMetin(s.ad, 80);
    var tur = RUTIN_TURLERI.indexOf(s.tur) >= 0 ? s.tur : 'ozel';
    if (!ad) {
      ad = tur === 'paragraf' ? 'Paragraf Çözümü' : (tur === 'problem' ? 'Problem Çözümü' : (tur === 'geometri' ? 'Geometri Çalışması' : 'Özel Rutin'));
    }
    var hedefTur = s.hedefTur === 'sure' ? 'sure' : 'soru';
    var hedefDeger = tamSayiAl(s.hedefDeger, 1, 1440, hedefTur === 'sure' ? 30 : 20);
    var gunler = [];
    (Array.isArray(s.gunler) ? s.gunler : []).forEach(function (x) {
      var n = Number(x);
      if (n >= 0 && n <= 6 && Math.round(n) === n && gunler.indexOf(n) < 0) { gunler.push(n); }
    });
    if (!gunler.length) { throw new Error('Rutin için haftanın en az bir gününü seç.'); }
    gunler.sort();
    var bas = tarihAl(s.baslangicTarihi) || bugunStr();
    var bit = tarihAl(s.bitisTarihi);
    if (bit && bit < bas) { throw new Error('Bitiş tarihi başlangıç tarihinden önce olamaz.'); }
    return {
      ad: ad,
      tur: tur,
      hedefTur: hedefTur,
      hedefDeger: hedefDeger,
      gunler: gunler,
      baslangicTarihi: bas,
      bitisTarihi: bit,
      aktif: s.aktif !== false
    };
  }

  function tekrarlananRutinBul(veri, id) {
    for (var i = 0; i < (veri.tekrarlananRutinler || []).length; i++) {
      if (veri.tekrarlananRutinler[i].id === id) { return veri.tekrarlananRutinler[i]; }
    }
    throw new Error('Rutin bulunamadı.');
  }

  function tekrarlananRutinEkle(veri, s) {
    if (!Array.isArray(veri.tekrarlananRutinler)) { veri.tekrarlananRutinler = []; }
    var a = rutinAlanlari(s);
    a.id = yeniId();
    a.olusturma = simdiFonksiyonu().toISOString();
    veri.tekrarlananRutinler.push(a);
    return a;
  }

  function tekrarlananRutinGuncelle(veri, id, s) {
    var r = tekrarlananRutinBul(veri, id);
    var birlesik = {};
    Object.keys(r).forEach(function (k) { birlesik[k] = r[k]; });
    Object.keys(s || {}).forEach(function (k) { birlesik[k] = s[k]; });
    var a = rutinAlanlari(birlesik);
    Object.keys(a).forEach(function (k) { r[k] = a[k]; });
    return r;
  }

  function tekrarlananRutinSil(veri, id) {
    var r = tekrarlananRutinBul(veri, id);
    veri.tekrarlananRutinler.splice(veri.tekrarlananRutinler.indexOf(r), 1);
  }

  function gunlukRutinKaydet(veri, tarih, rutinId, kayit) {
    if (!tarihAyristir(tarih)) { throw new Error('Tarih geçerli değil.'); }
    tekrarlananRutinBul(veri, rutinId);
    if (!veri.rutinKayitlari || typeof veri.rutinKayitlari !== 'object') { veri.rutinKayitlari = {}; }
    if (!veri.rutinKayitlari[tarih]) { veri.rutinKayitlari[tarih] = {}; }
    // 'gerceklesen' (UI) veya 'deger' (eski format) ikisini de kabul et
    var gerceklesenHam = kayit.gerceklesen !== undefined ? kayit.gerceklesen : kayit.deger;
    var deger = (gerceklesenHam !== null && gerceklesenHam !== undefined && gerceklesenHam !== '')
      ? tamSayiAl(gerceklesenHam, 0, 10000, 0)
      : null;
    veri.rutinKayitlari[tarih][rutinId] = {
      tamamlandi: kayit.tamamlandi === true,
      deger: deger,
      notlar: serbestMetin(kayit.notlar, 300)
    };
    return veri.rutinKayitlari[tarih][rutinId];
  }

  function gununRutinleri(veri, tarih) {
    var t = tarihAyristir(tarih);
    if (!t) { return []; }
    var haftaGunu = t.haftaGunu;
    var kayitlar = (veri.rutinKayitlari && veri.rutinKayitlari[tarih]) || {};
    var liste = [];
    (veri.tekrarlananRutinler || []).forEach(function (r) {
      if (!r.aktif) { return; }
      if (r.baslangicTarihi && r.baslangicTarihi > tarih) { return; }
      if (r.bitisTarihi && r.bitisTarihi < tarih) { return; }
      if (r.gunler.indexOf(haftaGunu) < 0) { return; }
      var k = kayitlar[r.id] || { tamamlandi: false, deger: null, notlar: '' };
      liste.push({
        id: r.id,
        ad: r.ad,
        tur: r.tur,
        hedefTuru: r.hedefTuru || r.hedefTur,
        hedefDeger: r.hedefDeger,
        tamamlandi: k.tamamlandi === true,
        gerceklesen: (k.deger !== null && k.deger !== undefined) ? k.deger : null,
        notlar: k.notlar || ''
      });
    });
    return liste;
  }

  // ----- Yanlış Defteri Otomatik Görevleri -----

  function yanlisGorevBul(veri, id) {
    for (var i = 0; i < (veri.yanlisGorevleri || []).length; i++) {
      if (veri.yanlisGorevleri[i].id === id) { return veri.yanlisGorevleri[i]; }
    }
    throw new Error('Yanlış tekrar görevi bulunamadı.');
  }

  function yanlisGorevEkle(veri, s) {
    if (!Array.isArray(veri.yanlisGorevleri)) { veri.yanlisGorevleri = []; }
    var baslik = serbestMetin(s.baslik, 200);
    if (!baslik) { throw new Error('Görev başlığı boş olamaz.'); }
    var dersId = typeof s.dersId === 'string' ? s.dersId : '';
    var konuId = typeof s.konuId === 'string' ? s.konuId : '';
    if (konuId) {
      var mukerrer = veri.yanlisGorevleri.some(function (g) {
        return g.konuId === konuId && (g.durum === 'onerildi' || g.durum === 'onaylandi');
      });
      if (mukerrer) { return null; }
    }
    var d = YANLIS_GOREV_DURUMLARI.indexOf(s.durum) >= 0 ? s.durum : 'onerildi';
    var yeni = {
      id: yeniId(),
      dersId: dersId,
      konuId: konuId,
      dersAdi: serbestMetin(s.dersAdi, 80),
      konuAdi: serbestMetin(s.konuAdi, 120),
      baslik: baslik,
      sebep: serbestMetin(s.sebep, 80),
      soruHedefi: tamSayiAl(s.soruHedefi, 0, 500, 20),
      sureDk: tamSayiAl(s.sureDk, 5, 240, 30),
      tarih: tarihAl(s.tarih) || bugunStr(),
      durum: d,
      olusturma: simdiFonksiyonu().toISOString(),
      tamamlanmaTarihi: ''
    };
    veri.yanlisGorevleri.push(yeni);
    return yeni;
  }

  function yanlisGorevDurumGuncelle(veri, id, yeniDurum) {
    if (YANLIS_GOREV_DURUMLARI.indexOf(yeniDurum) < 0) { throw new Error('Geçersiz görev durumu.'); }
    var g = yanlisGorevBul(veri, id);
    g.durum = yeniDurum;
    if (yeniDurum === 'calisildi') {
      g.tamamlanmaTarihi = bugunStr();
      if (g.dersId && g.konuId) {
        try {
          var dk = dersVeKonu(veri, g.dersId, g.konuId);
          if (dk && dk.konu) {
            dk.konu.sonCalisma = bugunStr();
            if (dk.konu.durum === 'baslanmadi') { dk.konu.durum = 'calisiyor'; }
          }
        } catch (e) { /* konu silinmişse atla */ }
      }
    } else if (yeniDurum === 'onaylandi') {
      var varMi = veri.gorevler.some(function (x) {
        return x.konuId && x.konuId === g.konuId && x.tarih === (g.tarih || bugunStr()) && !x.tamamlandi;
      });
      if (!varMi) {
        gorevEkle(veri, {
          baslik: g.baslik,
          tarih: g.tarih || bugunStr(),
          sureDk: g.sureDk || 30,
          dersId: g.dersId,
          konuId: g.konuId,
          oncelik: 3,
          notlar: 'Yanlış defteri tekrarı (' + (g.sebep || 'hata tekrarı') + ')'
        });
      }
    }
    return g;
  }

  function yanlisGorevSil(veri, id) {
    var g = yanlisGorevBul(veri, id);
    veri.yanlisGorevleri.splice(veri.yanlisGorevleri.indexOf(g), 1);
  }

  function yanlisPlaniAyarlariKaydet(veri, a) {
    if (!veri.yanlisPlaniAyarlari) { veri.yanlisPlaniAyarlari = { denemeEsigi: 3, sonDenemeSayisi: 0 }; }
    if (a.denemeEsigi !== undefined) {
      veri.yanlisPlaniAyarlari.denemeEsigi = tamSayiAl(a.denemeEsigi, 1, 20, 3);
    }
    if (a.sonDenemeSayisi !== undefined) {
      veri.yanlisPlaniAyarlari.sonDenemeSayisi = tamSayiAl(a.sonDenemeSayisi, 0, 10000, 0);
    }
    return veri.yanlisPlaniAyarlari;
  }

  // ----- Haftalık Planlama -----

  function haftaBasiTarihi(tarih) {
    var t = tarihAyristir(tarih);
    if (!t) { return ''; }
    var fark = t.haftaGunu === 0 ? -6 : (1 - t.haftaGunu);
    return tarihEkle(tarih, fark);
  }

  function haftalikPlanAl(veri, haftaBasi) {
    if (!tarihAyristir(haftaBasi)) { throw new Error('Hafta başı tarihi geçersiz.'); }
    if (!veri.haftalikPlanlar || typeof veri.haftalikPlanlar !== 'object') { veri.haftalikPlanlar = {}; }
    if (!veri.haftalikPlanlar[haftaBasi]) {
      veri.haftalikPlanlar[haftaBasi] = {
        odevler: [],
        kisitlamalar: [],
        talimat: '',
        oncelikliDersler: '',
        bitirilecekKonular: '',
        notlar: '',
        tekrarKonulari: [],
        program: { gunler: [], uygulandi: false }
      };
    }
    return veri.haftalikPlanlar[haftaBasi];
  }

  function haftalikOdevEkle(veri, haftaBasi, s) {
    var plan = haftalikPlanAl(veri, haftaBasi);
    var ad = serbestMetin(s.ad || s.baslik, 120);
    if (!ad) { throw new Error('Ödev adı boş olamaz.'); }
    var dersId = typeof s.dersId === 'string' ? s.dersId : '';
    var konuId = typeof s.konuId === 'string' ? s.konuId : '';
    var hedefTur = s.hedefTur === 'sure' ? 'sure' : 'soru';
    // tercihEdilenGun: sayı (0-6) veya tarih string'i kabul et
    var tercihGunRaw = s.tercihEdilenGun !== undefined ? s.tercihEdilenGun : s.tercihGun;
    var tercihGun = null;
    if (typeof tercihGunRaw === 'number' && tercihGunRaw >= 0 && tercihGunRaw <= 6) {
      tercihGun = tercihGunRaw;
    } else if (typeof tercihGunRaw === 'string' && tarihAyristir(tercihGunRaw)) {
      tercihGun = tarihAyristir(tercihGunRaw).haftaGunu;
    }
    // sureDk → hedefDeger ve hedefTur=sure
    var hedefDeger;
    if (s.sureDk !== undefined && s.hedefDeger === undefined) {
      hedefTur = 'sure';
      hedefDeger = tamSayiAl(s.sureDk, 1, 1440, 45);
    } else {
      hedefDeger = tamSayiAl(s.hedefDeger, 1, 1440, hedefTur === 'sure' ? 45 : 30);
    }
    var o = {
      id: yeniId(),
      ad: ad,
      baslik: ad,
      dersId: veri.dersler.some(function(d){return d.id===dersId;}) ? dersId : '',
      konuId: '',
      sonTeslimTarihi: tarihAl(s.sonTeslimTarihi || s.sonTeslim),
      tercihEdilenGun: tercihGun,
      hedefTur: hedefTur,
      hedefDeger: hedefDeger,
      tamamlandi: s.tamamlandi === true,
      olusturma: simdiFonksiyonu().toISOString()
    };
    // konuId ancak dersId geçerliyse atanır
    if (o.dersId) {
      var ders = null;
      for (var di = 0; di < veri.dersler.length; di++) { if (veri.dersler[di].id === dersId) { ders = veri.dersler[di]; break; } }
      if (ders && ders.konular.some(function(k){return k.id===konuId;})) { o.konuId = konuId; }
    }
    plan.odevler.push(o);
    return o;
  }

  function haftalikOdevGuncelle(veri, haftaBasi, odevId, s) {
    var plan = haftalikPlanAl(veri, haftaBasi);
    var o = null;
    for (var i = 0; i < plan.odevler.length; i++) {
      if (plan.odevler[i].id === odevId) { o = plan.odevler[i]; break; }
    }
    if (!o) { throw new Error('Ödev bulunamadı.'); }
    if (s.ad !== undefined) {
      var ad = serbestMetin(s.ad, 120);
      if (!ad) { throw new Error('Ödev adı boş olamaz.'); }
      o.ad = ad;
    }
    if (s.dersId !== undefined) {
      o.dersId = veri.dersler.some(function (d) { return d.id === s.dersId; }) ? s.dersId : '';
    }
    if (s.konuId !== undefined) { o.konuId = (o.dersId && konuVarMi(s.konuId)) ? s.konuId : ''; }
    if (s.sonTeslimTarihi !== undefined) { o.sonTeslimTarihi = tarihAl(s.sonTeslimTarihi); }
    if (s.tercihEdilenGun !== undefined) {
      o.tercihEdilenGun = (typeof s.tercihEdilenGun === 'number' && s.tercihEdilenGun >= 0 && s.tercihEdilenGun <= 6) ? s.tercihEdilenGun : null;
    }
    if (s.hedefTur !== undefined) { o.hedefTur = s.hedefTur === 'sure' ? 'sure' : 'soru'; }
    if (s.hedefDeger !== undefined) { o.hedefDeger = tamSayiAl(s.hedefDeger, 1, 1440, o.hedefTur === 'sure' ? 45 : 30); }
    if (s.tamamlandi !== undefined) { o.tamamlandi = s.tamamlandi === true; }
    return o;
  }

  function haftalikOdevSil(veri, haftaBasi, odevId) {
    var plan = haftalikPlanAl(veri, haftaBasi);
    var index = -1;
    for (var i = 0; i < plan.odevler.length; i++) {
      if (plan.odevler[i].id === odevId) { index = i; break; }
    }
    if (index >= 0) { plan.odevler.splice(index, 1); }
  }

  function haftalikOdevTamamla(veri, haftaBasi, odevId, tamamlandi) {
    return haftalikOdevGuncelle(veri, haftaBasi, odevId, { tamamlandi: tamamlandi === true });
  }

  function haftalikKisitlamaEkle(veri, haftaBasi, s) {
    var plan = haftalikPlanAl(veri, haftaBasi);
    var tarih = tarihAl(s.tarih);
    if (!tarih) { throw new Error('Kısıtlama tarihi geçersiz.'); }
    var tumGun = s.tumGun === true;
    var bas = saatAl(s.bas), bit = saatAl(s.bit);
    if (!tumGun) {
      if (!bas || !bit) { throw new Error('Başlangıç ve bitiş saatini gir.'); }
      if (saatDakika(bit) <= saatDakika(bas)) { throw new Error('Bitiş saati başlangıçtan sonra olmalı.'); }
    }
    var k = {
      id: yeniId(),
      tarih: tarih,
      bas: tumGun ? '' : bas,
      bit: tumGun ? '' : bit,
      tumGun: tumGun,
      aciklama: serbestMetin(s.aciklama, 120) || 'Müsait değil'
    };
    plan.kisitlamalar.push(k);
    return k;
  }

  function haftalikKisitlamaSil(veri, haftaBasi, kisitId) {
    var plan = haftalikPlanAl(veri, haftaBasi);
    var index = -1;
    for (var i = 0; i < plan.kisitlamalar.length; i++) {
      if (plan.kisitlamalar[i].id === kisitId) { index = i; break; }
    }
    if (index >= 0) { plan.kisitlamalar.splice(index, 1); }
  }

  function haftalikTalimatKaydet(veri, haftaBasi, talimatlar) {
    var plan = haftalikPlanAl(veri, haftaBasi);
    // Hem string hem nesne formatı desteklenir
    if (talimatlar && typeof talimatlar === 'object') {
      if (talimatlar.talimat !== undefined) { plan.talimat = serbestMetin(talimatlar.talimat, 2000); }
      if (talimatlar.oncelikliDersler !== undefined) { plan.oncelikliDersler = serbestMetin(talimatlar.oncelikliDersler, 500); }
      if (talimatlar.bitirilecekKonular !== undefined) { plan.bitirilecekKonular = serbestMetin(talimatlar.bitirilecekKonular, 500); }
      if (talimatlar.notlar !== undefined) { plan.notlar = serbestMetin(talimatlar.notlar, 1000); }
    } else {
      plan.talimat = serbestMetin(talimatlar, 2000);
    }
    return plan;
  }

  function haftalikTekrarEkle(veri, haftaBasi, s) {
    var plan = haftalikPlanAl(veri, haftaBasi);
    if (!Array.isArray(plan.tekrarKonulari)) { plan.tekrarKonulari = []; }
    var konuAdi = serbestMetin(s.konuAdi || s.ad, 120);
    if (!konuAdi) { throw new Error('Tekrar edilecek konu adı boş olamaz.'); }
    var dersAdi = serbestMetin(s.dersAdi, 80);
    var konuId = typeof s.konuId === 'string' ? s.konuId : '';
    var dersId = typeof s.dersId === 'string' ? s.dersId : '';

    var varMi = plan.tekrarKonulari.some(function (t) {
      return (konuId && t.konuId === konuId) || (t.konuAdi && t.konuAdi.toLowerCase() === konuAdi.toLowerCase());
    });
    if (varMi) { throw new Error('"' + konuAdi + '" bu haftanın tekrar listesinde zaten mevcut.'); }

    var oge = {
      id: yeniId(),
      dersId: dersId,
      konuId: konuId,
      dersAdi: dersAdi,
      konuAdi: konuAdi,
      hedefSoru: tamSayiAl(s.hedefSoru, 5, 200, 20),
      sureDk: tamSayiAl(s.sureDk, 15, 180, 40),
      tamamlandi: false,
      olusturma: simdiFonksiyonu().toISOString()
    };
    plan.tekrarKonulari.push(oge);
    return oge;
  }

  function haftalikTekrarSil(veri, haftaBasi, tekrarId) {
    var plan = haftalikPlanAl(veri, haftaBasi);
    if (!Array.isArray(plan.tekrarKonulari)) { return; }
    var idx = -1;
    for (var i = 0; i < plan.tekrarKonulari.length; i++) {
      if (plan.tekrarKonulari[i].id === tekrarId || plan.tekrarKonulari[i].konuId === tekrarId) {
        idx = i;
        break;
      }
    }
    if (idx >= 0) { plan.tekrarKonulari.splice(idx, 1); }
  }

  function haftalikTekrarDurum(veri, haftaBasi, tekrarId, tamamlandi) {
    var plan = haftalikPlanAl(veri, haftaBasi);
    if (!Array.isArray(plan.tekrarKonulari)) { return; }
    for (var i = 0; i < plan.tekrarKonulari.length; i++) {
      if (plan.tekrarKonulari[i].id === tekrarId || plan.tekrarKonulari[i].konuId === tekrarId) {
        plan.tekrarKonulari[i].tamamlandi = !!tamamlandi;
        break;
      }
    }
  }

  function haftalikProgramKaydet(veri, haftaBasi, gunler) {
    var plan = haftalikPlanAl(veri, haftaBasi);
    if (!plan.program || typeof plan.program !== 'object' || Array.isArray(plan.program)) {
      plan.program = { gunler: [], uygulandi: false };
    }
    plan.program.gunler = Array.isArray(gunler) ? gunler.slice() : [];
    plan.program.uygulandi = false;
    return plan.program;
  }

  function haftalikProgramiUygula(veri, haftaBasi) {
    var plan = haftalikPlanAl(veri, haftaBasi);
    var gunler = (plan.program && plan.program.gunler) ? plan.program.gunler : (Array.isArray(plan.program) ? plan.program : []);
    var eklenen = 0;
    gunler.forEach(function (p) {
      if (!p.tarih || !p.baslik) { return; }
      var varMi = veri.gorevler.some(function (g) {
        return g.tarih === p.tarih && g.baslik === p.baslik && (!p.bas || g.saat === p.bas);
      });
      if (!varMi) {
        var sure = 45;
        if (p.bas && p.bit) {
          sure = Math.max(10, saatDakika(p.bit) - saatDakika(p.bas));
        }
        gorevEkle(veri, {
          baslik: p.baslik,
          tarih: p.tarih,
          saat: p.bas || '',
          sureDk: sure,
          notlar: p.detay || ''
        });
        eklenen++;
      }
    });
    if (plan.program && typeof plan.program === 'object' && !Array.isArray(plan.program)) {
      plan.program.uygulandi = true;
    }
    return { eklenen: eklenen };
  }

  var api = {
    ANAHTAR: ANAHTAR,
    ONCEKI_ANAHTARI: ONCEKI_ANAHTARI,
    BOZUK_ONEK: BOZUK_ONEK,
    OTO_YEDEK_ANAHTARI: OTO_YEDEK_ANAHTARI,
    VERI_SURUMU: VERI_SURUMU,
    GRUPLAR: GRUPLAR,
    BIRIMLER: BIRIMLER,
    RUTIN_TURLERI: RUTIN_TURLERI,
    RUTIN_HEDEF_TURLERI: RUTIN_HEDEF_TURLERI,
    KAYNAK_TURLERI: KAYNAK_TURLERI,
    KAYNAK_KATALOGU: KAYNAK_KATALOGU,
    YANLIS_GOREV_DURUMLARI: YANLIS_GOREV_DURUMLARI,
    SEBEPLER: SEBEPLER,
    DENEME_DERSLERI: DENEME_DERSLERI,
    TEKRAR_ARALIKLARI: TEKRAR_ARALIKLARI,
    depolamaAyarla: depolamaAyarla,
    simdiAyarla: simdiAyarla,
    yeniId: yeniId,
    bugunStr: bugunStr,
    gunFarki: gunFarki,
    tarihEkle: tarihEkle,
    tarihAyristir: tarihAyristir,
    tarihEtiketi: tarihEtiketi,
    kisaTarih: kisaTarih,
    uzunTarih: uzunTarih,
    varsayilanVeri: varsayilanVeri,
    varsayilanRutinler: varsayilanRutinler,
    normalizeEt: normalizeEt,
    yukle: yukle,
    kaydet: kaydet,
    otoYedekler: otoYedekler,
    otoYedekVerisi: otoYedekVerisi,
    oncekiniSakla: oncekiniSakla,
    oncekiVeri: oncekiVeri,
    disaAktar: disaAktar,
    iceAktar: iceAktar,
    dersBul: dersBul,
    denemeDersiBul: denemeDersiBul,
    gorevGecikmisMi: gorevGecikmisMi,
    altGorevOzeti: altGorevOzeti,
    filtrele: filtrele,
    ozet: ozet,
    dersIlerleme: dersIlerleme,
    grupIlerleme: grupIlerleme,
    yedekGunu: yedekGunu,
    yedekHatirlatmaGerekli: yedekHatirlatmaGerekli,
    gorevEkle: gorevEkle,
    gorevGuncelle: gorevGuncelle,
    gorevTamamlaDegistir: gorevTamamlaDegistir,
    gorevSil: gorevSil,
    altGorevEkle: altGorevEkle,
    altGorevTamamlaDegistir: altGorevTamamlaDegistir,
    altGorevSil: altGorevSil,
    dersEkle: dersEkle,
    dersSil: dersSil,
    konuEkle: konuEkle,
    konuSil: konuSil,
    konuDurumuIlerlet: konuDurumuIlerlet,
    konuSeviyeAyarla: konuSeviyeAyarla,
    konuTekrarEttim: konuTekrarEttim,
    konuTekrarTarihiAyarla: konuTekrarTarihiAyarla,
    kaynakEkle: kaynakEkle,
    katalogdanKaynakEkle: katalogdanKaynakEkle,
    kaynakGuncelle: kaynakGuncelle,
    kaynakIlerlemeAyarla: kaynakIlerlemeAyarla,
    kaynakSil: kaynakSil,
    denemeEkle: denemeEkle,
    denemeGuncelle: denemeGuncelle,
    denemeSil: denemeSil,
    hataEkle: hataEkle,
    hataGuncelle: hataGuncelle,
    hataSil: hataSil,
    hedefleriKaydet: hedefleriKaydet,
    gorevZamanlaAyarla: gorevZamanlaAyarla,
    rutinBlokEkle: rutinBlokEkle,
    rutinBlokGuncelle: rutinBlokGuncelle,
    rutinBlokSil: rutinBlokSil,
    rutinAyarlariKaydet: rutinAyarlariKaydet,
    gunlukKaydet: gunlukKaydet,
    otoYedekleriSil: otoYedekleriSil,
    oncekiniSil: oncekiniSil,
    tumVerileriSifirla: tumVerileriSifirla,
    tekrarlananRutinEkle: tekrarlananRutinEkle,
    tekrarlananRutinGuncelle: tekrarlananRutinGuncelle,
    tekrarlananRutinSil: tekrarlananRutinSil,
    gunlukRutinKaydet: gunlukRutinKaydet,
    gununRutinleri: gununRutinleri,
    yanlisGorevEkle: yanlisGorevEkle,
    yanlisGorevDurumGuncelle: yanlisGorevDurumGuncelle,
    yanlisGorevSil: yanlisGorevSil,
    yanlisPlaniAyarlariKaydet: yanlisPlaniAyarlariKaydet,
    haftaBasiTarihi: haftaBasiTarihi,
    haftalikPlanAl: haftalikPlanAl,
    haftalikOdevEkle: haftalikOdevEkle,
    haftalikOdevGuncelle: haftalikOdevGuncelle,
    haftalikOdevSil: haftalikOdevSil,
    haftalikOdevTamamla: haftalikOdevTamamla,
    haftalikKisitlamaEkle: haftalikKisitlamaEkle,
    haftalikKisitlamaSil: haftalikKisitlamaSil,
    haftalikTalimatKaydet: haftalikTalimatKaydet,
    haftalikTekrarEkle: haftalikTekrarEkle,
    haftalikTekrarSil: haftalikTekrarSil,
    haftalikTekrarDurum: haftalikTekrarDurum,
    haftalikProgramKaydet: haftalikProgramKaydet,
    haftalikProgramiUygula: haftalikProgramiUygula,
    yerelTarih: yerelTarih,
    saatDakika: saatDakika
  };

  kok.YKSDepo = api;
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})(typeof window !== 'undefined' ? window : globalThis);
