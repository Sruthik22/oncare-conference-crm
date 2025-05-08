interface CardViewProps<T> {
  items: T[]
  renderCard: (item: T) => React.ReactNode
  onCardClick?: (item: T) => void
}

export function CardView<T>({ items, renderCard }: CardViewProps<T>) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.length === 0 ? (
        <div className="col-span-full flex flex-col items-center justify-center py-12 px-4 bg-gray-50 rounded-xl">
          <div className="text-center">
            <p className="mt-1 text-sm text-gray-500">No items found</p>
          </div>
        </div>
      ) : (
        items.map((item, index) => (
          <div key={index} className="animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
            {renderCard(item)}
          </div>
        ))
      )}
    </div>
  )
} 