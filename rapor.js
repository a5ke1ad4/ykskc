/*
 * rapor.js — Günlük rapor, haftalık analiz ve kural tabanlı öneriler.
 * Yalnızca okur; veriyi değiştirmez.
 * Öneriler basit, açık kurallara dayanır (yapay zekâ değildir); her öneri nedenini söyler.
 */
(function (kok) {
  'use strict';

  var D = kok.YKSDepo || require('./depo.js');
  var A = kok.YKSAnaliz || require('./analiz.js');
  var P = kok.YKSPlanlayici || require('./planlayici.js');

  var GUN_ADLARI = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

  function yuzde(a, b) { return b ? Math.round((a / b) * 100) : 0; }

  function tamamlananlar(veri, tarih) {
    return veri.gorevler.filter(function (g) { return g.tamamlandi && P.yerelGun(g.tamamlanmaTarihi) === tarih; });
  }

  function topla(liste, alan) {
    return liste.reduce(function (t, x) { return t + x[alan]; }, 0);
  }

  function gunlukRapor(veri, tarih) {
    var tamam = tamamlananlar(veri, tarih);
    var planli = veri.gorevler.filter(function (g) { return g.tarih === tarih; });
    var konular = [];
    veri.dersler.forEach(function (d) {
      d.konular.forEach(function (k) { if (k.sonCalisma === tarih) { konular.push({ dersAdi: d.grup + ' ' + d.ad, konuAdi: k.ad, durum: k.durum }); } });
    });
    var hedefDk = P.etkinHedefDk(veri, tarih);
    var yapilanDk = topla(tamam, 'sureDk');
    return {
      tarih: tarih,
      tamamlananSayisi: tamam.length,
      tamamlananDk: yapilanDk,
      planliSayisi: planli.length,
      planliTamam: planli.filter(function (g) { return g.tamamlandi; }).length,
      planliDk: topla(planli, 'sureDk'),
      kalanGorevler: planli.filter(function (g) { return !g.tamamlandi; }),
      gecikenSayisi: veri.gorevler.filter(function (g) { return !g.tamamlandi && g.tarih && g.tarih < tarih; }).length,
      hedefDk: hedefDk,
      hedefOrani: hedefDk ? yuzde(yapilanDk, hedefDk) : null,
      hatalar: veri.hatalar.filter(function (h) { return h.tarih === tarih; }).length,
      denemeler: veri.denemeler.filter(function (d) { return d.tarih === tarih; }),
      konular: konular,
      degerlendirme: veri.gunluk[tarih] || null
    };
  }

  // Bugün dahil son 7 gün.
  function haftalikRapor(veri, bugun) {
    var gunler = [];
    for (var i = 6; i >= 0; i--) {
      var t = D.tarihEkle(bugun, -i);
      var tamam = tamamlananlar(veri, t);
      gunler.push({ tarih: t, gunAdi: GUN_ADLARI[D.tarihAyristir(t).haftaGunu], tamamlananSayisi: tamam.length, tamamlananDk: topla(tamam, 'sureDk'), hedefDk: P.etkinHedefDk(veri, t) });
    }
    var bas = gunler[0].tarih;
    var planli = veri.gorevler.filter(function (g) { return g.tarih && g.tarih >= bas && g.tarih <= bugun; });
    var hatalar = veri.hatalar.filter(function (h) { return h.tarih >= bas && h.tarih <= bugun; });
    var denemeler = veri.denemeler.filter(function (d) { return d.tarih >= bas && d.tarih <= bugun; });
    var son14 = D.tarihEkle(bugun, -13);
    var puanlar = gunler.map(function (g) { return veri.gunluk[g.tarih] ? veri.gunluk[g.tarih].puan : 0; }).filter(function (p) { return p > 0; });

    var sebepSay = {}, konuSay = {};
    hatalar.forEach(function (h) {
      sebepSay[h.sebep] = (sebepSay[h.sebep] || 0) + 1;
      if (h.konuAdi) { var a = h.konuAdi + ' (' + h.dersAdi + ')'; konuSay[a] = (konuSay[a] || 0) + 1; }
    });
    var sebepler = Object.keys(sebepSay).map(function (k) { return { id: k, ad: A.sebepAdi(k), sayi: sebepSay[k] }; }).sort(function (a, b) { return b.sayi - a.sayi; });
    var konular = Object.keys(konuSay).map(function (k) { return { ad: k, sayi: konuSay[k] }; }).sort(function (a, b) { return b.sayi - a.sayi; });

    var konuBitti = 0;
    veri.dersler.forEach(function (d) { d.konular.forEach(function (k) { if (k.durum === 'bitti' && k.sonCalisma >= bas && k.sonCalisma <= bugun) { konuBitti++; } }); });

    var enUzak = null;
    ['TYT', 'AYT'].forEach(function (s) {
      A.dersAnalizi(veri, s, 3).forEach(function (r) { if (r.fark !== null && r.fark < 0 && (!enUzak || r.fark < enUzak.fark)) { enUzak = { ad: s + ' ' + r.ad, fark: r.fark }; } });
    });

    var toplamDk = topla(gunler, 'tamamlananDk');
    var hedefToplam = topla(gunler, 'hedefDk');
    return {
      baslangic: bas, bitis: bugun, gunler: gunler,
      toplamDk: toplamDk, hedefToplamDk: hedefToplam, hedefOrani: hedefToplam ? yuzde(toplamDk, hedefToplam) : null,
      tamamlananSayisi: topla(gunler, 'tamamlananSayisi'),
      planliSayisi: planli.length, planliTamam: planli.filter(function (g) { return g.tamamlandi; }).length,
      tamamlanmaOrani: planli.length ? yuzde(planli.filter(function (g) { return g.tamamlandi; }).length, planli.length) : null,
      gecikenSayisi: veri.gorevler.filter(function (g) { return D.gorevGecikmisMi(g, bugun); }).length,
      tekrarGeciken: A.tekrarZamaniGelenler(veri, bugun).length,
      hataSayisi: hatalar.length, sebepler: sebepler, hataKonulari: konular,
      denemeSayisi: denemeler.length,
      son14DenemeVar: veri.denemeler.some(function (d) { return d.tarih >= son14 && d.tarih <= bugun; }),
      konuBitti: konuBitti, enUzakDers: enUzak,
      ortalamaPuan: puanlar.length ? Math.round((puanlar.reduce(function (a, b) { return a + b; }, 0) / puanlar.length) * 10) / 10 : null,
      puanGunSayisi: puanlar.length
    };
  }

  var SEBEP_ONERILERI = {
    'dikkatsizlik': 'Hatalarının çoğu dikkatsizlikten. Cevabı işaretlemeden önce soruyu ve işlemi bir kez daha kontrol etmeyi alışkanlık yap.',
    'islem': 'Hatalarının çoğu işlem hatası. Çözümü basamak basamak yaz, işlem yoğun sorularda zamanlı alıştırma ekle.',
    'konu-eksigi': 'Hatalarının çoğu konu eksiğinden. Aşağıdaki en çok hata yapılan konuları önce konu anlatımı ve örnek soruyla çalış.',
    'unuttum': 'Hatalarının çoğu unutmaktan. Tekrar tarihlerini aksatma; biten konuları kısa tekrarlarla canlı tut.',
    'okuma': 'Hatalarının çoğu soruyu yanlış okumaktan. Soru kökünü işaretleyerek okumayı dene.',
    'sure': 'Hatalarının çoğu süre yetmemesinden. Soruları süre tutarak çözdüğün bloklar ekle.',
    'kararsiz': 'Hatalarının çoğu şıklar arasında kararsızlıktan. Eleme yöntemini çalış ve emin olmadığın soruları işaretleyip sona bırak.',
    'riske-girmedim': 'Boş bıraktıklarının çoğu "riske girmedim" diye işaretli. Emin olmadıkların konulara öncelik ver.'
  };

  // Her öneri { baslik, metin } olarak döner; metin nedeni de söyler.
  function oneriler(veri, bugun, hafta) {
    var liste = [];
    function ekle(baslik, metin) { liste.push({ baslik: baslik, metin: metin }); }

    if (hafta.toplamDk === 0) {
      ekle('Süre kaydı yok', 'Son 7 günde süreli tamamlanmış görev yok. Görevlere süre ekleyip tamamladıkça çalışma grafiğin dolar.');
    } else if (hafta.hedefToplamDk > 0 && hafta.hedefOrani < 70) {
      ekle('Süre hedefinin altındasın', 'Haftalık hedefinin %' + hafta.hedefOrani + '\'ine ulaştın (' + A.sureMetni(hafta.toplamDk) + ' / ' + A.sureMetni(hafta.hedefToplamDk) + '). Hedef gerçekçi değilse Rutin sayfasından düşürebilir, değilse Plan sayfasından günlük programı kullanabilirsin.');
    } else if (hafta.hedefToplamDk > 0 && hafta.hedefOrani >= 100) {
      ekle('Süre hedefini tuttun', 'Haftalık çalışma süresi hedefinin %' + hafta.hedefOrani + '\'ine ulaştı. Bu düzeni koru.');
    }
    if (hafta.tamamlanmaOrani !== null && hafta.planliSayisi >= 5 && hafta.tamamlanmaOrani < 60) {
      ekle('Planın fazla yüklü olabilir', 'Son 7 günde tarihli ' + hafta.planliSayisi + ' görevden %' + hafta.tamamlanmaOrani + '\'i tamamlandı. Günlük görev sayısını azaltmayı veya süreleri gerçekçi girmeyi dene.');
    }
    if (hafta.gecikenSayisi >= 3) {
      ekle('Geciken görevler birikti', hafta.gecikenSayisi + ' geciken görev var. Plan sayfasındaki "Geciken görevleri yeniden planla" bölümünden yeni gün ve saat verebilirsin.');
    }
    if (hafta.tekrarGeciken >= 3) {
      ekle('Tekrarlar gecikiyor', hafta.tekrarGeciken + ' konunun tekrarı gecikti. Bugün 20-30 dakikalık bir tekrar bloğu ayır.');
    }
    if (hafta.hataSayisi >= 3 && hafta.sebepler.length && SEBEP_ONERILERI[hafta.sebepler[0].id]) {
      var s = hafta.sebepler[0];
      var metin = SEBEP_ONERILERI[s.id] + ' (' + hafta.hataSayisi + ' kayıttan ' + s.sayi + ' tanesi: ' + s.ad + ')';
      if (hafta.hataKonulari.length) { metin += ' En çok hata: ' + hafta.hataKonulari[0].ad + '.'; }
      ekle('En sık hata sebebi: ' + s.ad, metin);
    }
    if (hafta.enUzakDers) {
      ekle('Hedefe en uzak ders', hafta.enUzakDers.ad + ' derslerinde son 3 deneme ortalaman hedefin ' + A.netMetni(-hafta.enUzakDers.fark) + ' net altında. Önümüzdeki hafta bu derse ek çalışma bloğu ayırmayı düşün.');
    }
    if (!hafta.son14DenemeVar && veri.denemeler.length > 0) {
      ekle('Deneme zamanı', 'Son 14 günde deneme girmedin. Düzenli deneme, gelişimi ölçmenin en iyi yolu.');
    }
    if (hafta.ortalamaPuan !== null && hafta.puanGunSayisi >= 3 && hafta.ortalamaPuan <= 2.5) {
      ekle('Günlerin düşük puanlanmış', 'Değerlendirdiğin ' + hafta.puanGunSayisi + ' günün ortalaması ' + hafta.ortalamaPuan + '/5. Programı hafifletmeyi veya dinlenme saatlerini rutine eklemeyi düşünebilirsin.');
    }
    if (!liste.length) {
      ekle('Dikkat çeken bir sorun yok', 'Kayıtlarına göre bu hafta belirgin bir sorun görünmüyor. Aynı düzenle devam et.');
    }
    return liste;
  }

  var api = { gunlukRapor: gunlukRapor, haftalikRapor: haftalikRapor, oneriler: oneriler, GUN_ADLARI: GUN_ADLARI };
  kok.YKSRapor = api;
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})(typeof window !== 'undefined' ? window : globalThis);
