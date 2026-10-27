export type AutomationErrorKind = 'failed' | 'uncertain' | 'needs-user' | 'stopped'

export class AutomationError extends Error {
  constructor(
    readonly kind: AutomationErrorKind,
    message: string,
  ) {
    super(message)
    this.name = 'AutomationError'
  }
}

export const failed = (msg: string) => new AutomationError('failed', msg)
export const uncertain = (msg: string) => new AutomationError('uncertain', msg)
export const needsUser = (msg: string) => new AutomationError('needs-user', msg)
export const stopped = () => new AutomationError('stopped', 'Stopped before submitting')

export function asAutomationError(err: unknown, fallback: AutomationErrorKind): AutomationError {
  if (err instanceof AutomationError) return err
  const message = err instanceof Error ? err.message.split('\n')[0] : String(err)
  return new AutomationError(fallback, message)
}
