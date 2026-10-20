/**
 * Back/next button row for booking steps. On phones it sticks to the bottom
 * of the screen so the next action is always reachable without scrolling.
 */
export default function StepActions({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="
        sticky bottom-0 z-10 flex gap-3 mt-6 -mx-5 -mb-5 px-5 rounded-b-3xl pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]
        bg-white/95 backdrop-blur border-t-2 border-ink/10
        md:static md:m-0 md:mt-8 md:rounded-none md:px-0 md:pt-0 md:pb-0 md:bg-transparent md:backdrop-blur-none md:border-0
      "
    >
      {children}
    </div>
  )
}
