import { For, type JSX } from "solid-js"
import { Badge } from "@opencode/ui/badge"
import { Button } from "@opencode/ui/button"
import { Loader } from "@opencode/ui/loader"
import { TextInput } from "@opencode/ui/text-input"

const swatches = [
  { name: "bg-base", token: "--v2-background-bg-base" },
  { name: "bg-deep", token: "--v2-background-bg-deep" },
  { name: "layer-01", token: "--v2-background-bg-layer-01" },
  { name: "border-base", token: "--v2-border-border-base" },
  { name: "text-muted", token: "--v2-text-text-muted" },
  { name: "text-base", token: "--v2-text-text-base" },
  { name: "accent", token: "--v2-background-bg-accent" },
  { name: "accent-text", token: "--v2-text-text-accent" },
  { name: "user-message", token: "--cairn-user-message-bg" },
]

const Section = (props: { title: string; description?: string; children: JSX.Element }) => (
  <section class="flex flex-col gap-4 border-t border-v2-border-border-base py-8 first:border-t-0">
    <div class="flex flex-col gap-1">
      <h2 class="text-[13px] font-[600] tracking-[0.08em] text-v2-text-text-faint uppercase">{props.title}</h2>
      {props.description ? <p class="text-[13px] text-v2-text-text-muted">{props.description}</p> : null}
    </div>
    {props.children}
  </section>
)

export default {
  title: "Cairn/Design System",
  id: "cairn-design-system",
  parameters: { layout: "fullscreen" },
}

export const Overview = {
  render: () => (
    <div class="min-h-dvh bg-v2-background-bg-base px-10 py-12 text-v2-text-text-base">
      <div class="mx-auto flex max-w-[880px] flex-col">
        <header class="flex items-center gap-4 pb-8">
          <img src="/assets/logo-cairn.svg" alt="Cairn" class="size-14 rounded-[12px]" />
          <div class="flex flex-col">
            <span class="font-(family-name:--cairn-font-serif) text-[32px] leading-none tracking-[-0.02em]">Cairn</span>
            <span class="pt-1 text-[13px] text-v2-text-text-muted">
              Design system, palette chaleureuse et typographie de lecture.
            </span>
          </div>
        </header>

        <Section title="Palette" description="Rôles sémantiques v2 et surfaces de marque.">
          <div class="grid grid-cols-3 gap-3">
            <For each={swatches}>
              {(swatch) => (
                <div class="flex flex-col overflow-hidden rounded-[10px] border border-v2-border-border-base">
                  <div class="h-16" style={{ background: `var(${swatch.token})` }} />
                  <div class="flex flex-col gap-0.5 bg-v2-background-bg-base px-3 py-2">
                    <span class="text-[12px] font-[530]">{swatch.name}</span>
                    <span class="font-mono text-[11px] text-v2-text-text-faint">{swatch.token}</span>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Section>

        <Section title="Typographie" description="Serif pour la lecture, sans pour l'interface, mono pour le code.">
          <div class="flex flex-col gap-6">
            <p class="cairn-prose text-v2-text-text-base">
              Un cairn est un empilement de pierres qui guide sans contraindre. L'assistant suit la même idée : des
              repères clairs, une conversation au centre, et assez de silence autour pour penser.
            </p>
            <p class="max-w-[68ch] text-[13px] leading-[1.6] text-v2-text-text-muted">
              Texte d'interface en sans-serif. Les libellés secondaires restent lisibles, sans concurrencer la
              conversation.
            </p>
            <code class="w-fit rounded-[6px] bg-v2-background-bg-layer-01 px-2 py-1 font-mono text-[12px]">
              bun run test:unit
            </code>
          </div>
        </Section>

        <Section title="Contrôles">
          <div class="flex flex-col gap-6">
            <div class="flex flex-wrap items-center gap-2">
              <Button variant="contrast">Action principale</Button>
              <Button variant="neutral">Neutre</Button>
              <Button variant="outline">Contour</Button>
              <Button variant="ghost">Discret</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="contrast" disabled>
                Désactivé
              </Button>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <Button size="small" variant="neutral">
                Small
              </Button>
              <Button size="normal" variant="neutral">
                Normal
              </Button>
              <Button size="large" variant="neutral">
                Large
              </Button>
            </div>
            <div class="grid max-w-[420px] gap-3">
              <TextInput placeholder="Posez votre question" />
              <TextInput appearance="large" placeholder="Champ large" value="Valeur saisie" />
              <TextInput invalid placeholder="Champ invalide" />
            </div>
          </div>
        </Section>

        <Section title="États">
          <div class="flex flex-wrap items-center gap-3">
            <Badge variant="neutral">Neutre</Badge>
            <Badge variant="accent">Accent</Badge>
            <Badge variant="subtle">Subtil</Badge>
            <span class="inline-flex items-center gap-2 text-[13px] text-v2-text-text-muted">
              <Loader />
              Réflexion en cours
            </span>
          </div>
        </Section>

        <Section title="Conversation" description="Fond utilisateur distinct, réponse en serif, code discret.">
          <div class="flex flex-col gap-5">
            <div class="ml-auto max-w-[80%] rounded-[14px] px-4 py-2.5 text-[14px] leading-[1.55] cairn-user-message">
              Peux-tu m'expliquer la différence entre un volume et un bind mount ?
            </div>
            <div class="flex flex-col gap-3">
              <p class="cairn-prose">
                Un volume est géré par Docker, stocké hors du système de fichiers de l'hôte. Un bind mount pointe
                directement vers un chemin de l'hôte, ce qui le rend pratique en développement.
              </p>
              <pre class="w-full max-w-[560px] overflow-x-auto rounded-[10px] bg-v2-background-bg-layer-01 p-3 font-mono text-[12px] leading-[1.6]">
                <code>docker run -v cairn-data:/data cairn:latest</code>
              </pre>
            </div>
          </div>
        </Section>
      </div>
    </div>
  ),
}
