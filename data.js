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
  "sku": "BS-APL-001",
  "name": "Apple iPhone 13 256GB Midnight",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-002",
  "name": "Apple iPhone 13 512GB Midnight",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-003",
  "name": "Apple iPhone 13 256GB Starlight",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-004",
  "name": "Apple iPhone 13 512GB Starlight",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-005",
  "name": "Apple iPhone 13 256GB Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-006",
  "name": "Apple iPhone 13 512GB Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-007",
  "name": "Apple iPhone 13 256GB Pink",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-008",
  "name": "Apple iPhone 13 512GB Pink",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-009",
  "name": "Apple iPhone 13 256GB Green",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-010",
  "name": "Apple iPhone 13 512GB Green",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-011",
  "name": "Apple iPhone 13 256GB (PRODUCT)RED",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-012",
  "name": "Apple iPhone 13 512GB (PRODUCT)RED",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-013",
  "name": "Apple iPhone 13 mini 256GB Midnight",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-014",
  "name": "Apple iPhone 13 mini 512GB Midnight",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-015",
  "name": "Apple iPhone 13 mini 256GB Starlight",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-016",
  "name": "Apple iPhone 13 mini 512GB Starlight",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-017",
  "name": "Apple iPhone 13 mini 256GB Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-018",
  "name": "Apple iPhone 13 mini 512GB Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-019",
  "name": "Apple iPhone 13 mini 256GB Pink",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-020",
  "name": "Apple iPhone 13 mini 512GB Pink",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-021",
  "name": "Apple iPhone 13 mini 256GB Green",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-022",
  "name": "Apple iPhone 13 mini 512GB Green",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-023",
  "name": "Apple iPhone 13 mini 256GB (PRODUCT)RED",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-024",
  "name": "Apple iPhone 13 mini 512GB (PRODUCT)RED",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-025",
  "name": "Apple iPhone 13 Pro 256GB Graphite",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-026",
  "name": "Apple iPhone 13 Pro 512GB Graphite",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-027",
  "name": "Apple iPhone 13 Pro 1TB Graphite",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-028",
  "name": "Apple iPhone 13 Pro 256GB Gold",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-029",
  "name": "Apple iPhone 13 Pro 512GB Gold",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-030",
  "name": "Apple iPhone 13 Pro 1TB Gold",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-031",
  "name": "Apple iPhone 13 Pro 256GB Silver",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-032",
  "name": "Apple iPhone 13 Pro 512GB Silver",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-033",
  "name": "Apple iPhone 13 Pro 1TB Silver",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-034",
  "name": "Apple iPhone 13 Pro 256GB Sierra Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-035",
  "name": "Apple iPhone 13 Pro 512GB Sierra Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-036",
  "name": "Apple iPhone 13 Pro 1TB Sierra Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-037",
  "name": "Apple iPhone 13 Pro 256GB Alpine Green",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-038",
  "name": "Apple iPhone 13 Pro 512GB Alpine Green",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-039",
  "name": "Apple iPhone 13 Pro 1TB Alpine Green",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-040",
  "name": "Apple iPhone 13 Pro Max 256GB Graphite",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-041",
  "name": "Apple iPhone 13 Pro Max 512GB Graphite",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-042",
  "name": "Apple iPhone 13 Pro Max 1TB Graphite",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-043",
  "name": "Apple iPhone 13 Pro Max 256GB Gold",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-044",
  "name": "Apple iPhone 13 Pro Max 512GB Gold",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-045",
  "name": "Apple iPhone 13 Pro Max 1TB Gold",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-046",
  "name": "Apple iPhone 13 Pro Max 256GB Silver",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-047",
  "name": "Apple iPhone 13 Pro Max 512GB Silver",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-048",
  "name": "Apple iPhone 13 Pro Max 1TB Silver",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-049",
  "name": "Apple iPhone 13 Pro Max 256GB Sierra Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-050",
  "name": "Apple iPhone 13 Pro Max 512GB Sierra Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-051",
  "name": "Apple iPhone 13 Pro Max 1TB Sierra Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-052",
  "name": "Apple iPhone 13 Pro Max 256GB Alpine Green",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-053",
  "name": "Apple iPhone 13 Pro Max 512GB Alpine Green",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-054",
  "name": "Apple iPhone 13 Pro Max 1TB Alpine Green",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-055",
  "name": "Apple iPhone 14 256GB Midnight",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-056",
  "name": "Apple iPhone 14 512GB Midnight",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-057",
  "name": "Apple iPhone 14 256GB Starlight",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-058",
  "name": "Apple iPhone 14 512GB Starlight",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-059",
  "name": "Apple iPhone 14 256GB Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-060",
  "name": "Apple iPhone 14 512GB Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-061",
  "name": "Apple iPhone 14 256GB Purple",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-062",
  "name": "Apple iPhone 14 512GB Purple",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-063",
  "name": "Apple iPhone 14 256GB Yellow",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-064",
  "name": "Apple iPhone 14 512GB Yellow",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-065",
  "name": "Apple iPhone 14 256GB (PRODUCT)RED",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-066",
  "name": "Apple iPhone 14 512GB (PRODUCT)RED",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-067",
  "name": "Apple iPhone 14 Plus 256GB Midnight",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-068",
  "name": "Apple iPhone 14 Plus 512GB Midnight",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-069",
  "name": "Apple iPhone 14 Plus 256GB Starlight",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-070",
  "name": "Apple iPhone 14 Plus 512GB Starlight",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-071",
  "name": "Apple iPhone 14 Plus 256GB Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-072",
  "name": "Apple iPhone 14 Plus 512GB Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-073",
  "name": "Apple iPhone 14 Plus 256GB Purple",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-074",
  "name": "Apple iPhone 14 Plus 512GB Purple",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-075",
  "name": "Apple iPhone 14 Plus 256GB Yellow",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-076",
  "name": "Apple iPhone 14 Plus 512GB Yellow",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-077",
  "name": "Apple iPhone 14 Plus 256GB (PRODUCT)RED",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-078",
  "name": "Apple iPhone 14 Plus 512GB (PRODUCT)RED",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-079",
  "name": "Apple iPhone 14 Pro 256GB Space Black",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-080",
  "name": "Apple iPhone 14 Pro 512GB Space Black",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-081",
  "name": "Apple iPhone 14 Pro 1TB Space Black",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-082",
  "name": "Apple iPhone 14 Pro 256GB Silver",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-083",
  "name": "Apple iPhone 14 Pro 512GB Silver",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-084",
  "name": "Apple iPhone 14 Pro 1TB Silver",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-085",
  "name": "Apple iPhone 14 Pro 256GB Gold",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-086",
  "name": "Apple iPhone 14 Pro 512GB Gold",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-087",
  "name": "Apple iPhone 14 Pro 1TB Gold",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-088",
  "name": "Apple iPhone 14 Pro 256GB Deep Purple",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-089",
  "name": "Apple iPhone 14 Pro 512GB Deep Purple",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-090",
  "name": "Apple iPhone 14 Pro 1TB Deep Purple",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-091",
  "name": "Apple iPhone 14 Pro Max 256GB Space Black",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-092",
  "name": "Apple iPhone 14 Pro Max 512GB Space Black",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-093",
  "name": "Apple iPhone 14 Pro Max 1TB Space Black",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-094",
  "name": "Apple iPhone 14 Pro Max 256GB Silver",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-095",
  "name": "Apple iPhone 14 Pro Max 512GB Silver",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-096",
  "name": "Apple iPhone 14 Pro Max 1TB Silver",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-097",
  "name": "Apple iPhone 14 Pro Max 256GB Gold",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-098",
  "name": "Apple iPhone 14 Pro Max 512GB Gold",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-099",
  "name": "Apple iPhone 14 Pro Max 1TB Gold",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-100",
  "name": "Apple iPhone 14 Pro Max 256GB Deep Purple",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-101",
  "name": "Apple iPhone 14 Pro Max 512GB Deep Purple",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-102",
  "name": "Apple iPhone 14 Pro Max 1TB Deep Purple",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-103",
  "name": "Apple iPhone 15 256GB Black",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-104",
  "name": "Apple iPhone 15 512GB Black",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-105",
  "name": "Apple iPhone 15 256GB Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-106",
  "name": "Apple iPhone 15 512GB Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-107",
  "name": "Apple iPhone 15 256GB Green",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-108",
  "name": "Apple iPhone 15 512GB Green",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-109",
  "name": "Apple iPhone 15 256GB Yellow",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-110",
  "name": "Apple iPhone 15 512GB Yellow",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-111",
  "name": "Apple iPhone 15 256GB Pink",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-112",
  "name": "Apple iPhone 15 512GB Pink",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-113",
  "name": "Apple iPhone 15 Plus 256GB Black",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-114",
  "name": "Apple iPhone 15 Plus 512GB Black",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-115",
  "name": "Apple iPhone 15 Plus 256GB Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-116",
  "name": "Apple iPhone 15 Plus 512GB Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-117",
  "name": "Apple iPhone 15 Plus 256GB Green",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-118",
  "name": "Apple iPhone 15 Plus 512GB Green",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-119",
  "name": "Apple iPhone 15 Plus 256GB Yellow",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-120",
  "name": "Apple iPhone 15 Plus 512GB Yellow",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-121",
  "name": "Apple iPhone 15 Plus 256GB Pink",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-122",
  "name": "Apple iPhone 15 Plus 512GB Pink",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-123",
  "name": "Apple iPhone 15 Pro 256GB Black Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-124",
  "name": "Apple iPhone 15 Pro 512GB Black Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-125",
  "name": "Apple iPhone 15 Pro 1TB Black Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-126",
  "name": "Apple iPhone 15 Pro 256GB White Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-127",
  "name": "Apple iPhone 15 Pro 512GB White Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-128",
  "name": "Apple iPhone 15 Pro 1TB White Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-129",
  "name": "Apple iPhone 15 Pro 256GB Blue Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-130",
  "name": "Apple iPhone 15 Pro 512GB Blue Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-131",
  "name": "Apple iPhone 15 Pro 1TB Blue Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-132",
  "name": "Apple iPhone 15 Pro 256GB Natural Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-133",
  "name": "Apple iPhone 15 Pro 512GB Natural Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-134",
  "name": "Apple iPhone 15 Pro 1TB Natural Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-135",
  "name": "Apple iPhone 15 Pro Max 256GB Black Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-136",
  "name": "Apple iPhone 15 Pro Max 512GB Black Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-137",
  "name": "Apple iPhone 15 Pro Max 1TB Black Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-138",
  "name": "Apple iPhone 15 Pro Max 256GB White Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-139",
  "name": "Apple iPhone 15 Pro Max 512GB White Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-140",
  "name": "Apple iPhone 15 Pro Max 1TB White Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-141",
  "name": "Apple iPhone 15 Pro Max 256GB Blue Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-142",
  "name": "Apple iPhone 15 Pro Max 512GB Blue Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-143",
  "name": "Apple iPhone 15 Pro Max 1TB Blue Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-144",
  "name": "Apple iPhone 15 Pro Max 256GB Natural Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-145",
  "name": "Apple iPhone 15 Pro Max 512GB Natural Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-146",
  "name": "Apple iPhone 15 Pro Max 1TB Natural Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-147",
  "name": "Apple iPhone 16 128GB Black",
  "category": "Apple & Acessórios",
  "price": "R$ 4.400,00",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-148",
  "name": "Apple iPhone 16 512GB Black",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-149",
  "name": "Apple iPhone 16 128GB White",
  "category": "Apple & Acessórios",
  "price": "R$ 4.400,00",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-150",
  "name": "Apple iPhone 16 512GB White",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-151",
  "name": "Apple iPhone 16 128GB Pink",
  "category": "Apple & Acessórios",
  "price": "R$ 4.450,00",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-152",
  "name": "Apple iPhone 16 512GB Pink",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-153",
  "name": "Apple iPhone 16 128GB Teal",
  "category": "Apple & Acessórios",
  "price": "R$ 4.300,00",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-154",
  "name": "Apple iPhone 16 512GB Teal",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-155",
  "name": "Apple iPhone 16 128GB Ultramarine",
  "category": "Apple & Acessórios",
  "price": "R$ 4.350,00",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-156",
  "name": "Apple iPhone 16 512GB Ultramarine",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-157",
  "name": "Apple iPhone 16e 256GB Black",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-158",
  "name": "Apple iPhone 16e 512GB Black",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-159",
  "name": "Apple iPhone 16e 256GB White",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-160",
  "name": "Apple iPhone 16e 512GB White",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-161",
  "name": "Apple iPhone 16 Plus 256GB Black",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-162",
  "name": "Apple iPhone 16 Plus 512GB Black",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-163",
  "name": "Apple iPhone 16 Plus 256GB White",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-164",
  "name": "Apple iPhone 16 Plus 512GB White",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-165",
  "name": "Apple iPhone 16 Plus 256GB Pink",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-166",
  "name": "Apple iPhone 16 Plus 512GB Pink",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-167",
  "name": "Apple iPhone 16 Plus 256GB Teal",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-168",
  "name": "Apple iPhone 16 Plus 512GB Teal",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-169",
  "name": "Apple iPhone 16 Plus 256GB Ultramarine",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-170",
  "name": "Apple iPhone 16 Plus 512GB Ultramarine",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-171",
  "name": "Apple iPhone 16 Pro 256GB Black Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-172",
  "name": "Apple iPhone 16 Pro 512GB Black Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-173",
  "name": "Apple iPhone 16 Pro 1TB Black Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-174",
  "name": "Apple iPhone 16 Pro 256GB White Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-175",
  "name": "Apple iPhone 16 Pro 512GB White Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-176",
  "name": "Apple iPhone 16 Pro 1TB White Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-177",
  "name": "Apple iPhone 16 Pro 256GB Natural Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-178",
  "name": "Apple iPhone 16 Pro 512GB Natural Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-179",
  "name": "Apple iPhone 16 Pro 1TB Natural Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-180",
  "name": "Apple iPhone 16 Pro 256GB Desert Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-181",
  "name": "Apple iPhone 16 Pro 512GB Desert Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-182",
  "name": "Apple iPhone 16 Pro 1TB Desert Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-183",
  "name": "Apple iPhone 16 Pro Max 256GB Black Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-184",
  "name": "Apple iPhone 16 Pro Max 512GB Black Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-185",
  "name": "Apple iPhone 16 Pro Max 1TB Black Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-186",
  "name": "Apple iPhone 16 Pro Max 256GB White Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-187",
  "name": "Apple iPhone 16 Pro Max 512GB White Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-188",
  "name": "Apple iPhone 16 Pro Max 1TB White Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-189",
  "name": "Apple iPhone 16 Pro Max 256GB Natural Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-190",
  "name": "Apple iPhone 16 Pro Max 512GB Natural Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-191",
  "name": "Apple iPhone 16 Pro Max 1TB Natural Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-192",
  "name": "Apple iPhone 16 Pro Max 256GB Desert Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-193",
  "name": "Apple iPhone 16 Pro Max 512GB Desert Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-194",
  "name": "Apple iPhone 16 Pro Max 1TB Desert Titanium",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-195",
  "name": "Apple iPhone 17 256GB Black",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-196",
  "name": "Apple iPhone 17 512GB Black",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-197",
  "name": "Apple iPhone 17 256GB White",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-198",
  "name": "Apple iPhone 17 512GB White",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-199",
  "name": "Apple iPhone 17 256GB Mist Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-200",
  "name": "Apple iPhone 17 512GB Mist Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-201",
  "name": "Apple iPhone 17 256GB Sage",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-202",
  "name": "Apple iPhone 17 512GB Sage",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-203",
  "name": "Apple iPhone 17 256GB Lavender",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-204",
  "name": "Apple iPhone 17 512GB Lavender",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-205",
  "name": "Apple iPhone 17 Air 256GB Space Black",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-206",
  "name": "Apple iPhone 17 Air 512GB Space Black",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-207",
  "name": "Apple iPhone 17 Air 1TB Space Black",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-208",
  "name": "Apple iPhone 17 Air 256GB Cloud White",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-209",
  "name": "Apple iPhone 17 Air 512GB Cloud White",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-210",
  "name": "Apple iPhone 17 Air 1TB Cloud White",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-211",
  "name": "Apple iPhone 17 Air 256GB Light Gold",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-212",
  "name": "Apple iPhone 17 Air 512GB Light Gold",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-213",
  "name": "Apple iPhone 17 Air 1TB Light Gold",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-214",
  "name": "Apple iPhone 17 Air 256GB Sky Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-215",
  "name": "Apple iPhone 17 Air 512GB Sky Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-216",
  "name": "Apple iPhone 17 Air 1TB Sky Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-217",
  "name": "Apple iPhone 17 Pro 256GB Silver",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-218",
  "name": "Apple iPhone 17 Pro 512GB Silver",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-219",
  "name": "Apple iPhone 17 Pro 1TB Silver",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-220",
  "name": "Apple iPhone 17 Pro 256GB Cosmic Orange",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-221",
  "name": "Apple iPhone 17 Pro 512GB Cosmic Orange",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-222",
  "name": "Apple iPhone 17 Pro 1TB Cosmic Orange",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-223",
  "name": "Apple iPhone 17 Pro 256GB Deep Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-224",
  "name": "Apple iPhone 17 Pro 512GB Deep Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-225",
  "name": "Apple iPhone 17 Pro 1TB Deep Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-226",
  "name": "Apple iPhone 17 Pro Max 256GB Silver",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-227",
  "name": "Apple iPhone 17 Pro Max 512GB Silver",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-228",
  "name": "Apple iPhone 17 Pro Max 1TB Silver",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-229",
  "name": "Apple iPhone 17 Pro Max 2TB Silver",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-230",
  "name": "Apple iPhone 17 Pro Max 256GB Cosmic Orange",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-231",
  "name": "Apple iPhone 17 Pro Max 512GB Cosmic Orange",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-232",
  "name": "Apple iPhone 17 Pro Max 1TB Cosmic Orange",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-233",
  "name": "Apple iPhone 17 Pro Max 2TB Cosmic Orange",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-234",
  "name": "Apple iPhone 17 Pro Max 256GB Deep Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-235",
  "name": "Apple iPhone 17 Pro Max 512GB Deep Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-236",
  "name": "Apple iPhone 17 Pro Max 1TB Deep Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-237",
  "name": "Apple iPhone 17 Pro Max 2TB Deep Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-238",
  "name": "Apple iPhone 18 Pro 256GB Black",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-239",
  "name": "Apple iPhone 18 Pro 512GB Black",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-240",
  "name": "Apple iPhone 18 Pro 1TB Black",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-241",
  "name": "Apple iPhone 18 Pro 2TB Black",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-242",
  "name": "Apple iPhone 18 Pro 256GB Silver",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-243",
  "name": "Apple iPhone 18 Pro 512GB Silver",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-244",
  "name": "Apple iPhone 18 Pro 1TB Silver",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-245",
  "name": "Apple iPhone 18 Pro 2TB Silver",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-246",
  "name": "Apple iPhone 18 Pro 256GB Glacier",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-247",
  "name": "Apple iPhone 18 Pro 512GB Glacier",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-248",
  "name": "Apple iPhone 18 Pro 1TB Glacier",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-249",
  "name": "Apple iPhone 18 Pro 2TB Glacier",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-250",
  "name": "Apple iPhone 18 Pro 256GB Burgundy",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-251",
  "name": "Apple iPhone 18 Pro 512GB Burgundy",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-252",
  "name": "Apple iPhone 18 Pro 1TB Burgundy",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-253",
  "name": "Apple iPhone 18 Pro 2TB Burgundy",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-254",
  "name": "Apple iPhone 18 Pro Max 256GB Black",
  "category": "Apple & Acessórios",
  "price": "R$ 8.685,00",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-255",
  "name": "Apple iPhone 18 Pro Max 512GB Black",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-256",
  "name": "Apple iPhone 18 Pro Max 1TB Black",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-257",
  "name": "Apple iPhone 18 Pro Max 2TB Black",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-258",
  "name": "Apple iPhone 18 Pro Max 256GB Silver",
  "category": "Apple & Acessórios",
  "price": "R$ 8.500,00",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-259",
  "name": "Apple iPhone 18 Pro Max 512GB Silver",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-260",
  "name": "Apple iPhone 18 Pro Max 1TB Silver",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-261",
  "name": "Apple iPhone 18 Pro Max 2TB Silver",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-262",
  "name": "Apple iPhone 18 Pro Max 256GB Glacier",
  "category": "Apple & Acessórios",
  "price": "R$ 8.600,00",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-263",
  "name": "Apple iPhone 18 Pro Max 512GB Glacier",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-264",
  "name": "Apple iPhone 18 Pro Max 1TB Glacier",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-265",
  "name": "Apple iPhone 18 Pro Max 2TB Glacier",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-266",
  "name": "Apple iPhone 18 Pro Max 256GB Burgundy",
  "category": "Apple & Acessórios",
  "price": "R$ 8.645,00",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-267",
  "name": "Apple iPhone 18 Pro Max 512GB Burgundy",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-268",
  "name": "Apple iPhone 18 Pro Max 1TB Burgundy",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-269",
  "name": "Apple iPhone 18 Pro Max 2TB Burgundy",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-270",
  "name": "Apple iPhone 18 Duo (iPhone Duo) 256GB Night Sky",
  "category": "Apple & Acessórios",
  "price": "R$ 13.850,00",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-271",
  "name": "Apple iPhone 18 Duo (iPhone Duo) 512GB Night Sky",
  "category": "Apple & Acessórios",
  "price": "R$ 15.350,00",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-272",
  "name": "Apple iPhone 18 Duo (iPhone Duo) 1TB Night Sky",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-273",
  "name": "Apple iPhone 18 Duo (iPhone Duo) 2TB Night Sky",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-274",
  "name": "Apple iPhone 18 Duo (iPhone Duo) 256GB Star White",
  "category": "Apple & Acessórios",
  "price": "R$ 14.000,00",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-275",
  "name": "Apple iPhone 18 Duo (iPhone Duo) 512GB Star White",
  "category": "Apple & Acessórios",
  "price": "R$ 15.200,00",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-276",
  "name": "Apple iPhone 18 Duo (iPhone Duo) 1TB Star White",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-277",
  "name": "Apple iPhone 18 Duo (iPhone Duo) 2TB Star White",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-278",
  "name": "Apple MacBook Air M5 13 polegadas 512GB Sky Blue",
  "category": "Notebooks & Periféricos",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-279",
  "name": "Apple MacBook Air M5 13 polegadas 512GB Silver",
  "category": "Notebooks & Periféricos",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-280",
  "name": "Apple MacBook Air M5 13 polegadas 512GB Starlight",
  "category": "Notebooks & Periféricos",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-281",
  "name": "Apple MacBook Air M5 13 polegadas 512GB Midnight",
  "category": "Notebooks & Periféricos",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-287",
  "name": "Apple AirPods Max 2 (Smart Case) Orange",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
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
  "sku": "BS-APL-294",
  "name": "Apple AirPods Max 2 (Smart Case) Azul",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-295",
  "name": "Apple AirPods Max 2 (Smart Case) Roxo",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-296",
  "name": "Apple AirPods Max 2 (Smart Case) Preto",
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
  "sku": "BS-APL-300",
  "name": "Apple Watch S12 42mm Black",
  "category": "Smartwatches",
  "price": "Consulte",
  "icon": "watch"
 },
 {
  "sku": "BS-APL-301",
  "name": "Apple Watch S12 42mm Bronze",
  "category": "Smartwatches",
  "price": "Consulte",
  "icon": "watch"
 },
 {
  "sku": "BS-APL-302",
  "name": "Apple Watch S12 42mm Light Gold",
  "category": "Smartwatches",
  "price": "Consulte",
  "icon": "watch"
 },
 {
  "sku": "BS-APL-303",
  "name": "Apple Watch S12 46mm Black",
  "category": "Smartwatches",
  "price": "Consulte",
  "icon": "watch"
 },
 {
  "sku": "BS-APL-304",
  "name": "Apple Watch S12 46mm Dark Bronze",
  "category": "Smartwatches",
  "price": "Consulte",
  "icon": "watch"
 },
 {
  "sku": "BS-APL-305",
  "name": "Apple iPad 11 128GB Silver",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-306",
  "name": "Apple iPad 11 128GB Blue",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-307",
  "name": "Apple iPad 11 128GB Pink",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-308",
  "name": "Apple iPad 11 128GB Yellow",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-309",
  "name": "Apple MacBook Neo 256GB Silver",
  "category": "Notebooks & Periféricos",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-310",
  "name": "Apple MacBook Neo 256GB Blush",
  "category": "Notebooks & Periféricos",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-311",
  "name": "Apple MacBook Neo 256GB Citrus",
  "category": "Notebooks & Periféricos",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-312",
  "name": "Apple MacBook Neo 256GB Indigo",
  "category": "Notebooks & Periféricos",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-313",
  "name": "Apple MacBook Neo 512GB Silver",
  "category": "Notebooks & Periféricos",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-314",
  "name": "Apple MacBook Neo 512GB Blush",
  "category": "Notebooks & Periféricos",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-315",
  "name": "Apple MacBook Neo 512GB Citrus",
  "category": "Notebooks & Periféricos",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-316",
  "name": "Apple MacBook Neo 512GB Indigo",
  "category": "Notebooks & Periféricos",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-317",
  "name": "Apple iPad Air M4 11\" 128GB Space Gray",
  "category": "Apple & Acessórios",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-APL-318",
  "name": "Apple Watch S12 46mm Light Gold",
  "category": "Smartwatches",
  "price": "Consulte",
  "icon": "watch"
 },
 {
  "sku": "BS-APL-319",
  "name": "Apple Watch Ultra 3 49mm Natural Titanium",
  "category": "Smartwatches",
  "price": "Consulte",
  "icon": "watch"
 },
 {
  "sku": "BS-APL-320",
  "name": "Apple Watch Ultra 3 49mm Black Titanium",
  "category": "Smartwatches",
  "price": "Consulte",
  "icon": "watch"
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
  "sku": "BS-HOT-001",
  "name": "Hotway A18 Pro Max 256GB/6GB Burgundy",
  "category": "Smart & Tech",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-RAS-001",
  "name": "Rastreador Connecta Apple",
  "category": "Smart & Tech",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-RAS-002",
  "name": "Rastreador Connecta Android",
  "category": "Smart & Tech",
  "price": "Consulte",
  "icon": "tag"
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
  "sku": "BS-VG-004",
  "name": "Starlink Mini X",
  "category": "Starlink",
  "price": "Consulte",
  "icon": "dish"
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
  "sku": "BS-VG-008",
  "name": "Genérico Mouse Pad Gamer RPG",
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
  "sku": "BS-WEA-001",
  "name": "Oura Ring Tamanho 7 Rose",
  "category": "Wearables",
  "price": "Consulte",
  "icon": "ring"
 },
 {
  "sku": "BS-WEA-002",
  "name": "Oura Ring Tamanho 8 Rose",
  "category": "Wearables",
  "price": "Consulte",
  "icon": "ring"
 },
 {
  "sku": "BS-WEA-003",
  "name": "Oura Ring Tamanho 9 Black",
  "category": "Wearables",
  "price": "Consulte",
  "icon": "ring"
 },
 {
  "sku": "BS-WEA-004",
  "name": "Oura Ring Tamanho 10 Silver",
  "category": "Wearables",
  "price": "Consulte",
  "icon": "ring"
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
  "sku": "BS-WEA-007",
  "name": "Huawei Watch GT5 41mm White & Gold",
  "category": "Smartwatches",
  "price": "Consulte",
  "icon": "watch"
 },
 {
  "sku": "BS-WEA-008",
  "name": "Huawei Watch GT5 41mm Brown Woven",
  "category": "Smartwatches",
  "price": "Consulte",
  "icon": "watch"
 },
 {
  "sku": "BS-WEA-009",
  "name": "Huawei Watch GT5 46mm Black",
  "category": "Smartwatches",
  "price": "Consulte",
  "icon": "watch"
 },
 {
  "sku": "BS-WEA-010",
  "name": "Huawei Watch GT5 46mm Brown prateado",
  "category": "Smartwatches",
  "price": "Consulte",
  "icon": "watch"
 },
 {
  "sku": "BS-WEA-011",
  "name": "Huawei Watch GT5 46mm Blue prateado",
  "category": "Smartwatches",
  "price": "Consulte",
  "icon": "watch"
 },
 {
  "sku": "BS-WEA-012",
  "name": "Oura Ring Tamanho 7 Gold",
  "category": "Wearables",
  "price": "Consulte",
  "icon": "ring"
 },
 {
  "sku": "BS-WEA-013",
  "name": "Oura Ring Tamanho 8 Gold",
  "category": "Wearables",
  "price": "Consulte",
  "icon": "ring"
 },
 {
  "sku": "BS-XIA-001",
  "name": "Xiaomi Redmi Pad 2 128GB/4GB Black",
  "category": "Smart & Tech",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-XIA-002",
  "name": "Xiaomi Redmi Pad 2 128GB/4GB Green",
  "category": "Smart & Tech",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-XIA-003",
  "name": "Xiaomi Redmi A7 Pro 64GB/4GB Black",
  "category": "Smart & Tech",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-XIA-004",
  "name": "Xiaomi Redmi A7 Pro 64GB/4GB Green",
  "category": "Smart & Tech",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-XIA-005",
  "name": "Xiaomi Redmi A7 Pro 128GB/4GB Black",
  "category": "Smart & Tech",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-XIA-006",
  "name": "Xiaomi Redmi A7 Pro 128GB/4GB Green",
  "category": "Smart & Tech",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-XIA-007",
  "name": "Xiaomi Redmi A7 Pro 128GB/4GB Blue",
  "category": "Smart & Tech",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-XIA-008",
  "name": "Xiaomi Redmi Note 15 256GB/8GB Black",
  "category": "Smart & Tech",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-XIA-009",
  "name": "Xiaomi Redmi Note 15 256GB/8GB Blue",
  "category": "Smart & Tech",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-XIA-010",
  "name": "Xiaomi Redmi Note 15 256GB/8GB Purple",
  "category": "Smart & Tech",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-XIA-011",
  "name": "Xiaomi Redmi Pad 2 128GB/4GB Gray",
  "category": "Smart & Tech",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-XIA-012",
  "name": "Xiaomi Redmi A7 Pro 64GB/4GB Blue",
  "category": "Smart & Tech",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-XIA-013",
  "name": "Xiaomi Poco X8 Pro 12/512GB Mint Green",
  "category": "Smart & Tech",
  "price": "Consulte",
  "icon": "tag"
 },
 {
  "sku": "BS-XIA-014",
  "name": "Xiaomi Poco X8 Pro 12/512GB Yellow",
  "category": "Smart & Tech",
  "price": "Consulte",
  "icon": "tag"
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
