# Compreender as estatísticas

O Shortn conta cada visita aos seus links curtos e códigos QR. Este guia explica o que é contado, como restringir os números com intervalos, análises e filtros, como os exportar e como os dados dos visitantes são protegidos.

## Cliques e leituras

O Shortn regista dois tipos de visita:

- um **clique** é uma visita através de um link curto, seja escrito, tocado ou aberto a partir de outro site;
- uma **leitura** é uma visita através de um dos seus códigos QR.

O filtro **Tipo** alterna entre **Cliques e leituras**, **Cliques** e **Leituras QR**. O resumo no topo mostra também os **Visitantes únicos** e o **País principal**.

## Onde encontrar as estatísticas

- **Estatísticas**, na barra lateral, abrange todo o espaço de trabalho.
- O separador **Estatísticas** de um link abrange esse link.
- O separador **Leituras** de um código QR abrange esse código.
- O separador **Estatísticas** de uma campanha abrange os links dessa campanha.
- O separador **Estatísticas** de uma página bio mostra as visualizações, os cliques e a taxa de cliques da página.

Todos, exceto o das páginas bio, partilham os mesmos controlos.

## Escolher um intervalo de datas

1. Abra **Intervalo de datas** e escolha **Últimos 7 dias**, **Últimos 30 dias**, **Últimos 90 dias** ou **Últimos 12 meses**, ou defina um **Intervalo personalizado** com as datas **De** e **Até**.
2. Escolha o **Intervalo** para agrupar o gráfico por hora, dia, semana ou mês.

Até onde pode recuar depende do histórico de estatísticas do plano. Quando um intervalo começa mais cedo, a página indica a data a partir da qual os dados ficam fora do período do plano e mostra o que estiver disponível. Consulte os [Preços](/pt/pricing) para ver o histórico de cada plano.

## Análises

Por baixo do gráfico, as análises agrupam as visitas por:

- **Links**
- **Países** e **Cidades**
- **Origens**: o site de onde veio a visita. Direto significa que não houve site de origem, como num endereço escrito, numa aplicação ou numa leitura de código QR.
- **Dispositivos**, **Navegadores** e **Sistemas operativos**
- **Origens UTM**, **Meios UTM** e **Campanhas UTM**
- **Regras de destino**: a regra de redirecionamento que escolheu o destino, nos links com regras por país, por dispositivo ou de rotação.

Cada análise mostra as linhas principais; selecione **Ver tudo** para a lista completa. As análises além dos links, e a filtragem por elas, dependem do plano.

## Filtrar a vista

Selecione um valor numa análise para filtrar a página inteira, ou abra os filtros para combinar vários, por exemplo um link, um país e dispositivos móveis. Selecione **Limpar tudo** para os retirar.

Todos os filtros ficam no endereço da página, por isso pode guardar uma vista nos favoritos ou partilhá-la com um colega que tenha acesso ao espaço de trabalho.

## Exportar estatísticas

1. Defina o intervalo e os filtros pretendidos.
2. Selecione **Exportar estatísticas**.
3. Em **Dados**, escolha **Agregados** para totais por período e por grupo, ou **Eventos individuais** para uma linha por visita.
4. Escolha o formato (CSV, ou NDJSON para eventos individuais) e selecione **Preparar exportação**.

As exportações correm em segundo plano, por isso pode sair da página. Os ficheiros prontos ficam no **Histórico de exportações**. Ficheiros e histórico expiram 24 horas após a preparação. A exportação mantém o período revisto, mesmo que o plano mude antes de ser executada. A exportação CSV depende do plano, e a exportação de campanhas tem um requisito de plano próprio.

## Privacidade

- Os endereços IP dos visitantes são guardados em forma de hash.
- Os endereços IP originais são apagados ao fim de 90 dias.
- As exportações de eventos individuais excluem endereços IP, hashes de visitantes e agentes do utilizador.
- O conteúdo incorporado nas páginas bio só é carregado depois de o visitante o pedir.

## Ler os números

- Compare o mesmo intervalo entre links, em vez de totais de intervalos com durações diferentes.
- Use as análises UTM para ver que canal resultou, e as regras de destino para comparar os destinos de um mesmo link.

## Próximos passos

- [Parâmetros UTM](/docs/pt/guides/links/utm-parameters)
- [Organizar campanhas](/docs/pt/guides/campaigns/organizing-campaigns)
- [Mudar de plano](/docs/pt/guides/billing/upgrading-plans)
