import type {
  Bookshelf,
  Notebook,
  Section,
  Page,
  User,
  UserStats,
} from '../types';
import { readApiError } from './validation';

const getHeaders = () => {
  const token = localStorage.getItem('lumina_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const api = {
  auth: {
    signup: async (data: {
      email: string;
      password: string;
      name: string;
      username?: string;
    }) => {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Signup failed'));
      return res.json();
    },
    login: async (data: { identifier: string; password: string }) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Login failed'));
      return res.json();
    },
    me: async () => {
      const res = await fetch('/api/auth/me', { headers: getHeaders() });
      if (!res.ok) throw new Error(await readApiError(res, 'Auth failed'));
      return res.json();
    },
    updateProfile: async (body: {
      name?: string;
      email?: string;
      username?: string | null;
    }) => {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(await readApiError(res, 'Profile update failed'));
      }
      return res.json() as Promise<{ token: string; user: User }>;
    },
    changePassword: async (body: {
      currentPassword: string;
      newPassword: string;
    }) => {
      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(await readApiError(res, 'Password change failed'));
      }
    },
    closeAccount: async () => {
      const res = await fetch('/api/auth/account', {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) {
        throw new Error(await readApiError(res, 'Failed to close account'));
      }
    },
  },
  user: {
    stats: async () => {
      const res = await fetch('/api/user/stats', { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to load stats');
      return res.json() as Promise<UserStats>;
    },
    backup: async () => {
      const res = await fetch('/api/user/backup', { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to create backup');
      return res.json() as Promise<Record<string, unknown>>;
    },
    importBackup: async (payload: Record<string, unknown>) => {
      const res = await fetch('/api/user/backup/import', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Import failed'));
      return res.json() as Promise<{ ok: boolean; stats?: UserStats }>;
    },
    deleteData: async () => {
      const res = await fetch('/api/user/data', {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Failed to delete data'));
    },
  },
  bookshelves: {
    list: async (): Promise<Bookshelf[]> => {
      const res = await fetch('/api/bookshelves', { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to load bookshelves');
      const rows = await res.json();
      return (rows as Array<{ id: string; name: string }>).map((r) => ({
        id: r.id,
        title: r.name,
      }));
    },
    create: async (id: string, name: string) => {
      const res = await fetch('/api/bookshelves', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ id, name }),
      });
      if (!res.ok) throw new Error('Failed to create bookshelf');
      const j = await res.json();
      return { id: j.id as string, title: j.name as string };
    },
    update: async (id: string, name: string) => {
      const res = await fetch(`/api/bookshelves/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed to rename bookshelf');
      const j = await res.json();
      return { id: j.id as string, title: j.name as string };
    },
    delete: async (id: string) => {
      const res = await fetch(`/api/bookshelves/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { detail?: string };
        throw new Error(err.detail || 'Failed to delete bookshelf');
      }
    },
  },
  notebooks: {
    list: async (archived: boolean, bookshelfId: string): Promise<Notebook[]> => {
      const params = new URLSearchParams();
      params.set('bookshelfId', bookshelfId);
      if (archived) params.set('archived', 'true');
      const res = await fetch(`/api/notebooks?${params}`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load notebooks');
      const notebooks = await res.json();
      return Promise.all(
        notebooks.map(async (nb: Record<string, unknown>) => {
          const sections = await api.sections.list(nb.id as string);
          return {
            ...nb,
            title: nb.name as string,
            sections,
            archived,
            bookshelfId: (nb.bookshelfId as string) || bookshelfId,
          } as Notebook;
        })
      );
    },
    create: async (id: string, name: string, bookshelfId: string) => {
      const res = await fetch('/api/notebooks', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ id, name, bookshelfId }),
      });
      if (!res.ok) throw new Error('Failed to create notebook');
      return res.json();
    },
    update: async (id: string, name: string) => {
      const res = await fetch(`/api/notebooks/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ name })
      });
      if (!res.ok) throw new Error('Failed to update notebook');
      return res.json();
    },
    delete: async (id: string) => {
      const res = await fetch(`/api/notebooks/${id}`, { method: 'DELETE', headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to delete notebook');
    },
    setArchive: async (id: string, archived: boolean) => {
      const res = await fetch(`/api/notebooks/${id}/archive`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ archived }),
      });
      if (!res.ok) throw new Error('Failed to update notebook');
      return res.json();
    },
  },
  sections: {
    list: async (notebookId: string): Promise<Section[]> => {
      const res = await fetch(`/api/sections/${notebookId}`, { headers: getHeaders() });
      const sections = await res.json();
      // Fetch pages for each section
      return Promise.all(
        sections.map(async (sec: { id: string; name: string }) => {
          const pages = await api.pages.list(sec.id);
          return { ...sec, title: sec.name, pages };
        })
      );
    },
    create: async (id: string, notebookId: string, name: string) => {
      const res = await fetch('/api/sections', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ id, notebookId, name })
      });
      if (!res.ok) throw new Error('Failed to create section');
      return res.json();
    },
    update: async (id: string, name: string) => {
      const res = await fetch(`/api/sections/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ name })
      });
      if (!res.ok) throw new Error('Failed to update section');
      return res.json();
    },
    delete: async (id: string) => {
      const res = await fetch(`/api/sections/${id}`, { method: 'DELETE', headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to delete section');
    }
  },
  pages: {
    list: async (sectionId: string): Promise<Page[]> => {
      const res = await fetch(`/api/pages/${sectionId}`, { headers: getHeaders() });
      return res.json();
    },
    create: async (id: string, sectionId: string, title: string, content: string) => {
      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ id, sectionId, title, content })
      });
      if (!res.ok) throw new Error('Failed to create page');
      return res.json();
    },
    update: async (id: string, title: string, content: string) => {
      const res = await fetch(`/api/pages/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ title, content })
      });
      if (!res.ok) throw new Error('Failed to update page');
      return res.json();
    },
    delete: async (id: string) => {
      const res = await fetch(`/api/pages/${id}`, { method: 'DELETE', headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to delete page');
    }
  }
};
