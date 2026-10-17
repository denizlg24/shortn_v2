# Parâmetros UTM

Os parâmetros UTM são etiquetas no URL, como `utm_source=newsletter`, que as ferramentas de estatísticas leem para saber de onde veio uma visita. No Shortn surgem em três sítios: nas variantes UTM de um link, no construtor de UTM de uma campanha e nas definições de redirecionamento, que decidem que parâmetros chegam ao destino.

## Os cinco parâmetros

- `utm_source`: de onde vem o tráfego, por exemplo `newsletter` ou `facebook`.
- `utm_medium`: o tipo de canal, por exemplo `email` ou `social`.
- `utm_campaign`: a campanha a que a visita pertence.
- `utm_term`: a palavra-chave de pesquisa paga. Opcional.
- `utm_content`: distingue links semelhantes, como `cabecalho` e `rodape`. Opcional.

## Acrescentar variantes UTM a um link

Uma variante é uma versão etiquetada de um link curto para um canal. As visitas através dela são contadas por origem, meio e campanha.

1. Abra o link e selecione o separador **Variantes UTM**.
2. Selecione **Adicionar variante**.
3. Preencha **Origem**, **Meio** e **Campanha** e, se quiser, **Termo** e **Conteúdo**. Ao escolher uma campanha guardada, aparecem os valores sugeridos dessa campanha.
4. Selecione **Guardar variante**.

A lista de variantes mostra cada **URL etiquetado**: o link curto com os parâmetros acrescentados, por exemplo `shortn.at/primavera?utm_source=newsletter&utm_medium=email&utm_campaign=saldos-primavera`. Selecione **Copiar** para o copiar.

O valor de **Campanha** liga a variante à campanha com o mesmo nome, o que junta o link a essa campanha. As variantes UTM e as campanhas dependem do plano.

Para alterar uma variante, selecione **Editar**. Para a apagar, selecione **Remover** e confirme com **Remover variante**. Os URL já partilhados continuam a redirecionar e as estatísticas mantêm-se. Se era a última variante do link numa campanha, o link sai dessa campanha.

## Etiquetar muitos links de uma vez

Para etiquetar vários links para o mesmo canal, use o separador **Construtor de UTM** de uma campanha. Define sempre `utm_campaign` com o título da campanha, sugere os valores guardados e grava a mesma variante em todos os links selecionados. Consulte [Organizar campanhas](/docs/pt/guides/campaigns/organizing-campaigns).

## Controlar o que chega ao destino

O URL etiquetado leva os parâmetros até ao Shortn, que os regista com cada visita. Se são ou não passados ao destino depende das definições de redirecionamento do link.

1. Abra o separador **Editar** do link e expanda **Opções avançadas**.
2. Abra **Redirecionamento e parâmetros**.
3. Escolha as definições:
   - **Encaminhar parâmetros recebidos** passa ao destino os parâmetros do visitante, incluindo as etiquetas UTM.
   - Os campos `utm_source`, `utm_medium`, `utm_campaign`, `utm_term` e `utm_content` fixam valores que são sempre acrescentados ao destino.
4. Selecione **Guardar alterações**.

Quando o mesmo parâmetro aparece em mais de um sítio, aplicam-se estas regras:

- um valor UTM fixado nas definições de redirecionamento prevalece sempre;
- caso contrário, um parâmetro que já exista no URL de destino prevalece sobre o recebido;
- os parâmetros recebidos só são encaminhados com o encaminhamento ativo.

## Ler os resultados UTM

Na página **Estatísticas**, as análises **Origens UTM**, **Meios UTM** e **Campanhas UTM** agrupam as visitas por etiqueta, e é possível filtrar por qualquer valor. Estas análises dependem do plano. Consulte [Compreender as estatísticas](/docs/pt/guides/analytics/understanding-analytics).

## Boas práticas

- Escreva os valores em minúsculas e mantenha uma só grafia por canal, para que os resultados do mesmo canal não fiquem divididos por vários valores.
- Use `utm_content` para comparar posições do mesmo link, como o cabeçalho e o rodapé.
- Não acrescente etiquetas UTM a links que apontam para o seu próprio site; substituem a origem original da visita.

## Próximos passos

- [Organizar campanhas](/docs/pt/guides/campaigns/organizing-campaigns)
- [Gerir links](/docs/pt/guides/links/managing-links)
