export function setAccessToken(token: string): void {
    if (typeof window === 'undefined') {
        return;
    }

    localStorage.setItem('accessToken', token);
}

export function getAccessToken(): string | null {
    if (typeof window === 'undefined') {
        return null;
    }

    return localStorage.getItem('accessToken');
}

export function clearAccessToken(): void {
    if (typeof window === 'undefined') {
        return;
    }

    localStorage.removeItem('accessToken');
}

export function isAuthenticated(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    const accessToken = getAccessToken();
    return accessToken !== null && accessToken !== undefined && accessToken !== '';
}