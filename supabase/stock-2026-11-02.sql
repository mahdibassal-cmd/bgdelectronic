-- Contagem inicial 2026-11-02 (MB). Idempotente: rodar de novo não duplica.
-- Entra via public.purchases (trigger purchase_ai soma estoque e grava product_costs).
-- Requer o usuário admin mahdibassal@icloud.com já criado em Auth.
begin;

-- 1) Produtos novos (preco_venda 0 = MB precisa definir o preço de venda)
insert into public.products (sku,marca,produto,tamanho,preco_venda,notas) values
('ARM-013','Armaf','Club de Nuit Imperial','105ml',0,'novo 2026-11-02: definir preço'),
('ARM-014','Armaf','Club de Nuit Sillage','105ml',0,'novo 2026-11-02: definir preço'),
('ARM-015','Armaf','Connoisseur Women','100ml',0,'novo 2026-11-02: definir preço'),
('MPF-038','MPF','Rhapsody','100ml',0,'novo 2026-11-02: definir preço'),
('MPF-039','MPF','Eternal Club','100ml',0,'novo 2026-11-02: definir preço'),
('HAM-001','Hamidi','Sundown','100ml',0,'novo 2026-11-02: definir preço'),
('HAM-002','Hamidi','Rose Rush','100ml',0,'novo 2026-11-02: definir preço'),
('HAM-003','Hamidi','Oud Admire','100ml',0,'novo 2026-11-02: definir preço'),
('HAR-001','Al Haramain','Amber Oud Gold Extreme','100ml',0,'novo 2026-11-02: definir preço')
on conflict (sku) do nothing;
update public.products set produto='Amber Oud Gold Extreme' where sku='HAR-001' and produto<>'Amber Oud Gold Extreme';

-- 2) Compras = contagem inicial (só insere se ainda não houver para esse SKU)
with admin as (
  select id from auth.users where lower(email) = 'mahdibassal@icloud.com' limit 1
), v(sku,qtd,custo) as (values
('ARM-003',4,195),('ARM-001',7,265),('ARM-008',3,140),('ARM-005',3,145),
('ARM-004',2,165),('ARM-013',2,190),('ARM-014',2,210),('ARM-011',10,130),
('MPF-022',5,100),('MPF-032',12,80),('MPF-038',10,80),('ARA-013',1,215),
('IBQ-001',1,200),('FER-002',4,95),('ARM-015',1,180),('HAM-001',1,100),
('MPF-029',1,80),('HAM-002',1,100),('HAR-001',1,240),('MPF-011',1,80),
('MPF-019',1,100),('HAM-003',2,100),('MPF-039',1,90),('MPF-018',1,100))
insert into public.purchases (sku,qtd,custo_unit,observacao,created_by)
select v.sku, v.qtd, v.custo, 'contagem-inicial-2026-11-02', (select id from admin)
from v
where not exists (select 1 from public.purchases p
                  where p.sku = v.sku and p.observacao = 'contagem-inicial-2026-11-02');
-- (se created_by vier nulo => erro NOT NULL: crie o admin primeiro)

commit;

select p.sku as code, p.marca||' '||p.produto as name, c.custo as cost, p.estoque as stock
from public.products p left join public.product_costs c using (sku)
where p.sku in ('ARM-003','ARM-001','ARM-008','ARM-005','ARM-004','ARM-013','ARM-014','ARM-011',
 'MPF-022','MPF-032','MPF-038','ARA-013','IBQ-001','FER-002','ARM-015','HAM-001','MPF-029',
 'HAM-002','HAR-001','MPF-011','MPF-019','HAM-003','MPF-039','MPF-018')
order by p.sku;
