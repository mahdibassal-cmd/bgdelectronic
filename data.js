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
  "price": "Consulte",
  "promo": "SUPER PROMO",
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
  "price": "Consulte",
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
 },
 {
  "sku": "BS-ACC-001",
  "name": "Apple Carregador USB-C 20W",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "cable"
 },
 {
  "sku": "BS-ACC-002",
  "name": "Apple Cabo USB-C para USB-C",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "cable"
 },
 {
  "sku": "BS-ACC-003",
  "name": "Apple Cabo USB-C para Lightning",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "cable"
 },
 {
  "sku": "BS-ACC-005",
  "name": "Genérico Mini Teclado Number Pad",
  "category": "Notebooks & Periféricos",
  "price": "Consulte",
  "icon": "keyboard"
 },
 {
  "sku": "BS-ACC-006",
  "name": "Holy Land Lark A1",
  "category": "Smart & Tech",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "name": "Apple iPhone 13",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-APL-001",
    "label": "256GB Midnight",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-002",
    "label": "512GB Midnight",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-003",
    "label": "256GB Starlight",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-004",
    "label": "512GB Starlight",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-005",
    "label": "256GB Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-006",
    "label": "512GB Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-007",
    "label": "256GB Pink",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-008",
    "label": "512GB Pink",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-009",
    "label": "256GB Green",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-010",
    "label": "512GB Green",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-011",
    "label": "256GB (PRODUCT)RED",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-012",
    "label": "512GB (PRODUCT)RED",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Apple iPhone 13 mini",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-APL-013",
    "label": "256GB Midnight",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-014",
    "label": "512GB Midnight",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-015",
    "label": "256GB Starlight",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-016",
    "label": "512GB Starlight",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-017",
    "label": "256GB Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-018",
    "label": "512GB Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-019",
    "label": "256GB Pink",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-020",
    "label": "512GB Pink",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-021",
    "label": "256GB Green",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-022",
    "label": "512GB Green",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-023",
    "label": "256GB (PRODUCT)RED",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-024",
    "label": "512GB (PRODUCT)RED",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Apple iPhone 13 Pro",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-APL-025",
    "label": "256GB Graphite",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-026",
    "label": "512GB Graphite",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-027",
    "label": "1TB Graphite",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-028",
    "label": "256GB Gold",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-029",
    "label": "512GB Gold",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-030",
    "label": "1TB Gold",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-031",
    "label": "256GB Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-032",
    "label": "512GB Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-033",
    "label": "1TB Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-034",
    "label": "256GB Sierra Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-035",
    "label": "512GB Sierra Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-036",
    "label": "1TB Sierra Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-037",
    "label": "256GB Alpine Green",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-038",
    "label": "512GB Alpine Green",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-039",
    "label": "1TB Alpine Green",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Apple iPhone 13 Pro Max",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-APL-040",
    "label": "256GB Graphite",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-041",
    "label": "512GB Graphite",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-042",
    "label": "1TB Graphite",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-043",
    "label": "256GB Gold",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-044",
    "label": "512GB Gold",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-045",
    "label": "1TB Gold",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-046",
    "label": "256GB Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-047",
    "label": "512GB Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-048",
    "label": "1TB Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-049",
    "label": "256GB Sierra Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-050",
    "label": "512GB Sierra Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-051",
    "label": "1TB Sierra Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-052",
    "label": "256GB Alpine Green",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-053",
    "label": "512GB Alpine Green",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-054",
    "label": "1TB Alpine Green",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Apple iPhone 14",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-APL-055",
    "label": "256GB Midnight",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-056",
    "label": "512GB Midnight",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-057",
    "label": "256GB Starlight",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-058",
    "label": "512GB Starlight",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-059",
    "label": "256GB Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-060",
    "label": "512GB Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-061",
    "label": "256GB Purple",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-062",
    "label": "512GB Purple",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-063",
    "label": "256GB Yellow",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-064",
    "label": "512GB Yellow",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-065",
    "label": "256GB (PRODUCT)RED",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-066",
    "label": "512GB (PRODUCT)RED",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Apple iPhone 14 Plus",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-APL-067",
    "label": "256GB Midnight",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-068",
    "label": "512GB Midnight",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-069",
    "label": "256GB Starlight",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-070",
    "label": "512GB Starlight",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-071",
    "label": "256GB Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-072",
    "label": "512GB Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-073",
    "label": "256GB Purple",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-074",
    "label": "512GB Purple",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-075",
    "label": "256GB Yellow",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-076",
    "label": "512GB Yellow",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-077",
    "label": "256GB (PRODUCT)RED",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-078",
    "label": "512GB (PRODUCT)RED",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Apple iPhone 14 Pro",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-APL-079",
    "label": "256GB Space Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-080",
    "label": "512GB Space Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-081",
    "label": "1TB Space Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-082",
    "label": "256GB Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-083",
    "label": "512GB Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-084",
    "label": "1TB Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-085",
    "label": "256GB Gold",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-086",
    "label": "512GB Gold",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-087",
    "label": "1TB Gold",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-088",
    "label": "256GB Deep Purple",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-089",
    "label": "512GB Deep Purple",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-090",
    "label": "1TB Deep Purple",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Apple iPhone 14 Pro Max",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-APL-091",
    "label": "256GB Space Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-092",
    "label": "512GB Space Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-093",
    "label": "1TB Space Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-094",
    "label": "256GB Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-095",
    "label": "512GB Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-096",
    "label": "1TB Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-097",
    "label": "256GB Gold",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-098",
    "label": "512GB Gold",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-099",
    "label": "1TB Gold",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-100",
    "label": "256GB Deep Purple",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-101",
    "label": "512GB Deep Purple",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-102",
    "label": "1TB Deep Purple",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Apple iPhone 15",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-APL-103",
    "label": "256GB Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-104",
    "label": "512GB Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-105",
    "label": "256GB Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-106",
    "label": "512GB Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-107",
    "label": "256GB Green",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-108",
    "label": "512GB Green",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-109",
    "label": "256GB Yellow",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-110",
    "label": "512GB Yellow",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-111",
    "label": "256GB Pink",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-112",
    "label": "512GB Pink",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Apple iPhone 15 Plus",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-APL-113",
    "label": "256GB Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-114",
    "label": "512GB Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-115",
    "label": "256GB Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-116",
    "label": "512GB Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-117",
    "label": "256GB Green",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-118",
    "label": "512GB Green",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-119",
    "label": "256GB Yellow",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-120",
    "label": "512GB Yellow",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-121",
    "label": "256GB Pink",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-122",
    "label": "512GB Pink",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Apple iPhone 15 Pro",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-APL-123",
    "label": "256GB Black Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-124",
    "label": "512GB Black Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-125",
    "label": "1TB Black Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-126",
    "label": "256GB White Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-127",
    "label": "512GB White Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-128",
    "label": "1TB White Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-129",
    "label": "256GB Blue Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-130",
    "label": "512GB Blue Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-131",
    "label": "1TB Blue Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-132",
    "label": "256GB Natural Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-133",
    "label": "512GB Natural Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-134",
    "label": "1TB Natural Titanium",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Apple iPhone 15 Pro Max",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-APL-135",
    "label": "256GB Black Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-136",
    "label": "512GB Black Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-137",
    "label": "1TB Black Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-138",
    "label": "256GB White Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-139",
    "label": "512GB White Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-140",
    "label": "1TB White Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-141",
    "label": "256GB Blue Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-142",
    "label": "512GB Blue Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-143",
    "label": "1TB Blue Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-144",
    "label": "256GB Natural Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-145",
    "label": "512GB Natural Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-146",
    "label": "1TB Natural Titanium",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Apple iPhone 16",
  "category": "Apple & Acessórios",
  "price": "R$ 4.400,00",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-APL-147",
    "label": "128GB Black",
    "price": "R$ 4.400,00"
   },
   {
    "sku": "BS-APL-148",
    "label": "512GB Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-149",
    "label": "128GB White",
    "price": "R$ 4.400,00"
   },
   {
    "sku": "BS-APL-150",
    "label": "512GB White",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-151",
    "label": "128GB Pink",
    "price": "R$ 4.450,00"
   },
   {
    "sku": "BS-APL-152",
    "label": "512GB Pink",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-153",
    "label": "128GB Teal",
    "price": "R$ 4.300,00"
   },
   {
    "sku": "BS-APL-154",
    "label": "512GB Teal",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-155",
    "label": "128GB Ultramarine",
    "price": "R$ 4.350,00"
   },
   {
    "sku": "BS-APL-156",
    "label": "512GB Ultramarine",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Apple iPhone 16e",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-APL-157",
    "label": "256GB Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-158",
    "label": "512GB Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-159",
    "label": "256GB White",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-160",
    "label": "512GB White",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Apple iPhone 16 Plus",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-APL-161",
    "label": "256GB Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-162",
    "label": "512GB Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-163",
    "label": "256GB White",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-164",
    "label": "512GB White",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-165",
    "label": "256GB Pink",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-166",
    "label": "512GB Pink",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-167",
    "label": "256GB Teal",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-168",
    "label": "512GB Teal",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-169",
    "label": "256GB Ultramarine",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-170",
    "label": "512GB Ultramarine",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Apple iPhone 16 Pro",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-APL-171",
    "label": "256GB Black Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-172",
    "label": "512GB Black Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-173",
    "label": "1TB Black Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-174",
    "label": "256GB White Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-175",
    "label": "512GB White Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-176",
    "label": "1TB White Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-177",
    "label": "256GB Natural Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-178",
    "label": "512GB Natural Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-179",
    "label": "1TB Natural Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-180",
    "label": "256GB Desert Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-181",
    "label": "512GB Desert Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-182",
    "label": "1TB Desert Titanium",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Apple iPhone 16 Pro Max",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-APL-183",
    "label": "256GB Black Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-184",
    "label": "512GB Black Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-185",
    "label": "1TB Black Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-186",
    "label": "256GB White Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-187",
    "label": "512GB White Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-188",
    "label": "1TB White Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-189",
    "label": "256GB Natural Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-190",
    "label": "512GB Natural Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-191",
    "label": "1TB Natural Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-192",
    "label": "256GB Desert Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-193",
    "label": "512GB Desert Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-194",
    "label": "1TB Desert Titanium",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Apple iPhone 17",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-APL-195",
    "label": "256GB Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-196",
    "label": "512GB Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-197",
    "label": "256GB White",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-198",
    "label": "512GB White",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-199",
    "label": "256GB Mist Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-200",
    "label": "512GB Mist Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-201",
    "label": "256GB Sage",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-202",
    "label": "512GB Sage",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-203",
    "label": "256GB Lavender",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-204",
    "label": "512GB Lavender",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Apple iPhone 17 Air",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-APL-205",
    "label": "256GB Space Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-206",
    "label": "512GB Space Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-207",
    "label": "1TB Space Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-208",
    "label": "256GB Cloud White",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-209",
    "label": "512GB Cloud White",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-210",
    "label": "1TB Cloud White",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-211",
    "label": "256GB Light Gold",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-212",
    "label": "512GB Light Gold",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-213",
    "label": "1TB Light Gold",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-214",
    "label": "256GB Sky Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-215",
    "label": "512GB Sky Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-216",
    "label": "1TB Sky Blue",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Apple iPhone 17 Pro",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-APL-217",
    "label": "256GB Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-218",
    "label": "512GB Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-219",
    "label": "1TB Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-220",
    "label": "256GB Cosmic Orange",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-221",
    "label": "512GB Cosmic Orange",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-222",
    "label": "1TB Cosmic Orange",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-223",
    "label": "256GB Deep Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-224",
    "label": "512GB Deep Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-225",
    "label": "1TB Deep Blue",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Apple iPhone 17 Pro Max",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-APL-226",
    "label": "256GB Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-227",
    "label": "512GB Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-228",
    "label": "1TB Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-229",
    "label": "2TB Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-230",
    "label": "256GB Cosmic Orange",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-231",
    "label": "512GB Cosmic Orange",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-232",
    "label": "1TB Cosmic Orange",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-233",
    "label": "2TB Cosmic Orange",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-234",
    "label": "256GB Deep Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-235",
    "label": "512GB Deep Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-236",
    "label": "1TB Deep Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-237",
    "label": "2TB Deep Blue",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Apple iPhone 18 Pro",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-APL-238",
    "label": "256GB Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-239",
    "label": "512GB Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-240",
    "label": "1TB Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-241",
    "label": "2TB Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-242",
    "label": "256GB Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-243",
    "label": "512GB Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-244",
    "label": "1TB Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-245",
    "label": "2TB Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-246",
    "label": "256GB Glacier",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-247",
    "label": "512GB Glacier",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-248",
    "label": "1TB Glacier",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-249",
    "label": "2TB Glacier",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-250",
    "label": "256GB Burgundy",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-251",
    "label": "512GB Burgundy",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-252",
    "label": "1TB Burgundy",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-253",
    "label": "2TB Burgundy",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Apple iPhone 18 Pro Max",
  "category": "Apple & Acessórios",
  "price": "R$ 8.685,00",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-APL-254",
    "label": "256GB Black",
    "price": "R$ 8.685,00"
   },
   {
    "sku": "BS-APL-255",
    "label": "512GB Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-256",
    "label": "1TB Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-257",
    "label": "2TB Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-258",
    "label": "256GB Silver",
    "price": "R$ 8.500,00"
   },
   {
    "sku": "BS-APL-259",
    "label": "512GB Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-260",
    "label": "1TB Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-261",
    "label": "2TB Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-262",
    "label": "256GB Glacier",
    "price": "R$ 8.600,00"
   },
   {
    "sku": "BS-APL-263",
    "label": "512GB Glacier",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-264",
    "label": "1TB Glacier",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-265",
    "label": "2TB Glacier",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-266",
    "label": "256GB Burgundy",
    "price": "R$ 8.645,00"
   },
   {
    "sku": "BS-APL-267",
    "label": "512GB Burgundy",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-268",
    "label": "1TB Burgundy",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-269",
    "label": "2TB Burgundy",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Apple iPhone 18 Duo (iPhone Duo)",
  "category": "Apple & Acessórios",
  "price": "R$ 13.850,00",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-APL-270",
    "label": "256GB Night Sky",
    "price": "R$ 13.850,00"
   },
   {
    "sku": "BS-APL-271",
    "label": "512GB Night Sky",
    "price": "R$ 15.350,00"
   },
   {
    "sku": "BS-APL-272",
    "label": "1TB Night Sky",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-273",
    "label": "2TB Night Sky",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-274",
    "label": "256GB Star White",
    "price": "R$ 14.000,00"
   },
   {
    "sku": "BS-APL-275",
    "label": "512GB Star White",
    "price": "R$ 15.200,00"
   },
   {
    "sku": "BS-APL-276",
    "label": "1TB Star White",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-277",
    "label": "2TB Star White",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Apple MacBook Air M5 13 polegadas",
  "category": "Notebooks & Periféricos",
  "price": "Consulte",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-APL-278",
    "label": "512GB Sky Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-279",
    "label": "512GB Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-280",
    "label": "512GB Starlight",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-281",
    "label": "512GB Midnight",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Apple AirPods Max 2 (Smart Case)",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-APL-287",
    "label": "Orange",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-294",
    "label": "Azul",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-295",
    "label": "Roxo",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-296",
    "label": "Preto",
    "price": "Consulte"
   }
  ]
 },
 {
  "sku": "BS-APL-289",
  "name": "Apple AirPods 4 ANC",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-290",
  "name": "Apple AirPods 5",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-297",
  "name": "Apple iPhone 16 CPO 128GB Pink",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-298",
  "name": "Apple iPhone Pocket 40cm",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-299",
  "name": "Apple iPhone Pocket 80cm",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "name": "Apple Watch S12",
  "category": "Smartwatches",
  "price": "Consulte",
  "icon": "watch",
  "variants": [
   {
    "sku": "BS-APL-300",
    "label": "42mm Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-301",
    "label": "42mm Bronze",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-302",
    "label": "42mm Light Gold",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-303",
    "label": "46mm Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-304",
    "label": "46mm Dark Bronze",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-318",
    "label": "46mm Light Gold",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Apple iPad 11",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-APL-305",
    "label": "128GB Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-306",
    "label": "128GB Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-307",
    "label": "128GB Pink",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-308",
    "label": "128GB Yellow",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Apple MacBook Neo",
  "category": "Notebooks & Periféricos",
  "price": "Consulte",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-APL-309",
    "label": "256GB Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-310",
    "label": "256GB Blush",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-311",
    "label": "256GB Citrus",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-312",
    "label": "256GB Indigo",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-313",
    "label": "512GB Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-314",
    "label": "512GB Blush",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-315",
    "label": "512GB Citrus",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-316",
    "label": "512GB Indigo",
    "price": "Consulte"
   }
  ]
 },
 {
  "sku": "BS-APL-317",
  "name": "Apple iPad Air M4 11\" 128GB Space Gray",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "name": "Apple Watch Ultra 3",
  "category": "Smartwatches",
  "price": "Consulte",
  "icon": "watch",
  "variants": [
   {
    "sku": "BS-APL-319",
    "label": "49mm Natural Titanium",
    "price": "Consulte"
   },
   {
    "sku": "BS-APL-320",
    "label": "49mm Black Titanium",
    "price": "Consulte"
   }
  ]
 },
 {
  "sku": "BS-AUD-002",
  "name": "HopeStar A60 + 2 Microfones",
  "category": "Áudio & Som",
  "price": "Consulte",
  "icon": "speaker"
 },
 {
  "sku": "BS-AUD-004",
  "name": "Sing-e Caixa de Som ZQS-X7 50W x2",
  "category": "Áudio & Som",
  "price": "Consulte",
  "icon": "speaker"
 },
 {
  "sku": "BS-ELE-001",
  "name": "Ninja Pro Airfryer",
  "category": "Cozinha & Casa",
  "price": "Consulte",
  "icon": "fryer"
 },
 {
  "sku": "BS-ELE-002",
  "name": "Ninja Foodi Airfryer",
  "category": "Cozinha & Casa",
  "price": "Consulte",
  "icon": "fryer"
 },
 {
  "sku": "BS-ELE-003",
  "name": "Roku Streaming Stick 4K",
  "category": "Smart & Tech",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "name": "Rastreador Connecta",
  "category": "Smart & Tech",
  "price": "Consulte",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-RAS-001",
    "label": "Apple",
    "price": "Consulte"
   },
   {
    "sku": "BS-RAS-002",
    "label": "Android",
    "price": "Consulte"
   }
  ]
 },
 {
  "sku": "BS-TEC-001",
  "name": "Logitech Teclado MK235",
  "category": "Notebooks & Periféricos",
  "price": "Consulte",
  "icon": "keyboard"
 },
 {
  "sku": "BS-TEC-002",
  "name": "Logitech Teclado MK250",
  "category": "Notebooks & Periféricos",
  "price": "Consulte",
  "icon": "keyboard"
 },
 {
  "sku": "BS-TEC-003",
  "name": "Logitech Teclado MK470",
  "category": "Notebooks & Periféricos",
  "price": "Consulte",
  "icon": "keyboard"
 },
 {
  "sku": "BS-TEC-004",
  "name": "Logitech Teclado MK220",
  "category": "Notebooks & Periféricos",
  "price": "Consulte",
  "icon": "keyboard"
 },
 {
  "sku": "BS-VG-001",
  "name": "Nintendo Switch OLED",
  "category": "Consoles",
  "price": "Consulte",
  "icon": "console"
 },
 {
  "sku": "BS-VG-002",
  "name": "Sony PlayStation 5",
  "category": "Consoles",
  "price": "Consulte",
  "icon": "console"
 },
 {
  "sku": "BS-VG-003",
  "name": "Sony PlayStation 5 Pro",
  "category": "Consoles",
  "price": "Consulte",
  "icon": "console"
 },
 {
  "sku": "BS-VG-005",
  "name": "Hori Split",
  "category": "Acessórios Gaming",
  "price": "Consulte",
  "icon": "gamepad"
 },
 {
  "sku": "BS-VG-006",
  "name": "Blink Door",
  "category": "Smart & Tech",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-VG-007",
  "name": "Genérico Kit Gamer Teclado",
  "category": "Acessórios Gaming",
  "price": "Consulte",
  "icon": "gamepad"
 },
 {
  "sku": "BS-VG-009",
  "name": "Microsoft Controle Xbox Elite Series 2",
  "category": "Acessórios Gaming",
  "price": "Consulte",
  "icon": "gamepad"
 },
 {
  "sku": "BS-VG-010",
  "name": "Rockstar Games GTA VI - PS5",
  "category": "Consoles",
  "price": "R$ 320,00",
  "icon": "console"
 },
 {
  "name": "Oura Ring",
  "category": "Wearables",
  "price": "Consulte",
  "icon": "ring",
  "variants": [
   {
    "sku": "BS-WEA-001",
    "label": "Tamanho 7 Rose",
    "price": "Consulte"
   },
   {
    "sku": "BS-WEA-002",
    "label": "Tamanho 8 Rose",
    "price": "Consulte"
   },
   {
    "sku": "BS-WEA-003",
    "label": "Tamanho 9 Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-WEA-004",
    "label": "Tamanho 10 Silver",
    "price": "Consulte"
   },
   {
    "sku": "BS-WEA-012",
    "label": "Tamanho 7 Gold",
    "price": "Consulte"
   },
   {
    "sku": "BS-WEA-013",
    "label": "Tamanho 8 Gold",
    "price": "Consulte"
   }
  ]
 },
 {
  "sku": "BS-WEA-005",
  "name": "Google Fit",
  "category": "Wearables",
  "price": "Consulte",
  "icon": "watch"
 },
 {
  "sku": "BS-WEA-006",
  "name": "Garmin Forerunner 165 Black",
  "category": "Smartwatches",
  "price": "Consulte",
  "icon": "watch"
 },
 {
  "name": "Huawei Watch GT5",
  "category": "Smartwatches",
  "price": "Consulte",
  "icon": "watch",
  "variants": [
   {
    "sku": "BS-WEA-007",
    "label": "41mm White & Gold",
    "price": "Consulte"
   },
   {
    "sku": "BS-WEA-008",
    "label": "41mm Brown Woven",
    "price": "Consulte"
   },
   {
    "sku": "BS-WEA-009",
    "label": "46mm Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-WEA-010",
    "label": "46mm Brown prateado",
    "price": "Consulte"
   },
   {
    "sku": "BS-WEA-011",
    "label": "46mm Blue prateado",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Xiaomi Redmi Pad 2",
  "category": "Smart & Tech",
  "price": "Consulte",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-XIA-001",
    "label": "128GB/4GB Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-XIA-002",
    "label": "128GB/4GB Green",
    "price": "Consulte"
   },
   {
    "sku": "BS-XIA-011",
    "label": "128GB/4GB Gray",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Xiaomi Redmi A7 Pro",
  "category": "Smart & Tech",
  "price": "Consulte",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-XIA-003",
    "label": "64GB/4GB Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-XIA-004",
    "label": "64GB/4GB Green",
    "price": "Consulte"
   },
   {
    "sku": "BS-XIA-005",
    "label": "128GB/4GB Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-XIA-006",
    "label": "128GB/4GB Green",
    "price": "Consulte"
   },
   {
    "sku": "BS-XIA-007",
    "label": "128GB/4GB Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-XIA-012",
    "label": "64GB/4GB Blue",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Xiaomi Redmi Note 15",
  "category": "Smart & Tech",
  "price": "Consulte",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-XIA-008",
    "label": "256GB/8GB Black",
    "price": "Consulte"
   },
   {
    "sku": "BS-XIA-009",
    "label": "256GB/8GB Blue",
    "price": "Consulte"
   },
   {
    "sku": "BS-XIA-010",
    "label": "256GB/8GB Purple",
    "price": "Consulte"
   }
  ]
 },
 {
  "name": "Xiaomi Poco X8 Pro",
  "category": "Smart & Tech",
  "price": "Consulte",
  "icon": "tag",
  "variants": [
   {
    "sku": "BS-XIA-013",
    "label": "12/512GB Mint Green",
    "price": "Consulte"
   },
   {
    "sku": "BS-XIA-014",
    "label": "12/512GB Yellow",
    "price": "Consulte"
   }
  ]
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
  "hopestar-a60-450w-2-microfones": "https://pag.getnet.com.br/fSenl2bPf",
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
  "iphone-pocket-40-cm": "https://pag.getnet.com.br/vot-tki2H",
  "logitech-mk220-teclado-mouse-sem-fio": "https://pag.getnet.com.br/_GNWjtnut",
  "logitech-mk235-ii-teclado-mouse-sem-fio": "https://pag.getnet.com.br/nBU-mb0qg",
  "logitech-mk250-teclado-mouse-sem-fio": "https://pag.getnet.com.br/GGw_nqARQ",
  "logitech-mk470-teclado-mouse-sem-fio": "https://pag.getnet.com.br/ZTrxmJqJA",
  "airfryer-ninja-pro": "https://pag.getnet.com.br/SlnqgvSeX",
  "airfryer-ninja-foodi": "https://pag.getnet.com.br/Sdzhnv0He"
};
