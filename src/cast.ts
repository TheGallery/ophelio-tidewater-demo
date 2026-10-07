export type CastCard = {
  slug: string
  label: string
  membershipId: string
  memberId: string
  card: string
}

export async function loadCast(kv: KVNamespace | undefined): Promise<CastCard[]> {
  if (!kv) return []
  try {
    const raw = await kv.get('cast')
    if (!raw) return []
    return JSON.parse(raw) as CastCard[]
  } catch {
    return []
  }
}
