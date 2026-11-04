# Séries preparatórias e aquecimento

Cada `ExerciseSet` possui `setType`: `working` (série de trabalho, padrão),
`warmup` (aquecimento) ou `preparatory` (preparatória). A escolha pertence a
um exercício da sessão, sem alterar o modelo do treino ou `plannedSets`.

## Iniciar uma sessão

Envie `Authorization: Bearer <accessToken>` nas requisições. Em
`POST /workout-sessions/start`, selecione os vínculos desejados usando os IDs
de `workoutExercises` retornados por `GET /workouts/:id`:

```json
{
  "userId": "<UUID do usuário autenticado>",
  "workoutId": "<UUID do treino>",
  "additionalSets": [
    {
      "workoutExerciseId": "<UUID do vínculo no treino>",
      "sets": [
        { "setNumber": 1, "setType": "warmup" },
        { "setNumber": 2, "setType": "preparatory" }
      ]
    }
  ]
}
```

Omitir `additionalSets` mantém o comportamento anterior. Exercícios não
selecionados não recebem séries adicionais. São aceitos até 100 vínculos e
100 séries adicionais por vínculo. IDs de outro treino, vínculos arquivados,
exercícios inativos, tipos inválidos e números duplicados são rejeitados.
Sessão, snapshots e séries são criados na mesma transação. A resposta inclui
`exerciseSessions[].sets`, com peso e repetições `null` e `completed: false`.

## Adicionar e editar durante a sessão

Use `PUT /workout-sessions/:sessionId/exercises/:exerciseSessionId/sets`:

```json
{
  "setNumber": 1,
  "setType": "warmup",
  "weight": "20.50",
  "reps": 12,
  "completed": true
}
```

`setNumber` é único no exercício, compartilhado entre todos os tipos, e
determina a ordem de exibição. Por exemplo, após aquecimento 1 e preparatória
2, numere as séries de trabalho como 3, 4 e 5. Isso continua representando
três séries de trabalho no plano. Use números livres ao inserir novas séries
e ordene os registros pelo número; não há renumeração automática.

Para criar uma série adicional antes de realizá-la, envie somente
`setNumber` e `setType`. Peso, repetições e conclusão omitidos preservam os
valores existentes; em uma nova série ficam `null`, `null` e `false`.
Omitir `setType` preserva o tipo na atualização e usa `working` na criação.
`null` explícito não é aceito nesses campos. Peso continua sendo uma string
decimal exata, sem conversão para ponto flutuante.

`DELETE /workout-sessions/:sessionId/exercises/:exerciseSessionId/sets/:setNumber`
remove uma série adicional não concluída. Séries concluídas e séries de
trabalho retornam 409. Todas as alterações são bloqueadas após finalizar a
sessão, e o acesso continua restrito ao proprietário.

## Histórico e resumos

- Consulta da sessão e performance anterior retornam todos os tipos.
- Estatísticas e relatório de progressão contam somente séries `working`
  concluídas em sessões finalizadas, incluindo repetições e maior carga.
- O resumo muscular ignora exercícios com apenas séries adicionais, mesmo
  quando a execução está marcada como concluída. A duração continua sendo o
  tempo total entre início e fim da sessão.
- As séries antigas recebem `working` pela migração e preservam seus dados.

## Migração

Os artefatos foram gerados com `yarn prisma contract emit`. A migração
`migrations/app/20261104T2250_add_exercise_set_type` adiciona somente a coluna
`exercise_sets.set_type` com padrão `working`, sem exclusão de dados.
Antes de executar esta versão da API em um ambiente existente, aplique:

```sh
yarn prisma db migrate
yarn prisma db verify
```

Os testes usam PostgreSQL real; configure `DATABASE_URL` para um banco de
testes isolado antes de executar `yarn test:e2e`.
