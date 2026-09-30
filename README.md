# LiDire MVP — Versão 4.1

Baseada na versão 3.9 com cadastro/autenticação PBKDF2 compatível com Cloudflare Workers.

## Alterações da 4.1
- Exibição clara do mínimo de 8 caracteres no cadastro.
- Foto de perfil com opção de câmera do celular e galeria.
- Navegação com histórico do navegador/Android e botão Voltar funcional.
- Seta superior direita transformada em Voltar.
- Acesso global aos recursos centralizado em Explorar; removidos atalhos globais duplicados da tela inicial.
- Registro do ciclo menstrual mantido e reforçado como ação funcional.
- Assistente com entrada por voz e leitura de respostas por áudio quando suportado pelo navegador.
- Opção “Esqueci minha senha” na tela de login e infraestrutura de tokens de recuperação no Worker. O envio efetivo do link por e-mail exige configuração de provedor de e-mail transacional no Cloudflare.

## Arquivos principais
- `index.html`
- `app.js`
- `index.js`
- `styles.css`
- `wrangler.toml`
- `schema.sql`
- `auth-schema.sql`
