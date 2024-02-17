import { PrismaClient } from '@prisma/client'

import fastify from 'fastify'
import { Webhook } from 'svix'

export const app = fastify()

const prisma = new PrismaClient()

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

  return res.status(200).send({
    success: true,
    message: 'Webhook received',
  })
})

// app.post('/users', async (request, reply) => {
//   console.log(request.body)
//   // const registerBodySchema = z.object({
//   //   name: z.string().nullable(),
//   //   clerkId: z.string(),
//   //   username: z.string(),
//   //   email: z.string().email().nullable(),
//   // })

//   // const { name, clerkId, email, username } = registerBodySchema.parse(
//   //   request.body,
//   // )

//   // await prisma.user.create({
//   //   data: {
//   //     clerk_id: clerkId,
//   //     email,
//   //     username,
//   //     name,
//   //   },
//   // })
// })
