import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Today } from './pages/Today';
import { FoodLog } from './pages/FoodLog';
import { MealEdit } from './pages/MealEdit';
import { MyFoods } from './pages/MyFoods';
import { SymptomsPage } from './pages/Symptoms';
import { BowelEdit, SymptomEdit } from './pages/SymptomEdit';
import { PatternsPage } from './pages/Patterns';
import { PlaceEdit, PlacesPage } from './pages/Places';
import { MedsPage } from './pages/Meds';
import { SettingsPage } from './pages/SettingsPage';

const NAV = [
  { to: '/', label: 'Today', icon: '◉', also: ['/settings', '/meds'] },
  { to: '/food', label: 'Food', icon: '◈', also: ['/meal', '/foods'] },
  { to: '/symptoms', label: 'Symptoms', icon: '✚', also: ['/symptom', '/bowel'] },
  { to: '/patterns', label: 'Patterns', icon: '▤' },
  { to: '/places', label: 'Places', icon: '⌂' },
];

export function App() {
  return (
    <HashRouter>
      <main>
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/food" element={<FoodLog />} />
          <Route path="/meal/:id" element={<MealEdit />} />
          <Route path="/foods" element={<MyFoods />} />
          <Route path="/symptoms" element={<SymptomsPage />} />
          <Route path="/symptom/:id" element={<SymptomEdit />} />
          <Route path="/bowel/:id" element={<BowelEdit />} />
          <Route path="/patterns" element={<PatternsPage />} />
          <Route path="/places" element={<PlacesPage />} />
          <Route path="/places/:id" element={<PlaceEdit />} />
          <Route path="/meds" element={<MedsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      <TabBar />
    </HashRouter>
  );
}

function TabBar() {
  const { pathname } = useLocation();
  return (
    <nav className="tabbar">
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.to === '/'}
          className={({ isActive }) => (isActive || n.also?.some((p) => pathname.startsWith(p)) ? 'active' : '')}
        >
          <span aria-hidden="true">{n.icon}</span>
          {n.label}
        </NavLink>
      ))}
    </nav>
  );
}
