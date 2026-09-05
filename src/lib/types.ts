/**
 * The shared data model.
 *
 * Everything in this file describes the *shape* of section data — never the data
 * itself. `scripts/parse-classcards.ts` produces `Roster`, `scripts/encrypt-data.ts`
 * encrypts it, and the app decrypts it back into these types at runtime.
 *
 * Fields are optional almost everywhere on purpose: class cards are inconsistently
 * filled in and the supplemental survey is voluntary, so every view must render
 * sensibly when a field is missing.
 */

export type Region = {
  city?: string
  state?: string
  country?: string
}

export type PriorRole = {
  company?: string
  title?: string
  location?: string
  /** Free text from the card — a division, team, or role summary. Not a taxonomy. */
  description?: string
  /** Dates exactly as the card prints them, e.g. "JUN 2021 - JUL 2024". */
  dates?: string
  /** Normalised bucket, inferred from company and title. See `inferIndustry`. */
  industry?: string
}

export type Education = {
  school?: string
  degree?: string
  gradDate?: string
}

/** Month/day only. We deliberately never store or ship a birth year. */
export type Birthday = {
  month: number // 1-12
  day: number // 1-31
}

export type Person = {
  /** Stable slug derived from the email local part, e.g. "rpatel" or "rpatel2". */
  id: string
  firstName: string
  lastName: string
  displayName: string
  email: string

  /** Preferred phone, digits normalised. Absent when the person opted out. */
  phone?: string
  /** Name of a partner/spouse. Used to keep couples out of the same dinner. */
  partner?: string

  /** Key into the encrypted photo bundle. Absent when the person opted out. */
  photoId?: string

  homeRegion?: Region
  currentCity?: string

  /** Most recent first. */
  preMBA: PriorRole[]
  education: Education[]

  /**
   * The only interest-style field in the MVP, and the one worth having: 60 of 89
   * people filled it in, against 34 for "Interests" and 19 for "HBS Activities".
   *
   * Those two, plus languages, post-MBA goals and social links, are deliberately
   * out of scope for now — see docs/class-cards.md, which documents how they are
   * laid out on the card so they can be added back without rediscovering it.
   */
  professionalInterests: string[]

  birthday?: Birthday
  startupExperience?: boolean

  pronouns?: string
  funFact?: string
  /** Feeds the dinner allocator so hosts know what to cook. */
  dietary?: string[]
}

export type Roster = {
  version: 1
  generatedAt: string
  section: string
  people: Person[]
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export type EventCategory = 'section' | 'course' | 'social' | 'deadline' | 'birthday'

/** An entry in the public data/events.json — this is the main PR surface. */
export type SectionEvent = {
  id: string
  title: string
  category: Exclude<EventCategory, 'birthday' | 'course'>
  /** ISO date, YYYY-MM-DD. */
  date: string
  /** Optional local times, HH:MM in 24h. */
  startTime?: string
  endTime?: string
  location?: string
  description?: string
  url?: string
}

/** A recurring class in data/courses.json. */
export type Course = {
  id: string
  name: string
  professor?: string
  room?: string
  /** 0 = Sunday … 6 = Saturday. */
  daysOfWeek: number[]
  startTime: string
  endTime: string
  /** Inclusive ISO date range over which the course meets. */
  startDate: string
  endDate: string
  /** ISO dates on which the class does not meet (holidays, etc.). */
  exceptions?: string[]
}

/** What the calendar actually renders, after flattening all three sources. */
export type CalendarEntry = {
  id: string
  title: string
  category: EventCategory
  date: string
  startTime?: string
  endTime?: string
  location?: string
  description?: string
  url?: string
  /** Set for birthdays, so the entry can link into the directory. */
  personId?: string
}

// ---------------------------------------------------------------------------
// Meetups
// ---------------------------------------------------------------------------

export type MeetupKind = 'dinner' | 'onetoone'

export type MeetupGroup = {
  /** 1-based label shown in the UI, e.g. "Dinner Group 7". */
  label: string
  memberIds: string[]
}

export type MeetupRound = {
  id: string
  kind: MeetupKind
  /** ISO date the round is scheduled for. */
  date: string
  groups: MeetupGroup[]
  /** People excluded from this round. */
  absentIds: string[]
  generatedAt: string
}

export type MeetupHistory = {
  version: 1
  rounds: MeetupRound[]
}
