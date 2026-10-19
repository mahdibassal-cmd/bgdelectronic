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
    "armaf-odyssey-mandarine-sky",
    "arabiyat-prestige-la-di-da-for-her",
    "ferassa-jamra",
    "armaf-yum-yum",
    "arabiyat-prestige-hypnotic-vanilla"
  ],

  /* Por produto (chave = id):
     mpLink: link de pagamento Mercado Pago -> mostra o botão "Comprar" (escondido enquanto vazio)
     stock:  unidades em estoque -> com 1 a lowStockAt mostra "Últimas unidades" (null = não mostra)
     Exemplo: "armaf-club-de-nuit-elite":{mpLink:"https://mpago.la/xxxx", stock:2} */
  lowStockAt:3,
  products:{
  },

  /* Decants 10 ml. Enquanto a lista estiver vazia a seção aparece como "Em breve".
     Item: {perfumeId:"armaf-club-de-nuit-elite", ml:10, price:49.90, available:true, mpLink:""}
     (perfumeId puxa nome, marca e foto do catálogo; price em reais) */
  decants:[
  ]
};
