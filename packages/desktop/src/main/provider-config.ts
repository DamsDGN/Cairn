type Document = Record<string, unknown>

// The OpenAI-compatible provider shape the server reads from configuration. `settings` is an open
// record, so the base URL and any extra option the user typed live there.
export const OPENAI_COMPATIBLE_PACKAGE = "@ai-sdk/openai-compatible"

export function applyProvider(
  document: Document,
  input: {
    id: string
    name: string
    baseURL: string
    headers?: Record<string, string>
    models: ReadonlyArray<{ id: string; name: string }>
  },
): void {
  const providers = record(document.providers) ?? {}
  const existing = record(providers[input.id]) ?? {}
  const settings = record(existing.settings) ?? {}

  settings.baseURL = input.baseURL

  const models = record(existing.models) ?? {}
  for (const model of input.models) models[model.id] = { ...(record(models[model.id]) ?? {}), name: model.name }

  providers[input.id] = {
    ...existing,
    name: input.name,
    package: typeof existing.package === "string" ? existing.package : OPENAI_COMPATIBLE_PACKAGE,
    settings,
    models,
    ...(input.headers && Object.keys(input.headers).length > 0 ? { headers: input.headers } : {}),
  }
  document.providers = providers
}

// `model` at the top level is what the server uses when neither the session nor the agent names one.
export function applyDefaultModel(document: Document, model: string | null): void {
  if (model) document.model = model
  else delete document.model
}

function record(value: unknown): Document | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined

  return value as Document
}
