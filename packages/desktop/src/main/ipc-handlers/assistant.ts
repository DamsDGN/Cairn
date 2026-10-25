import { Effect } from "effect"
import { AssistantRpcs } from "../../shared/ipc-rpc"
import { readAssistantMcpServers, writeAssistantMcpServer } from "../assistant-config"

export const assistantHandlers = AssistantRpcs.toLayer(
  AssistantRpcs.of({
    AssistantMcpAdd: ({ server, config }) => Effect.sync(() => writeAssistantMcpServer(server, config)),
    AssistantMcpRemove: ({ server }) => Effect.sync(() => writeAssistantMcpServer(server, null)),
    AssistantMcpList: () => Effect.sync(() => ({ servers: readAssistantMcpServers() })),
  }),
)
