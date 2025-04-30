import { Fragment, useState } from 'react'
import { Menu, Transition } from '@headlessui/react'
import { FunnelIcon, CheckIcon } from '@heroicons/react/24/outline'

interface FilterOption {
  id: string
  name: string
}

interface FilterMenuProps {
  title: string
  options: FilterOption[]
  selectedValues: string[]
  onChange: (selectedValues: string[]) => void
}

export function FilterMenu({ title, options, selectedValues, onChange }: FilterMenuProps) {
  const toggleOption = (optionId: string) => {
    if (selectedValues.includes(optionId)) {
      onChange(selectedValues.filter(id => id !== optionId))
    } else {
      onChange([...selectedValues, optionId])
    }
  }

  return (
    <Menu as="div" className="relative inline-block text-left">
      <div>
        <Menu.Button className="flex items-center space-x-2 py-2.5 px-4 border border-gray-200 rounded-lg
                              text-sm font-medium text-gray-700 bg-white hover:bg-gray-50
                              transition-colors duration-200">
          <FunnelIcon className="h-4 w-4 text-gray-500" />
          <span>{title}</span>
          {selectedValues.length > 0 && (
            <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
              {selectedValues.length}
            </span>
          )}
        </Menu.Button>
      </div>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="p-2">
            <div className="px-3 py-2 border-b border-gray-100">
              <h3 className="text-sm font-medium text-gray-900">{title}</h3>
            </div>
            <div className="py-1 max-h-60 overflow-y-auto">
              {options.length === 0 ? (
                <div className="px-4 py-2 text-sm text-gray-500">No options available</div>
              ) : (
                options.map((option) => (
                  <Menu.Item key={option.id}>
                    {({ active }) => (
                      <button
                        onClick={() => toggleOption(option.id)}
                        className={`
                          flex items-center justify-between w-full px-4 py-2 text-sm rounded-md
                          ${active ? 'bg-primary-50 text-primary-900' : 'text-gray-700'}
                        `}
                      >
                        <span>{option.name}</span>
                        {selectedValues.includes(option.id) && (
                          <CheckIcon className="h-4 w-4 text-primary-600" />
                        )}
                      </button>
                    )}
                  </Menu.Item>
                ))
              )}
            </div>
            {selectedValues.length > 0 && (
              <div className="px-3 py-2 border-t border-gray-100">
                <button
                  onClick={() => onChange([])}
                  className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  )
} 