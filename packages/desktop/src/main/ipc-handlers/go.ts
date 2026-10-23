import { Effect } from "effect"
import { GoRpcs } from "../../shared/ipc-rpc"
import { fetchGoUsage } from "../subscription"

export const goHandlers = GoRpcs.toLayer(
  Effect.gen(function* () {
    return GoRpcs.of({
      GoUsage: () => Effect.promise(() => fetchGoUsage()),
    })
  }),
)
