import { Show, type JSX } from "solid-js"
import { usePlatform } from "@/runtime/platform/platform"
import { useLanguage } from "@/runtime/i18n/language"

// Frameless Linux windows have no native decoration, so the titlebar carries the caption buttons.
export function WindowControls() {
  const platform = usePlatform()
  const language = useLanguage()

  const maximized = () => platform.windowMaximized?.() ?? false

  return (
    <div data-slot="window-controls" class="flex h-full shrink-0 items-center gap-0.5 pe-2 [app-region:no-drag]">
      <WindowControlButton label={language.t("desktop.menu.minimize")} onClick={() => void platform.windowMinimize?.()}>
        <path d="M3 8h10" />
      </WindowControlButton>
      <WindowControlButton
        label={maximized() ? language.t("desktop.menu.restore") : language.t("desktop.menu.maximize")}
        onClick={() => void platform.windowToggleMaximize?.()}
      >
        <Show when={maximized()} fallback={<rect x="3.5" y="3.5" width="9" height="9" rx="1.25" />}>
          <rect x="3.5" y="5.5" width="7" height="7" rx="1.25" />
          <path d="M5.5 5.5V3.5h7v7h-2" />
        </Show>
      </WindowControlButton>
      <WindowControlButton
        label={language.t("desktop.menu.closeWindow")}
        onClick={() => void platform.windowClose?.()}
        danger
      >
        <path d="M4 4l8 8M12 4l-8 8" />
      </WindowControlButton>
    </div>
  )
}

function WindowControlButton(props: { label: string; onClick: () => void; danger?: boolean; children: JSX.Element }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
      class="flex size-7 items-center justify-center rounded-[6px] text-v2-icon-icon-muted transition-colors duration-75 focus-visible:outline-none"
      classList={{
        "hover:bg-v2-background-bg-layer-02 hover:text-v2-text-text-base focus-visible:bg-v2-background-bg-layer-02":
          !props.danger,
        "hover:bg-v2-state-bg-danger hover:text-v2-state-fg-danger focus-visible:bg-v2-state-bg-danger": !!props.danger,
      }}
    >
      <svg
        viewBox="0 0 16 16"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        stroke-width="1.25"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        {props.children}
      </svg>
    </button>
  )
}
