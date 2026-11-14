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
     Exemplo: "id-do-perfume":{payLink:"", stock:2} */
  lowStockAt:3,
  products:{
    "armaf-club-de-nuit-intense-fuego":{payLink:"https://pag.getnet.com.br/RpH1gKDs3"},
    "armaf-club-de-nuit-bling":{payLink:"https://pag.getnet.com.br/3TkZvFiPz"},
    "armaf-tag-uomo-nero":{payLink:"https://pag.getnet.com.br/YUVyfpj1n"},
    "armaf-le-parfait-pour-homme":{payLink:"https://pag.getnet.com.br/495EgqX17"},
    "armaf-magical-oud":{payLink:"https://pag.getnet.com.br/MUx285y6K"},
    "armaf-island-bliss":{payLink:"https://pag.getnet.com.br/p7HiuInLB"},
    "armaf-odyssey-go-mango":{payLink:"https://pag.getnet.com.br/2Ee6VKjpl"},
    "armaf-odyssey-spectra":{payLink:"https://pag.getnet.com.br/aNQ1lT_ag"},
    "mpf-scudo-electrique":{payLink:"https://pag.getnet.com.br/JbCi0Jrt4"},
    "mpf-wicked":{payLink:"https://pag.getnet.com.br/t1Px1KRpQ"},
    "mpf-his-dynasty":{payLink:"https://pag.getnet.com.br/X8RCdPi9l"},
    "mpf-two-dare":{payLink:"https://pag.getnet.com.br/MAElfy84-"},
    "mpf-gossip-homme":{payLink:"https://pag.getnet.com.br/DxpWqvAKa"},
    "mpf-orchid-noir":{payLink:"https://pag.getnet.com.br/epESkSmZF"},
    "mpf-just-oud-wood":{payLink:"https://pag.getnet.com.br/LX78EENTD"},
    "mpf-ombre":{payLink:"https://pag.getnet.com.br/m-NRk1bqK"},
    "mpf-rider-blue":{payLink:"https://pag.getnet.com.br/ohUgyyW2t"},
    "arabiyat-prestige-bahiya-garnet":{payLink:"https://pag.getnet.com.br/GRGtq1ara"},
    "al-wataniah-atter-al-wesal-gold":{payLink:"https://pag.getnet.com.br/T4kT4JsuR"},
    "ibraheem-al-qurashi-arabian-tobacco":{payLink:"https://pag.getnet.com.br/jJSZX02pk"},
    "ibraheem-al-qurashi-spanish-tobacco":{payLink:"https://pag.getnet.com.br/Wpq-lohoo"},
    "ibraheem-al-qurashi-cuban-tobacco":{payLink:"https://pag.getnet.com.br/9YHmErzlk"},
    "ibraheem-al-qurashi-dominic-tobacco":{payLink:"https://pag.getnet.com.br/t0_Fv_0gq"},
    "ibraheem-al-qurashi-jamaican-tobacco":{payLink:"https://pag.getnet.com.br/jVFWNnsYI"},
    "ibraheem-al-qurashi-mexican-tobacco":{payLink:"https://pag.getnet.com.br/Gz8wIKSfZ"},
    "ibraheem-al-qurashi-balas-rose":{payLink:"https://pag.getnet.com.br/rY8mxWP3a"},
    /* MPF novo 25/10 — cole o link Getnet R$ 99,99 em payLink */
    "mpf-poudre":{payLink:"https://pag.getnet.com.br/SMA90Eiqp"},
    "mpf-dark-scudo":{payLink:"https://pag.getnet.com.br/hc9eu148n"},
    "mpf-highway-parfum":{payLink:"https://pag.getnet.com.br/nwJrF1wl6"},
    "mpf-vanilla-tobacco":{payLink:"https://pag.getnet.com.br/TLXqkkAT4"},
    "mpf-wicked-elixir":{payLink:"https://pag.getnet.com.br/SK5DqABA3"},
    "mpf-wicked-legend":{payLink:"https://pag.getnet.com.br/Aqrd1HzT0"},
    "mpf-wicked-noir":{payLink:"https://pag.getnet.com.br/dj6xRCSbT"},
    /* Paris Corner + French Avenue novos 27/10 — cole o link Getnet no payLink */
  },

  /* Decants 10 ml. Enquanto a lista estiver vazia a seção aparece como "Em breve".
     Item: {perfumeId:"armaf-club-de-nuit-elite", ml:10, price:49.90, available:true, payLink:""}
     (perfumeId puxa nome, marca e foto do catálogo; price em reais) */
  /* Decants Arabiyat Prestige 27/10 (R$ 10,00, sem ml, só varejo; Fahad Gaze/Regal não estão no catálogo de frascos) */
  decants:[
    {perfumeId:"arabiyat-prestige-bahiya-garnet", price:10.00, available:true, payLink:"https://pag.getnet.com.br/dS6zzAmP8"},
    {perfumeId:"arabiyat-prestige-uhud", price:10.00, available:true, payLink:"https://pag.getnet.com.br/dS6zzAmP8"},
    {perfumeId:"arabiyat-prestige-marwa", price:10.00, available:true, payLink:"https://pag.getnet.com.br/dS6zzAmP8"},
    {brand:"Arabiyat Prestige", name:"Fahad Gaze", photo:"assets/img/arabiyat-prestige-fahad-gaze.webp", price:10.00, available:true, payLink:"https://pag.getnet.com.br/dS6zzAmP8"},
    {brand:"Arabiyat Prestige", name:"Fahad Regal", photo:"assets/img/arabiyat-prestige-fahad-regal.webp", price:10.00, available:true, payLink:"https://pag.getnet.com.br/dS6zzAmP8"}
  ]
};
