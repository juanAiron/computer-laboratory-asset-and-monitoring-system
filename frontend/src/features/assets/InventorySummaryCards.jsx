export function InventorySummaryCards({ label, cards, loading, error }) {
  return (
    <section aria-label={label} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label: cardLabel, value, detail, icon: Icon }) => (
        <article key={cardLabel} className="rounded-xl border border-palm-leaf/30 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-hunter-green">{cardLabel}</p>
              <p className="mt-2 text-2xl font-bold text-evergreen">
                {loading || error ? '—' : value}
              </p>
            </div>
            <span className="rounded-lg bg-palm-leaf/15 p-2 text-hunter-green">
              <Icon aria-hidden="true" className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-2 text-xs text-hunter-green">{detail}</p>
        </article>
      ))}
    </section>
  )
}
