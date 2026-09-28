# AGENTS.md

## Project Overview

This repository contains the backend API for a personal fitness application.

The API is responsible for managing:

- users;
- exercises;
- workout templates;
- exercises assigned to workout templates;
- workout sessions;
- exercise execution during a workout session;
- performed sets, including weight and repetitions;
- workout history and progression data.

The application is initially intended for a single user, but the domain model must not prevent future multi-user support.

---

## Tech Stack

- Node.js
- TypeScript
- NestJS
- Prisma 8 RC
- PostgreSQL
- Yarn

Do not assume Prisma 7 or earlier APIs.

This project uses the Prisma 8 contract-based architecture.

---

## Prisma Architecture

The Prisma source of truth is:

`src/prisma/contract.prisma`

Generated artifacts include:

`src/prisma/contract.json`

`src/prisma/contract.d.ts`

Do not manually edit generated Prisma artifacts.

Whenever the Prisma contract changes, regenerate the artifacts with:

```bash
yarn prisma contract emit
```

The PostgreSQL database has already been initialized using the Prisma 8 database workflow.

Do not introduce Prisma 7 style patterns such as:

```ts
prisma.exercise.findMany()
```

or:

```ts
prisma.exercise.create({
  data: {}
})
```

Use the Prisma 8 ORM API exposed by the generated PostgreSQL runtime.

Expected access pattern:

```ts
db.orm.public.Exercise
```

Example read:

```ts
db.orm.public.Exercise.all()
```

Example create:

```ts
db.orm.public.Exercise.create({
  name: 'Supino reto',
  muscleGroup: 'Peito',
})
```

---

## Prisma Files

The Prisma integration should remain centralized under:

```text
src/
└── prisma/
    ├── contract.prisma
    ├── contract.json
    ├── contract.d.ts
    ├── db.ts
    ├── prisma.module.ts
    └── prisma.service.ts
```

`db.ts` owns the Prisma PostgreSQL runtime instance.

`PrismaService` exposes that database instance to NestJS through dependency injection.

Avoid creating multiple database runtime instances.

Avoid opening and closing the database connection for every HTTP request.

---

## Current Database Models

The domain currently contains seven main models:

```text
User
Exercise
Workout
WorkoutExercise
WorkoutSession
ExerciseSession
ExerciseSet
```

The model is intentionally divided into two concepts:

```text
PLANNING

User
Workout
WorkoutExercise
Exercise
```

and:

```text
EXECUTION / HISTORY

WorkoutSession
ExerciseSession
ExerciseSet
```

This distinction must be preserved.

---

## User

`User` represents the owner of the fitness data.

The application initially has only one user, so the model should remain simple.

Do not add authentication, authorization, roles, email, password, refresh tokens, or similar infrastructure unless explicitly requested.

A workout and a workout session belong to a user.

---

## Exercise

`Exercise` represents a reusable exercise definition.

Examples:

```text
Supino reto
Puxada alta
Remada baixa
Agachamento
Leg press
Rosca direta
```

An exercise is not tied directly to one workout.

The same exercise may be reused across multiple workouts.

Relevant concepts:

```text
name
description
muscleGroup
isActive
```

Exercises should normally be archived instead of physically deleted.

Use:

```text
isActive = false
```

for exercises that should no longer appear in normal application flows.

Historical data must remain valid.

---

## Workout

`Workout` is a workout template, not a completed workout.

Examples:

```text
Treino de Costas
Treino de Pernas
Treino de Peito
Upper A
Lower A
```

A `Workout` belongs to a `User`.

It may contain:

```text
name
notes
isActive
```

Do not store performed weight, performed repetitions, completion state, or elapsed duration directly on `Workout`.

Those values belong to a workout execution.

Workouts should normally be archived using:

```text
isActive = false
```

instead of physical deletion.

---

## WorkoutExercise

`WorkoutExercise` is the explicit relation between a `Workout` and an `Exercise`.

It represents an exercise configured inside a specific workout template.

It contains information such as:

```text
workoutId
exerciseId
exerciseOrder
plannedSets
plannedReps
notes
isActive
```

Example:

```text
Treino de Costas

1. Puxada alta
   4 x 10

2. Remada baixa
   4 x 8

3. Pulldown
   3 x 12
```

The planned number of sets and repetitions belongs here because those values are part of the workout template.

Do not put actual performed repetitions or weight here.

`exerciseOrder` must be unique inside a workout.

The same exercise is allowed to appear more than once in the same workout if future workout strategies require it.

Do not introduce a unique constraint that permanently prevents this unless explicitly requested.

---

## WorkoutSession

`WorkoutSession` represents one execution of a workout.

Example:

```text
Workout:
Treino de Costas

Started:
2026-09-11 18:30

Finished:
2026-09-11 19:42
```

Relevant fields include:

```text
userId
workoutId
startedAt
finishedAt
notes
```

`finishedAt = null` means the workout session is currently in progress.

Do not store a redundant `duration` column unless explicitly required.

Workout duration should normally be calculated from:

```text
finishedAt - startedAt
```

Workout sessions are historical data and should generally not be deleted.

---

## ExerciseSession

`ExerciseSession` represents the execution of one workout exercise inside one workout session.

It contains:

```text
workoutSessionId
workoutExerciseId
exerciseOrder
plannedSets
plannedReps
completed
notes
```

The values:

```text
exerciseOrder
plannedSets
plannedReps
```

are intentionally copied from `WorkoutExercise` when a workout session starts.

This creates a snapshot of the workout plan at that moment.

This snapshot is important.

Example:

```text
September:
Supino reto
4 x 10
```

If the workout template is later changed to:

```text
November:
Supino reto
5 x 6
```

the September workout history must still show:

```text
4 x 10
```

Never make historical sessions depend exclusively on the current workout template values.

`completed` represents whether that exercise was completed during that specific workout session.

It is not a permanent property of the exercise.

---

## ExerciseSet

`ExerciseSet` stores the actual result of an individual set performed during an `ExerciseSession`.

Relevant fields:

```text
exerciseSessionId
setNumber
weight
reps
completed
```

Example:

```text
Supino reto

Set 1
80 kg x 10

Set 2
80 kg x 9

Set 3
80 kg x 8

Set 4
75 kg x 10
```

Each row above is one `ExerciseSet`.

`setNumber` must be unique inside one `ExerciseSession`.

`weight` is stored as a decimal value.

Do not use floating-point arithmetic for weight when exact decimal storage is available.

`completed` represents whether that specific set was completed.

The application may later automatically mark an `ExerciseSession` as completed when all required sets are completed, but keep both completion levels in the data model.

---

## Relationship Overview

The conceptual relationship is:

```text
User
│
├── Workout
│   │
│   └── WorkoutExercise
│       │
│       └── Exercise
│
└── WorkoutSession
    │
    └── ExerciseSession
        │
        └── ExerciseSet
```

More precisely:

```text
User 1:N Workout

User 1:N WorkoutSession

Workout 1:N WorkoutExercise

Exercise 1:N WorkoutExercise

Workout 1:N WorkoutSession

WorkoutSession 1:N ExerciseSession

WorkoutExercise 1:N ExerciseSession

ExerciseSession 1:N ExerciseSet
```

---

## Delete Policy

Preserving workout history is more important than aggressive physical deletion.

The intended domain behavior is:

```text
User -> Workout
RESTRICT

Exercise -> WorkoutExercise
RESTRICT

User -> WorkoutSession
RESTRICT

Workout -> WorkoutSession
RESTRICT

WorkoutExercise -> ExerciseSession
RESTRICT
```

Logical deletion / archival should normally be preferred for:

```text
Workout
Exercise
WorkoutExercise
```

using:

```text
isActive = false
```

Conceptually, these child relationships may be treated as cascades when explicit hard deletion is intentionally performed:

```text
Workout -> WorkoutExercise

WorkoutSession -> ExerciseSession

ExerciseSession -> ExerciseSet
```

However, the current Prisma 8 RC contract used by this project has shown issues when explicit `onDelete` actions are added to `contract.prisma`.

Therefore:

- do not add `onDelete` directives to the Prisma contract unless verified to work with the exact installed Prisma version;
- preserve the current working contract;
- implement deliberate cascade deletion in a transaction at application level when necessary;
- do not physically delete historical workout data by default.

---

## NestJS Module Strategy

Do not create one NestJS module for every database table.

Database models and application modules are not required to have a 1:1 relationship.

Recommended application modules:

```text
src/
├── prisma/
├── users/
├── exercises/
├── workouts/
└── workout-sessions/
```

`workouts` may coordinate:

```text
Workout
WorkoutExercise
```

`workout-sessions` may coordinate:

```text
WorkoutSession
ExerciseSession
ExerciseSet
```

This keeps the application structured around use cases and domain responsibilities instead of database tables.

---

## Initial API Development Order

Prefer implementing the API in this order:

```text
1. Prisma integration with NestJS

2. Exercise CRUD

3. Workout CRUD

4. Add/remove/reorder exercises in a workout

5. Start a WorkoutSession

6. Create ExerciseSession snapshots

7. Record ExerciseSet results

8. Mark sets and exercises as completed

9. Finish a WorkoutSession

10. Workout history

11. Previous exercise performance

12. Progression and statistics
```

Avoid implementing advanced features before the core workout flow works end-to-end.

---

## Exercise API

Initial endpoints may follow:

```text
POST   /exercises
GET    /exercises
GET    /exercises/:id
PATCH  /exercises/:id
```

Do not make physical deletion the default behavior.

Archiving may be implemented through an update such as:

```json
{
  "isActive": false
}
```

---

## Workout API

The workout domain should eventually support operations similar to:

```text
POST   /workouts
GET    /workouts
GET    /workouts/:id
PATCH  /workouts/:id
```

and explicit workout exercise management:

```text
POST   /workouts/:workoutId/exercises
PATCH  /workouts/:workoutId/exercises/:workoutExerciseId
DELETE /workouts/:workoutId/exercises/:workoutExerciseId
```

A delete operation here should respect existing historical references.

Prefer archive/removal from the active template without damaging old workout sessions.

---

## Workout Session API

Expected use cases:

```text
POST /workout-sessions/start
```

Starts a workout and creates a `WorkoutSession`.

When a workout starts:

1. load the active `WorkoutExercise` entries;
2. create the `WorkoutSession`;
3. create one `ExerciseSession` for each active workout exercise;
4. copy `exerciseOrder`, `plannedSets`, and `plannedReps` into each `ExerciseSession`;
5. keep the operation transactional.

Recording a set should update or create an `ExerciseSet`.

Finishing a workout should populate:

```text
finishedAt
```

Do not recalculate old sessions from the current workout template.

---

## Transactions

Use database transactions for operations that must succeed or fail together.

Important transactional flows include:

```text
Starting a workout session
```

because it may create:

```text
WorkoutSession
+
multiple ExerciseSession records
```

and intentional cascade deletion of a workout session may require deleting:

```text
ExerciseSet
ExerciseSession
WorkoutSession
```

as one atomic operation.

Do not leave partially created workout sessions.

---

## Validation

Use NestJS DTOs for API boundaries.

Do not expose database models directly as request DTOs.

Validate at least:

```text
name is required where applicable
plannedSets > 0
plannedReps > 0
exerciseOrder > 0
setNumber > 0
reps >= 0
weight >= 0
```

Do not silently accept invalid identifiers.

Return appropriate HTTP status codes and NestJS exceptions.

---

## Service Responsibilities

Controllers should remain thin.

Controllers should:

```text
receive HTTP input
call the appropriate service
return the result
```

Business logic should live in services.

Database access should not be placed directly in controllers.

For example:

```text
ExercisesController
        ↓
ExercisesService
        ↓
PrismaService
        ↓
PostgreSQL
```

---

## PrismaService

Keep Prisma access centralized.

Expected pattern:

```ts
@Injectable()
export class PrismaService {
  readonly db = db;
}
```

Other services should receive `PrismaService` through NestJS dependency injection.

Avoid importing and creating raw database clients throughout feature services.

---

## Naming Conventions

TypeScript:

```text
camelCase
```

Examples:

```text
workoutId
exerciseOrder
plannedSets
startedAt
finishedAt
```

PostgreSQL physical columns should use:

```text
snake_case
```

Examples:

```text
workout_id
exercise_order
planned_sets
started_at
finished_at
```

Prisma `@map` and `@@map` should bridge those naming conventions.

Database table names should remain plural snake_case:

```text
users
exercises
workouts
workout_exercises
workout_sessions
exercise_sessions
exercise_sets
```

---

## Code Organization

Prefer feature-oriented NestJS organization.

Example:

```text
src/
├── prisma/
│   ├── contract.prisma
│   ├── contract.json
│   ├── contract.d.ts
│   ├── db.ts
│   ├── prisma.module.ts
│   └── prisma.service.ts
│
├── exercises/
│   ├── dto/
│   ├── exercises.controller.ts
│   ├── exercises.module.ts
│   └── exercises.service.ts
│
├── workouts/
│   ├── dto/
│   ├── workouts.controller.ts
│   ├── workouts.module.ts
│   └── workouts.service.ts
│
├── workout-sessions/
│   ├── dto/
│   ├── workout-sessions.controller.ts
│   ├── workout-sessions.module.ts
│   └── workout-sessions.service.ts
│
├── users/
│   └── ...
│
├── app.module.ts
└── main.ts
```

If a new abstraction is not justified yet, do not create it only to mimic enterprise architecture.

Keep the project modular but pragmatic.

---

## Current Scope

The current project scope is backend API only.

Do not make assumptions about frontend implementation details.

The backend must remain usable by any client capable of consuming HTTP APIs.

Do not introduce frontend-specific state or UI concepts into database models.

For example, a checkbox in the UI maps to:

```text
completed: Boolean
```

but the database should not contain concepts such as:

```text
checkboxState
buttonState
screenState
modalState
```

---

## Features Intentionally Deferred

Do not implement these unless explicitly requested:

```text
authentication
JWT
refresh tokens
roles and permissions
social login
Apple login
Google login
subscriptions
payments
notifications
Apple Health / HealthKit
body measurements
progress photos
nutrition tracking
calorie tracking
exercise videos
AI-generated workouts
multi-tenant architecture
complex caching
message queues
microservices
```

The first objective is a stable workout tracking API.

---

## Future Domain Candidates

Potential future entities may include:

```text
BodyMeasurement
Goal
PersonalRecord
MuscleGroup
ExerciseMuscle
TrainingProgram
ProgressPhoto
```

Do not add them preemptively.

Add them only when a concrete feature requires them.

---

## Historical Integrity

Historical workout data must be treated as immutable context wherever practical.

Changing a workout template must not rewrite old workout sessions.

Changing:

```text
plannedSets
plannedReps
exerciseOrder
```

inside `WorkoutExercise` must affect future sessions only.

Existing `ExerciseSession` snapshots must remain unchanged.

Similarly, renaming or archiving an exercise must not invalidate previous performed sets.

---

## General Engineering Rules

Prefer simple, explicit code.

Do not over-engineer the application.

Do not introduce repositories, command buses, CQRS, event sourcing, domain events, microservices, or additional architectural layers unless they solve a demonstrated problem or are explicitly requested.

Keep controllers thin.

Keep business logic in services.

Use DTOs at API boundaries.

Use Prisma through `PrismaService`.

Use transactions for multi-step writes.

Preserve workout history.

Prefer soft deletion/archive for reusable domain definitions.

Use Yarn for project commands.

When introducing a new package or external library, explain why it is needed and provide the Yarn installation command.

When generating or suggesting code, identify the exact file path where the code belongs.

---

## Codex Working Guidance

Before making changes:

1. inspect the current implementation;
2. inspect `src/prisma/contract.prisma`;
3. do not assume Prisma 7 syntax;
4. preserve existing working Prisma 8 contract behavior;
5. avoid adding `onDelete` directives unless compatibility has been explicitly verified;
6. keep historical workout integrity intact;
7. prefer small, reviewable changes;
8. run relevant format, type-check, test, and Prisma validation commands after modifications.

For Prisma contract changes, run:

```bash
yarn prisma contract emit
```

Do not modify generated `contract.json` or `contract.d.ts` manually.

When uncertain about Prisma 8 RC behavior, inspect the installed package/version and existing project code before changing the architecture.

---

## Primary Goal

The API should make this flow reliable:

```text
Create exercises
      ↓
Create workout
      ↓
Assign exercises to workout
      ↓
Start workout
      ↓
Record sets, weight and repetitions
      ↓
Mark exercises as completed
      ↓
Finish workout
      ↓
Preserve history
      ↓
Use historical data to track progression
```

Every architectural decision should support this core flow without unnecessarily complicating the project.
