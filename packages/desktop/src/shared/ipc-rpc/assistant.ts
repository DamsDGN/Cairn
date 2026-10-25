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

export const AssistantRpcs = RpcGroup.make(AssistantMcpAdd, AssistantMcpRemove, AssistantMcpList)
