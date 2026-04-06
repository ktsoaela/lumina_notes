export interface User {
  id: number;
  email: string;
  name: string;
  username?: string | null;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
}

export interface Page {
  id: string;
  title: string;
  content: string;
  updatedAt: number | string;
}

export interface Section {
  id: string;
  title: string;
  pages: Page[];
}

export interface Notebook {
  id: string;
  title: string;
  sections: Section[];
}

export interface AppState {
  notebooks: Notebook[];
  activeNotebookId: string | null;
  activeSectionId: string | null;
  activePageId: string | null;
}
