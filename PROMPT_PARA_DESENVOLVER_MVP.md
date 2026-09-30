# Prompt de desenvolvimento — LiDire MVP 1.0

Desenvolver o MVP 1.0 do aplicativo LiDire — “Seu Copiloto para a Vida”.

## Identidade visual obrigatória

- Manter interface escura.
- Fundo principal: #070C22.
- Fundo secundário: #0B1230.
- Cards: #101A3B e #141F47.
- Texto: #F7F8FF.
- Texto secundário: #A9B0CA.
- Gradiente principal: #7B2CFF → #2E75FF → #12D9D2.
- Acento rosa: #E91E9B.
- Fontes: Poppins para títulos e Inter para textos.
- Usar exclusivamente o arquivo `logo-lidire-oficial.png` fornecido. Não redesenhar, substituir ou alterar o logotipo.

## Módulos

Home / Meu Dia, autenticação, perfil, Agenda, Tarefas, Lembretes, Compras, Hidratação, Estudos, Treinos, Finanças, Objetivos, Resumo diário/semanal, Assistente LiDire e Família.

## Regras funcionais

Nenhum botão deve ser meramente decorativo. Cada ação deve abrir uma tela, formulário, confirmação ou executar uma função.

Agenda e tarefas são entidades diferentes.

Treinos devem suportar exercício, carga, meta de repetições e repetições executadas.

Finanças devem suportar receitas, despesas e despesas fixas.

Objetivos devem combinar meta, prazo, valor acumulado, tarefas relacionadas e progresso.

Família deve permitir compartilhamento futuro de compromissos, listas de compras, treinos, estudos e outras informações autorizadas.

## Arquitetura

A versão atual usa armazenamento local para permitir testes imediatos.

A próxima etapa deve conectar Cloudflare Workers + D1, autenticação segura e isolamento dos dados por usuário.

Não usar dados estáticos como substituto das funcionalidades.
