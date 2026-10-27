# SEO / Google (bgdstores.com)

Regenerate after any product/price change:  `node tools/seo-build.js`  (rewrites head tags, JSON-LD, sitemap.xml, robots.txt, feeds/google-merchant.xml). Retail prices only; atacado data is never read.

## Search Console (MB does the login)
1. search.google.com/search-console → Adicionar propriedade → **Prefixo do URL** → `https://bgdstores.com/` → Continuar.
2. Em "Outros métodos de verificação" → **Tag HTML** → copie a tag `<meta name="google-site-verification" content="...">` e envie ao GODaddy Covers (via Grok Bot). NÃO clique em Verificar ainda.
3. Nós colamos só o valor `content` em `tools/gsc-verification.txt`, rodamos o script e publicamos (a tag entra no `<head>` da home).
4. Quando avisarmos que está no ar → clique **Verificar**.
5. Menu Sitemaps → digite `sitemap.xml` → Enviar.
No DNS change is needed for this method.

## Merchant Center (listagens gratuitas)
1. merchants.google.com → criar conta grátis com o mesmo Google → nome da empresa BAGDA PERFUMES, país Brasil, site https://bgdstores.com/.
2. Informações da empresa: endereço Rua Barão de Ladário 670, Mega Polo Brás, Loja 357, 3º andar, São Paulo - SP; telefone +55 11 99287-3509.
3. Site: **Reivindicar site** → usa a verificação do Search Console (mesma conta) → Reivindicar.
4. Produtos → Adicionar produtos → **Arquivo** → **Busca programada** (scheduled fetch) → URL `https://bgdstores.com/feeds/google-merchant.xml`, frequência diária, idioma português, país Brasil, moeda BRL.
5. Programas → ativar **Listagens gratuitas**. Configurar frete e política de devolução (exigidos).
