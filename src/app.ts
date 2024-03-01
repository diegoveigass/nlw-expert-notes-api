import { PrismaClient } from '@prisma/client'

import fastify from 'fastify'
import { Webhook } from 'svix'
import { env } from './env'
import { z } from 'zod'

export const app = fastify()

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
})

app.post('/api/webhooks', async (req, res) => {
  const WEBHOOK_SECRET = env.WEBHOOK_SECRET
  if (!WEBHOOK_SECRET) {
    throw new Error('You need a WEBHOOK_SECRET in your .env')
  }

  const headers = req.headers
  const payload = JSON.stringify(req.body)

  const svixId = headers['svix-id'] as string
  const svixTimestamp = headers['svix-timestamp'] as string
  const svixSignature = headers['svix-signature'] as string

  console.log({
    svixId,
    svixTimestamp,
    svixSignature,
  })

  // If there are missing Svix headers, error out
  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response('Error occured -- no svix headers', {
      status: 400,
    })
  }

  // Initiate Svix
  const wh = new Webhook(WEBHOOK_SECRET)

  let evt: WebhookEvent

  console.log({ payload, wh })

  try {
    evt = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as WebhookEvent
  } catch (err: any) {
    console.log('Webhook failed to verify. Error:', err.message)
    return res.status(400).send({
      success: false,
      message: err.message,
    })
  }

  // Grab the ID and TYPE of the Webhook
  const { id } = evt.data
  const eventType = evt.type

  console.log(`Webhook with an ID of ${id} and type of ${eventType}`)
  console.log('Webhook body:', evt.data)

  if (eventType === 'user.created') {
    const user = await prisma.user.findFirst({
      where: {
        clerk_id: evt.data.id,
      },
    })

    if (!user) {
      await prisma.user.create({
        data: {
          clerk_id: evt.data.id,
          name: evt.data?.name,
          username: evt.data.username,
        },
      })

      return res.status(201).send({
        success: true,
        message: 'User created successfully',
      })
    }
  }

  return res.status(200).send({
    success: true,
    message: 'Webhook received',
  })
})

app.post('/notes', async (request, reply) => {
  const createNoteBodySchema = z.object({
    date: z.string(),
    content: z.string(),
    clerkUserId: z.string(),
  })

  const { date, clerkUserId, content } = createNoteBodySchema.parse(
    request.body,
  )

  const user = await prisma.user.findFirst({
    where: {
      clerk_id: clerkUserId,
    },
  })

  if (!user) return

  await prisma.note.create({
    data: {
      content,
      created_at: date,
      user_id: user.id,
    },
  })

  return reply.status(201).send({
    success: true,
    message: 'Note created successfully',
  })
})

app.post('/note', async (request, reply) => {
  const getNotesBodySchema = z.object({
    clerkUserId: z.string(),
  })

  const { clerkUserId } = getNotesBodySchema.parse(request.body)

  const user = await prisma.user.findFirst({
    where: {
      clerk_id: clerkUserId,
    },
  })

  if (!user) return

  const notes = await prisma.note.findMany({
    select: {
      content: true,
      id: true,
      created_at: true,
    },
    where: {
      user_id: user.id,
    },
  })

  reply.code(200).send(notes)
})
