// Sin imports de Node: se usa también desde el middleware (Edge runtime).
export function isQa(): boolean {
  return process.env.APP_ENV === 'qa'
}
