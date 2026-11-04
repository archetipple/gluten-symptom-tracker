import { Link } from 'react-router-dom';
import { Header } from '../components/common';
import { SECTIONS } from '../sections';

/** Start screen: one big button per section. */
export function Home() {
  return (
    <div className="page home">
      <Header
        title="Celiac Tracker"
        right={
          <Link to="/settings" className="ghost gear" aria-label="Settings">
            ⚙
          </Link>
        }
      />
      <nav className="home-grid" aria-label="Sections">
        {SECTIONS.map((s) => (
          <Link key={s.to} to={s.to} className="home-btn">
            <span className="home-icon" aria-hidden="true">
              {s.icon}
            </span>
            <span className="home-label">{s.label}</span>
            <span className="home-sub">{s.blurb}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
