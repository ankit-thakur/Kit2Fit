import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'Dashboard', emoji: '\u{1F4CA}' },
  { to: '/log', label: 'Log', emoji: '\u{1F4DD}' },
  { to: '/profile', label: 'Profile', emoji: '\u{1F464}' },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-kit-light bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
      <div className="mx-auto flex max-w-lg justify-around">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2 text-sm font-medium ${
                isActive ? 'text-kit' : 'text-gray-400'
              }`
            }
          >
            <span className="text-xl">{tab.emoji}</span>
            {tab.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
