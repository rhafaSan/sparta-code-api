# Sparta Workout API

Backend para planejamento e execução de treinos, usando NestJS 11, TypeScript, Prisma 8 RC e PostgreSQL. Implementa usuários, exercícios, treinos, sessões, séries, histórico e estatísticas básicas. Não inclui autenticação.

## Executar

Requisitos: Node.js 24, Yarn 1.22 e PostgreSQL 15 ou superior.

```bash
yarn install
# Configure DATABASE_URL no .env usando .env.example como referência.
yarn prisma contract emit
yarn db:verify
yarn start:dev
```

Se `yarn` não estiver no PATH, use `corepack yarn` nos comandos. A API escuta na porta `3000`, configurável por `PORT`. `GET /` identifica a aplicação. A inicialização verifica o acesso ao banco e falha se a conexão não estiver disponível.

O banco existente já está inicializado. Não execute uma reinicialização nele. Para um banco novo e vazio, configure sua própria `DATABASE_URL`, execute `yarn prisma db init` e revise o plano solicitado pelo CLI. O contrato é `src/prisma/contract.prisma`.

O descanso adiciona a coluna opcional `rest_seconds` em `workout_exercises` e `exercise_sessions`. Registros existentes ficam com `null`, sem atribuir um descanso ao histórico. Para atualizar seu banco local de desenvolvimento após emitir o contrato, revise `yarn prisma db update --dry-run` e aplique com `yarn prisma db update`. Em bancos compartilhados ou produção, use o fluxo de migrations revisadas do Prisma 8.

```bash
yarn build
yarn start:prod
```

A configuração ESM gera `dist/main.js`. `src/prisma/db.ts` mantém uma única instância do runtime; `PrismaService` a disponibiliza por injeção e fecha o pool no encerramento da aplicação. O polyfill Temporal é carregado antes do Prisma: os campos de data desta RC usam `Temporal.Instant`, serializado como string ISO no JSON.

## Rotas

IDs são UUIDs. Corpos de requisição usam `Content-Type: application/json`. Listagens retornam arrays com `limit` (padrão 20, máximo 100) e `offset` (padrão 0). Exercícios e treinos arquivados são ocultados por padrão; use `includeArchived=true` para incluí-los.

| Método | Rota | Finalidade |
| --- | --- | --- |
| POST / GET | `/users` | Criar / listar usuários |
| GET / PATCH | `/users/:id` | Consultar / alterar nome |
| POST / GET | `/exercises` | Criar / listar exercícios |
| GET / PATCH | `/exercises/:id` | Consultar / editar / arquivar |
| POST / GET | `/workouts` | Criar / listar treinos; GET exige `userId` |
| GET / PATCH | `/workouts/:id` | Consultar plano ativo / editar / arquivar |
| POST | `/workouts/:workoutId/exercises` | Adicionar exercício ao plano |
| PATCH / DELETE | `/workouts/:workoutId/exercises/:workoutExerciseId` | Editar configuração / arquivar vínculo |
| PUT | `/workouts/:workoutId/exercises/order` | Reordenar todos os vínculos ativos |
| POST | `/workout-sessions/start` | Iniciar sessão e criar snapshots |
| GET | `/workout-sessions?userId=UUID` | Histórico e sessões em andamento |
| GET | `/workout-sessions/:id` | Sessão, snapshots, séries e duração |
| PUT | `/workout-sessions/:sessionId/exercises/:exerciseSessionId/sets` | Criar / atualizar uma série pelo `setNumber` |
| PATCH | `/workout-sessions/:sessionId/exercises/:exerciseSessionId` | Atualizar conclusão, descanso ou notas do exercício |
| POST | `/workout-sessions/:id/finish` | Finalizar sessão |
| GET | `/workout-sessions/exercises/:exerciseId/performance?userId=UUID` | Execuções anteriores, mais recentes primeiro |
| GET | `/workout-sessions/exercises/:exerciseId/statistics?userId=UUID` | Séries concluídas, repetições e maior peso |

Histórico, desempenho e estatísticas aceitam filtro opcional `workoutId`. Desempenho retorna apenas exercícios de sessões finalizadas; `limit=1` consulta a execução anterior mais recente. Se o mesmo exercício aparece duas vezes no plano, cada execução é retornada separadamente. Estatísticas consideram somente séries concluídas de sessões finalizadas, abrangendo todo o histórico filtrado, independentemente da paginação.

`userId` identifica o proprietário para criação e consultas por usuário. Não é autenticação nem controle de acesso: as rotas por ID não exigem credenciais, conforme o escopo inicial.

## Exemplo do fluxo

Substitua os identificadores entre `<...>` pelos UUIDs retornados em cada etapa. Exemplos também estão em `requests.http`.

1. `POST /users`

```json
{ "name": "Rafael" }
```

2. `POST /exercises`

```json
{ "name": "Supino reto", "muscleGroup": "Peito" }
```

3. `POST /workouts`

```json
{ "userId": "<userId>", "name": "Treino de Peito" }
```

4. `POST /workouts/<workoutId>/exercises`

```json
{ "exerciseId": "<exerciseId>", "exerciseOrder": 1, "plannedSets": 4, "plannedReps": 10, "restSeconds": 90 }
```

5. `POST /workout-sessions/start`

```json
{ "userId": "<userId>", "workoutId": "<workoutId>" }
```

A resposta contém `id` da sessão e `exerciseSessions[].id`. A criação da sessão e dos snapshots ocorre em uma única transação. O proprietário deve corresponder ao do treino. Treinos arquivados ou sem exercícios elegíveis são recusados. Vínculos ou definições de exercício arquivados não entram em novas sessões.

6. `PUT /workout-sessions/<sessionId>/exercises/<exerciseSessionId>/sets`

```json
{ "setNumber": 1, "weight": "80.25", "reps": 10, "completed": true }
```

`weight` é uma **string decimal não negativa**, com até 40 caracteres, sem notação exponencial. Números JSON são rejeitados para evitar perda de precisão. `reps` é inteiro não negativo. Envie novamente o mesmo `setNumber` para atualizar a série existente. Omitir `completed` mantém o valor anterior em atualizações; em novas séries, o padrão é `false`. São permitidas séries adicionais além das planejadas.

7. `PATCH /workout-sessions/<sessionId>/exercises/<exerciseSessionId>`

```json
{ "completed": true }
```

A conclusão de uma série e a conclusão de um exercício são independentes. Não há conclusão automática nesta versão.

8. `POST /workout-sessions/<sessionId>/finish`

```json
{ "notes": "Treino concluído" }
```

É permitido encerrar um treino parcialmente executado. A operação é idempotente: chamadas posteriores preservam `finishedAt` e as notas originais. Sessões finalizadas recusam alterações em séries e exercícios. `durationSeconds` é calculado na consulta detalhada e permanece `null` enquanto a sessão estiver aberta.

## Descanso entre séries

`restSeconds` configura o intervalo entre as séries de um exercício, em segundos inteiros de `0` a `2147483647`. `0` indica sem descanso; `null` indica não configurado. Na criação, omitir o campo resulta em `null`; em atualizações, omitir preserva o valor atual.

Configure no `POST /workouts/:workoutId/exercises` ou no `PATCH /workouts/:workoutId/exercises/:workoutExerciseId`, por exemplo `{ "restSeconds": 90 }`. Cada exercício do plano pode ter um intervalo diferente.

Ao iniciar o treino, o descanso é copiado para `ExerciseSession` na mesma transação dos demais dados planejados. Alterações posteriores do plano afetam somente sessões futuras. As respostas de criação e consulta da sessão incluem `exerciseSessions[].restSeconds`.

Durante o treino, envie `{ "restSeconds": 60 }` ao `PATCH /workout-sessions/:sessionId/exercises/:exerciseSessionId` para ajustar o intervalo somente naquela execução. Sessões finalizadas recusam a alteração com `409`. Esse campo armazena o intervalo configurado, não mede o tempo efetivamente descansado nem executa um cronômetro.

## Arquivamento e ordem

Use `PATCH` com `{ "isActive": false }` para arquivar exercícios ou treinos. `DELETE` de um vínculo arquiva o `WorkoutExercise`. Histórico não é removido por essas rotas.

`exerciseOrder` é único dentro do treino, inclusive para vínculos arquivados. Uma posição ocupada retorna `409`. Para trocar posições, envie todos os IDs dos vínculos ativos, uma única vez, na ordem desejada:

```json
{ "workoutExerciseIds": ["<segundoVinculoId>", "<primeiroVinculoId>"] }
```

A reordenação atribui posições de 1 a N aos ativos e coloca arquivados após os ativos. Posições intermediárias são usadas somente dentro da transação. Para reativar um vínculo arquivado, use `PATCH` com `{ "isActive": true }`; a definição do exercício precisa estar ativa.

O mesmo exercício pode aparecer mais de uma vez no treino. A identidade `exerciseId` de um vínculo existente não é editável: arquive o vínculo e adicione outro. Isso preserva a associação das séries históricas com o exercício correto.

Alterar `plannedSets`, `plannedReps` ou a ordem não altera snapshots anteriores. Nomes e descrições continuam sendo consultados na definição atual do exercício; o contrato existente não mantém snapshot desses textos. Alterações do plano e início de sessões adquirem um lock no treino. Registro de séries, conclusão de exercícios e finalização adquirem um lock na sessão, mantido até o commit.

## Validação e respostas

DTOs rejeitam campos desconhecidos, UUIDs inválidos, nomes em branco, valores negativos e `null` em campos obrigatórios. `notes`, `description` e `muscleGroup` podem receber `null` para limpar o texto. Limites: nome 200 caracteres, notas/descrição 5000, grupo muscular 100, `plannedSets` até 1000 e reordenação até 1000 vínculos.

- `400`: entrada inválida.
- `404`: recurso inexistente ou vínculo fora do recurso pai informado.
- `409`: posição ocupada, entidade arquivada, sessão finalizada ou conflito de escrita.
- `500`: erro inesperado, sem exposição de detalhes do banco na resposta.

Estatísticas retornam `completedSets` como número, `totalReps` como string inteira e `maxWeight` como string decimal ou `null` quando não há pesos elegíveis.

## Verificação

```bash
yarn format:check
yarn typecheck
yarn lint
yarn test --runInBand
yarn test:e2e
yarn build
yarn db:verify
```

Os testes E2E usam o PostgreSQL apontado por `DATABASE_URL`. Criam usuários e exercícios com identificadores exclusivos e removem somente seus próprios registros em uma transação ao final. Para rodar em outro banco de desenvolvimento/teste, configure `DATABASE_URL` antes de executar. Testam o fluxo HTTP real, validação, snapshots, rollback com falha forçada, pesos decimais, gravações concorrentes, arquivamento, conclusão e histórico.

Os artefatos `contract.json` e `contract.d.ts` são gerados e estão excluídos da formatação e do lint. Ao modificar o contrato, execute `yarn prisma contract emit`; nunca edite esses artefatos manualmente.

Dependências adicionadas:

```bash
yarn add class-validator class-transformer temporal-polyfill
```

As duas primeiras suportam os DTOs e o ValidationPipe; a terceira fornece o Temporal exigido pelo codec de data desta versão do Prisma.

## Swagger

Com a API em execução, acesse http://localhost:3000/docs (ou a porta definida em `PORT`). O documento OpenAPI está em http://localhost:3000/docs-json.

Todas as rotas estão agrupadas por domínio, com parâmetros, corpos de requisição, exemplos e códigos de resposta. Expanda uma operação e use **Try it out** e **Execute** para testá-la. Crie primeiro um usuário e exercícios; reutilize os UUIDs retornados para criar treinos e iniciar sessões. Pesos devem ser enviados como strings decimais, por exemplo `"80.25"`.

A integração usa a dependência oficial do NestJS, instalada com:

```bash
yarn add @nestjs/swagger@^11
```

## Catálogo inicial de exercícios (seed)

O arquivo `exercises_catalog_pt.json` contém 232 exercícios. Execute a seed no banco indicado por `DATABASE_URL`:

```bash
yarn seed
```

O comando compila o projeto e executa `src/prisma/seed.ts`. A importação é transacional e usa os UUIDs do catálogo como identidade: executar novamente não duplica registros e preserva nomes editados, descrições, grupos musculares e arquivamentos. Cadastros manuais continuam independentes; nomes iguais com UUIDs diferentes não são mesclados. A seed não é executada automaticamente na inicialização da API.

Mapeamento: `id` mantém o UUID original, `namePt` vira `name`, `primaryMuscles` vira `muscleGroup` usando a taxonomia em português e `isActive` é preservado na criação. Nome inglês, equipamentos, músculos secundários e classificações ficam em `description`; o JSON original mantém os metadados estruturados. Não foi necessária migration. Atividades de tempo/distância são descritas no catálogo, mas não adicionam métricas novas ao registro de séries.

Mantenha `exercises_catalog_pt.json` na raiz ao distribuir/executar o projeto, inclusive junto da pasta `dist`. Não altere os UUIDs de entradas já importadas. Remover uma entrada do JSON não apaga o exercício do banco; arquive-o pela API se necessário.

### Buscar e usar exercícios

```http
GET /exercises?q=supino&muscleGroup=Peitoral&catalogOnly=true&limit=20&offset=0
```

- `q`: trecho do nome, sem distinguir maiúsculas/minúsculas; acentos são considerados. `%` e `_` são pesquisados literalmente.
- `muscleGroup`: grupo completo, sem distinguir maiúsculas/minúsculas.
- `catalogOnly=true`: somente exercícios cujos UUIDs pertencem ao catálogo atual; por padrão inclui também cadastros manuais.
- `includeArchived=true`: inclui arquivados. Paginação mantém `limit` e `offset`.

Use o `id` retornado como `exerciseId` em `POST /workouts/:workoutId/exercises`. Para um exercício novo, continue usando `POST /exercises` e reutilize o ID da resposta da mesma forma. Os filtros também estão documentados no Swagger em `/docs`.

## Geração de treino por prompt

`POST /workouts/generate` gera **um modelo de treino** com Gemini e persiste o treino e seus vínculos em uma única transação. A resposta 201 tem o mesmo formato de `GET /workouts/:id`, incluindo `workoutExercises[].exercise`. Use o `id` retornado em `POST /workout-sessions/start`; os snapshots e o histórico continuam seguindo o fluxo existente.

1. Crie uma chave em https://aistudio.google.com/apikey.
2. Configure no `.env` e reinicie a API:

```dotenv
GEMINI_API_KEY=sua-chave
GEMINI_MODEL=gemini-3.1-flash-lite
```

3. Tenha um usuário e exercícios ativos cadastrados. O catálogo do projeto pode ser carregado com `yarn seed`.
4. Envie:

```http
POST /workouts/generate
Content-Type: application/json

{
  "userId": "<UUID do usuário>",
  "prompt": "Quero um treino de pernas para iniciante, com máquinas, em 45 minutos."
}
```

A configuração é opcional: sem chave, somente a geração retorna 503. A integração usa o `fetch` do Node; nenhuma dependência nova é necessária. A rota e os erros estão no Swagger em `/docs`.

O [Gemini 3.1 Flash-Lite tem camada gratuita](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.1-flash-lite), sujeita à disponibilidade e às cotas da conta. Use um projeto no free tier para evitar cobrança; configurar este modelo não impede custos em contas com faturamento ativo. Não há troca automática para modelos pagos. Confira os limites no AI Studio. No free tier, o Google informa que os dados podem ser usados para melhorar seus produtos.

O provedor recebe o prompt e os IDs, nomes e grupos musculares dos exercícios ativos; não recebe o usuário nem o histórico. O prompt original não é armazenado separadamente. Nome, notas, exercícios, ordem, séries, repetições e descanso do resultado são persistidos nas tabelas existentes, sem migration.

O modelo só pode selecionar exercícios do catálogo enviado. A aplicação valida novamente o JSON, os IDs e os valores antes de gravar. A ordem é atribuída pelo servidor; exercícios repetidos são permitidos. Limites desta geração: prompt de 2000 caracteres, catálogo de até 500 exercícios ativos, 1–20 exercícios no treino, 1–10 séries, 1–100 repetições e descanso de 0–600 segundos. Pedidos de programação semanal devem ser feitos como treinos individuais. Adequação do plano ao prompt depende do modelo; o usuário pode editar o resultado pelas rotas existentes.

A chamada externa tem timeout de 30 segundos e acontece antes da transação. Antes de gravar, os exercícios selecionados são bloqueados e revalidados para evitar uso de definições arquivadas durante a geração. Qualquer falha de gravação desfaz o treino inteiro. Cada chamada bem-sucedida cria um novo treino; não há deduplicação de prompts ou idempotência entre requisições.

| HTTP | Motivo |
| --- | --- |
| 400 | Prompt vazio/inválido, UUID inválido ou campo desconhecido |
| 404 | Usuário inexistente |
| 409 | Catálogo vazio, acima do limite ou exercício arquivado durante a geração |
| 422 | Recusa do modelo ou pedido incompatível com o catálogo |
| 429 | Cota do Gemini esgotada |
| 502 | JSON, estrutura, valores ou IDs inválidos; resposta incompleta ou erro de rede |
| 503 | Chave ausente, configuração inválida ou provedor indisponível |
| 504 | Timeout da geração |

Testes unitários simulam a API externa; os testes e2e usam PostgreSQL real e um provedor simulado, sem consumir cota. Execute `yarn test --runInBand` e `yarn test:e2e`.
