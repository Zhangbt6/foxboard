import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Kanban from './pages/Kanban';
import Agents from './pages/Agents';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/kanban" element={<Kanban />} />
          <Route path="/agents" element={<Agents />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
