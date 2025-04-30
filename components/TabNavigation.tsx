import { Icon } from '@/components/Icon'
import { UserIcon, BuildingOfficeIcon, CalendarIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'

interface Tab {
  id: 'attendees' | 'health-systems' | 'conferences'
  label: string
  count: number
  icon: typeof UserIcon
}

interface TabNavigationProps {
  activeTab: 'attendees' | 'health-systems' | 'conferences'
  onTabChange: (tab: 'attendees' | 'health-systems' | 'conferences') => void
  counts: {
    attendees: number
    'health-systems': number
    conferences: number
  }
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

export function TabNavigation({ activeTab, onTabChange, counts }: TabNavigationProps) {
  const tabs: Tab[] = [
    { id: 'attendees', label: 'Attendees', count: counts.attendees, icon: UserIcon },
    { id: 'health-systems', label: 'Health Systems', count: counts['health-systems'], icon: BuildingOfficeIcon },
    { id: 'conferences', label: 'Conferences', count: counts.conferences, icon: CalendarIcon },
  ]

  return (
    <div className="w-64 shrink-0 flex flex-col overflow-y-auto border-r border-gray-200 bg-white">
      <div className="flex h-[72px] shrink-0 items-center px-6 border-b border-gray-200">
        <Image 
          src="/oncare_logo.svg" 
          alt="OnCare Logo" 
          width={24}
          height={24}
          className="h-6 w-auto"
          priority
        />
        <span className="ml-3 text-gray-900 font-semibold text-sm">Oncare CRM</span>
      </div>
      <nav className="flex flex-1 flex-col px-6 pt-4">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          <li>
            <ul role="list" className="-mx-2 space-y-1">
              {tabs.map((tab) => (
                <li key={tab.id}>
                  <button
                    onClick={() => onTabChange(tab.id)}
                    className={classNames(
                      activeTab === tab.id
                        ? 'bg-gray-50 text-indigo-600'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-indigo-600',
                      'group flex w-full gap-x-3 rounded-md p-2 text-sm/6 font-semibold'
                    )}
                  >
                    <Icon 
                      icon={tab.icon} 
                      size="sm" 
                      className={classNames(
                        activeTab === tab.id 
                          ? 'text-indigo-600' 
                          : 'text-gray-400 group-hover:text-indigo-600',
                        'size-6 shrink-0'
                      )}
                    />
                    <span className="truncate">{tab.label}</span>
                    <span
                      aria-hidden="true"
                      className="ml-auto w-9 min-w-max rounded-full bg-white px-2.5 py-0.5 text-center text-xs/5 font-medium whitespace-nowrap text-gray-600 ring-1 ring-gray-200 ring-inset"
                    >
                      {tab.count}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </li>
        </ul>
      </nav>
    </div>
  )
} 