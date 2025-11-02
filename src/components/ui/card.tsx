import React from 'react'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function Card({ className = '', children, ...props }: CardProps) {
  const classes = `rounded-lg border border-gray-200 bg-white text-gray-950 shadow-sm ${className}`
  
  return (
    <div className={classes} {...props}>
      {children}
    </div>
  )
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function CardHeader({ className = '', children, ...props }: CardHeaderProps) {
  const classes = `flex flex-col space-y-1.5 p-6 ${className}`
  
  return (
    <div className={classes} {...props}>
      {children}
    </div>
  )
}

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode
}

export function CardTitle({ className = '', children, ...props }: CardTitleProps) {
  const classes = `text-2xl font-semibold leading-none tracking-tight ${className}`
  
  return (
    <h3 className={classes} {...props}>
      {children}
    </h3>
  )
}

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function CardContent({ className = '', children, ...props }: CardContentProps) {
  const classes = `p-6 pt-0 ${className}`
  
  return (
    <div className={classes} {...props}>
      {children}
    </div>
  )
}