/*
 * planlayici.js — Rutine göre boş zamanı bulur, konuları önceliklendirir, günlük program önerir
 * ve geciken görevler için yeni düzen önerir.
 * Hesaplama kısmı yalnızca okur; veriyi sadece planiUygula ve yenidenPlanlaUygula değiştirir.
 * Tüm saatler "gün içindeki dakika" olarak hesaplanır (ör. 17:30 = 1050).
 */
(function (kok) {
  'use strict';

  var D = kok.YKSDepo || require('./depo.js');
  var A = kok.YKSAnaliz || require('./analiz.js');

  var EN_KUCUK_BLOK = 25;   // bundan kısa boşluğa konu önerisi konmaz
  var EN_KUCUK_ARALIK = 10; // bundan kısa boşluk yok sayılır

  // Ders adından deneme dersine eşleme (hedef farkı için)
  var DERS_ANAHTARI = {
    'TYT|Türkçe': 'tyt-turkce', 'TYT|Matematik': 'tyt-matematik', 'TYT|Geometri': 'tyt-matematik',
    'TYT|Fizik': 'tyt-fizik', 'TYT|Kimya': 'tyt-kimya', 'TYT|Biyoloji': 'tyt-biyoloji',
    'TYT|Tarih': 'tyt-tarih', 'TYT|Coğrafya': 'tyt-cografya', 'TYT|Felsefe': 'tyt-felsefe', 'TYT|Din Kültürü': 'tyt-din',
    'AYT|Matematik': 'ayt-matematik', 'AYT|Geometri': 'ayt-matematik', 'AYT|Fizik': 'ayt-fizik',
    'AYT|Kimya': 'ayt-kimya', 'AYT|Biyoloji': 'ayt-biyoloji'
  };

  function dersAnahtari(ders) { return DERS_ANAHTARI[ders.grup + '|' + ders.ad] || null; }

  // ---------- Aralık matematiği ----------

  function birlestir(araliklar) {
    var sirali = araliklar.filter(function (a) { return a[1] > a[0]; }).map(function (a) { return [a[0], a[1]]; })
      .sort(function (a, b) { return a[0] - b[0]; });
    var cikti = [];
    sirali.forEach(function (a) {
      var son = cikti[cikti.length - 1];
      if (son && a[0] <= son[1]) { son[1] = Math.max(son[1], a[1]); } else { cikti.push(a); }
    });
    return cikti;
  }

  function cikar(araliklar, engeller) {
    var kalan = birlestir(araliklar);
    birlestir(engeller).forEach(function (e) {
      var yeni = [];
      kalan.forEach(function (a) {
        if (e[1] <= a[0] || e[0] >= a[1]) { yeni.push(a); return; }
        if (e[0] > a[0]) { yeni.push([a[0], e[0]]); }
        if (e[1] < a[1]) { yeni.push([e[1], a[1]]); }
      });
      kalan = yeni;
    });
    return kalan;
  }

  function yukariYuvarla5(dk) { return Math.ceil(dk / 5) * 5; }

  function haftaGunu(tarih) { return D.tarihAyristir(tarih).haftaGunu; }

  function blokListesi(veri, tarih, tur) {
    var gun = haftaGunu(tarih);
    return veri.rutin.bloklar.filter(function (b) { return b.tur === tur && b.gunler.indexOf(gun) >= 0; })
      .map(function (b) { return { ad: b.ad, bas: A.dakikayaCevir(b.bas), bit: A.dakikayaCevir(b.bit) }; })
      .sort(function (a, b) { return a.bas - b.bas; });
  }

  function rutinVarMi(veri) {
    return veri.rutin.bloklar.some(function (b) { return b.tur === 'calisma'; });
  }

  function gorevSuresi(veri, g) { return g.sureDk || veri.rutin.varsayilanSureDk; }

  // O günün serbest çalışma aralıkları: çalışma pencereleri - meşgul bloklar - saatli görevler.
  // secenek.simdiDk verilirse (bugün için) geçmiş saatler çıkarılır.
  function bosAraliklar(veri, tarih, secenek) {
    secenek = secenek || {};
    var pencereler = blokListesi(veri, tarih, 'calisma').map(function (b) { return [b.bas, b.bit]; });
    var engeller = blokListesi(veri, tarih, 'mesgul').map(function (b) { return [b.bas, b.bit]; });
    veri.gorevler.forEach(function (g) {
      if (g.tamamlandi || g.tarih !== tarih || !g.saat) { return; }
      var bas = A.dakikayaCevir(g.saat);
      // Görevden sonra mola payı da ayrılır; böylece uygulanmış bir program yeniden hesaplandığında aynı kalır.
      engeller.push([bas, bas + gorevSuresi(veri, g) + veri.rutin.molaDk]);
    });
    var bos = cikar(pencereler, engeller);
    if (secenek.simdiDk !== null && secenek.simdiDk !== undefined) {
      var sinir = yukariYuvarla5(secenek.simdiDk);
      bos = cikar(bos, [[0, sinir]]);
    }
    return bos.filter(function (a) { return a[1] - a[0] >= EN_KUCUK_ARALIK; });
  }

  // İlk uyan boşluğa yerleştirir. Başlangıç dakikasını döndürür, sığmazsa null.
  function yerlestir(bos, sure, mola) {
    for (var i = 0; i < bos.length; i++) {
      if (bos[i][1] - bos[i][0] >= sure) {
        var bas = bos[i][0];
        bos[i][0] = bas + sure + mola;
        return bas;
      }
    }
    return null;
  }

  function oncelikSirasi(veri, liste) {
    return liste.slice().sort(function (a, b) {
      if (a.oncelik !== b.oncelik) { return b.oncelik - a.oncelik; }
      var ta = a.tarih || '9999-99-99', tb = b.tarih || '9999-99-99';
      if (ta !== tb) { return ta < tb ? -1 : 1; }
      return a.olusturma < b.olusturma ? -1 : (a.olusturma > b.olusturma ? 1 : 0);
    });
  }

  function etkinHedefDk(veri, tarih) {
    if (veri.rutin.gunlukHedefDk > 0) { return veri.rutin.gunlukHedefDk; }
    var t = 0;
    birlestir(blokListesi(veri, tarih, 'calisma').map(function (b) { return [b.bas, b.bit]; })).forEach(function (a) { t += a[1] - a[0]; });
    return t;
  }

  // ---------- Konu önceliği ----------

  // Her konuya bir öncelik puanı verir. Puan; durum, seviye, hata sayısı, tekrar vadesi
  // ve dersin hedef netten uzaklığına bakar. Nedenleri de metin olarak döndürür.
  function konuOnceligi(veri, bugun, secenek) {
    secenek = secenek || {};
    var fark = {};
    ['TYT', 'AYT'].forEach(function (sinav) {
      A.dersAnalizi(veri, sinav, 3).forEach(function (r) { if (r.fark !== null) { fark[r.anahtar] = r.fark; } });
    });
    var planli = {};
    veri.gorevler.forEach(function (g) {
      if (!g.tamamlandi && g.konuId && (!g.tarih || g.tarih >= bugun)) { planli[g.konuId] = true; }
    });
    var haric = {};
    (secenek.haric || []).forEach(function (id) { haric[id] = true; });

    var satirlar = [];
    var sira = 0;
    veri.dersler.forEach(function (d) {
      var anahtar = dersAnahtari(d);
      d.konular.forEach(function (k) {
        sira++;
        if (planli[k.id] || haric[k.id]) { return; }
        var puan = 0, nedenler = [];
        if (k.durum === 'baslanmadi') { puan += 2; nedenler.push('Henüz başlanmadı'); }
        else if (k.durum === 'calisiyor') { puan += 1.5; nedenler.push('Çalışmaya devam'); }
        if (k.seviye > 0 && k.seviye < 5) { puan += (5 - k.seviye) * 0.8; nedenler.push('Seviyen ' + k.seviye + '/5'); }
        var hata = A.konuHataSayisi(veri, k.id);
        if (hata) { puan += Math.min(hata, 5); nedenler.push(hata + ' hata kaydı'); }
        if (k.durum === 'bitti' && k.tekrarTarihi && k.tekrarTarihi <= bugun) {
          puan += 3 + Math.min(D.gunFarki(k.tekrarTarihi, bugun), 10) * 0.2;
          nedenler.push('Tekrar zamanı geldi');
        }
        if (puan <= 0) { return; }
        if (anahtar && fark[anahtar] !== undefined && fark[anahtar] < 0) {
          puan += Math.min(-fark[anahtar], 15) * 0.15;
          nedenler.push('Ders hedefe ' + A.netMetni(-fark[anahtar]) + ' net uzak');
        }
        if (puan < 1) { return; }
        satirlar.push({ dersId: d.id, konuId: k.id, dersAdi: d.grup + ' ' + d.ad, konuAdi: k.ad, puan: Math.round(puan * 100) / 100, sira: sira, nedenler: nedenler, neden: nedenler.join(', ') });
      });
    });
    // Eşit puanda müfredat (ders listesi) sırası korunur.
    satirlar.sort(function (a, b) { return b.puan - a.puan || a.sira - b.sira; });
    return secenek.limit ? satirlar.slice(0, secenek.limit) : satirlar;
  }

  // ---------- Günlük program ----------

  function yerelGun(iso) {
    var d = new Date(iso);
    return isNaN(d.getTime()) ? '' : D.yerelTarih(d);
  }

  function tamamlananDakika(veri, tarih) {
    var t = 0;
    veri.gorevler.forEach(function (g) { if (g.tamamlandi && yerelGun(g.tamamlanmaTarihi) === tarih) { t += g.sureDk; } });
    return t;
  }

  function gunlukPlan(veri, tarih, bugun, simdiDk) {
    var bugunMu = tarih === bugun;
    var mola = veri.rutin.molaDk, blok = veri.rutin.blokDk;
    var bos = bosAraliklar(veri, tarih, { simdiDk: bugunMu ? simdiDk : null });
    var serbestDk = 0;
    bos.forEach(function (a) { serbestDk += a[1] - a[0]; });

    var acik = veri.gorevler.filter(function (g) { return !g.tamamlandi; });
    var ogeler = [];

    var sabitDk = 0;
    acik.filter(function (g) { return g.tarih === tarih && g.saat; }).forEach(function (g) {
      var bas = A.dakikayaCevir(g.saat), sure = gorevSuresi(veri, g);
      sabitDk += sure;
      ogeler.push({ tur: 'sabit', gorevId: g.id, bas: bas, bit: bas + sure, baslik: g.baslik, oncelik: g.oncelik });
    });

    var bekleyen = oncelikSirasi(veri, acik.filter(function (g) {
      return !g.saat && g.tarih === tarih || (bugunMu && g.tarih && g.tarih < tarih);
    }));
    var sigmayanlar = [];
    var gorevDk = 0;
    bekleyen.forEach(function (g) {
      var sure = gorevSuresi(veri, g);
      var bas = yerlestir(bos, sure, mola);
      if (bas === null) { sigmayanlar.push({ gorevId: g.id, baslik: g.baslik, sure: sure }); return; }
      gorevDk += sure;
      ogeler.push({ tur: 'gorev', gorevId: g.id, bas: bas, bit: bas + sure, baslik: g.baslik, oncelik: g.oncelik, gecikti: !!(g.tarih && g.tarih < tarih) });
    });

    var hedefDk = etkinHedefDk(veri, tarih);
    var yapilanDk = tamamlananDakika(veri, tarih);
    var kalanHedef = veri.rutin.gunlukHedefDk > 0 ? Math.max(0, hedefDk - yapilanDk - sabitDk - gorevDk) : Infinity;

    // Kalan boşluğu önerilen konularla doldur
    var konular = konuOnceligi(veri, bugun);
    var oneriSayisi = 0, sonDers = '';
    bos.forEach(function (aralik) {
      while (konular.length) {
        var mevcut = aralik[1] - aralik[0];
        if (mevcut < EN_KUCUK_BLOK) { break; }
        var sure = Math.min(blok, mevcut, kalanHedef);
        if (sure < EN_KUCUK_BLOK) { return; }
        var secim = 0;
        for (var i = 0; i < konular.length; i++) { if (konular[i].dersId !== sonDers) { secim = i; break; } }
        var k = konular.splice(secim, 1)[0];
        ogeler.push({ tur: 'oneri', konuId: k.konuId, dersId: k.dersId, bas: aralik[0], bit: aralik[0] + sure, baslik: k.konuAdi, dersAdi: k.dersAdi, neden: k.neden });
        oneriSayisi++;
        sonDers = k.dersId;
        aralik[0] += sure + mola;
        if (kalanHedef !== Infinity) { kalanHedef -= sure; }
      }
    });

    ogeler.sort(function (a, b) { return a.bas - b.bas; });
    var planlananDk = 0;
    ogeler.forEach(function (o) { planlananDk += o.bit - o.bas; });

    return {
      tarih: tarih, ogeler: ogeler, sigmayanlar: sigmayanlar, mesgul: blokListesi(veri, tarih, 'mesgul'),
      hedefDk: hedefDk, yapilanDk: yapilanDk, planlananDk: planlananDk, serbestDk: serbestDk,
      pencereVar: blokListesi(veri, tarih, 'calisma').length > 0, oneriSayisi: oneriSayisi
    };
  }

  // Planı gerçek göreve çevirir: bekleyen görevlere saat verir, önerilen konular için yeni görev açar.
  // Önce kopya üzerinde dener; hata çıkarsa gerçek veriye hiç dokunmaz.
  function uygula(veri, plan) {
    var deneme = JSON.parse(JSON.stringify(veri));
    islemleriYap(deneme, plan);
    return islemleriYap(veri, plan);
  }

  function islemleriYap(veri, plan) {
    var guncellenen = 0, eklenen = 0;
    plan.ogeler.forEach(function (o) {
      if (o.tur === 'gorev') {
        D.gorevZamanlaAyarla(veri, o.gorevId, { tarih: plan.tarih, saat: A.saateCevir(o.bas), sureDk: o.bit - o.bas });
        guncellenen++;
      } else if (o.tur === 'oneri') {
        D.gorevEkle(veri, { baslik: 'Çalış: ' + o.baslik, tarih: plan.tarih, saat: A.saateCevir(o.bas), sureDk: o.bit - o.bas, dersId: o.dersId, konuId: o.konuId, notlar: o.neden });
        eklenen++;
      }
    });
    return { guncellenen: guncellenen, eklenen: eklenen };
  }

  // ---------- Geride kalınca yeniden planlama ----------

  function yenidenPlanla(veri, bugun, simdiDk, gunSayisi) {
    gunSayisi = gunSayisi || 7;
    var geciken = oncelikSirasi(veri, veri.gorevler.filter(function (g) { return D.gorevGecikmisMi(g, bugun); }));
    var sonuc = { gecikenSayisi: geciken.length, oneriler: [], sigmayanlar: [], hata: null, gunSayisi: gunSayisi };
    if (!geciken.length) { return sonuc; }
    if (!rutinVarMi(veri)) {
      sonuc.hata = 'Geciken görevleri yerleştirmek için önce Rutin sayfasında çalışma saatlerini tanımla.';
      return sonuc;
    }
    var mola = veri.rutin.molaDk;
    var gunler = [];
    for (var d = 0; d < gunSayisi; d++) {
      var tarih = D.tarihEkle(bugun, d);
      var bos = bosAraliklar(veri, tarih, { simdiDk: d === 0 ? simdiDk : null });
      // O güne zaten yazılmış saatsiz görevler de zaman harcar
      oncelikSirasi(veri, veri.gorevler.filter(function (g) { return !g.tamamlandi && g.tarih === tarih && !g.saat; }))
        .forEach(function (g) { yerlestir(bos, gorevSuresi(veri, g), mola); });
      gunler.push({ tarih: tarih, bos: bos });
    }
    geciken.forEach(function (g) {
      var sure = gorevSuresi(veri, g);
      for (var i = 0; i < gunler.length; i++) {
        var bas = yerlestir(gunler[i].bos, sure, mola);
        if (bas !== null) {
          sonuc.oneriler.push({ gorevId: g.id, baslik: g.baslik, eskiTarih: g.tarih, yeniTarih: gunler[i].tarih, yeniSaat: A.saateCevir(bas), sure: sure });
          return;
        }
      }
      sonuc.sigmayanlar.push({ gorevId: g.id, baslik: g.baslik, sure: sure });
    });
    return sonuc;
  }

  function yenidenPlanlaUygula(veri, sonuc) {
    var deneme = JSON.parse(JSON.stringify(veri));
    sonuc.oneriler.forEach(function (o) { D.gorevZamanlaAyarla(deneme, o.gorevId, { tarih: o.yeniTarih, saat: o.yeniSaat, sureDk: o.sure }); });
    sonuc.oneriler.forEach(function (o) { D.gorevZamanlaAyarla(veri, o.gorevId, { tarih: o.yeniTarih, saat: o.yeniSaat, sureDk: o.sure }); });
    return sonuc.oneriler.length;
  }

  // Haftalık program taslağı oluşturur (Rutinler, ödevler, yanlış görevleri ve müsaitlik kısıtlamalarını birleştirir)
  function haftalikPlanTaslagi(veri, haftaBasi, bugun) {
    var haftalikPlan = D.haftalikPlanAl(veri, haftaBasi);
    var odevler = haftalikPlan.odevler || [];
    var kisitlamalar = haftalikPlan.kisitlamalar || [];
    var program = [];
    var mola = veri.rutin.molaDk, blok = veri.rutin.blokDk;

    for (var i = 0; i < 7; i++) {
      var tarih = D.tarihEkle(haftaBasi, i);
      var haftaGunu = (i + 1) % 7;

      var gunKisit = kisitlamalar.filter(function (k) { return k.tarih === tarih; });
      var tumGunDolu = gunKisit.some(function (k) { return k.tumGun; });
      if (tumGunDolu) {
        program.push({
          id: D.yeniId(),
          tarih: tarih,
          bas: '',
          bit: '',
          baslik: 'Müsait değil (' + (gunKisit[0].aciklama || 'Kısıtlama') + ')',
          tur: 'kisitlama',
          detay: gunKisit[0].aciklama,
          tamamlandi: false
        });
        continue;
      }

      var bos = bosAraliklar(veri, tarih, { simdiDk: tarih === bugun ? 0 : null });
      var kisitEngeller = [];
      gunKisit.forEach(function (k) {
        if (k.bas && k.bit) { kisitEngeller.push([A.dakikayaCevir(k.bas), A.dakikayaCevir(k.bit)]); }
      });
      if (kisitEngeller.length) {
        bos = cikar(bos, kisitEngeller);
      }

      var rutinler = D.gununRutinleri(veri, tarih);
      rutinler.forEach(function (r) {
        var sure = r.hedefTur === 'sure' ? r.hedefDeger : Math.max(20, Math.round(r.hedefDeger * 1.5));
        var bas = yerlestir(bos, sure, mola);
        program.push({
          id: D.yeniId(),
          tarih: tarih,
          bas: bas !== null ? A.saateCevir(bas) : '',
          bit: bas !== null ? A.saateCevir(bas + sure) : '',
          baslik: r.ad + ' (' + (r.hedefTur === 'soru' ? r.hedefDeger + ' soru' : r.hedefDeger + ' dk') + ')',
          tur: 'rutin',
          detay: r.tur,
          tamamlandi: r.tamamlandi
        });
      });

      var gunlukOdevler = odevler.filter(function (o) {
        if (o.tamamlandi) { return false; }
        if (o.tercihEdilenGun !== null && o.tercihEdilenGun !== undefined) {
          return o.tercihEdilenGun === haftaGunu;
        }
        return o.sonTeslimTarihi === tarih;
      });
      gunlukOdevler.forEach(function (o) {
        var sure = o.hedefTur === 'sure' ? o.hedefDeger : Math.max(30, Math.round(o.hedefDeger * 1.5));
        var bas = yerlestir(bos, sure, mola);
        program.push({
          id: D.yeniId(),
          tarih: tarih,
          bas: bas !== null ? A.saateCevir(bas) : '',
          bit: bas !== null ? A.saateCevir(bas + sure) : '',
          baslik: 'Ödev: ' + o.ad,
          tur: 'odev',
          detay: (o.hedefTur === 'soru' ? o.hedefDeger + ' soru' : o.hedefDeger + ' dk') + (o.sonTeslimTarihi ? ', Son: ' + D.kisaTarih(o.sonTeslimTarihi, bugun) : ''),
          tamamlandi: o.tamamlandi
        });
      });

      var secilenTekrarlar = haftalikPlan.tekrarKonulari || [];
      secilenTekrarlar.forEach(function (tk, sIdx) {
        if (tk.tamamlandi) { return; }
        if ((sIdx % 7) === i) {
          var sure = tk.sureDk || 40;
          var bas = yerlestir(bos, sure, mola);
          program.push({
            id: D.yeniId(),
            tarih: tarih,
            bas: bas !== null ? A.saateCevir(bas) : '',
            bit: bas !== null ? A.saateCevir(bas + sure) : '',
            baslik: 'Tekrar: ' + tk.konuAdi + (tk.dersAdi ? ' (' + tk.dersAdi + ')' : ''),
            tur: 'tekrar',
            detay: 'Kullanıcı seçimi haftalık tekrar' + (tk.hedefSoru ? ' (' + tk.hedefSoru + ' soru)' : ''),
            tamamlandi: false
          });
        }
      });

      var yanlislar = (veri.yanlisGorevleri || []).filter(function (yg) {
        return yg.durum === 'onaylandi' && (yg.tarih === tarih || (!yg.tarih && i < 3));
      });
      yanlislar.forEach(function (yg) {
        var sure = yg.sureDk || 40;
        var bas = yerlestir(bos, sure, mola);
        program.push({
          id: D.yeniId(),
          tarih: tarih,
          bas: bas !== null ? A.saateCevir(bas) : '',
          bit: bas !== null ? A.saateCevir(bas + sure) : '',
          baslik: yg.baslik,
          tur: 'yanlis',
          detay: yg.sebep || '',
          tamamlandi: yg.durum === 'calisildi'
        });
      });

      var konular = konuOnceligi(veri, bugun, { limit: 3 });
      bos.forEach(function (aralik) {
        while (konular.length) {
          var mevcut = aralik[1] - aralik[0];
          if (mevcut < EN_KUCUK_BLOK) { break; }
          var sure = Math.min(blok, mevcut);
          var k = konular.shift();
          program.push({
            id: D.yeniId(),
            tarih: tarih,
            bas: A.saateCevir(aralik[0]),
            bit: A.saateCevir(aralik[0] + sure),
            baslik: 'Konu: ' + k.konuAdi + ' (' + k.dersAdi + ')',
            tur: 'oneri',
            detay: k.neden,
            tamamlandi: false
          });
          aralik[0] += sure + mola;
        }
      });
    }

    program.sort(function (a, b) {
      if (a.tarih !== b.tarih) { return a.tarih < b.tarih ? -1 : 1; }
      if (a.bas !== b.bas) {
        if (!a.bas) { return 1; }
        if (!b.bas) { return -1; }
        return a.bas < b.bas ? -1 : 1;
      }
      return 0;
    });

    return { gunler: program };
  }

  var api = {
    dersAnahtari: dersAnahtari,
    birlestir: birlestir,
    cikar: cikar,
    blokListesi: blokListesi,
    rutinVarMi: rutinVarMi,
    bosAraliklar: bosAraliklar,
    etkinHedefDk: etkinHedefDk,
    tamamlananDakika: tamamlananDakika,
    konuOnceligi: konuOnceligi,
    gunlukPlan: gunlukPlan,
    planiUygula: uygula,
    yenidenPlanla: yenidenPlanla,
    yenidenPlanlaUygula: yenidenPlanlaUygula,
    haftalikPlanTaslagi: haftalikPlanTaslagi,
    yerelGun: yerelGun
  };

  kok.YKSPlanlayici = api;
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})(typeof window !== 'undefined' ? window : globalThis);
