import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';


describe('API de autenticación (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /health confirma que el servicio está arriba', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect((res.body as { estado: string }).estado).toBe('ok');
      });
  });

  it('GET /api/dashboard sin cookie de sesión responde 401', () => {
    return request(app.getHttpServer()).get('/api/dashboard').expect(401);
  });
});
