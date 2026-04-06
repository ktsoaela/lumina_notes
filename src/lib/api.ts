import { Notebook, Section, Page, User } from '../types';

const getHeaders = () => {
  const token = localStorage.getItem('lumina_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const api = {
  auth: {
    signup: async (data: any) => {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Signup failed');
      return res.json();
    },
    login: async (data: any) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Login failed');
      return res.json();
    },
    me: async () => {
      const res = await fetch('/api/auth/me', { headers: getHeaders() });
      if (!res.ok) throw new Error('Auth failed');
      return res.json();
    }
  },
  notebooks: {
    list: async (): Promise<Notebook[]> => {
      const res = await fetch('/api/notebooks', { headers: getHeaders() });
      const notebooks = await res.json();
      // Fetch sections for each notebook
      return Promise.all(notebooks.map(async (nb: any) => {
        const sections = await api.sections.list(nb.id);
        return { ...nb, title: nb.name, sections };
      }));
    },
    create: async (id: string, name: string) => {
      const res = await fetch('/api/notebooks', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ id, name })
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
    }
  },
  sections: {
    list: async (notebookId: string): Promise<Section[]> => {
      const res = await fetch(`/api/sections/${notebookId}`, { headers: getHeaders() });
      const sections = await res.json();
      // Fetch pages for each section
      return Promise.all(sections.map(async (sec: any) => {
        const pages = await api.pages.list(sec.id);
        return { ...sec, title: sec.name, pages };
      }));
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
