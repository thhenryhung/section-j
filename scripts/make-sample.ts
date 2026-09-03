/**
 * Generates the synthetic roster that this public repo ships with.
 *
 * Every contributor develops against this file. It has the same shape and roughly
 * the same distribution as the real section, so the UI is exercised properly —
 * long names, missing fields, people with no photo, people with no stated interests —
 * without a single real person appearing in a public repository.
 *
 * Emails use the reserved `.invalid` TLD (RFC 2606), which can never resolve, and
 * photos are generated initial-avatars rather than faces.
 *
 *   npm run data:sample
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mulberry32 } from '../src/lib/pairing'
import type { Person, Roster } from '../src/lib/types'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.join(repoRoot, 'data')

const SEED = 20280901
const COUNT = 90
const random = mulberry32(SEED)

const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)]
const chance = (p: number) => random() < p

function sample<T>(items: readonly T[], min: number, max: number): T[] {
  const n = min + Math.floor(random() * (max - min + 1))
  const pool = [...items]
  const out: T[] = []
  for (let i = 0; i < n && pool.length > 0; i++) {
    out.push(pool.splice(Math.floor(random() * pool.length), 1)[0])
  }
  return out
}

const FIRST_NAMES = [
  'Amara', 'Ravi', 'Sofia', 'Kenji', 'Leila', 'Mateo', 'Nadia', 'Tomas', 'Priya', 'Elias',
  'Yuki', 'Camila', 'Omar', 'Ingrid', 'Diego', 'Aisha', 'Lukas', 'Mei', 'Farid', 'Rosa',
  'Kwame', 'Anika', 'Pedro', 'Zara', 'Henrik', 'Lucia', 'Arjun', 'Freya', 'Marco', 'Thandi',
  'Hugo', 'Noor', 'Sven', 'Ondine', 'Jae', 'Beatriz', 'Idris', 'Elena', 'Rafael', 'Chiara',
  'Tobias', 'Amina', 'Bharat', 'Greta', 'Santiago', 'Hana', 'Emeka', 'Anneke', 'Yosef', 'Mira',
]

const LAST_NAMES = [
  'Okonkwo', 'Iyer', 'Marchetti', 'Tanaka', 'Haddad', 'Restrepo', 'Petrov', 'Nowak', 'Sharma',
  'Lindqvist', 'Watanabe', 'Duarte', 'Al-Sayed', 'Bergstrom', 'Navarro', 'Rahman', 'Fischer',
  'Zhang', 'Karimi', 'Fernandes', 'Mensah', 'Kapoor', 'Silva', 'Toma', 'Nilsen', 'Moreau',
  'Banerjee', 'Halvorsen', 'Rossi', 'Dlamini', 'Vandenberg', 'Aziz', 'Eriksen', 'Ibarra',
  'Park', 'Cardoso', 'Diallo', 'Kovacs', 'Ferreira', 'Bianchi', 'Larsen', 'Yusuf', 'Menon',
  'Schulz', 'Delgado', 'Kimura', 'Adeyemi', 'Vargas', 'Cohen', 'Ashworth',
]

const REGIONS = [
  { city: 'Lagos', country: 'Nigeria' },
  { city: 'Mumbai', country: 'India' },
  { city: 'Milan', country: 'Italy' },
  { city: 'Tokyo', country: 'Japan' },
  { city: 'Beirut', country: 'Lebanon' },
  { city: 'Bogota', country: 'Colombia' },
  { city: 'Warsaw', country: 'Poland' },
  { city: 'Stockholm', country: 'Sweden' },
  { city: 'Sao Paulo', country: 'Brazil' },
  { city: 'Cairo', country: 'Egypt' },
  { city: 'Seoul', country: 'South Korea' },
  { city: 'Nairobi', country: 'Kenya' },
  { city: 'Mexico City', country: 'Mexico' },
  { city: 'Berlin', country: 'Germany' },
  { city: 'Singapore', country: 'Singapore' },
  { city: 'New York', state: 'NY', country: 'United States' },
  { city: 'San Francisco', state: 'CA', country: 'United States' },
  { city: 'Chicago', state: 'IL', country: 'United States' },
  { city: 'Boston', state: 'MA', country: 'United States' },
  { city: 'Austin', state: 'TX', country: 'United States' },
  { city: 'Toronto', state: 'ON', country: 'Canada' },
  { city: 'London', country: 'United Kingdom' },
]

const EMPLOYERS: Array<[string, string]> = [
  ['Northwind Advisory', 'Consulting'],
  ['Grayline Partners', 'Consulting'],
  ['Meridian & Co.', 'Consulting'],
  ['Ashford Capital', 'Finance'],
  ['Blue Harbor Group', 'Finance'],
  ['Kestrel Investments', 'Finance'],
  ['Lumen Systems', 'Technology'],
  ['Fathom Labs', 'Technology'],
  ['Orbital Software', 'Technology'],
  ['Vela Health', 'Healthcare'],
  ['Corvus Bio', 'Healthcare'],
  ['Terrace Foods', 'Consumer'],
  ['Halden Retail', 'Consumer'],
  ['Ironwood Energy', 'Energy'],
  ['Solstice Renewables', 'Energy'],
  ['Cadence Media', 'Media'],
  ['Redwood Nonprofit Trust', 'Social Impact'],
  ['Ministry of Finance', 'Government'],
  ['Pinnacle Real Estate', 'Real Estate'],
  ['Atlas Logistics', 'Industrials'],
]

const TITLES = [
  'Associate', 'Senior Associate', 'Engagement Manager', 'Analyst', 'Product Manager',
  'Software Engineer', 'Investment Analyst', 'Vice President', 'Founder', 'Chief of Staff',
  'Operations Lead', 'Strategy Manager', 'Research Scientist', 'Programme Officer',
]


const DIETARY = ['Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Gluten-free', 'No shellfish', 'Nut allergy']

const PROFESSIONAL_INTERESTS = [
  'Private Equity', 'Growth Equity', 'Venture Capital', 'Product Management',
  'Corporate Strategy', 'General Management', 'Impact Investing', 'Healthcare Delivery',
  'Climate Technology', 'Consumer Brands', 'Supply Chain', 'Fintech', 'Real Estate Development',
  'Entrepreneurship', 'Media & Entertainment', 'Public Policy', 'Artificial Intelligence',
]

const SCHOOLS = [
  'Universidade de Sao Paulo', 'Indian Institute of Technology Bombay', 'Politecnico di Milano',
  'University of Tokyo', 'American University of Beirut', 'Universidad de los Andes',
  'Warsaw School of Economics', 'KTH Royal Institute of Technology', 'Cairo University',
  'Seoul National University', 'University of Nairobi', 'Tecnologico de Monterrey',
  'Technical University of Munich', 'National University of Singapore', 'Cornell University',
  'University of Michigan', 'Georgia Institute of Technology', 'McGill University',
  'University of Edinburgh', 'Rice University',
]

const DEGREES = [
  'BS, Mechanical Engineering', 'BA, Economics', 'BS, Computer Science',
  'BEng, Electrical Engineering', 'BA, Political Science', 'BCom, Finance',
  'BSc, Mathematics', 'BA, History', 'BS, Industrial Engineering', 'BA, International Relations',
]

const PRONOUNS = ['she/her', 'he/him', 'they/them']

const FUN_FACTS = [
  'Once cycled the length of Japan.',
  'Can solve a Rubik’s cube one-handed.',
  'Former semi-professional goalkeeper.',
  'Has visited every continent except Antarctica.',
  'Ran a supper club for three years.',
  'Speaks five languages, badly.',
  'Built a canoe from scratch.',
  'Was an extra in a nationally televised advert.',
  'Holds a national record in competitive rowing.',
  'Once lived in a lighthouse for a summer.',
]

/** A deterministic initials avatar, so the sample set needs no image assets. */
function avatarDataUri(initials: string, hue: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stop-color="hsl(${hue} 62% 62%)"/><stop offset="100%" stop-color="hsl(${(hue + 40) % 360} 58% 44%)"/>
</linearGradient></defs>
<rect width="400" height="400" fill="url(#g)"/>
<text x="200" y="200" font-family="Georgia, serif" font-size="160" font-weight="600" fill="rgba(255,255,255,0.92)" text-anchor="middle" dominant-baseline="central">${initials}</text>
</svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`
}

const people: Person[] = []
const photos: Record<string, string> = {}
const usedIds = new Set<string>()

for (let i = 0; i < COUNT; i++) {
  const firstName = pick(FIRST_NAMES)
  const lastName = pick(LAST_NAMES)

  let id = (firstName[0] + lastName).toLowerCase().replace(/[^a-z]/g, '')
  let suffix = 2
  while (usedIds.has(id)) id = `${(firstName[0] + lastName).toLowerCase().replace(/[^a-z]/g, '')}${suffix++}`
  usedIds.add(id)

  const region = pick(REGIONS)
  const [company, industry] = pick(EMPLOYERS)

  // Gap rates are matched to the real section, so the UI is exercised against
  // the sparsity it will actually meet: 39% have no professional interests,
  // 61% no interests, 78% no HBS activities.
  const hasPhoto = chance(0.94)
  const hasSecondRole = chance(0.45)
  const hasProfessionalInterests = chance(0.68)

  const person: Person = {
    id,
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`,
    email: `${id}@${'example.invalid'}`,
    phone: chance(0.9) ? `+1 617 555 ${String(1000 + i).slice(-4)}` : undefined,
    partner: undefined,
    photoId: hasPhoto ? id : undefined,
    homeRegion: region,
    currentCity: chance(0.8) ? 'Boston, MA' : undefined,
    preMBA: [
      { company, title: pick(TITLES), location: region.city, industry, dates: 'JUL 2022 - JUN 2026' },
      ...(hasSecondRole
        ? (() => {
            const [c2, i2] = pick(EMPLOYERS)
            return [
              {
                company: c2,
                title: pick(TITLES),
                location: region.city,
                industry: i2,
                dates: 'AUG 2020 - JUN 2022',
              },
            ]
          })()
        : []),
    ],
    education: [
      { school: pick(SCHOOLS), degree: pick(DEGREES), gradDate: `${2018 + Math.floor(random() * 5)}` },
    ],
    professionalInterests: hasProfessionalInterests ? sample(PROFESSIONAL_INTERESTS, 1, 5) : [],
    birthday: { month: 1 + Math.floor(random() * 12), day: 1 + Math.floor(random() * 28) },
    startupExperience: chance(0.28),
    pronouns: chance(0.35) ? pick(PRONOUNS) : undefined,
    funFact: chance(0.5) ? pick(FUN_FACTS) : undefined,
    dietary: chance(0.3) ? sample(DIETARY, 1, 2) : undefined,
  }

  people.push(person)
  if (hasPhoto) {
    photos[id] = avatarDataUri(
      (firstName[0] + lastName[0]).toUpperCase(),
      Math.floor(random() * 360),
    )
  }
}

// Make one couple, so the allocator's partner constraint is exercised in dev.
people[3].partner = people[57].displayName
people[57].partner = people[3].displayName

const roster: Roster = {
  version: 1,
  generatedAt: new Date(Date.UTC(2026, 8, 1)).toISOString(),
  section: 'Sample Section (synthetic data)',
  people,
}

mkdirSync(dataDir, { recursive: true })
writeFileSync(path.join(dataDir, 'roster.sample.json'), JSON.stringify(roster, null, 2) + '\n')
writeFileSync(path.join(dataDir, 'photos.sample.json'), JSON.stringify(photos) + '\n')

console.log(`✓ data/roster.sample.json — ${people.length} synthetic people`)
console.log(`✓ data/photos.sample.json — ${Object.keys(photos).length} generated avatars`)
console.log('  These are fabricated. No real section member appears in this repo.')
