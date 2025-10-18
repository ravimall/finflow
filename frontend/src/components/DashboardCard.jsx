import PropTypes from "prop-types";

export default function DashboardCard({ title, children, loading }) {
  return (
    <div className="h-full w-full rounded-xl bg-white p-4 shadow-sm transition-all duration-200 hover:scale-[1.01] hover:shadow-md">
      <h2 className="text-sm font-semibold text-gray-600">{title}</h2>
      <div className="mt-2 text-sm text-gray-500">
        {loading ? <p className="text-xs text-gray-400">Loading...</p> : children}
      </div>
    </div>
  );
}

DashboardCard.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node,
  loading: PropTypes.bool,
};

DashboardCard.defaultProps = {
  children: null,
  loading: false,
};
