import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  app.enableShutdownHooks();
  const config = new DocumentBuilder()
    .setTitle('Sparta Workout API')
    .setDescription(
      'API de planejamento e execução de treinos. Crie um usuário, exercícios e um treino; associe os exercícios, inicie uma sessão, registre séries e finalize. Use os UUIDs retornados nas próximas requisições. Pesos são strings decimais. Arquivamento preserva o histórico.',
    )
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { docExpansion: 'none', displayRequestDuration: true },
    customSiteTitle: 'Sparta API — Swagger',
  });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
