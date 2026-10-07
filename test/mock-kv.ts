export function createMockKv(): KVNamespace {
  const data = new Map<string, string>()
  return {
    get: async (key: string) => data.get(key) ?? null,
    put: async (key: string, value: string) => {
      data.set(key, value)
    },
    delete: async (key: string) => {
      data.delete(key)
    },
    list: async (options?: { prefix?: string }) => ({
      keys: Array.from(data.keys())
        .filter((key) => !options?.prefix || key.startsWith(options.prefix))
        .map((name) => ({ name })),
      list_complete: true,
      cursor: '',
    }),
  } as unknown as KVNamespace
}
