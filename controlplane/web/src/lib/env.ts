const rawApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || ''
const rawMetricsUrl = (import.meta.env.VITE_METRICS_URL as string | undefined)?.trim() || ''

export const API_BASE_URL = rawApiBaseUrl.replace(/\/$/, '')
export const METRICS_URL = rawMetricsUrl || `${API_BASE_URL}/api/metrics`
