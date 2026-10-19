# Autenticação

`POST /users` é público e exige `name`, `email`, `username` e `password`:

```json
{
  "name": "Rafael",
  "email": "user@example.com",
  "username": "rafael",
  "password": "Uma-senha-segura-42"
}
```

E-mail e username são únicos, normalizados para minúsculas e sem espaços nas extremidades. Username aceita de 3 a 30 caracteres (`a-z`, `0-9`, `_`). Senha aceita de 8 a 128 caracteres e preserva espaços; não pode conter somente espaços. O nome de exibição continua em `name`. `PATCH /users/:id` altera somente esse nome; não redefine credenciais.

Senhas usam scrypt do Node.js (`N=131072`, `r=8`, `p=1`, salt aleatório de 16 bytes, chave de 64 bytes). `passwordHash` nunca é retornado nas respostas HTTP. Nenhuma dependência nova foi necessária. [Parâmetros recomendados pela OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

## Login e renovação

| Método | Rota | Corpo / autenticação |
| --- | --- | --- |
| POST | `/auth/login` | `{ "email": "user@example.com", "password": "Uma-senha-segura-42" }` |
| POST | `/auth/refresh` | `{ "refreshToken": "rt_..." }` |
| POST | `/auth/logout` | `{ "refreshToken": "rt_..." }`; retorna 204 |
| GET | `/auth/me` | `Authorization: Bearer at_...` |

Login retorna `user`, `accessToken`, `refreshToken`, `tokenType: "Bearer"`, `expiresIn: 900` (segundos) e `refreshExpiresAt` (ISO 8601). Renovação retorna os mesmos campos de tokens, sem `user`. Respostas de autenticação usam `Cache-Control: no-store`.

Tokens são opacos, gerados com 32 bytes aleatórios. O banco guarda somente hashes SHA-256 dos tokens, apropriados para segredos aleatórios de alta entropia; senhas continuam usando scrypt.

- Access token: 15 minutos.
- Refresh token: janela de 30 dias desde o login ou a última renovação, limitada a 60 dias desde o login. Após esse limite é necessário entrar novamente.
- Cada renovação troca os dois tokens. O par anterior deixa de funcionar. O cliente deve salvar o novo par e enviar apenas uma renovação por vez, inclusive entre abas.
- Reutilizar qualquer refresh token consumido revoga toda a sessão daquele login, inclusive os novos tokens. Outros logins/dispositivos continuam válidos.
- O banco preserva os hashes dos refresh tokens consumidos para detectar reutilização. Rotação e revogação usam uma transação e bloqueio da sessão para serializar requisições concorrentes.
- Logout aceita o refresh token atual ou anterior da sessão e revoga o access token imediatamente. É idempotente e funciona sem access token válido.
- Refresh expirado ou desconhecido retorna 401. Credenciais incorretas usam a mesma mensagem para e-mail inexistente e senha errada.

Esse fluxo oferece login persistente. A implementação interna de sessões do aplicativo Instagram não foi confirmada; os prazos acima são decisões desta API. A rotação com detecção de reutilização segue a [RFC 9700, seção 4.14](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14).

O cliente envia tokens em JSON nos endpoints de autenticação e usa Bearer nas demais rotas. Em produção, use HTTPS e armazenamento seguro apropriado ao cliente. Tokens não devem ir em URLs, logs ou repositórios. Não há cookies de sessão nesta API.

## Acesso aos dados

São públicas: `GET /`, `POST /users`, login, refresh, logout e a documentação Swagger. As demais rotas exigem access token. Use **Authorize** no Swagger (`/docs`).

Os campos `userId` existentes nos corpos e filtros continuam obrigatórios onde já eram exigidos e devem coincidir com o usuário autenticado; outra identidade retorna 403. Rotas por ID de usuário, treino ou sessão de outro proprietário retornam 404. `GET /users` retorna somente o próprio usuário. Exercícios continuam sendo definições compartilhadas, acessíveis a usuários autenticados.

Cadastro e endpoints públicos de autenticação têm limite de 20 requisições por minuto por IP, com resposta 429. O limitador usa memória por processo; múltiplas instâncias precisam de limitação compartilhada no gateway ou de uma implementação distribuída. O limite não substitui a janela de expiração das sessões.

## Migração do banco existente

As migrations foram aplicadas ao banco configurado, preservando o ID e o histórico do usuário existente. As credenciais foram preenchidas diretamente apenas nesse registro. Não existe senha padrão, seed de credenciais ou redefinição automática na inicialização.

Para outro banco que ainda tenha usuários sem credenciais, aplique primeiro a expansão:

```bash
yarn prisma db migrate --to 20261019T1605_add_authentication
```

Antes de prosseguir, atribua a cada usuário e-mail e username únicos e um hash criado por `hashPassword` em `src/auth/password.ts`, usando uma operação administrativa controlada. Não grave a senha em texto plano. A etapa seguinte exige campos preenchidos e falha se encontrar `NULL`; ela não inventa credenciais:

```bash
yarn prisma db migrate --advance-ref db
```

Em um banco vazio, as duas etapas podem ser aplicadas juntas. O contrato final exige as três colunas. Os artefatos Prisma foram regenerados pelo CLI.
