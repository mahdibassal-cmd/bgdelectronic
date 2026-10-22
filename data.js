/* =========================================================
   DATA.JS: PRODUTOS E PREÇOS DE VAREJO DO SITE (arquivo único dos eletrônicos).
   Para mudar um preço, edite 'price' aqui (ou PRICE_OVERRIDE em tools/build_data.py e rode o script).
   PRODUCTS: name, category, price, icon, image (opcional), imageSource.
   FEATURED_PERFUMES: ids do catálogo perfumes/data.json (preços vêm do próprio catálogo).
   ========================================================= */
const PRODUCTS = [
 {
  "name": "Nintendo Switch OLED Neon",
  "category": "Consoles",
  "price": "R$ 2.200,00",
  "icon": "console",
  "image": "img/eletronicos/nintendo-switch-oled-neon.webp",
  "imageSource": "Nintendo — nintendo.com/sg (caixa Neon Blue/Neon Red)"
 },
 {
  "name": "Starlink Mini",
  "category": "Starlink",
  "price": "R$ 604,99",
  "icon": "dish",
  "image": "img/eletronicos/starlink-mini.webp",
  "imageSource": "Starlink — starlink.com/specifications (Starlink_Mini_1000px)"
 },
 {
  "name": "Hori Split Pad Pro (ergonômico para Nintendo Switch)",
  "category": "Acessórios Gaming",
  "price": "R$ 297,00",
  "icon": "gamepad",
  "image": "img/eletronicos/hori-split-pad-pro-ergon-mico-para-nintendo-switch.webp",
  "imageSource": "HORI — stores.horiusa.com (NSW-298U, Translucent Black)"
 },
 {
  "name": "Kit Gamer Teclado + Mouse",
  "category": "Acessórios Gaming",
  "price": "R$ 77,00",
  "icon": "gamepad",
  "image": "img/eletronicos/kit-gamer-teclado-mouse.webp",
  "imageSource": "Foto MB — X-Cell XC-CB-05 (foto de estúdio: perspectiva, cor e fundo tratados)"
 },
 {
  "name": "Mouse Pad Gamer RGB",
  "category": "Acessórios Gaming",
  "price": "R$ 66,00",
  "icon": "gamepad",
  "image": "img/eletronicos/mouse-pad-gamer-rgb.webp",
  "imageSource": "Foto MB — X-Cell XC-MPD-06 Extra Grande (foto de estúdio: perspectiva, cor e fundo tratados)"
 },
 {
  "name": "JBL Boombox 4 Black",
  "category": "Áudio & Som",
  "price": "R$ 2.169,99",
  "icon": "speaker",
  "image": "img/eletronicos/jbl-boombox-4-black.webp",
  "imageSource": "JBL — assets/jbl/official-p2.png"
 },
 {
  "name": "Hopestar A60 450W + 2 microfones",
  "category": "Áudio & Som",
  "price": "R$ 1.650,00",
  "icon": "speaker",
  "image": "img/eletronicos/hopestar-a60-450w-2-microfones.webp",
  "imageSource": "Hopestar — hopestar.hk (A60 Ultra)"
 },
 {
  "name": "JOOG Hi-Lite",
  "category": "Áudio & Som",
  "price": "R$ 715,00",
  "icon": "speaker",
  "image": "img/eletronicos/joog-hi-lite.webp",
  "imageSource": "Varejo — comprasparaguai.com.br (anúncio JOOG Hi-Lite JHL-02)"
 },
 {
  "name": "Rastreador compatível com iPhone (buscador)",
  "category": "Smart & Tech",
  "price": "R$ 55,00",
  "icon": "tag",
  "image": "img/eletronicos/rastreador-compat-vel-com-iphone-buscador.webp",
  "imageSource": "Foto MB — X-Cell XC-TAG-02, redondo (foto de estúdio: perspectiva, cor e fundo tratados)"
 },
 {
  "name": "Oura Ring 5 tamanho 7, Gold",
  "category": "Wearables",
  "price": "R$ 3.629,99",
  "icon": "ring",
  "image": "img/eletronicos/oura-ring-5-tamanho-7-gold.webp",
  "imageSource": "Oura — ouraring.com (Oura Ring 5 Gold)"
 },
 {
  "name": "Oura Ring 5 tamanho 7, Rose",
  "category": "Wearables",
  "price": "R$ 3.629,99",
  "icon": "ring",
  "image": "img/eletronicos/oura-ring-5-tamanho-7-rose.webp",
  "imageSource": "Oura — ouraring.com (Oura Ring 5 Deep Rose)"
 },
 {
  "name": "Oura Ring 5 tamanho 8, Gold",
  "category": "Wearables",
  "price": "R$ 3.629,99",
  "icon": "ring",
  "image": "img/eletronicos/oura-ring-5-tamanho-8-gold.webp",
  "imageSource": "Oura — ouraring.com (Oura Ring 5 Gold)"
 },
 {
  "name": "Oura Ring 5 tamanho 8, Rosa",
  "category": "Wearables",
  "price": "R$ 3.629,99",
  "icon": "ring",
  "image": "img/eletronicos/oura-ring-5-tamanho-8-rosa.webp",
  "imageSource": "Oura — ouraring.com (Oura Ring 5 Deep Rose)"
 },
 {
  "name": "Oura Ring 5 tamanho 9, Black",
  "category": "Wearables",
  "price": "R$ 3.299,99",
  "icon": "ring",
  "image": "img/eletronicos/oura-ring-5-tamanho-9-black.webp",
  "imageSource": "Oura — ouraring.com (Oura Ring 5 Black)"
 },
 {
  "name": "Oura Ring 5 tamanho 10, Silver",
  "category": "Wearables",
  "price": "R$ 3.299,99",
  "icon": "ring",
  "image": "img/eletronicos/oura-ring-5-tamanho-10-silver.webp",
  "imageSource": "Oura — ouraring.com (Oura Ring 5 Silver)"
 },
 {
  "name": "Google Fit Air (pulseira)",
  "category": "Wearables",
  "price": "R$ 814,00",
  "icon": "ring",
  "image": "img/eletronicos/google-fit-air-pulseira.webp",
  "imageSource": "Google — blog.google (Fitbit Air, pulseiras Active)"
 },
 {
  "name": "Garmin 170 Music (White)",
  "category": "Smartwatches",
  "price": "R$ 1.925,00",
  "icon": "watch",
  "image": "img/eletronicos/garmin-170-music-white.webp",
  "imageSource": "Garmin — garmin.co.jp (Forerunner 170 Music Whitestone)"
 },
 {
  "name": "Huawei Watch GT5 41mm feminino (White & Gold / Brown Woven)",
  "category": "Smartwatches",
  "price": "R$ 946,00",
  "icon": "watch",
  "image": "img/eletronicos/huawei-watch-gt5-41mm-feminino-white-gold-brown-woven.webp",
  "imageSource": "Huawei — press room Mynewsdesk (GT 5 41mm Gold)"
 },
 {
  "name": "Huawei Watch GT5 46mm masculino (Black Black / Brown Prateado / Blue Prateado)",
  "category": "Smartwatches",
  "price": "R$ 935,00",
  "icon": "watch",
  "image": "img/eletronicos/huawei-watch-gt5-46mm-masculino-black-black-brown-prateado-b.webp",
  "imageSource": "Huawei — press room Mynewsdesk (GT 5 46mm Black)"
 },
 {
  "name": "Airtag (nossa marca)",
  "category": "Apple & Acessórios",
  "price": "R$ 33,00",
  "icon": "cable",
  "image": "img/eletronicos/airtag-nossa-marca.webp",
  "imageSource": "Foto MB — X-Cell XC-TAG-03, gota (foto de estúdio: perspectiva, cor e fundo tratados)"
 },
 {
  "name": "Fone USB-C com fio Apple original",
  "category": "Apple & Acessórios",
  "price": "R$ 186,99",
  "icon": "cable",
  "image": "img/eletronicos/fone-usb-c-com-fio-apple-original.webp",
  "imageSource": "Apple — apple.com/br (EarPods USB-C, MTJY3)"
 },
 {
  "name": "Cabo USB-C / Lightning / USB 1m",
  "category": "Apple & Acessórios",
  "price": "R$ 5,50",
  "icon": "cable",
  "image": "img/eletronicos/cabo-usb-c-lightning-usb-1m.webp",
  "imageSource": "Foto MB — cabo USB-C 45W 1M (foto de estúdio: perspectiva, cor e fundo tratados)"
 },
 {
  "name": "Cabo USB-C / Lightning / USB 1,5m",
  "category": "Apple & Acessórios",
  "price": "R$ 5,50",
  "icon": "cable",
  "image": "img/eletronicos/cabo-usb-c-lightning-usb-1-5m.webp",
  "imageSource": "Foto MB — mesma foto do cabo 1M (caixa diz 1M; trocar se o MB mandar a do 1,5m)"
 },
 {
  "name": "iPhone Pocket 80 cm",
  "category": "Apple & Acessórios",
  "price": "R$ 30,00",
  "icon": "cable",
  "image": "img/eletronicos/iphone-pocket-80-cm.webp",
  "imageSource": "Apple — apple.com/newsroom (iPhone Pocket, alça longa)"
 },
 {
  "name": "iPhone Pocket 40 cm",
  "category": "Apple & Acessórios",
  "price": "R$ 30,00",
  "icon": "cable",
  "image": "img/eletronicos/iphone-pocket-40-cm.webp",
  "imageSource": "Apple — apple.com/newsroom (iPhone Pocket, alça curta)"
 },
 {
  "name": "Logitech MK220 teclado + mouse sem fio",
  "category": "Notebooks & Periféricos",
  "price": "R$ 118,80",
  "icon": "keyboard",
  "image": "img/eletronicos/logitech-mk220-teclado-mouse-sem-fio.webp",
  "imageSource": "Logitech — resource.logitech.com (galeria MK220)"
 },
 {
  "name": "Logitech MK235 II teclado + mouse sem fio",
  "category": "Notebooks & Periféricos",
  "price": "R$ 142,99",
  "icon": "keyboard",
  "image": "img/eletronicos/logitech-mk235-ii-teclado-mouse-sem-fio.webp",
  "imageSource": "Logitech — logitech.com/pt-br (galeria MK235)"
 },
 {
  "name": "Logitech MK250 teclado + mouse sem fio",
  "category": "Notebooks & Periféricos",
  "price": "R$ 142,99",
  "icon": "keyboard",
  "image": "img/eletronicos/logitech-mk250-teclado-mouse-sem-fio.webp",
  "imageSource": "Logitech — logitech.com (MK250 Graphite)"
 },
 {
  "name": "Logitech MK470 teclado + mouse sem fio",
  "category": "Notebooks & Periféricos",
  "price": "R$ 269,50",
  "icon": "keyboard",
  "image": "img/eletronicos/logitech-mk470-teclado-mouse-sem-fio.webp",
  "imageSource": "Logitech — news.logitech.com (press kit MK470 Graphite)"
 },
 {
  "name": "AirFryer Ninja Pro",
  "category": "Cozinha & Casa",
  "price": "R$ 1.265,00",
  "icon": "fryer",
  "image": "img/eletronicos/airfryer-ninja-pro.webp",
  "imageSource": "Ninja — ninjakitchen.com (Air Fryer Pro AF141)"
 },
 {
  "name": "AirFryer Ninja Foodi",
  "category": "Cozinha & Casa",
  "price": "R$ 2.200,00",
  "icon": "fryer",
  "image": "img/eletronicos/airfryer-ninja-foodi.webp",
  "imageSource": "Ninja — assets.sharkninja.com (Foodi DualZone DZ201)"
 }
];

const FEATURED_PERFUMES = ["arabiyat-prestige-marwa", "arabiyat-prestige-bahiya-garnet", "arabiyat-prestige-hypnotic-vanilla", "armaf-club-de-nuit-intense-man", "ferassa-burkan"];

// Links de pagamento Getnet (PIX/cartão), chave = slug da imagem img/eletronicos/<id>.webp
const PAY_LINKS = {
  "nintendo-switch-oled-neon": "https://pag.getnet.com.br/6HoQdbXTDV",
  "starlink-mini": "https://pag.getnet.com.br/Au7W7Yv8Q",
  "hori-split-pad-pro-ergon-mico-para-nintendo-switch": "https://pag.getnet.com.br/Q2vl-YKEJ",
  "kit-gamer-teclado-mouse": "https://pag.getnet.com.br/jCw9eJ4uS",
  "mouse-pad-gamer-rgb": "https://pag.getnet.com.br/4UgOzRO3t",
  "jbl-boombox-4-black": "https://pag.getnet.com.br/8OnTKdiay",
  "hopestar-a60-450w-2-microfones": "https://pag.getnet.com.br/fSenl2bPf",
  "joog-hi-lite": "https://pag.getnet.com.br/Xn3-TbpD7",
  "rastreador-compat-vel-com-iphone-buscador": "https://pag.getnet.com.br/BjY3ZZIvs",
  "oura-ring-5-tamanho-7-gold": "https://pag.getnet.com.br/17_4VU2r2",
  "oura-ring-5-tamanho-7-rose": "https://pag.getnet.com.br/X04bcbUKL",
  "oura-ring-5-tamanho-8-gold": "https://pag.getnet.com.br/A3v7VIV3c",
  "oura-ring-5-tamanho-8-rosa": "https://pag.getnet.com.br/qz5TtPlCv",
  "oura-ring-5-tamanho-9-black": "https://pag.getnet.com.br/2TbrhXb-y",
  "oura-ring-5-tamanho-10-silver": "https://pag.getnet.com.br/Y6olLtNp4",
  "google-fit-air-pulseira": "https://pag.getnet.com.br/kDSAMMQYo",
  "garmin-170-music-white": "https://pag.getnet.com.br/ViRs3Hra0",
  "huawei-watch-gt5-41mm-feminino-white-gold-brown-woven": "https://pag.getnet.com.br/xzk0XPnrY",
  "huawei-watch-gt5-46mm-masculino-black-black-brown-prateado-b": "https://pag.getnet.com.br/ERn_mQ0ak",
  "airtag-nossa-marca": "https://pag.getnet.com.br/B7tZiZ4mX",
  "fone-usb-c-com-fio-apple-original": "https://pag.getnet.com.br/yUTk3hfpa",
  "cabo-usb-c-lightning-usb-1m": "https://pag.getnet.com.br/TKvfwldcg",
  "cabo-usb-c-lightning-usb-1-5m": "https://pag.getnet.com.br/J0hkTcz-K",
  "iphone-pocket-80-cm": "https://pag.getnet.com.br/n3ohEqyvq",
  "iphone-pocket-40-cm": "https://pag.getnet.com.br/jCq3587s1",
  "logitech-mk220-teclado-mouse-sem-fio": "https://pag.getnet.com.br/_GNWjtnut",
  "logitech-mk235-ii-teclado-mouse-sem-fio": "https://pag.getnet.com.br/nBU-mb0qg",
  "logitech-mk250-teclado-mouse-sem-fio": "https://pag.getnet.com.br/GGw_nqARQ",
  "logitech-mk470-teclado-mouse-sem-fio": "https://pag.getnet.com.br/ZTrxmJqJA",
  "airfryer-ninja-pro": "https://pag.getnet.com.br/SlnqgvSeX",
  "airfryer-ninja-foodi": "https://pag.getnet.com.br/Sdzhnv0He"
};
