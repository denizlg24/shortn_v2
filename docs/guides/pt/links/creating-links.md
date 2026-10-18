# Criar links

Um link curto envia os visitantes para um URL de destino e conta cada visita. Este guia percorre o formulário de criação, do destino às regras avançadas de redirecionamento, e explica como importar links em massa.

## Criar um link

1. Abra **Links** na barra lateral e selecione **Novo link**. Também pode colar um URL em qualquer ponto da página de links, fora de um campo de texto, ou premir C.
2. Indique o **URL de destino**. É o único campo obrigatório.
3. Preencha, se quiser, os campos opcionais descritos abaixo.
4. Selecione **Criar link**.

O Shortn copia o novo link curto para a área de transferência e abre o respetivo resumo. Cada link criado conta para o limite mensal de links do plano, visível em **Utilização** na barra lateral.

## Sugestões de título e de chave

Ao colar um destino, o Shortn consulta a página. Quando os dados chegam, selecione **Usar título da página** para preencher o **Título**, ou **Usar chave sugerida** para adotar uma chave legível. O que tiver escrito nunca é substituído. Se a página não puder ser lida, escreva um título ou deixe o campo vazio.

## Chave personalizada

A chave é a parte que vem depois do domínio, por exemplo `exemplo` em `shortn.at/exemplo`. Deixe **Chave personalizada** vazia para obter uma chave aleatória, ou escreva uma com letras, algarismos, `-` e `_`. As chaves personalizadas dependem do plano; se o seu não as incluir, o formulário indica o plano que as inclui.

Se mais tarde mudar a chave, a chave antiga continua a redirecionar para o mesmo link.

## Título, descrição e etiquetas

O **Título** e a **Descrição** ajudam a encontrar o link nas listas e nas estatísticas. Os visitantes não os veem.

Em **Etiquetas**, pesquise uma etiqueta existente ou escreva uma nova para a criar. Cada link pode ter até 50 etiquetas. As etiquetas alimentam os filtros da página de links, do construtor de campanhas e do seletor de links das páginas bio.

## Palavra-passe

Em **Palavra-passe**, defina uma palavra-passe que os visitantes têm de introduzir antes de chegar ao destino e, opcionalmente, uma **Dica** mostrada na página de acesso. A proteção por palavra-passe depende do plano.

## Opções avançadas

Abra **Opções avançadas** para configurar regras de redirecionamento. Cada grupo mostra um resumo de uma linha com a configuração atual.

- **Agendamento e expiração**: defina **Disponível a partir de (UTC)** e **Expira em (UTC)**, um **Limite aproximado de visitas acumuladas** e um **URL alternativa quando indisponível** para quem chega fora desse período. O limite inclui leituras de códigos QR e é aproximado, porque visitas simultâneas podem ultrapassá-lo.
- **Destino por país**: envia visitantes de determinados países para outros URL. Use códigos de país de duas letras; aplica-se a primeira regra que corresponder.
- **Destino por dispositivo**: encaminha por sistema operativo, por tipo de dispositivo ou por ambos.
- **Rotação ponderada**: divide o tráfego entre até 10 destinos segundo pesos relativos. Quem regressa mantém o mesmo destino.
- **Links de aplicações**: abre uma aplicação iOS ou Android, com alternativa para o destino web ou para a loja de aplicações.
- **Redirecionamento e parâmetros**: encaminha os parâmetros recebidos, usa um redirecionamento permanente HTTP 301 e fixa valores UTM. Consulte [Parâmetros UTM](/docs/pt/guides/links/utm-parameters).
- **Pré-visualização social**: define o título, a descrição e a imagem que os robôs de pré-visualização mostram quando o link é partilhado.

## Importar links de um ficheiro CSV

Para criar muitos links de uma vez, selecione **Importar** na página de links. Carregue um ficheiro CSV em UTF-8 com linha de cabeçalho e até 50 000 linhas, associe as colunas, reveja o resultado da validação e crie os links válidos. Os links importados contam para o limite mensal do plano.

## Depois de criar o link

A página do link tem os separadores **Resumo**, **Estatísticas**, **Código QR**, **Variantes UTM** e **Editar**. No separador **Código QR**, selecione **Criar um código QR** para gerar um código imprimível que usa este link.

As alterações guardadas em **Editar** aplicam-se a partir do clique seguinte.

## Próximos passos

- [Gerir links](/docs/pt/guides/links/managing-links)
- [Parâmetros UTM](/docs/pt/guides/links/utm-parameters)
- [Criar códigos QR](/docs/pt/guides/qr-codes/creating-qr-codes)
