import React from 'react';

interface IconProps {
  icon: React.ElementType;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6'
};

export function Icon({ icon: IconComponent, size = 'md', className = '' }: IconProps) {
  const sizeClass = sizeClasses[size];
  
  return (
    <span className="icon-container">
      <IconComponent className={`${sizeClass} ${className}`} width={24} height={24} aria-hidden="true" />
    </span>
  );
} 