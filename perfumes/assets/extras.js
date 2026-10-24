/* BAGDA PERFUMES — configurações da loja (edite aqui; não depende do data.js)
   Tudo neste arquivo é opcional. Campos vazios = recurso escondido. */
window.BAGDA_EXTRAS={
  /* Parcelamento no cartão. Se o crédito for SEM JUROS, troque noInterest para true:
     os cards passam a mostrar "12x de R$ X sem juros". Com false mostra "ou em até 12x no cartão". */
  installments:{max:12, noInterest:false},

  /* Faixa "Mais vendidos" — ids dos produtos, na ordem (veja os ids em data.json). */
  bestSellers:[
    "armaf-club-de-nuit-intense-man",
    "armaf-club-de-nuit-elite",
    "arabiyat-prestige-mahd-al-dhahab",
    "arabiyat-prestige-la-di-da-for-her",
    "ferassa-jamra"
  ],

  /* Por produto (chave = id):
     payLink: link de pagamento Getnet (PIX/cartão) -> mostra o botão "Pagar" (escondido enquanto vazio)
     stock:  unidades em estoque -> com 1 a lowStockAt mostra "Últimas unidades" (null = não mostra)
     Exemplo: "armaf-club-de-nuit-elite":{payLink:"https://pag.getnet.com.br/xxxx", stock:2} */
  lowStockAt:3,
  products:{
    "ferassa-jamra":{payLink:"https://pag.getnet.com.br/NzK6N-pmh"},
    "ferassa-nemer":{payLink:"https://pag.getnet.com.br/5ukF1sjX2"},
    "ferassa-delilah":{payLink:"https://pag.getnet.com.br/_hPuVVQS3"},
    "ferassa-burkan":{payLink:"https://pag.getnet.com.br/xMYwoJ77A"},
    "armaf-club-de-nuit-elite":{payLink:"https://pag.getnet.com.br/yg3oQnAWh"},
    "armaf-club-de-nuit-intense-fuego":{payLink:"https://pag.getnet.com.br/RpH1gKDs3"},
    "armaf-club-de-nuit-bling":{payLink:"https://pag.getnet.com.br/3TkZvFiPz"},
    "armaf-club-de-nuit-intense-man":{payLink:"https://pag.getnet.com.br/OM6qnRzam"},
    "armaf-club-de-nuit-intense-woman":{payLink:"https://pag.getnet.com.br/mR7JZ15h6"},
    "armaf-club-de-nuit-malika":{payLink:"https://pag.getnet.com.br/FWVw-gcnX"},
    "armaf-tag-uomo-nero":{payLink:"https://pag.getnet.com.br/YUVyfpj1n"},
    "armaf-le-parfait-pour-homme":{payLink:"https://pag.getnet.com.br/495EgqX17"},
    "armaf-magical-oud":{payLink:"https://pag.getnet.com.br/MUx285y6K"},
    "armaf-island-bliss":{payLink:"https://pag.getnet.com.br/p7HiuInLB"},
    "armaf-odyssey-go-mango":{payLink:"https://pag.getnet.com.br/2Ee6VKjpl"},
    "armaf-odyssey-spectra":{payLink:"https://pag.getnet.com.br/aNQ1lT_ag"},
    "mpf-strength-in-amber":{payLink:"https://pag.getnet.com.br/fC_PeJHvv"},
    "mpf-wild-deep":{payLink:"https://pag.getnet.com.br/KLtp0kV71"},
    "mpf-scudo-electrique":{payLink:"https://pag.getnet.com.br/JbCi0Jrt4"},
    "mpf-wicked":{payLink:"https://pag.getnet.com.br/Hf5QlKxgN"},
    "mpf-black-morgan":{payLink:"https://pag.getnet.com.br/p56qZCKS_"},
    "mpf-europa-very-red":{payLink:"https://pag.getnet.com.br/yf2jNH39H"},
    "mpf-his-dynasty":{payLink:"https://pag.getnet.com.br/X8RCdPi9l"},
    "mpf-two-dare":{payLink:"https://pag.getnet.com.br/MAElfy84-"},
    "mpf-gossip-homme":{payLink:"https://pag.getnet.com.br/DxpWqvAKa"},
    "mpf-souls-intertwined-for-her":{payLink:"https://pag.getnet.com.br/Oa_iacrAD"},
    "mpf-crypto-gold":{payLink:"https://pag.getnet.com.br/i-7Ea6Mxk"},
    "mpf-before-midnight-for-her":{payLink:"https://pag.getnet.com.br/AJ1fEpn-g"},
    "mpf-dominer":{payLink:"https://pag.getnet.com.br/aB18t9yQN"},
    "mpf-prima-donna":{payLink:"https://pag.getnet.com.br/3ydGQSnLv"},
    "mpf-by-the-shore":{payLink:"https://pag.getnet.com.br/QCydAEF10"},
    "mpf-heartstrings":{payLink:"https://pag.getnet.com.br/f0iNGzWp5"},
    "mpf-rose-bourbon":{payLink:"https://pag.getnet.com.br/8sQKYk1tz"},
    "mpf-rouge-lights":{payLink:"https://pag.getnet.com.br/UAkZZQSKk"},
    "mpf-oud-memoir":{payLink:"https://pag.getnet.com.br/B5QRSxnAw"},
    "mpf-roseate-glow":{payLink:"https://pag.getnet.com.br/VVdFeFl-F"},
    "mpf-fizzy-cherry":{payLink:"https://pag.getnet.com.br/OwW9K1mtJ"},
    "mpf-just-peach":{payLink:"https://pag.getnet.com.br/OavKV_TZH"},
    "mpf-fabulicious":{payLink:"https://pag.getnet.com.br/OLdFmvzwW"},
    "mpf-leather-for-men":{payLink:"https://pag.getnet.com.br/NAwouevc0"},
    "mpf-orchid-noir":{payLink:"https://pag.getnet.com.br/epESkSmZF"},
    "mpf-just-oud-wood":{payLink:"https://pag.getnet.com.br/LX78EENTD"},
    "mpf-ombre":{payLink:"https://pag.getnet.com.br/m-NRk1bqK"},
    "mpf-aquatic-allure":{payLink:"https://pag.getnet.com.br/zJkuRRxdR"},
    "mpf-rider-blue":{payLink:"https://pag.getnet.com.br/ohUgyyW2t"},
    "arabiyat-prestige-ashaa-amethyst":{payLink:"https://pag.getnet.com.br/kPL4qYKQa"},
    "arabiyat-prestige-nyla":{payLink:"https://pag.getnet.com.br/PWriQWVXJ"},
    "arabiyat-prestige-ashaa-blanc":{payLink:"https://pag.getnet.com.br/jB7fSshb4"},
    "arabiyat-prestige-ashaa-mauve":{payLink:"https://pag.getnet.com.br/j2j0aGEl1"},
    "arabiyat-prestige-ashaa-neroli":{payLink:"https://pag.getnet.com.br/q1zKQ2u9c"},
    "arabiyat-prestige-ashaa-oud-noir":{payLink:"https://pag.getnet.com.br/gaeFEq6LX"},
    "arabiyat-prestige-ayaan":{payLink:"https://pag.getnet.com.br/82rKLQNEh"},
    "arabiyat-prestige-qissat-al-najah":{payLink:"https://pag.getnet.com.br/yL-ZJJKjc"},
    "arabiyat-prestige-la-di-da-for-her":{payLink:"https://pag.getnet.com.br/3h9lXeG32"},
    "arabiyat-prestige-hypnotic-amber":{payLink:"https://pag.getnet.com.br/u2PVHQOFK"},
    "arabiyat-prestige-raees-luxury-edition":{payLink:"https://pag.getnet.com.br/yhLVnE9yHk"},
    "arabiyat-prestige-habib-azul":{payLink:"https://pag.getnet.com.br/Cafmoe2k-"},
    "arabiyat-prestige-habiba-rosa":{payLink:"https://pag.getnet.com.br/ccUzH-HVe"},
    "arabiyat-prestige-rihla":{payLink:"https://pag.getnet.com.br/Mx1ByWLnt"},
    "arabiyat-prestige-nisma":{payLink:"https://pag.getnet.com.br/nR9fU3O6F"},
    "arabiyat-prestige-portrait":{payLink:"https://pag.getnet.com.br/lwdNwe5Vp"},
    "arabiyat-prestige-portrait-azure":{payLink:"https://pag.getnet.com.br/8JJ9qUhok"},
    "arabiyat-prestige-swar-venin":{payLink:"https://pag.getnet.com.br/dpUol3igY"},
    "arabiyat-prestige-raspberry-ripple":{payLink:"https://pag.getnet.com.br/ExdawLLMNL"},
    "arabiyat-prestige-black-currant-lolly":{payLink:"https://pag.getnet.com.br/vwWlPS4Yn"},
    "arabiyat-prestige-ramad":{payLink:"https://pag.getnet.com.br/KhnpJMB0F"},
    "arabiyat-prestige-marwa":{payLink:"https://pag.getnet.com.br/M5HSkJM13"},
    "arabiyat-prestige-mahd-al-dhahab":{payLink:"https://pag.getnet.com.br/1uocAGQf3"},
    "arabiyat-prestige-rumiel":{payLink:"https://pag.getnet.com.br/bYxbBQGxg"},
    "arabiyat-prestige-uhud":{payLink:"https://pag.getnet.com.br/4WWkQEjSP"},
    "arabiyat-prestige-bahiya-garnet":{payLink:"https://pag.getnet.com.br/w4-l1oeYw"},
    "arabiyat-prestige-kohl-luminous":{payLink:"https://pag.getnet.com.br/J4q6mt36L"},
    "arabiyat-prestige-noire":{payLink:"https://pag.getnet.com.br/IdFLOJkoU"},
    "al-wataniah-atter-al-wesal-gold":{payLink:"https://pag.getnet.com.br/cKu4FCZbd"},
    "rayhaan-pacific-tropical-vibe":{payLink:"https://pag.getnet.com.br/z8rdxxgLB"},
    "ibraheem-al-qurashi-arabian-tobacco":{payLink:"https://pag.getnet.com.br/esCeZ0W1q"},
    "ibraheem-al-qurashi-spanish-tobacco":{payLink:"https://pag.getnet.com.br/L9yYTldeu"},
    "ibraheem-al-qurashi-cuban-tobacco":{payLink:"https://pag.getnet.com.br/tuJydEDQf"},
    "ibraheem-al-qurashi-dominic-tobacco":{payLink:"https://pag.getnet.com.br/aSZ1IvHy7"},
    "ibraheem-al-qurashi-jamaican-tobacco":{payLink:"https://pag.getnet.com.br/iZTQlZ5SG"},
    "ibraheem-al-qurashi-mexican-tobacco":{payLink:"https://pag.getnet.com.br/tbdkLu1zq"},
    "ibraheem-al-qurashi-balas-rose":{payLink:"https://pag.getnet.com.br/44Ih4neMG"}
  },

  /* Decants 10 ml. Enquanto a lista estiver vazia a seção aparece como "Em breve".
     Item: {perfumeId:"armaf-club-de-nuit-elite", ml:10, price:49.90, available:true, payLink:""}
     (perfumeId puxa nome, marca e foto do catálogo; price em reais) */
  decants:[
  ]
};
