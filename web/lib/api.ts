// ============================================================
// API Client — web verze (localStorage místo AsyncStorage)
// ============================================================

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

class ApiClient {
  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('access_token');
  }

  setTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
  }

  clearTokens() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_id');
  }

  isAuthenticated(): boolean {
    return this.getToken() != null;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = this.getToken();
    const hasBody = body !== undefined && body !== null;

    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        // Content-Type jen když reálně posíláme tělo —
        // jinak Fastify hodí FST_ERR_CTP_EMPTY_JSON_BODY
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: hasBody ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && token) {
      const refreshed = await this.refresh();
      if (refreshed) return this.request(method, path, body);
      this.clearTokens();
      window.location.href = '/auth';
      throw new Error('session_expired');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'network_error' }));
      throw err;
    }

    if (res.status === 204) return {} as T;
    return res.json();
  }

  private async refresh(): Promise<boolean> {
    const rt = localStorage.getItem('refresh_token');
    if (!rt) return false;
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      this.setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    }
  }

  get<T>(path: string) { return this.request<T>('GET', path); }
  post<T>(path: string, body?: unknown) { return this.request<T>('POST', path, body); }
  patch<T>(path: string, body: unknown) { return this.request<T>('PATCH', path, body); }
  delete<T>(path: string) { return this.request<T>('DELETE', path); }

  async login(email: string, password: string) {
    const data = await this.post<{ token: string; refreshToken: string; userId: string }>('/auth/login', { email, password });
    this.setTokens(data.token, data.refreshToken);
    localStorage.setItem('user_id', data.userId);
    return data;
  }

  async register(payload: unknown) {
    const data = await this.post<{ token: string; userId: string }>('/auth/register', payload);
    this.setTokens(data.token, '');
    localStorage.setItem('user_id', data.userId);
    return data;
  }
}

export const api = new ApiClient();
