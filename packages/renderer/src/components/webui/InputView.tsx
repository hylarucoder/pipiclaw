import type { Ref } from 'react'
import { Input as ShadcnInput } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'
import { i18n } from '@renderer/features/webui/utils/i18n.js'

export type InputType = 'text' | 'email' | 'password' | 'number' | 'url' | 'tel' | 'search'
export type InputSize = 'sm' | 'md' | 'lg'

export interface InputProps {
  type?: InputType
  size?: InputSize
  value?: string
  placeholder?: string
  label?: string
  error?: string
  disabled?: boolean
  required?: boolean
  name?: string
  autocomplete?: string
  min?: number
  max?: number
  step?: number
  inputRef?: Ref<HTMLInputElement>
  onInput?: (e: Event) => void
  onChange?: (e: Event) => void
  onKeyDown?: (e: KeyboardEvent) => void
  onKeyUp?: (e: KeyboardEvent) => void
  className?: string
}

export function Input({
  type = 'text',
  size = 'md',
  value = '',
  placeholder = '',
  label = '',
  error = '',
  disabled = false,
  required = false,
  name = '',
  autocomplete = '',
  min,
  max,
  step,
  inputRef,
  onInput,
  onChange,
  onKeyDown,
  onKeyUp,
  className = ''
}: InputProps): React.JSX.Element {
  const sizeClasses: Record<InputSize, string> = {
    sm: 'h-6 text-xs',
    md: 'h-7 text-sm md:text-xs/relaxed',
    lg: 'h-9 text-base'
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? (
        <label className="text-sm font-medium text-foreground">
          {label} {required ? <span className="text-destructive">{i18n('*')}</span> : null}
        </label>
      ) : null}
      <ShadcnInput
        ref={inputRef}
        type={type}
        className={cn(sizeClasses[size], error ? 'border-destructive' : '')}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        aria-invalid={Boolean(error)}
        name={name}
        autoComplete={autocomplete}
        min={min}
        max={max}
        step={step}
        onInput={(event) => {
          onInput?.(event.nativeEvent)
        }}
        onChange={(event) => {
          onChange?.(event.nativeEvent)
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event.nativeEvent)
        }}
        onKeyUp={(event) => {
          onKeyUp?.(event.nativeEvent)
        }}
      />
      {error ? <span className="text-sm text-destructive">{error}</span> : null}
    </div>
  )
}
