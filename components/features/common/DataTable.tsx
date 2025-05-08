import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
  createColumnHelper,
} from '@tanstack/react-table'
import { clsx } from 'clsx'
import { useSelection } from '@/lib/context/SelectionContext'
import { Checkbox } from '@/components/ui/checkbox'
import type { Attendee, HealthSystem, Conference } from '@/types'

type ItemType = Attendee | HealthSystem | Conference

interface DataTableProps<T extends ItemType> {
  data: T[]
  columns: ColumnDef<T>[]
  onRowClick?: (row: T) => void
}

export function DataTable<T extends ItemType>({ data, columns, onRowClick }: DataTableProps<T>) {
  const { selectedItems, toggleSelection } = useSelection()
  const columnHelper = createColumnHelper<T>()

  // Add selection column as the first column
  const selectionColumn = columnHelper.display({
    id: 'selection',
    header: () => null,
    cell: ({ row }) => {
      const isSelected = selectedItems.some(item => item.id === row.original.id)
      return (
        <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-center">
          <Checkbox
            checked={isSelected}
            onChange={() => toggleSelection(row.original)}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
        </div>
      )
    },
  })

  const table = useReactTable({
    data,
    columns: [selectionColumn, ...columns],
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={clsx(
                        "group px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                        header.id === 'selection' && "w-12 text-center"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className={clsx(
                    'group transition-colors duration-150',
                    onRowClick && 'cursor-pointer hover:bg-gray-50',
                    selectedItems.some(item => item.id === row.original.id) && 'bg-primary-50'
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={clsx(
                        "whitespace-nowrap px-6 py-4 text-sm text-gray-900",
                        cell.column.id === 'selection' && "w-12 text-center"
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.length === 0 && (
          <div className="flex h-32 items-center justify-center border-t border-gray-200 bg-white">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-900">No data available</p>
              <p className="mt-1 text-sm text-gray-500">Try adjusting your search or filter to find what you&apos;re looking for.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 