# Resumo muscular da sessão

`GET /workout-sessions/:id/share-summary`

```json
{
  "workoutSessionId": "uuid",
  "workoutName": "Treino de Costas e Bíceps",
  "durationSeconds": 4080,
  "muscles": ["biceps", "forearms", "lats", "middle-back"]
}
```

- ID malformado ou sessão inexistente: 404. Sessão aberta: 400.
- Somente exercícios com pelo menos um set concluído contribuem. O flag de conclusão do exercício isoladamente não basta.
- Slugs únicos, em ordem alfabética; músculos primários e secundários têm o mesmo tratamento.
- Duração em segundos inteiros (arredondamento para baixo), calculada dos timestamps `Temporal.Instant`.
- Sem exercícios realizados ou sem associações cadastradas: `muscles: []`.
- Arquivamento de treino, exercício ou músculo não exclui participação histórica.
- O endpoint não escreve no banco. Os snapshots existentes ficam intactos.
- Nome do treino e associações musculares são consultados no catálogo atual, conforme o escopo desta feature. Alterar esses cadastros pode alterar a apresentação de um resumo antigo; não há snapshot novo de nome ou músculos.

## Banco e importação

A migração `migrations/app/20260930T1434_muscle_share_summary` adiciona somente:

- `muscle_groups`: UUID, slug único, nome, view, is_active, created_at;
- `exercise_muscles`: UUID, exercise_id, muscle_group_id, role, created_at;
- unicidade `(exercise_id, muscle_group_id)`, índices e chaves estrangeiras.

Não remove campos/tabelas nem altera registros existentes. `Exercise.muscleGroup` e seus endpoints continuam compatíveis. Nenhum `onDelete`, duration, score ou intensidade foi adicionado.

`view` e `role` são strings no banco, validadas pelo importador (`front/back/both` e `primary/secondary`). Escritas diretas fora dele devem respeitar os mesmos valores.

Os 17 grupos básicos estão em `src/prisma/muscle-data.ts`. Preencha `exerciseMuscles` nesse arquivo com associações revisadas, usando IDs reais de exercícios, por exemplo:

```ts
{ exerciseId: 'UUID_REAL_DO_EXERCICIO', muscleSlug: 'lats', role: 'primary' },
{ exerciseId: 'UUID_REAL_DO_EXERCICIO', muscleSlug: 'biceps', role: 'secondary' },
```

O array começa vazio intencionalmente. Não há conversão automática do campo legado ou associação presumida do catálogo. Sem esses mapeamentos, os resumos retornam `muscles: []`.

`seedMuscles(database, mappings, groups)` também permite importação programática. Valida entradas e referências, executa tudo em uma transação e usa `conflictOn` nas unicidades do Prisma 8. Repetir a seed não duplica grupos/vínculos nem sobrescreve nomes, arquivamento ou papéis existentes. Correções de vínculos existentes devem ser feitas explicitamente; remover uma linha do array não apaga dados.

## Comandos locais

Use `DATABASE_URL` de um PostgreSQL local/de testes. Nunca execute as suítes e2e contra produção. Se Yarn não estiver no PATH, use `corepack yarn` no lugar de `yarn`.

```sh
yarn prisma contract emit
yarn prisma db migrate --show
yarn prisma db migrate
yarn seed:muscles
yarn typecheck
yarn build
yarn test --runInBand
yarn test:e2e
yarn lint
```

A migração já foi gerada offline a partir do ref `db`, hash `2d78ab1c4c32e92d53902b6cab52348af0dc644c2b12350d1836d016064b2225`. Não é necessário planejá-la novamente.

## Railway / produção — execução manual

Nenhuma mudança foi executada no Railway. Revise a migração e publique os artefatos gerados junto do código. A baseline `20260929T2002_baseline` já existia localmente sem rastreamento no Git antes desta tarefa; preserve-a e inclua o histórico necessário no pacote de deploy.

No ambiente com a conexão de produção configurada, primeiro faça apenas a prévia:

```sh
yarn prisma db migrate --show
```

Para a base já inicializada no contrato anterior, a rota deve aplicar apenas `20260930T1434_muscle_share_summary`, com oito operações aditivas. Se mostrar baseline, drops ou outras mudanças inesperadas, pare e confira o marker/histórico antes de aplicar.

Após revisão, durante o deploy coordenado com a nova versão da API:

```sh
yarn prisma db migrate
node dist/prisma/seed-muscles-cli.js
```

O build deve ter sido gerado previamente com `yarn build`. A seed cadastra grupos e apenas os mapeamentos explicitamente incluídos no arquivo de dados. Não use `db update`, reset ou recriação de banco em produção. A evolução do marker do contrato deve acompanhar a versão da API implantada.

## Arquivos

Criados:

- `src/workout-sessions/dto/workout-share-summary.dto.ts`
- `src/prisma/muscle-data.ts`
- `src/prisma/seed-muscles.ts`
- `src/prisma/seed-muscles-cli.ts`
- `test/share-summary.e2e-spec.ts`
- `docs/share-summary.md`
- `migrations/app/20260930T1434_muscle_share_summary/{migration.ts,migration.json,ops.json}` (gerados pelo CLI)
- `migrations/snapshots/66b3dd2be95bc5ea572d8ea2d4477753255bb7901e12bfb67143326f0f353007/{contract.json,contract.d.ts}` (gerados pelo CLI)

Alterados:

- `src/prisma/contract.prisma`
- `src/prisma/contract.json` e `src/prisma/contract.d.ts` (somente via `contract emit`)
- `src/workout-sessions/workout-sessions.controller.ts`
- `src/workout-sessions/workout-sessions.service.ts`
- `package.json`
- `test/app.e2e-spec.ts` e `test/workout-generation.e2e-spec.ts` (doubles compatíveis com os novos models)
