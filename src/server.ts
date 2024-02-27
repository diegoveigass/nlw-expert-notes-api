import { app } from './app'
import { env } from './env'
import cors from '@fastify/cors'

app.register(cors)

app
  .listen({
    host: '0.0.0.0',
    port: env.PORT,
  })
  .then(() => {
    console.log('http server runing!!')
  })
