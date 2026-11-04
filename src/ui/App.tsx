import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Home } from './pages/Home';
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
import { SECTIONS } from './sections';

export function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}

function Shell() {
  const { pathname } = useLocation();
  const home = pathname === '/';
  return (
    <>
      <main className={home ? 'no-tabs' : ''}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/today" element={<Today />} />
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
      {/* The home screen is its own menu, so the tab bar shows everywhere else. */}
      {!home && <TabBar pathname={pathname} />}
    </>
  );
}

function TabBar(props: { pathname: string }) {
  return (
    <nav className="tabbar">
      <NavLink to="/" end className="home-tab" aria-label="Home">
        <span aria-hidden="true">⌂</span>
        Home
      </NavLink>
      {SECTIONS.map((n) => (
        <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive || n.also.some((p) => props.pathname.startsWith(p)) ? 'active' : '')}>
          <span aria-hidden="true">{n.icon}</span>
          {n.label}
        </NavLink>
      ))}
    </nav>
  );
}
