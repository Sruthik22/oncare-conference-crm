import * as React from 'react'
import { cn } from '@/lib/utils'

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        type="checkbox"
        ref={ref}
        className={cn(
          'h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500',
          className
        )}
        {...props}
      />
    )
  }
)

Checkbox.displayName = 'Checkbox' 