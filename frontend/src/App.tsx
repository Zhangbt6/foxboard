import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Kanban from './pages/Kanban';
import Agents from './pages/Agents';
import Workflow from './pages/Workflow';
import Activity from './pages/Activity';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/kanban" element={<Kanban />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/workflow" element={<Workflow />} />
          <Route path="/activity" element={<Activity />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
