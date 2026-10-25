import "./wordmark.css"

export function NewSessionWordmark() {
  return (
    <div
      data-component="new-session-wordmark"
      aria-hidden="true"
      class="pointer-events-none mx-auto w-full max-w-[720px]"
    >
      <div data-slot="wordmark-reveal" class="mx-auto grid w-4/5 place-items-center">
        <CairnLockup class="col-start-1 row-start-1 opacity-[0.16]" />
        <CairnLockup class="wordmark-shimmer col-start-1 row-start-1" />
      </div>
    </div>
  )
}

function CairnLockup(props: { class: string }) {
  return (
    <div data-slot="wordmark-lockup" dir="ltr" class={`flex items-center gap-[0.18em] ${props.class}`}>
      <svg data-slot="wordmark-mark" viewBox="56 72 144 148" fill="currentColor">
        <ellipse cx="128" cy="184" rx="66" ry="28" />
        <ellipse cx="128" cy="136" rx="48" ry="23" fill-opacity="0.72" />
        <ellipse cx="128" cy="96" rx="31" ry="18" fill-opacity="0.45" />
      </svg>
      <span
        data-slot="wordmark-text"
        class="font-(family-name:--cairn-font-serif) leading-none font-[600] tracking-[-0.02em]"
      >
        Cairn
      </span>
    </div>
  )
}
