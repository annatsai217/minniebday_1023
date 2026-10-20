import { timingSafeEqual } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { slotStatus } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

const DAYS = ['10/22', '10/23', '10/24', '10/25', '10/26']
const SLOTS = [
  '11:00-11:30', '11:30-12:00', '12:00-12:30', '12:30-13:00', '13:00-13:30',
  '13:30-14:00', '14:00-14:30', '14:30-15:00', '15:00-15:30', '15:30-16:00',
  '16:00-16:30', '16:30-17:00', '17:00-17:30', '17:30-18:00',
]

function isAuthorized(req: Request) {
  const expected = process.env.ADMIN_PASSWORD
  const given = req.headers.get('x-admin-password')
  if (!expected || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function readAll() {
  const rows = await db.select().from(slotStatus)
  const data: Record<string, Record<string, number>> = {}
  for (const r of rows) {
    if (r.level <= 0) continue
    ;(data[r.day] ??= {})[r.slot] = r.level
  }
  return data
}

export async function GET() {
  return Response.json(await readAll(), { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: Request) {
  if (!process.env.ADMIN_PASSWORD) {
    return Response.json({ error: 'not_configured' }, { status: 503 })
  }
  if (!isAuthorized(req)) return Response.json({ error: 'unauthorized' }, { status: 401 })
  return Response.json({ ok: true })
}

export async function PUT(req: Request) {
  if (!isAuthorized(req)) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const changes = Array.isArray(body?.changes) ? body.changes : null
  if (!changes || changes.length > DAYS.length * SLOTS.length) {
    return Response.json({ error: 'invalid' }, { status: 400 })
  }

  const values: { day: string; slot: string; level: number }[] = []
  for (const c of changes) {
    const level = Number(c?.level)
    if (!DAYS.includes(c?.day) || !SLOTS.includes(c?.slot) || !Number.isInteger(level) || level < 0 || level > 3) {
      return Response.json({ error: 'invalid' }, { status: 400 })
    }
    values.push({ day: c.day, slot: c.slot, level })
  }

  if (values.length) {
    await db
      .insert(slotStatus)
      .values(values)
      .onConflictDoUpdate({
        target: [slotStatus.day, slotStatus.slot],
        set: { level: sql`excluded.level`, updatedAt: sql`now()` },
      })
  }

  return Response.json(await readAll())
}
