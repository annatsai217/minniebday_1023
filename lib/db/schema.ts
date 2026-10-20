import { integer, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core'

export const slotStatus = pgTable(
  'slot_status',
  {
    day: text('day').notNull(),
    slot: text('slot').notNull(),
    level: integer('level').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.day, t.slot] })],
)
