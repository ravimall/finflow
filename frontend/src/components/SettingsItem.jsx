import { Link } from "react-router-dom";

export default function SettingsItem({ icon, label, to }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center justify-center gap-1 rounded-lg bg-gray-50 p-4 text-center shadow-sm transition hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
    >
      <div className="text-2xl" aria-hidden="true">
        {icon}
      </div>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </Link>
  );
}
