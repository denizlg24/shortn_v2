# Organizar campanhas

Uma campanha agrupa as variantes UTM dos seus links para que os cliques possam ser lidos em conjunto. O título da campanha é o valor de `utm_campaign`, a campanha guarda valores sugeridos para os restantes parâmetros UTM e o construtor de UTM etiqueta muitos links de uma vez. As campanhas dependem do plano; se o seu não as incluir, a página de campanhas indica o plano que as inclui.

## Criar uma campanha

1. Abra **Campanhas** na barra lateral e selecione **Nova campanha**.
2. Indique um **Título**. É usado como `utm_campaign` nos URL que etiquetar, por isso escreva-o como deve aparecer nas estatísticas, por exemplo `saldos-primavera`.
3. Acrescente, se quiser, uma **Descrição**.
4. Selecione **Criar campanha**.

A campanha abre com os separadores **Resumo**, **Estatísticas**, **Construtor de UTM** e **Definições**.

## Definir valores UTM sugeridos

Abra **Definições** e preencha as **Predefinições UTM**: listas de origens, meios, termos e conteúdos sugeridos. Escreva um valor e prima Enter para o acrescentar. Os valores são guardados em minúsculas. O construtor de UTM e o formulário de variantes do link sugerem-nos, o que mantém a mesma grafia em toda a equipa.

Mudar o título da campanha atualiza as variantes guardadas. Os URL já partilhados mantêm o título antigo, e os respetivos cliques deixam de contar na campanha.

## Acrescentar links com o construtor de UTM

1. Abra **Construtor de UTM**, ou selecione **Construir um URL etiquetado** no resumo.
2. Em **Links**, selecione **Explorar ligações**. Filtre por etiquetas, pesquise ou agrupe os resultados por etiqueta. Marque links em quantas páginas precisar, ou use **Selecionar todos os resultados**, e depois selecione **Usar … ligações selecionadas**.
3. Preencha **Origem**, **Meio** e, se quiser, **Termo** e **Conteúdo**. O `utm_campaign` é sempre o título da campanha.
4. Verifique a pré-visualização do **URL etiquetado** e selecione **Copiar URL** se precisar dele já.
5. Selecione **Guardar como variante**. Com vários links selecionados, o botão grava a mesma variante em todos.

Um link entra na campanha quando uma das suas variantes UTM usa essa campanha. Enquanto a variante não for guardada, os cliques do link não contam na campanha.

Também é possível acrescentar variantes link a link, no separador **Variantes UTM** de cada link; consulte [Parâmetros UTM](/docs/pt/guides/links/utm-parameters).

## Mover links existentes para uma campanha

Em **Links**, selecione os links pretendidos, em várias páginas e filtros, e escolha **Mover para campanha**. Escolha a **Campanha de destino** e selecione **Mover ligações selecionadas**. Cada variante UTM mantém a origem, o meio, o termo e o conteúdo, e as predefinições da campanha não os substituem.

## Ler os resultados da campanha

O **Resumo** mostra os cliques, as leituras e os visitantes dos últimos 30 dias, e **Links e variantes** lista cada link com os seus URL etiquetados e cliques. Selecione **Copiar utm_campaign** para copiar o valor exato.

O separador **Estatísticas** abre as estatísticas completas filtradas pela campanha, com os mesmos intervalos de datas, análises e filtros da página **Estatísticas** do espaço de trabalho. A exportação CSV das estatísticas de uma campanha depende do plano. Consulte [Compreender as estatísticas](/docs/pt/guides/analytics/understanding-analytics).

## Encontrar campanhas

A lista de campanhas tem o campo **Pesquisar**, para títulos e descrições, e **Ordenar por**, com as opções mais recentes, mais antigas, mais links ou título.

## Eliminar uma campanha

No resumo, selecione **Eliminar campanha** e confirme. As variantes UTM são retiradas dos links e as predefinições UTM são apagadas. Os links continuam a funcionar. Os URL já partilhados com esse `utm_campaign` mantêm os cliques, mas nenhuma página de campanha os mostra.

## Sugestões

- Combine com a equipa um esquema de nomes para os títulos, como `estacao-ano-produto`, antes de começar a etiquetar.
- Use `utm_content` para comparar posições do mesmo link dentro de um canal.

## Próximos passos

- [Parâmetros UTM](/docs/pt/guides/links/utm-parameters)
- [Compreender as estatísticas](/docs/pt/guides/analytics/understanding-analytics)
