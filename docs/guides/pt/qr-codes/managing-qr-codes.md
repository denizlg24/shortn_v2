# Gerir códigos QR

Este guia descreve as opções de design de um código QR, a exportação de ficheiros para impressão, a exportação de vários códigos num ficheiro ZIP e a eliminação de códigos.

## Encontrar os códigos

Abra **Códigos QR** na barra lateral. Use **Pesquisar** para procurar por título, destino ou código, filtre por **Etiqueta** e por **Criado** e alterne a **Disposição** entre **Grelha** e **Lista**. Selecione um código para abrir o resumo, onde estão os separadores **Resumo**, **Design**, **Leituras** e **Detalhes**.

## Opções de design

Abra o separador **Design**. A pré-visualização acompanha as alterações e indica quando inclui alterações por guardar. Selecione **Guardar design** para as aplicar.

- **Cores**: escolha uma predefinição ou defina as cores do **Código** e do **Fundo**. Em **Cantos**, mantenha a cor do código ou escolha outra cor para os cantos.
- **Padrão**: escolha a forma dos **Pontos**, dos **Quadrados dos cantos** e dos **Pontos dos cantos**. As formas só mudam o aspeto; o link mantém-se.
- **Correção de erros**: escolha um **Nível**. Níveis mais altos permitem que o código resista a riscos e a um logótipo, à custa de um padrão mais denso.
- **Logótipo**: carregue uma imagem para o centro do código, ajuste o **Tamanho do logótipo** e, se quiser, ative **Esconder o padrão atrás do logótipo**. Mantenha o logótipo em 50% da correção de erros ou menos. Os logótipos dependem do plano.
- **Forma e legenda**: escolha uma **Forma** quadrada ou circular, uma **Moldura** (nenhuma, contorno ou sólida) e uma **Legenda** opcional até 64 caracteres. Molduras e legendas ficam fora do espaço livre à volta do código e aparecem nas transferências.

O painel **Verificação de leitura** avalia o contraste entre o código e o fundo e avisa sobre cores invertidas, fundo transparente e tamanho do logótipo. Use os avisos como motivo para testar com telemóveis reais antes de imprimir.

## Exportar para impressão

1. No resumo do código, em **Transferir**, selecione **Exportar para impressão**.
2. Escolha o **Formato** (SVG, PNG ou PDF) e o **Tamanho**.
3. Leia as indicações de impressão na página: quatro módulos de margem à volta do código, correção Q (H com logótipo), contraste mínimo de 3:1 e o tamanho mínimo recomendado a 300 dpi.
4. Selecione **Preparar transferência** e depois **Transferir ficheiro**.

As transferências expiram 24 horas após iniciar a exportação. Para uso em ecrã, **JPEG para ecrãs** no resumo gera um JPEG de imediato.

## Exportar vários códigos num ZIP

1. Na lista de códigos QR, marque os códigos pretendidos ou use **Selecionar esta página**. A seleção mantém-se ao mudar de página e de filtros.
2. Selecione **Exportar seleção**.
3. Reveja a seleção. Os filtros desta página só mudam a lista apresentada; o ZIP inclui todos os códigos selecionados.
4. Escolha o **Formato** e o **Tamanho** e selecione **Criar ZIP**.
5. Quando a exportação estiver pronta, selecione **Transferir ZIP**.

A página de exportação indica quantos códigos cabem num ZIP. Pode sair da página durante a exportação; o processo continua em segundo plano.

## Editar detalhes e destino

O separador **Detalhes** reúne o **URL de destino**, o **Título** e as **Etiquetas**. Mudar o destino não altera o padrão impresso; as cópias impressas seguem o novo destino a partir da leitura seguinte. Selecione **Guardar detalhes** para aplicar.

## Leituras

O resumo mostra os últimos 30 dias: leituras, visitantes, leituras acumuladas e a data da última leitura. O separador **Leituras** abre as estatísticas completas do código. As leituras também aparecem na página **Estatísticas** do espaço de trabalho, separadas dos cliques nos links. Consulte [Compreender as estatísticas](/docs/pt/guides/analytics/understanding-analytics).

## Eliminar códigos QR

Selecione **Eliminar código QR** no resumo, ou selecione códigos na lista e escolha **Eliminar selecionados**. A página de confirmação explica o que acontece:

- o código deixa de funcionar de imediato, porque o seu link curto é eliminado com ele;
- os links a que o código estava associado continuam a funcionar e apenas perdem o código QR;
- o histórico de leituras é arquivado e deixa de ser mostrado.

A eliminação de um código QR não pode ser anulada e as cópias impressas não podem ser recuperadas. Os membros só podem eliminar os códigos que criaram.

## Próximos passos

- [Criar códigos QR](/docs/pt/guides/qr-codes/creating-qr-codes)
- [Criar páginas bio](/docs/pt/guides/bio-pages/creating-bio-pages)
