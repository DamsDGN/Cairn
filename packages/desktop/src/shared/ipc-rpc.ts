import { RpcClient, RpcClientError } from "effect/rpc"
import { AppRpcs } from "./ipc-rpc/app"
import { AssistantRpcs } from "./ipc-rpc/assistant"
import { EventRpcs } from "./ipc-rpc/events"
import { ExtensionRpcs } from "./ipc-rpc/extensions"
import { FileRpcs } from "./ipc-rpc/files"
import { GoRpcs } from "./ipc-rpc/go"
import { MenuRpcs } from "./ipc-rpc/menu"
import { StorageRpcs } from "./ipc-rpc/storage"
import { WindowRpcs } from "./ipc-rpc/window"

export { AppRpcs } from "./ipc-rpc/app"

export { AssistantRpcs } from "./ipc-rpc/assistant"

export { EventRpcs } from "./ipc-rpc/events"

export { ExtensionRpcs } from "./ipc-rpc/extensions"

export { FileRpcs } from "./ipc-rpc/files"

export { MenuRpcs } from "./ipc-rpc/menu"

export { StorageRpcs } from "./ipc-rpc/storage"

export { WindowRpcs } from "./ipc-rpc/window"

export { GoRpcs } from "./ipc-rpc/go"

export const DesktopRpcs = AppRpcs.merge(
  StorageRpcs,
  FileRpcs,
  WindowRpcs,
  MenuRpcs,
  EventRpcs,
  ExtensionRpcs,
  GoRpcs,
  AssistantRpcs,
)

export type DesktopRpcClient = RpcClient.FromGroup<typeof DesktopRpcs, RpcClientError.RpcClientError>
