# Agenda semanal de treinos

A agenda é recorrente e pertence ao usuário autenticado. Cada dia tem no máximo um treino; um treino pode ser usado em vários dias. Os dias seguem a ordem ISO: segunda-feira = 1, terça = 2, quarta = 3, quinta = 4, sexta = 5, sábado = 6 e domingo = 7.

Todas as rotas exigem `Authorization: Bearer <accessToken>`. Não envie `userId`: o proprietário vem da autenticação.

## Associar ou substituir um treino

```http
PUT /workouts/schedule/1
Content-Type: application/json
Authorization: Bearer <accessToken>

{ "workoutId": "<UUID do treino>" }
```

A resposta 200 contém o registro da associação: `id`, `userId`, `workoutId` e `dayOfWeek`. Repetir a operação substitui a associação daquele dia, sem duplicá-la. Apenas treinos ativos do próprio usuário são aceitos. Treino inexistente ou de outro usuário retorna 404; treino arquivado retorna 409; dia fora de 1–7, UUID inválido ou campo desconhecido retorna 400.

## Consultar a semana

`GET /workouts/schedule` retorna sempre sete itens, de segunda a domingo, incluindo dias livres:

```json
[
  {
    "dayOfWeek": 1,
    "dayName": "Segunda-feira",
    "workoutId": "<UUID>",
    "workout": { "id": "<UUID>", "name": "Treino A", "...": "demais campos do treino" }
  },
  {
    "dayOfWeek": 2,
    "dayName": "Terça-feira",
    "workoutId": null,
    "workout": null
  }
]
```

O exemplo está abreviado; a resposta real contém os sete dias. `workout` contém os campos do modelo de treino, sem a lista de exercícios.

## Consultar o treino de hoje

```http
GET /workouts/today?timeZone=America%2FSao_Paulo
Authorization: Bearer <accessToken>
```

O parâmetro `timeZone` é opcional, com padrão `America/Sao_Paulo`. Use um fuso válido, como `Europe/Lisbon`; fuso inválido retorna 400. A data é calculada no momento da consulta, respeitando o fuso informado, independentemente do fuso do servidor.

```json
{
  "date": "2026-11-09",
  "timeZone": "America/Sao_Paulo",
  "dayOfWeek": 1,
  "dayName": "Segunda-feira",
  "workoutId": "<UUID>",
  "workout": {
    "id": "<UUID>",
    "name": "Treino A",
    "workoutExercises": []
  }
}
```

`workout` contém os campos do treino e os vínculos ativos em `workoutExercises`, ordenados por `exerciseOrder`, incluindo cada `exercise`, como na consulta de um treino. Em um dia livre, `workoutId` e `workout` são `null` e o status continua 200. O cliente consulta essa rota para apresentar o treino do dia. A consulta não cria sessões nem envia notificações; para executar o treino, use o `workoutId` retornado em `POST /workout-sessions/start`.

## Remover a associação

`DELETE /workouts/schedule/1` remove o treino de segunda-feira e retorna 200 com `{ "dayOfWeek": 1, "workoutId": null }`. A operação é idempotente. O treino e suas sessões permanecem intactos.

Arquivar um treino em `PATCH /workouts/:id` remove suas associações semanais na mesma transação. Reativá-lo não restaura a agenda automaticamente. Alterar a agenda afeta apenas a programação recorrente; não reescreve datas, snapshots ou resultados de sessões anteriores.

## Banco de dados

O contrato adiciona `WorkoutSchedule`, mapeado para `workout_schedules`, com uma restrição única por `(user_id, day_of_week)` e referências a usuário e treino. A integridade de proprietário e o intervalo de dias são validados pela aplicação. Não foram acrescentadas diretivas `onDelete`.

Os artefatos foram gerados com `yarn prisma contract emit`. A migration incremental fica em `migrations/app/20261111T0031_add_workout_schedule` e cria apenas a nova tabela, seus índices e referências. Para disponibilizar a feature no banco de destino, aplique o fluxo de migrations do Prisma 8:

```sh
yarn prisma db migrate
yarn db:verify
```

A migration e os testes são validados em um PostgreSQL local isolado; o banco remoto configurado não é modificado automaticamente durante o desenvolvimento desta feature.
