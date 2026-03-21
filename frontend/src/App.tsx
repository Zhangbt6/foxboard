import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProjectProvider } from './contexts/ProjectContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Kanban from './pages/Kanban';
import Agents from './pages/Agents';
import Workflow from './pages/Workflow';
import Activity from './pages/Activity';
import MyTasks from './pages/MyTasks';
import Office from './pages/Office';
import Projects from './pages/Projects';

function App() {
  return (
    <ProjectProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/kanban" element={<Kanban />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/workflow" element={<Workflow />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/my-tasks" element={<MyTasks />} />
            <Route path="/office" element={<Office />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ProjectProvider>
  );
}

export default App;
