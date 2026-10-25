import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"

export const McpServerConfigSchema = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("remote"),
    url: Schema.String,
    headers: Schema.optional(Schema.Record(Schema.String, Schema.String)),
    disabled: Schema.optional(Schema.Boolean),
  }),
  Schema.Struct({
    type: Schema.Literal("local"),
    command: Schema.Array(Schema.String),
    environment: Schema.optional(Schema.Record(Schema.String, Schema.String)),
    disabled: Schema.optional(Schema.Boolean),
  }),
])

export type McpServerConfig = typeof McpServerConfigSchema.Type

export const AssistantConfigResultSchema = Schema.Struct({
  ok: Schema.Boolean,
  path: Schema.optional(Schema.String),
  error: Schema.optional(Schema.Literals(["not-ready", "invalid-config", "not-found", "unknown"])),
})

export type AssistantConfigResult = typeof AssistantConfigResultSchema.Type

export const AssistantMcpAdd = Rpc.make("AssistantMcpAdd", {
  payload: { server: Schema.String, config: McpServerConfigSchema },
  success: AssistantConfigResultSchema,
})

export const AssistantMcpRemove = Rpc.make("AssistantMcpRemove", {
  payload: { server: Schema.String },
  success: AssistantConfigResultSchema,
})

export const AssistantMcpList = Rpc.make("AssistantMcpList", {
  success: Schema.Struct({ servers: Schema.Array(Schema.String) }),
})

export const AssistantProviderSave = Rpc.make("AssistantProviderSave", {
  payload: {
    id: Schema.String,
    name: Schema.String,
    baseURL: Schema.String,
    apiKey: Schema.optional(Schema.String),
    headers: Schema.optional(Schema.Record(Schema.String, Schema.String)),
    models: Schema.Array(Schema.Struct({ id: Schema.String, name: Schema.String })),
  },
  success: AssistantConfigResultSchema,
})

export type AssistantProviderInput = {
  id: string
  name: string
  baseURL: string
  apiKey?: string
  headers?: Record<string, string>
  models: Array<{ id: string; name: string }>
}

export const AssistantDefaultModel = Rpc.make("AssistantDefaultModel", {
  success: Schema.Struct({ model: Schema.optional(Schema.String) }),
})

export const AssistantDefaultModelSet = Rpc.make("AssistantDefaultModelSet", {
  payload: { model: Schema.NullOr(Schema.String) },
  success: AssistantConfigResultSchema,
})

export const AssistantRpcs = RpcGroup.make(
  AssistantMcpAdd,
  AssistantMcpRemove,
  AssistantMcpList,
  AssistantProviderSave,
  AssistantDefaultModel,
  AssistantDefaultModelSet,
)
