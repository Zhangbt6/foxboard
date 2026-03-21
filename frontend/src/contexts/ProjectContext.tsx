import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  owner?: string;
}

interface ProjectContextValue {
  currentProject: Project | null;
  setCurrentProject: (p: Project | null) => void;
  projectId: string | null;
}

export const ProjectContext = createContext<ProjectContextValue>({
  currentProject: null,
  setCurrentProject: () => {},
  projectId: null,
});

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  return (
    <ProjectContext.Provider
      value={{
        currentProject,
        setCurrentProject,
        projectId: currentProject?.id ?? null,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  return useContext(ProjectContext);
}
