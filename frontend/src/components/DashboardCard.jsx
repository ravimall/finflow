import PropTypes from "prop-types";

export default function DashboardCard({ title, value, icon, color }) {
  return (
    <div
      className={`flex h-full w-full flex-col items-start justify-center rounded-xl p-4 shadow-sm transition ${color}`}
    >
      <div className="mb-2 text-2xl">{icon}</div>
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-sm opacity-80">{title}</div>
    </div>
  );
}

DashboardCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  icon: PropTypes.node,
  color: PropTypes.string,
};

DashboardCard.defaultProps = {
  icon: null,
  color: "bg-white text-gray-900",
};
