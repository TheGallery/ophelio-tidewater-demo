const given = [
  'Morgan',
  'Riley',
  'Casey',
  'Quinn',
  'Avery',
  'Skyler',
  'Dakota',
  'Reese',
  'Rowan',
  'Sawyer',
  'Hayden',
  'Emerson',
  'Finley',
  'River',
  'Jules',
  'Taylor',
  'Cameron',
  'Alex',
  'Jordan',
  'Kai',
  'Sage',
  'Parker',
  'Bailey',
  'Drew',
]

const surnames = [
  'Harding',
  'Marlin',
  'Pierce',
  'Cove',
  'Sands',
  'Drift',
  'Kelpwick',
  'Tide',
  'Salter',
  'Whelan',
  'Brynn',
  'Noland',
  'Curren',
  'Fisher',
  'Reed',
  'Marsh',
  'Dune',
  'Spruce',
  'Cedar',
  'Pine',
  'Harbor',
  'Bay',
  'Shoal',
  'Crest',
]

export type Person = { name: string; role: 'adult' | 'child' }

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

export function makeFamily(maxPartySize: number): Person[] {
  const surname = pick(surnames)
  const firstNames = [...given].sort(() => Math.random() - 0.5)
  const size = Math.max(1, maxPartySize)
  const adults = Math.min(2, size)
  const children = Math.min(Math.floor(Math.random() * 3), size - adults)
  const roles: Person['role'][] = [
    ...Array<Person['role']>(adults).fill('adult'),
    ...Array<Person['role']>(children).fill('child'),
  ]
  return roles.map((role, index) => ({ name: `${firstNames[index]} ${surname}`, role }))
}

export function isMadeUpName(name: string): boolean {
  const [first, last, ...rest] = name.split(' ')
  return rest.length === 0 && given.includes(first) && surnames.includes(last)
}

export function fitsPlan(people: Person[], maxPartySize: number): boolean {
  return (
    people.length >= 1 &&
    people.length <= maxPartySize &&
    people[0].role === 'adult' &&
    (maxPartySize > 1 || people.every((person) => person.role === 'adult')) &&
    people.every((person) => isMadeUpName(person.name))
  )
}

export function makeEmail(): string {
  const local = `${pick(given).toLowerCase()}.${pick(surnames).toLowerCase()}.${crypto.randomUUID().slice(0, 8)}`
  return `${local}@example.com`
}
