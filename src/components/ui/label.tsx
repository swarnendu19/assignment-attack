import React from 'react'

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode
}

export function Label({ className = '', children, ...props }: LabelProps) {
  const classes = `text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`
  
  return (
    <label className={classes} {...props}>
      {children}
    </label>
  )
}