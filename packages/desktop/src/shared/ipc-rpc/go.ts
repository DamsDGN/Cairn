import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"

const GoUsageWindow = Schema.Struct({
  status: Schema.optional(Schema.String),
  percent: Schema.Number,
  resetsAt: Schema.optional(Schema.Number),
})

export const GoUsageSchema = Schema.Struct({
  rolling: Schema.optional(GoUsageWindow),
  weekly: Schema.optional(GoUsageWindow),
  monthly: Schema.optional(GoUsageWindow),
})

export const GoUsageRpc = Rpc.make("GoUsage", {
  success: Schema.NullOr(GoUsageSchema),
})

export const GoRpcs = RpcGroup.make(GoUsageRpc)
