import PropTypes from "prop-types";

const baseTabClasses =
  "relative inline-flex items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition";

export default function CustomerTabs({ tabs, activeTab, onChange }) {
  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-screen-md gap-2 overflow-x-auto px-4 py-2">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`${baseTabClasses} ${
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span>{tab.label}</span>
              {isActive && (
                <span className="absolute inset-x-2 -bottom-1 h-0.5 rounded-full bg-blue-600" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

CustomerTabs.propTypes = {
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    })
  ).isRequired,
  activeTab: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};
