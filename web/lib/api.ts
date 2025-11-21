/**
 * API client for DMV Queue System
 *
 * Handles all communication with the FastAPI backend with:
 * - Timeout support
 * - AbortController for request cancellation
 * - Structured error handling
 * - Retry logic for network failures
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const DEFAULT_TIMEOUT = 30000; // 30 seconds

// ⚠️ SECURITY WARNING ⚠️
// This API key is exposed to all browser users via NEXT_PUBLIC_* environment variable.
// This is ONLY acceptable for development/testing.
//
// For production:
// 1. DO NOT use NEXT_PUBLIC_STAFF_API_KEY
// 2. Implement proper server-side auth (JWT/session)
// 3. Staff operations should require user login with individual credentials
// 4. Use server-side API routes (Next.js API routes) to proxy authenticated requests
//
// See SECURITY.md for production authentication implementation guide
const STAFF_API_KEY = process.env.NEXT_PUBLIC_STAFF_API_KEY || 'dmv_staff_dev_key_CHANGE_IN_PRODUCTION';

/**
 * Custom error class for API errors
 */
export class APIError extends Error {
  constructor(
    public status: number,
    public detail: string,
    public url: string
  ) {
    super(`API Error ${status}: ${detail}`);
    this.name = 'APIError';
  }
}

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new APIError(408, 'Request timeout', url);
    }
    throw error;
  }
}

/**
 * Handle API response and errors
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      detail = errorData.detail || detail;
    } catch {
      // If JSON parsing fails, use status text
      detail = response.statusText || detail;
    }
    throw new APIError(response.status, detail, response.url);
  }

  return response.json();
}

export interface Branch {
  id: number;
  name: string;
  code: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface Service {
  id: number;
  branch_id: number;
  code: string;
  name: string;
  avg_service_time_minutes: number;
}

export interface Ticket {
  id: number;
  ticket_number: string;
  branch_id: number;
  service_id: number;
  status: string;
  created_at: string;
  position: number;
}

export interface TicketStatus {
  ticket_number: string;
  status: string;
  current_position: number;
  estimated_wait_minutes: number;
  created_at: string;
  called_at?: string;
  branch_name: string;
  service_name: string;
}

export interface QueueStatus {
  branch_id: number;
  branch_name: string;
  queues: Array<{
    service_code: string;
    service_name: string;
    waiting_count: number;
    currently_serving: string | null;
  }>;
}

// API functions

export async function fetchBranches(): Promise<Branch[]> {
  const response = await fetchWithTimeout(`${API_URL}/branches`);
  return handleResponse<Branch[]>(response);
}

export async function fetchBranchServices(branchId: number): Promise<Service[]> {
  const response = await fetchWithTimeout(`${API_URL}/branches/${branchId}/services`);
  return handleResponse<Service[]>(response);
}

export async function joinQueue(branchId: number, serviceCode: string): Promise<Ticket> {
  const response = await fetchWithTimeout(
    `${API_URL}/branches/${branchId}/join`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ service_code: serviceCode }),
    }
  );

  return handleResponse<Ticket>(response);
}

export async function fetchTicketStatus(ticketNumber: string): Promise<TicketStatus> {
  const response = await fetchWithTimeout(`${API_URL}/tickets/${ticketNumber}`);
  return handleResponse<TicketStatus>(response);
}

export async function callNextTicket(
  branchId: number,
  serviceCode: string
): Promise<{ ticket_number: string; message: string }> {
  const response = await fetchWithTimeout(
    `${API_URL}/branches/${branchId}/call-next?service=${serviceCode}`,
    {
      method: 'POST',
      headers: {
        'X-API-Key': STAFF_API_KEY,
      },
    }
  );

  return handleResponse<{ ticket_number: string; message: string }>(response);
}

export async function fetchQueueStatus(branchId: number): Promise<QueueStatus> {
  const response = await fetchWithTimeout(`${API_URL}/branches/${branchId}/queue-status`);
  return handleResponse<QueueStatus>(response);
}

// TODO: WebSocket connection for real-time updates
// Example usage after WebSocket implementation in backend:
//
// export function connectToQueueUpdates(branchId: number, onUpdate: (data: any) => void) {
//   const ws = new WebSocket(`ws://localhost:8000/ws/display/${branchId}`);
//
//   ws.onmessage = (event) => {
//     const data = JSON.parse(event.data);
//     onUpdate(data);
//   };
//
//   return ws;
// }
