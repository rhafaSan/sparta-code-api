# Relatório de rendimento

`GET /workout-sessions/progress-report` gera um relatório JSON para o usuário do token Bearer. Não recebe `userId`, não persiste relatórios e não altera os snapshots históricos.

```http
GET /workout-sessions/progress-report?startDate=2026-09-07&endDate=2026-10-04&groupBy=week
Authorization: Bearer <accessToken>
```

| Parâmetro | Regra |
| --- | --- |
| `startDate`, `endDate` | Obrigatórios, `YYYY-MM-DD`, inclusivos. Início deve ser menor ou igual ao fim. |
| `groupBy` | `week` (padrão) ou `month`. |
| `timeZone` | Fuso horário, padrão `America/Sao_Paulo`. Pode usar `UTC`. |
| `workoutId` | UUID opcional de um treino do usuário. |
| `exerciseId` | UUID opcional de um exercício. |

Para três ou quatro semanas, envie as datas desejadas com `groupBy=week`. Para meses, por exemplo, `startDate=2026-07-01&endDate=2026-09-30&groupBy=month`. Não há paginação que descarte parte dos dados selecionados.

As semanas começam na segunda-feira; meses seguem o calendário. O primeiro e o último intervalo são recortados pelas datas solicitadas. Semanas e meses vazios aparecem com contadores zero e métricas sem observações como `null`. O primeiro e o último intervalo podem ser parciais; suas datas são retornadas para tornar a comparação explícita.

## Dados considerados

Somente séries com `completed=true` de sessões com `finishedAt` preenchido. A seleção e o agrupamento usam **o início do treino** (`startedAt`) no fuso informado. Um treino iniciado no período pode ser finalizado depois dele. A conclusão do exercício inteiro não é obrigatória quando suas séries foram concluídas.

Treinos, vínculos e exercícios arquivados continuam presentes. O mesmo exercício em vários treinos, ou repetido no mesmo treino, é agregado pelo `exerciseId`. Não se usam as cargas/repetições planejadas do modelo. O nome do exercício é o nome atual da definição reutilizável; os valores analisados vêm das séries históricas.

## Métricas e progressão

O retorno tem `periods`, `totals` e `exercises[]`. Cada exercício contém seus `totals`, `periods[].metrics` e `progression`. Os totais gerais servem para contextualizar o volume de registros; as porcentagens são calculadas por exercício.

| Métrica | Significado |
| --- | --- |
| `workoutSessions` | Número de treinos distintos com pelo menos uma série concluída no recorte. |
| `completedSets` | Quantidade de séries concluídas. |
| `totalReps` | Soma exata de repetições, como string inteira. |
| `averageReps` | Média de repetições por série com repetições informadas; string com duas casas ou `null`. |
| `maxWeight` | Maior carga registrada; string decimal exata em kg ou `null`. |

`progression` compara o **primeiro e o último intervalo com séries concluídas** de cada exercício. Intervalos vazios nas extremidades são ignorados:

```json
{
  "fromPeriodStart": "2026-09-07",
  "toPeriodStart": "2026-09-28",
  "weightPercent": "12.50",
  "repsPercent": "33.33"
}
```

- `weightPercent = (maior carga final − maior carga inicial) / maior carga inicial × 100`.
- `repsPercent = (média final − média inicial) / média inicial × 100`.

Por exemplo, maior carga de `80.25` para `90.28125` é `12.50%`. Uma média de 9 para 12 repetições é `33.33%`. Usa-se a média por série para que mais séries ou treinos no período não sejam apresentados automaticamente como aumento de repetições por série. Carga e repetições são indicadores independentes: podem evoluir em sentidos diferentes e não significam que mais repetições foram feitas com a mesma carga.

Valores negativos representam redução; `0.00` significa estabilidade. Menos de dois intervalos com séries, base zero ou ausência da métrica em uma extremidade produzem `null` para o percentual correspondente. Com um único intervalo, as duas datas de comparação são iguais e os percentuais são `null`. Não se escolhem intervalos alternativos para substituir métricas ausentes.

Séries legadas com `weight=null` ou `reps=null` contam como concluídas, mas só entram na métrica que possuem. Zero é um valor informado válido. Os cálculos usam inteiros arbitrários e escala decimal, sem conversão de pesos para ponto flutuante. Percentuais e médias são arredondados apenas na resposta, para duas casas, com empates afastando de zero.

Sem dados, retorna HTTP 200, `exercises: []`, totais zerados e os intervalos solicitados. Entradas inválidas retornam 400; filtros de recursos inexistentes ou treino de outro usuário retornam 404; autenticação ausente/inválida retorna 401. O contrato de resposta também está no Swagger `/docs`.
