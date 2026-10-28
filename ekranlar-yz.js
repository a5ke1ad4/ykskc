/*
 * ekranlar-yz.js — Koç ekranı (yapay zekâ ile program hazırlama).
 * Model yalnızca öneri üretir; öneriler doğrulanır, önizlenir ve kullanıcı onaylayınca uygulanır.
 */
(function () {
  'use strict';

  var U = window.YKSArayuz;
  var D = window.YKSDepo;
  var A = window.YKSAnaliz;
  var Z = window.YKSYZ;
  var el = U.el, alan = U.alan, islem = U.islem, durum = U.durum;

  durum.koc = {
    yuklendi: false,
    mesajlar: [],
    girdi: '',
    bekliyor: false,
    analizBekliyor: false,
    ayarAcik: false,
    istem: '',
    yapistirilan: '',
    istekBaslangic: 0,
    gecenSaniye: 0,
    durumAnaliziMetni: '',
    durumAnaliziAcik: false
  };
  var koc = durum.koc;

  var beklemeSayaci = null;
  function zamanlayiciyiBaslat() {
    koc.istekBaslangic = Date.now();
    koc.gecenSaniye = 0;
    if (beklemeSayaci) { clearInterval(beklemeSayaci); }
    beklemeSayaci = setInterval(function () {
      koc.gecenSaniye = Math.max(1, Math.floor((Date.now() - koc.istekBaslangic) / 1000));
      var yazi = document.getElementById('koc-bekleme-yazisi');
      if (yazi) {
        yazi.textContent = 'Düşünüyor... (' + koc.gecenSaniye + ' sn geçti)';
      }
    }, 1000);
  }

  function zamanlayiciyiDurdur() {
    if (beklemeSayaci) {
      clearInterval(beklemeSayaci);
      beklemeSayaci = null;
    }
  }

  function yeniMesajId() {
    return 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }

  var HIZLI_ISTEKLER = [
    'Önümüzdeki günler için çalışma programı hazırla.',
    'Geciken görevlerimi boş saatlerime yeniden planla.',
    'Bu hafta zayıf konularıma ağırlık ver.'
  ];

  function giris(ozellikler, deger) {
    var e = el('input', ozellikler);
    if (deger !== undefined && deger !== null) { e.value = deger; }
    return e;
  }

  function simdiDakika() { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }

  function mesajlariYukle() {
    if (!koc.yuklendi) {
      koc.mesajlar = Z.sohbetOku();
      koc.mesajlar.forEach(function (m) { if (!m.id) { m.id = yeniMesajId(); } });
      koc.yuklendi = true;
    }
  }
  function mesajlariKaydet() {
    try { Z.sohbetKaydet(koc.mesajlar); } catch (h) { U.uyariGoster('Sohbet kaydedilemedi: ' + h.message, 'uyari', 'koc'); }
  }

  // ---------- Öneri işleme ----------

  function yanitiIsle(metin, harita) {
    var ayr = Z.yanitiAyristir(metin);
    if (ayr.hata) {
      koc.mesajlar.push({
        id: yeniMesajId(),
        rol: 'asistan',
        metin: 'Yanıtı anlayamadım: ' + ayr.hata + (ayr.ham ? '\n\nModelin yanıtı:\n' + ayr.ham.slice(0, 600) : ''),
        hata: true
      });
      return;
    }
    var dogru = Z.oneriyiDogrula(durum.veri, ayr, harita, durum.bugun, simdiDakika());
    var oneriVar = dogru.gorevler.length || dogru.tasi.length || dogru.reddedilen.length;
    var m = {
      id: yeniMesajId(),
      rol: 'asistan',
      metin: ayr.mesaj || (oneriVar ? 'Önerilerim aşağıda.' : '(Boş yanıt)')
    };
    if (oneriVar) {
      m.oneri = { ham: { gorevler: ayr.gorevler, tasi: ayr.tasi }, harita: harita, dogrulanmis: dogru, uygulandi: false };
    }
    koc.mesajlar.push(m);
  }

  function onerileriUygula(m) {
    var taze = Z.oneriyiDogrula(durum.veri, m.oneri.ham, m.oneri.harita, durum.bugun, simdiDakika());
    if (!taze.gorevler.length && !taze.tasi.length) {
      U.uyariGoster('Bu öneriler artık uygulanamıyor (saatler geçmiş veya dolmuş olabilir). Yeniden iste.', 'hata', 'koc');
      return;
    }
    var eksik = (m.oneri.dogrulanmis.gorevler.length + m.oneri.dogrulanmis.tasi.length) - (taze.gorevler.length + taze.tasi.length);
    var sonuc = null;
    var tamam = islem(function () {
      D.oncekiniSakla(durum.veri);               // beğenmezsen Yedek > "Önceki verilere dön"
      sonuc = Z.oneriyiUygula(durum.veri, taze);
    });
    if (tamam) {
      m.oneri.uygulandi = true;
      m.oneri.ozet = sonuc.eklenen + ' görev eklendi, ' + sonuc.tasinan + ' görev taşındı.';
      mesajlariKaydet();
      U.ciz();
      U.uyariGoster(m.oneri.ozet + (eksik > 0 ? ' (' + eksik + ' öneri artık geçerli olmadığı için atlandı.)' : '') + ' Beğenmezsen Yedek sayfasında "Önceki verilere dön" ile geri alabilirsin.', 'bilgi', 'koc');
    }
  }

  // ---------- Gönderme ----------

  function gonder() {
    var metin = koc.girdi.trim();
    if (!metin || koc.bekliyor) { return; }
    var ayar = Z.ayarOku();
    if (!ayar.model) {
      koc.ayarAcik = true;
      U.uyariGoster('Önce bağlantı ayarlarında model adını gir.', 'uyari', 'koc');
      U.ciz();
      return;
    }
    U.uyariSil('koc');
    var istem = Z.istemHazirla(durum.veri, metin, koc.mesajlar, ayar, durum.bugun, simdiDakika());
    koc.mesajlar.push({ id: yeniMesajId(), rol: 'kullanici', metin: metin });
    koc.girdi = '';
    koc.bekliyor = true;
    zamanlayiciyiBaslat();
    mesajlariKaydet();
    U.ciz();
    var harita = { konu: istem.baglam.konuHarita, gorev: istem.baglam.gorevHarita };
    Z.apiyeGonder(ayar, istem.mesajlar).then(function (yanit) {
      yanitiIsle(yanit, harita);
    }, function (hata) {
      koc.mesajlar.push({ id: yeniMesajId(), rol: 'sistem', metin: hata.message, hata: true });
    }).then(function () {
      koc.bekliyor = false;
      zamanlayiciyiDurdur();
      mesajlariKaydet();
      U.ciz();
    });
  }

  // ---------- Ekran parçaları ----------

  function oneriKutusu(m) {
    var o = m.oneri, d = o.dogrulanmis;
    var kap = el('div', { sinif: 'oneri-kutusu', 'data-oneri': o.uygulandi ? 'uygulandi' : 'bekliyor' });
    if (d.gorevler.length || d.tasi.length) {
      kap.appendChild(el('strong', { metin: 'Önerilen değişiklikler' }));
      var liste = el('ul', { sinif: 'oneri-maddeleri' });
      d.gorevler.forEach(function (g) {
        liste.appendChild(el('li', { 'data-tur': 'yeni' }, [
          el('span', { sinif: 'program-ad', metin: D.tarihEtiketi(g.tarih, durum.bugun) + ' ' + g.saat + ' (' + A.sureMetni(g.sureDk) + '): ' + g.baslik }),
          g.neden ? el('div', { sinif: 'alt-yazi', metin: g.neden }) : null
        ]));
      });
      d.tasi.forEach(function (t) {
        liste.appendChild(el('li', { 'data-tur': 'tasi' }, [
          el('span', { sinif: 'program-ad', metin: 'Taşı: ' + t.baslik }),
          el('div', { sinif: 'alt-yazi', metin: (t.eskiTarih ? D.kisaTarih(t.eskiTarih, durum.bugun) + (t.eskiSaat ? ' ' + t.eskiSaat : '') : 'tarihsiz') + ' yerine ' + D.tarihEtiketi(t.tarih, durum.bugun) + (t.saat ? ' ' + t.saat : '') })
        ]));
      });
      kap.appendChild(liste);
    }
    if (d.reddedilen.length) {
      kap.appendChild(el('div', { sinif: 'oneri-reddedilen', 'data-bolum': 'reddedilen' }, [
        el('strong', { metin: 'Uygulanamayan öneriler (otomatik elendi):' }),
        el('ul', {}, d.reddedilen.map(function (r) { return el('li', { metin: r.baslik + ': ' + r.neden }); }))
      ]));
    }
    if (d.uyarilar.length) {
      kap.appendChild(el('div', { sinif: 'alt-yazi', 'data-bolum': 'uyarilar', metin: 'Uyarı: ' + d.uyarilar.join(' ') }));
    }
    if (o.uygulandi) {
      kap.appendChild(el('p', { sinif: 'uygulandi-yazisi', metin: 'Uygulandı. ' + (o.ozet || '') }));
    } else if (d.gorevler.length || d.tasi.length) {
      kap.appendChild(el('button', { type: 'button', sinif: 'birincil', 'data-uygula': '1', metin: 'Önerileri uygula (' + (d.gorevler.length + d.tasi.length) + ')', onclick: function () { onerileriUygula(m); } }));
    }
    return kap;
  }

  function mesajBalonu(m) {
    var sinif = 'balon ' + (m.rol === 'kullanici' ? 'balon-kullanici' : (m.hata ? 'balon-hata' : 'balon-asistan'));
    var silDugme = el('button', {
      type: 'button',
      sinif: 'metin-dugme sil balon-sil-dugme',
      title: 'Bu mesajı sil',
      'aria-label': 'Bu mesajı sil',
      metin: '×',
      onclick: function () {
        if (window.confirm('Bu mesajı silmek istiyor musunuz?\n(Çalışma verilerinize veya görevlerinize dokunulmaz.)')) {
          if (m.id) { Z.sohbetMesajiSil(m.id); }
          koc.mesajlar = koc.mesajlar.filter(function (x) { return x !== m && x.id !== m.id; });
          mesajlariKaydet();
          U.ciz();
        }
      }
    });

    var baslikSatiri = el('div', { sinif: 'balon-ust-satir' }, [
      el('span', { sinif: 'balon-rol', metin: m.rol === 'kullanici' ? 'Sen' : (m.hata ? 'Sistem' : 'Koç') }),
      silDugme
    ]);

    var cocuklar = [baslikSatiri, el('div', { sinif: 'balon-metin', metin: m.metin })];
    if (m.oneri) { cocuklar.push(oneriKutusu(m)); }
    return el('li', { sinif: sinif, 'data-rol': m.rol, 'data-mesaj-id': m.id || '' }, cocuklar);
  }

  function ayarBolumu() {
    var a = Z.ayarOku();
    var adres = giris({ type: 'text', 'aria-label': 'API adresi', placeholder: Z.VARSAYILAN_ADRES, spellcheck: 'false' }, a.adres);
    var model = giris({ type: 'text', 'aria-label': 'Model adı', placeholder: 'Ollama\'da yüklü model adı', spellcheck: 'false' }, a.model);
    var anahtar = giris({ type: 'password', 'aria-label': 'API anahtarı', placeholder: 'Ollama için boş bırak', autocomplete: 'off' }, a.anahtar);
    var jsonModu = el('input', { type: 'checkbox', 'aria-label': 'JSON modu' }); jsonModu.checked = a.jsonModu;
    var gun = giris({ type: 'number', min: '1', max: '10', step: '1', 'aria-label': 'Plan gün sayısı' }, String(a.gunSayisi));
    var zamanAsimi = giris({ type: 'number', min: '10', max: '600', step: '5', inputmode: 'numeric', 'aria-label': 'Zaman aşımı (saniye)' }, String(a.zamanAsimiSn || 180));
    var notlar = el('input', { type: 'checkbox', 'aria-label': 'Gün notlarını da gönder' }); notlar.checked = a.notlariGonder;
    var gizlilik = el('p', { sinif: 'gizlilik-notu', 'data-bolum': 'gizlilik' });

    function gizlilikGuncelle() {
      if (Z.yerelAdresMi(adres.value.trim())) {
        gizlilik.textContent = 'Bu adres bu bilgisayarda. Gönderilen özet bilgisayarından çıkmaz.';
        gizlilik.className = 'gizlilik-notu';
      } else {
        gizlilik.textContent = 'Bu adres bu bilgisayarın dışında. Özet verilerin (hedeflerin, boş saatlerin, zayıf konuların, görev başlıkların) o servise gönderilir. Servisin veri kullanımı ve yaş/kullanım şartlarını kontrol et; anahtarını kimseyle paylaşma.';
        gizlilik.className = 'gizlilik-notu uyari-metni';
      }
    }
    adres.addEventListener('input', gizlilikGuncelle);
    gizlilikGuncelle();

    function formDegerleri() {
      return {
        adres: adres.value,
        model: model.value,
        anahtar: anahtar.value,
        jsonModu: jsonModu.checked,
        gunSayisi: gun.value,
        zamanAsimiSn: zamanAsimi.value,
        notlariGonder: notlar.checked
      };
    }

    var deneSonuc = el('p', { sinif: 'alt-yazi', id: 'yz-dene-sonuc', role: 'status' });
    var dene = el('button', {
      type: 'button', sinif: 'ikincil', id: 'yz-dene', metin: 'Bağlantıyı dene',
      onclick: function () {
        var g = formDegerleri();
        var ayar = { adres: g.adres.trim().replace(/\/+$/, ''), model: g.model.trim(), anahtar: g.anahtar.trim(), jsonModu: g.jsonModu, zamanAsimiSn: Number(g.zamanAsimiSn) || 180 };
        if (!ayar.adres || !ayar.model) { deneSonuc.textContent = 'Önce adres ve model adını gir.'; return; }
        deneSonuc.textContent = 'Deneniyor...';
        var t0 = Date.now();
        Z.apiyeGonder(ayar, [{ role: 'user', content: 'Yalnızca {"mesaj":"merhaba"} biçiminde JSON döndür.' }], { zamanAsimiMs: 90000 }).then(function (y) {
          deneSonuc.textContent = 'Bağlantı çalışıyor (' + Math.max(1, Math.round((Date.now() - t0) / 1000)) + ' sn). Modelin yanıtı: ' + y.slice(0, 120);
        }, function (h) { deneSonuc.textContent = 'Bağlantı kurulamadı: ' + h.message; });
      }
    });

    var onizleme = el('pre', { sinif: 'baglam-onizleme', 'data-bolum': 'onizleme' });
    var onizlemeKap = el('details', { sinif: 'yz-detay' }, [
      el('summary', { metin: 'Modele ne gönderiliyor?' }),
      el('p', { sinif: 'alt-yazi', metin: 'Her istekte yalnızca aşağıdaki özet ve yazdığın mesaj gönderilir. Tüm verilerin gönderilmez.' }),
      onizleme
    ]);
    onizlemeKap.addEventListener('toggle', function () {
      if (onizlemeKap.open) {
        var b = Z.baglamOlustur(durum.veri, durum.bugun, simdiDakika(), { gunSayisi: Number(gun.value) || 5, notlariGonder: notlar.checked });
        onizleme.textContent = b.metin;
      }
    });

    var kaydet = el('button', { type: 'submit', sinif: 'birincil', metin: 'Ayarları kaydet' });
    var sil = el('button', {
      type: 'button', sinif: 'metin-dugme sil', id: 'yz-ayar-sil', metin: 'Ayarları ve anahtarı sil',
      onclick: function () { if (window.confirm('Kayıtlı bağlantı ayarları ve API anahtarı silinsin mi?')) { Z.ayarSil(); koc.ayarAcik = true; U.ciz(); U.uyariGoster('Ayarlar silindi.', 'bilgi', 'koc'); } }
    });

    var yardim = el('details', { sinif: 'yz-detay' }, [
      el('summary', { metin: 'Ollama ile kurulum (ücretsiz, hesap gerekmez)' }),
      el('ol', { sinif: 'kurulum-adimlari' }, [
        el('li', { metin: 'ollama.com adresinden Windows sürümünü indirip kur.' }),
        el('li', { metin: 'Komut İstemi\'ni (cmd) aç ve bir model indir: ollama pull MODEL_ADI. Hangi modelin bilgisayarına uygun olduğunu birlikte seçeriz; indirdikten sonra "ollama list" komutu yüklü modellerin adını gösterir.' }),
        el('li', { metin: 'Ollama arka planda çalışırken yukarıya adres olarak ' + Z.VARSAYILAN_ADRES + ' yaz, model adını gir, "Bağlantıyı dene" de.' }),
        el('li', { metin: 'Küçük modeller uzun metinde zorlanır. Ollama varsayılan olarak kısa bir bağlam kullanır; plan çıktıları eksik veya tutarsız gelirse ortam değişkeni OLLAMA_CONTEXT_LENGTH=8192 ayarlayıp Ollama\'yı yeniden başlat.' }),
        el('li', { metin: 'Başka bir OpenAI uyumlu servis kullanmak istersen adresi, model adını ve anahtarı o servisin bilgileriyle değiştir.' })
      ])
    ]);

    var form = el('form', {
      sinif: 'kayit-formu', 'data-form': 'yz-ayar',
      onsubmit: function (olay) {
        olay.preventDefault();
        try {
          Z.ayarKaydet(formDegerleri());
          U.uyariGoster('Ayarlar kaydedildi.', 'bilgi', 'koc');
          koc.ayarAcik = false;
          U.ciz();
        } catch (h) { U.uyariGoster(h.message, 'hata', 'koc'); }
      }
    }, [
      el('div', { sinif: 'form-satir' }, [alan('API adresi', adres, 'genis'), alan('Model adı', model)]),
      el('div', { sinif: 'form-satir' }, [alan('API anahtarı (varsa)', anahtar), alan('Plan gün sayısı', gun, 'dar'), alan('Zaman aşımı (sn)', zamanAsimi, 'dar')]),
      el('label', { sinif: 'onay-satiri onay-normal' }, [jsonModu, el('span', { metin: 'JSON modu (çoğu sunucuda yanıtı düzenli tutar; sunucu desteklemezse otomatik kapanır)' })]),
      el('label', { sinif: 'onay-satiri onay-normal' }, [notlar, el('span', { metin: 'Gün sonu notlarımı ve odak yazılarımı da gönder (kapalıyken notların gönderilmez)' })]),
      gizlilik,
      el('div', { sinif: 'form-satir' }, [kaydet, dene, sil]),
      deneSonuc
    ]);

    var kok = el('details', { sinif: 'yz-detay yz-ayarlar', id: 'yz-ayarlar', open: koc.ayarAcik || !a.model }, [
      el('summary', { metin: 'Bağlantı ayarları' + (a.model ? ' (hazır: ' + a.model + ')' : ' (henüz ayarlanmadı)') }),
      form, onizlemeKap, yardim
    ]);
    kok.addEventListener('toggle', function () { koc.ayarAcik = kok.open; });
    return kok;
  }

  function durumAnaliziBolumu() {
    var kap = el('details', { sinif: 'yz-detay durum-analizi-detay', open: koc.durumAnaliziAcik }, [
      el('summary', { metin: 'YKS Durum Analizi (Gerçekçi & Temkinli AI Değerlendirmesi)' })
    ]);
    kap.addEventListener('toggle', function () { koc.durumAnaliziAcik = kap.open; });

    var ozet = A.kapsamliDurumOzeti(durum.veri, durum.bugun);
    var istatistikKartlari = el('div', { sinif: 'durum-istatistik-grid' }, [
      el('div', { sinif: 'istatistik-mini-kart' }, [
        el('span', { sinif: 'mini-kart-baslik', metin: 'Deneme Verisi' }),
        el('strong', { metin: (ozet.denemeOzet.tytOrt !== null ? 'TYT ' + ozet.denemeOzet.tytOrt + ' net' : 'TYT yok') + ' • ' + (ozet.denemeOzet.aytOrt !== null ? 'AYT ' + ozet.denemeOzet.aytOrt + ' net' : 'AYT yok') }),
        el('span', { sinif: 'alt-yazi', metin: ozet.denemeOzet.toplamDeneme + ' deneme kayıtlı' })
      ]),
      el('div', { sinif: 'istatistik-mini-kart' }, [
        el('span', { sinif: 'mini-kart-baslik', metin: 'Müfredat Tamamlama' }),
        el('strong', { metin: '%' + ozet.konuIlerleme.yuzde + ' tamamlandı' }),
        el('span', { sinif: 'alt-yazi', metin: ozet.konuIlerleme.biten + ' / ' + ozet.konuIlerleme.toplam + ' konu bitti' })
      ]),
      el('div', { sinif: 'istatistik-mini-kart' }, [
        el('span', { sinif: 'mini-kart-baslik', metin: 'Kronik Hata / Zayıf Konular' }),
        el('strong', { metin: ozet.yanlisKonulari.length + ' hata odağı' }),
        el('span', { sinif: 'alt-yazi', metin: ozet.zayifKonular.length + ' konu seviyesi zayıf' })
      ]),
      el('div', { sinif: 'istatistik-mini-kart' }, [
        el('span', { sinif: 'mini-kart-baslik', metin: 'Son 14 Günlük Çalışma' }),
        el('strong', { metin: ozet.calismaGecmisi.toplamSaat + ' saat' }),
        el('span', { sinif: 'alt-yazi', metin: ozet.calismaGecmisi.tamamlananGorev + ' görev tamamlandı' })
      ])
    ]);

    var veriUyari = null;
    if (!ozet.veriYeterliligi.yeterli) {
      veriUyari = el('div', { sinif: 'hatirlatma veri-uyari-kutu' }, [
        el('strong', { metin: 'Veri Yetersizliği Uyarısı: ' }),
        el('span', { metin: ozet.veriYeterliligi.aciklama + ' Bu nedenle analiz ve başarı olasılıkları temkinli tutulacak ve yüksek belirsizlik içerecektir.' })
      ]);
    }

    var analizDugmeleri = el('div', { sinif: 'form-satir' }, [
      el('button', {
        type: 'button', sinif: 'birincil', id: 'durum-analizi-yap',
        metin: koc.analizBekliyor ? 'Analiz Yapılıyor...' : 'YKS Durum Analizi Yap',
        disabled: (koc.analizBekliyor || koc.bekliyor) ? 'disabled' : null,
        onclick: function () {
          var ayar = Z.ayarOku();
          if (!ayar.model) {
            koc.ayarAcik = true;
            U.uyariGoster('Durum analizi için önce bağlantı ayarlarında model adını gir.', 'uyari', 'koc');
            U.ciz();
            return;
          }
          var istem = Z.durumAnaliziIstemiHazirla(durum.veri, durum.bugun, ayar);
          koc.analizBekliyor = true;
          koc.durumAnaliziAcik = true;
          zamanlayiciyiBaslat();
          U.ciz();
          Z.apiyeGonder(ayar, istem.mesajlar).then(function (yanit) {
            koc.durumAnaliziMetni = yanit;
          }, function (hata) {
            koc.durumAnaliziMetni = 'Analiz tamamlanamadı: ' + hata.message;
          }).then(function () {
            koc.analizBekliyor = false;
            zamanlayiciyiDurdur();
            U.ciz();
          });
        }
      }),
      el('button', {
        type: 'button', sinif: 'ikincil', metin: 'Analiz İstemini Göster (Elle Mod)',
        onclick: function () {
          var istem = Z.durumAnaliziIstemiHazirla(durum.veri, durum.bugun, Z.ayarOku());
          koc.istem = istem.kopyalaMetni;
          koc.durumAnaliziAcik = true;
          U.ciz();
          U.uyariGoster('Durum analizi istemi kopyalama kutusuna hazırlandı.', 'bilgi', 'koc');
        }
      })
    ]);

    kap.appendChild(istatistikKartlari);
    if (veriUyari) { kap.appendChild(veriUyari); }
    kap.appendChild(analizDugmeleri);

    if (koc.durumAnaliziMetni) {
      kap.appendChild(el('div', { sinif: 'durum-analizi-sonuc-kart' }, [
        el('div', { sinif: 'durum-kart-ust' }, [
          el('h3', { metin: 'AI YKS Durum Değerlendirmesi' }),
          el('button', {
            type: 'button', sinif: 'metin-dugme', metin: 'Metni Temizle',
            onclick: function () { koc.durumAnaliziMetni = ''; U.ciz(); }
          })
        ]),
        el('div', { sinif: 'durum-analizi-metin', metin: koc.durumAnaliziMetni })
      ]));
    }
    return kap;
  }

  function elleModBolumu() {
    var istemAlani = el('textarea', { rows: '8', readonly: 'readonly', 'aria-label': 'Yapay zekâya yapıştırılacak istem', id: 'yz-istem' });
    istemAlani.value = koc.istem;
    var yapistir = el('textarea', { rows: '6', 'aria-label': 'Yapay zekânın yanıtı', id: 'yz-yapistirilan', placeholder: 'Yapay zekânın verdiği JSON yanıtını buraya yapıştır' });
    yapistir.value = koc.yapistirilan;
    yapistir.addEventListener('input', function () { koc.yapistirilan = yapistir.value; });
    var hazirla = el('button', {
      type: 'button', sinif: 'ikincil', id: 'yz-istem-hazirla', metin: 'İstemi hazırla',
      onclick: function () {
        var istek = koc.girdi.trim() || 'Önümüzdeki günler için çalışma programı hazırla.';
        var i = Z.istemHazirla(durum.veri, istek, koc.mesajlar, Z.ayarOku(), durum.bugun, simdiDakika());
        koc.istem = i.kopyalaMetni;
        koc.elleHarita = { konu: i.baglam.konuHarita, gorev: i.baglam.gorevHarita };
        koc.elleIstek = istek;
        U.ciz();
      }
    });
    var kopyala = el('button', {
      type: 'button', sinif: 'ikincil', id: 'yz-kopyala', metin: 'Kopyala',
      onclick: function () {
        if (!koc.istem) { U.uyariGoster('Önce "İstemi hazırla" düğmesine bas.', 'uyari', 'koc'); return; }
        istemAlani.removeAttribute('readonly'); istemAlani.select();
        var tamam = false;
        try { tamam = document.execCommand('copy'); } catch (h) { tamam = false; }
        istemAlani.setAttribute('readonly', 'readonly');
        if (!tamam && navigator.clipboard) { navigator.clipboard.writeText(koc.istem).then(function () { U.uyariGoster('İstem kopyalandı.', 'bilgi', 'koc'); }, function () { U.uyariGoster('Kopyalanamadı; kutudaki metni elle seçip kopyala.', 'uyari', 'koc'); }); return; }
        U.uyariGoster(tamam ? 'İstem kopyalandı.' : 'Kopyalanamadı; kutudaki metni elle seçip kopyala.', tamam ? 'bilgi' : 'uyari', 'koc');
      }
    });
    var isle = el('button', {
      type: 'button', sinif: 'birincil', id: 'yz-yaniti-isle', metin: 'Yanıtı işle',
      onclick: function () {
        if (!koc.yapistirilan.trim()) { U.uyariGoster('Önce yapay zekânın yanıtını yapıştır.', 'uyari', 'koc'); return; }
        if (!koc.elleHarita) { U.uyariGoster('Önce "İstemi hazırla" düğmesine basıp o istemi kullanmalısın (kodlar ona göre eşleşir).', 'uyari', 'koc'); return; }
        koc.mesajlar.push({ id: yeniMesajId(), rol: 'kullanici', metin: koc.elleIstek || '(kopyala-yapıştır isteği)' });
        yanitiIsle(koc.yapistirilan, koc.elleHarita);
        koc.yapistirilan = ''; koc.istem = ''; koc.elleHarita = null; koc.girdi = '';
        mesajlariKaydet();
        U.ciz();
      }
    });
    return el('details', { sinif: 'yz-detay', id: 'yz-elle', open: !!koc.istem || !!koc.yapistirilan }, [
      el('summary', { metin: 'Elle kopyala-yapıştır modu (API yok)' }),
      el('p', { sinif: 'alt-yazi', metin: 'API kullanmadan da çalışır: istemi kopyala, istediğin bir yapay zekâ sohbetine yapıştır (kullanım şartlarına uyan bir servis seç), verdiği JSON yanıtı buraya yapıştır. Yanıt aynı doğrulamadan geçer ve aynı şekilde önizlenir.' }),
      el('div', { sinif: 'form-satir' }, [hazirla, kopyala]),
      istemAlani,
      yapistir,
      el('div', { sinif: 'form-satir' }, [isle])
    ]);
  }

  function kocGorunumu() {
    mesajlariYukle();
    var kok = el('div');
    kok.appendChild(U.sayfaBasligi('Koç', 'Boş saatlerine ve zayıf konularına göre program hazırlar, konuştukça düzenler. Yapay zekâ yalnızca öneri üretir; sen onaylamadan hiçbir şey değişmez. Yanlış öneriler (çakışan, geçmiş saatli) otomatik elenir.'));
    kok.appendChild(ayarBolumu());
    kok.appendChild(durumAnaliziBolumu());

    if (!P_rutinVar()) {
      kok.appendChild(el('div', { sinif: 'hatirlatma' }, [
        el('span', { metin: 'Boş saatlerin tanımlı değil; yapay zekâ nereye iş koyacağını bilemez. ' }),
        el('button', { type: 'button', sinif: 'metin-dugme', metin: 'Rutin sayfasına git', onclick: function () { U.gorunumeGit('rutin'); } })
      ]));
    }

    kok.appendChild(el('h2', { metin: 'Sohbet' }));
    if (!koc.mesajlar.length) {
      kok.appendChild(el('p', { sinif: 'bos', metin: 'Henüz konuşma yok. Aşağıdan bir istek yaz veya hazır isteklerden birini seç.' }));
    } else {
      kok.appendChild(el('ul', { sinif: 'sohbet', 'aria-live': 'polite' }, koc.mesajlar.map(mesajBalonu)));
    }

    if (koc.bekliyor || koc.analizBekliyor) {
      kok.appendChild(el('div', { sinif: 'bekleme-kutusu' }, [
        el('p', { sinif: 'alt-yazi bekleme', role: 'status', id: 'koc-bekleme-yazisi', metin: 'Düşünüyor... (' + koc.gecenSaniye + ' sn geçti)' }),
        el('button', {
          type: 'button', sinif: 'ikincil tehlike', id: 'koc-iptal-dugme', metin: 'İsteği İptal Et',
          onclick: function () {
            Z.istekIptalEt();
            koc.bekliyor = false;
            koc.analizBekliyor = false;
            zamanlayiciyiDurdur();
            U.uyariGoster('İstek kullanıcı tarafından iptal edildi.', 'bilgi', 'koc');
            U.ciz();
          }
        })
      ]));
    }

    var girdi = el('textarea', { rows: '3', maxlength: '800', 'aria-label': 'Koça mesaj', placeholder: 'örn. Salı akşamı dershane uzayacak, o gün boş yok. Türeve ağırlık ver, fizikten sıkıldım.', 'data-odak': 'koc-girdi' });
    girdi.value = koc.girdi;
    girdi.addEventListener('input', function () { koc.girdi = girdi.value; });
    girdi.addEventListener('keydown', function (olay) { if (olay.key === 'Enter' && (olay.ctrlKey || olay.metaKey)) { olay.preventDefault(); gonder(); } });
    kok.appendChild(el('div', { sinif: 'hizli-istekler' }, HIZLI_ISTEKLER.map(function (t) {
      return el('button', { type: 'button', sinif: 'filtre', metin: t, onclick: function () { koc.girdi = t; durum.odak = 'koc-girdi'; U.ciz(); } });
    })));
    kok.appendChild(el('form', {
      sinif: 'koc-formu', 'data-form': 'koc',
      onsubmit: function (olay) { olay.preventDefault(); gonder(); }
    }, [
      girdi,
      el('div', { sinif: 'form-satir' }, [
        el('button', { type: 'submit', sinif: 'birincil', id: 'koc-gonder', metin: (koc.bekliyor || koc.analizBekliyor) ? 'Bekleniyor...' : 'Gönder', disabled: (koc.bekliyor || koc.analizBekliyor) ? 'disabled' : null }),
        el('span', { sinif: 'alt-yazi', metin: 'Ctrl+Enter ile de gönderebilirsin.' }),
        koc.mesajlar.length ? el('button', {
          type: 'button', sinif: 'metin-dugme sil', id: 'koc-temizle', metin: 'Tüm sohbeti temizle',
          onclick: function () { if (window.confirm('Tüm sohbet geçmişi silinsin mi?\n(Denemeler, hedefler ve görevlerinize ASLA dokunulmaz.)')) { koc.mesajlar = []; Z.sohbetTemizle(); U.ciz(); } }
        }) : null
      ])
    ]));

    kok.appendChild(elleModBolumu());
    return kok;
  }

  function P_rutinVar() { return window.YKSPlanlayici.rutinVarMi(durum.veri); }

  U.gorunumler.koc = kocGorunumu;
})();
